import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());
// Serve static assets from public folder (e.g. /public/songs)
app.use(express.static(path.resolve(process.cwd(), 'public')));

// Data interfaces
export interface TapEvent {
  id: string;
  trackId: string;
  timestamp: number; // in seconds within the track
  clientCreatedAt: number;
  category: string; // 'fire' | 'drop' | 'vocals' | 'bass' | 'lyrics' | 'vibe'
  userNickname: string;
  userColor: string;
}

export interface TrackInfo {
  id: string;
  title: string;
  artist?: string;
  duration: number; // in seconds
  audioUrl?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // in seconds
  updatedAt: number; // Date.now() timestamp
}

export interface RoomState {
  roomId: string;
  albumTitle: string;
  artistName: string;
  tracks: TrackInfo[];
  currentTrackId: string;
  playbackState: PlaybackState;
  taps: TapEvent[];
  activeUsers: number;
}

// In-memory room store
const rooms = new Map<string, RoomState>();

// Helper to get or create room
function getOrCreateRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    const defaultTrackId = 'track-1';
    const initialRoom: RoomState = {
      roomId,
      albumTitle: 'TOBIJ - Demo Master Album',
      artistName: 'TOBIJ',
      tracks: [
        {
          id: 'track-1',
          title: '01 - Waiting for the Light',
          artist: 'TOBIJ',
          duration: 205,
          audioUrl: encodeURI('/songs/TOBIJ - Waiting For The Light - Mix - V3 (Demo Master).mp3'),
        },
        {
          id: 'track-2',
          title: '02 - You Shot Me Down',
          artist: 'TOBIJ',
          duration: 215,
          audioUrl: encodeURI('/songs/TOBIJ - You Shot Me Down - Mix - V4 (Demo Master).mp3'),
        },
        {
          id: 'track-3',
          title: '03 - Mad Boy',
          artist: 'TOBIJ',
          duration: 195,
          audioUrl: encodeURI('/songs/TOBIJ - Madboy - Mix - V3 (Demo Master).mp3'),
        },
        {
          id: 'track-4',
          title: '04 - Tired Eyes',
          artist: 'TOBIJ',
          duration: 190,
          audioUrl: encodeURI('/songs/TOBIJ - Tired Eyes - Mix - V4 (Demo Master).mp3'),
        },
        {
          id: 'track-5',
          title: '05 - Stay',
          artist: 'TOBIJ',
          duration: 200,
          audioUrl: encodeURI('/songs/TOBIJ - Stay - Mix - V4 (Demo Master).mp3'),
        },
        {
          id: 'track-6',
          title: '06 - Will You Be There?',
          artist: 'TOBIJ',
          duration: 195,
          audioUrl: encodeURI('/songs/TOBIJ - Will You Be There - Mix - V3 (Demo Master).mp3'),
        },
        {
          id: 'track-7',
          title: '07 - In Love With You',
          artist: 'TOBIJ',
          duration: 210,
          audioUrl: encodeURI('/songs/TOBIJ - In Love With You - Mix - V3 (Demo Master).mp3'),
        },
        {
          id: 'track-8',
          title: '08 - Heartblood',
          artist: 'TOBIJ',
          duration: 185,
          audioUrl: encodeURI('/songs/TOBIJ - Heartblood - Mix - V4 (Demo Master).mp3'),
        },
      ],
      currentTrackId: defaultTrackId,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now(),
      },
      taps: [],
      activeUsers: 0,
    };
    rooms.set(roomId, initialRoom);
  }
  return rooms.get(roomId)!;
}

// WebSocket setup
const wss = new WebSocketServer({ server });

interface ClientSocket extends WebSocket {
  roomId?: string;
  role?: 'host' | 'audience';
  userId?: string;
  nickname?: string;
  userColor?: string;
  isAlive?: boolean;
}

// Keepalive ping/pong
const interval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const client = ws as ClientSocket;
    if (client.isAlive === false) return client.terminate();
    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

// Broadcast helper for a specific room
function broadcastToRoom(roomId: string, message: object, excludeClient?: WebSocket) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client: WebSocket) => {
    const c = client as ClientSocket;
    if (c.readyState === WebSocket.OPEN && c.roomId === roomId && c !== excludeClient) {
      c.send(payload);
    }
  });
}

function updateActiveUserCount(roomId: string) {
  let count = 0;
  wss.clients.forEach((client: WebSocket) => {
    const c = client as ClientSocket;
    if (c.readyState === WebSocket.OPEN && c.roomId === roomId) {
      count++;
    }
  });
  const room = rooms.get(roomId);
  if (room) {
    room.activeUsers = count;
  }
  broadcastToRoom(roomId, {
    type: 'ROOM_USERS_COUNT',
    roomId,
    count,
  });
}

wss.on('connection', (ws: WebSocket) => {
  const client = ws as ClientSocket;
  client.isAlive = true;

  client.on('pong', () => {
    client.isAlive = true;
  });

  client.on('message', (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'JOIN_ROOM': {
          const roomId = (msg.roomId || 'main').trim().toLowerCase();
          client.roomId = roomId;
          client.role = msg.role || 'audience';
          client.userId = msg.userId || `user-${Math.random().toString(36).substring(2, 9)}`;
          client.nickname = msg.nickname || 'Gast';
          client.userColor = msg.userColor || '#f97316';

          const room = getOrCreateRoom(roomId);

          // Calculate current estimated playback time if playing
          let currentPlaybackTime = room.playbackState.currentTime;
          if (room.playbackState.isPlaying) {
            const elapsed = (Date.now() - room.playbackState.updatedAt) / 1000;
            currentPlaybackTime = Math.min(
              currentPlaybackTime + elapsed,
              room.tracks.find((t) => t.id === room.currentTrackId)?.duration || 300
            );
          }

          // Send current room state to newly joined client
          client.send(
            JSON.stringify({
              type: 'INIT_STATE',
              room: {
                ...room,
                playbackState: {
                  ...room.playbackState,
                  currentTime: currentPlaybackTime,
                },
              },
            })
          );

          updateActiveUserCount(roomId);
          break;
        }

        case 'HOST_PLAYBACK_SYNC': {
          if (!client.roomId) return;
          const room = getOrCreateRoom(client.roomId);
          if (client.role !== 'host') return;

          room.playbackState = {
            isPlaying: Boolean(msg.isPlaying),
            currentTime: typeof msg.currentTime === 'number' ? msg.currentTime : room.playbackState.currentTime,
            updatedAt: Date.now(),
          };

          if (msg.currentTrackId && room.tracks.some((t) => t.id === msg.currentTrackId)) {
            room.currentTrackId = msg.currentTrackId;
          }

          // Broadcast playback update to everyone in room
          broadcastToRoom(
            client.roomId,
            {
              type: 'PLAYBACK_UPDATE',
              playbackState: room.playbackState,
              currentTrackId: room.currentTrackId,
            },
            client
          );
          break;
        }

        case 'HOST_UPDATE_TRACKS': {
          if (!client.roomId || client.role !== 'host') return;
          const room = getOrCreateRoom(client.roomId);
          if (Array.isArray(msg.tracks) && msg.tracks.length > 0) {
            room.tracks = msg.tracks;
          }
          if (msg.albumTitle) room.albumTitle = msg.albumTitle;
          if (msg.artistName) room.artistName = msg.artistName;
          if (msg.currentTrackId) room.currentTrackId = msg.currentTrackId;

          broadcastToRoom(client.roomId, {
            type: 'TRACKS_UPDATED',
            tracks: room.tracks,
            albumTitle: room.albumTitle,
            artistName: room.artistName,
            currentTrackId: room.currentTrackId,
          });
          break;
        }

        case 'TAP_VIBE': {
          if (!client.roomId) return;
          const room = getOrCreateRoom(client.roomId);

          // Calculate precise song timestamp
          let calculatedTimestamp = 0;
          if (room.playbackState.isPlaying) {
            const elapsed = (Date.now() - room.playbackState.updatedAt) / 1000;
            calculatedTimestamp = room.playbackState.currentTime + elapsed;
          } else {
            calculatedTimestamp = room.playbackState.currentTime;
          }

          // Ensure non-negative and bound within current track duration
          const currentTrack = room.tracks.find((t) => t.id === room.currentTrackId);
          if (currentTrack && currentTrack.duration > 0) {
            calculatedTimestamp = Math.min(Math.max(0, calculatedTimestamp), currentTrack.duration);
          } else {
            calculatedTimestamp = Math.max(0, calculatedTimestamp);
          }

          // Format timestamp to 1 decimal place (tenths of a second)
          calculatedTimestamp = Math.round(calculatedTimestamp * 10) / 10;

          const tap: TapEvent = {
            id: `tap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            trackId: room.currentTrackId,
            timestamp: calculatedTimestamp,
            clientCreatedAt: Date.now(),
            category: msg.category || 'fire',
            userNickname: client.nickname || 'Gast',
            userColor: client.userColor || '#f97316',
          };

          room.taps.push(tap);

          // Broadcast to all clients in the room (including host & sender)
          broadcastToRoom(client.roomId, {
            type: 'NEW_TAP',
            tap,
            trackId: room.currentTrackId,
            totalTaps: room.taps.filter((t) => t.trackId === room.currentTrackId).length,
          });
          break;
        }

        case 'RESET_TAPS': {
          if (!client.roomId || client.role !== 'host') return;
          const room = getOrCreateRoom(client.roomId);
          if (msg.trackId) {
            room.taps = room.taps.filter((t) => t.trackId !== msg.trackId);
          } else {
            room.taps = [];
          }

          broadcastToRoom(client.roomId, {
            type: 'TAPS_RESET',
            trackId: msg.trackId,
            remainingTaps: room.taps,
          });
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  client.on('close', () => {
    if (client.roomId) {
      updateActiveUserCount(client.roomId);
    }
  });
});

// REST API
app.get('/api/room/:roomId', (req: Request, res: Response) => {
  const roomId = (req.params.roomId || 'main').trim().toLowerCase();
  const room = getOrCreateRoom(roomId);
  res.json(room);
});

app.post('/api/room/:roomId/reset', (req: Request, res: Response) => {
  const roomId = (req.params.roomId || 'main').trim().toLowerCase();
  const room = getOrCreateRoom(roomId);
  const trackId = req.body?.trackId;
  if (trackId) {
    room.taps = room.taps.filter((t) => t.trackId !== trackId);
  } else {
    room.taps = [];
  }
  broadcastToRoom(roomId, {
    type: 'TAPS_RESET',
    trackId,
    remainingTaps: room.taps,
  });
  res.json({ success: true, count: room.taps.length });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/download-zip', (_req: Request, res: Response) => {
  const filePath = path.resolve(process.cwd(), 'public/Album-Pre-Listening-Session.zip');
  res.download(filePath, 'Album-Pre-Listening-Session.zip');
});

// Dev server with Vite middleware vs Production
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`VibePulse Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
