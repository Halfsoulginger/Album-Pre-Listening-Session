/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RoomState, TrackInfo, TapEvent } from './types';
import { HostDashboard } from './components/HostDashboard';
import { AudienceMobileView } from './components/AudienceMobileView';
import { DEFAULT_ALBUM_TRACKS, ALBUM_METADATA } from './config/albumTracks';
import { Smartphone, Monitor } from 'lucide-react';

const DEFAULT_ROOM_ID = 'listening-party';

const INITIAL_ROOM_STATE: RoomState = {
  roomId: DEFAULT_ROOM_ID,
  albumTitle: ALBUM_METADATA.albumTitle,
  artistName: ALBUM_METADATA.artistName,
  tracks: DEFAULT_ALBUM_TRACKS,
  currentTrackId: DEFAULT_ALBUM_TRACKS[0]?.id || 'track-1',
  playbackState: {
    isPlaying: false,
    currentTime: 0,
    updatedAt: Date.now(),
  },
  taps: [],
  activeUsers: 1,
};

export default function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialMode = queryParams.get('mode') === 'audience' ? 'audience' : 'host';
  const initialRoomId = queryParams.get('room') || DEFAULT_ROOM_ID;

  const [mode, setMode] = useState<'host' | 'audience'>(initialMode);
  const [roomId] = useState<string>(initialRoomId);
  const [room, setRoom] = useState<RoomState>(INITIAL_ROOM_STATE);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [personalTapCount, setPersonalTapCount] = useState<number>(0);

  // Persistent audio source map to prevent server sync from wiping blob URLs
  const audioUrlsMapRef = useRef<Map<string, string>>(new Map());

  // Initialize with default tracks audio URLs
  useEffect(() => {
    DEFAULT_ALBUM_TRACKS.forEach((t) => {
      if (t.audioUrl) {
        audioUrlsMapRef.current.set(t.id, t.audioUrl);
      }
    });
  }, []);

  // User Profile
  const [nickname, setNickname] = useState<string>(() => {
    return localStorage.getItem('vibepulse_nickname') || `Gast #${Math.floor(10 + Math.random() * 90)}`;
  });
  const [userColor] = useState<string>(() => {
    const colors = ['#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#eab308'];
    return colors[Math.floor(Math.random() * colors.length)];
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        ws.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            roomId,
            role: mode,
            nickname,
            userColor,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'INIT_STATE':
              if (data.room) {
                setRoom((prev) => ({
                  ...data.room,
                  // Retain audioUrl from persistent map or existing tracks
                  tracks: data.room.tracks.map((t: TrackInfo) => {
                    const mappedUrl = audioUrlsMapRef.current.get(t.id);
                    const existing = prev.tracks.find((pt) => pt.id === t.id);
                    const finalAudioUrl = mappedUrl || existing?.audioUrl || t.audioUrl;
                    return {
                      ...t,
                      audioUrl: finalAudioUrl,
                      waveformPeaks: existing?.waveformPeaks || t.waveformPeaks,
                    };
                  }),
                }));
              }
              break;

            case 'PLAYBACK_UPDATE':
              setRoom((prev) => ({
                ...prev,
                playbackState: data.playbackState,
                currentTrackId: data.currentTrackId || prev.currentTrackId,
              }));
              break;

            case 'NEW_TAP':
              if (data.tap) {
                setRoom((prev) => {
                  if (prev.taps.some((t) => t.id === data.tap.id)) return prev;
                  return {
                    ...prev,
                    taps: [...prev.taps, data.tap],
                  };
                });
              }
              break;

            case 'ROOM_USERS_COUNT':
              setRoom((prev) => ({
                ...prev,
                activeUsers: data.count,
              }));
              break;

            case 'TRACKS_UPDATED':
              setRoom((prev) => ({
                ...prev,
                tracks: data.tracks.map((t: TrackInfo) => {
                  const mappedUrl = audioUrlsMapRef.current.get(t.id);
                  const existing = prev.tracks.find((pt) => pt.id === t.id);
                  return {
                    ...t,
                    audioUrl: mappedUrl || existing?.audioUrl || t.audioUrl,
                    waveformPeaks: existing?.waveformPeaks || t.waveformPeaks,
                  };
                }),
                albumTitle: data.albumTitle || prev.albumTitle,
                artistName: data.artistName || prev.artistName,
                currentTrackId: data.currentTrackId || prev.currentTrackId,
              }));
              break;

            case 'TAPS_RESET':
              setRoom((prev) => ({
                ...prev,
                taps: data.remainingTaps || [],
              }));
              break;

            case 'VOTING_STATE_UPDATE':
              setRoom((prev) => ({
                ...prev,
                isVotingActive: data.isVotingActive,
                votes: data.votes || [],
              }));
              break;
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        reconnectTimeoutRef.current = window.setTimeout(() => {
          setConnectionStatus('connecting');
          connectWebSocket();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }, [roomId, mode, nickname, userColor]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  // Host sends playback sync
  const handleHostSyncPlayback = (isPlaying: boolean, currentTime: number, trackId: string) => {
    setRoom((prev) => ({
      ...prev,
      currentTrackId: trackId,
      playbackState: {
        isPlaying,
        currentTime,
        updatedAt: Date.now(),
      },
    }));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'HOST_PLAYBACK_SYNC',
          isPlaying,
          currentTime,
          currentTrackId: trackId,
        })
      );
    }
  };

  // Host updates tracklist
  const handleHostUpdateTracks = (
    tracks: TrackInfo[],
    albumTitle?: string,
    artistName?: string,
    currentTrackId?: string
  ) => {
    // Save all audioUrls to persistent map
    tracks.forEach((t) => {
      if (t.audioUrl) {
        audioUrlsMapRef.current.set(t.id, t.audioUrl);
      }
    });

    setRoom((prev) => ({
      ...prev,
      tracks,
      albumTitle: albumTitle || prev.albumTitle,
      artistName: artistName || prev.artistName,
      currentTrackId: currentTrackId || prev.currentTrackId,
    }));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'HOST_UPDATE_TRACKS',
          tracks: tracks.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            duration: t.duration,
            waveformPeaks: t.waveformPeaks,
            // Include static /songs/... audio URLs
            audioUrl: t.audioUrl?.startsWith('/') ? t.audioUrl : undefined,
          })),
          albumTitle,
          artistName,
          currentTrackId,
        })
      );
    }
  };

  // Host resets taps
  const handleHostResetTaps = (trackId?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'RESET_TAPS',
          trackId,
        })
      );
    }
    setRoom((prev) => ({
      ...prev,
      taps: trackId ? prev.taps.filter((t) => t.trackId !== trackId) : [],
    }));
  };

  // Host toggles voting mode
  const handleHostToggleVoting = (active: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'HOST_SET_VOTING',
          active,
        })
      );
    }
    setRoom((prev) => ({
      ...prev,
      isVotingActive: active,
    }));
  };

  const handleHostResetVotes = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'RESET_VOTES',
        })
      );
    }
    setRoom((prev) => ({
      ...prev,
      votes: [],
    }));
  };

  // Audience submits favorites vote
  const handleAudienceSubmitVote = (trackIds: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'SUBMIT_VOTE',
          trackIds,
        })
      );
    }
  };

  // Audience sends single vibe tap
  const handleAudienceSendTap = (category = 'fire') => {
    setPersonalTapCount((prev) => prev + 1);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'TAP_VIBE',
          category,
        })
      );
    }
  };

  const handleUpdateNickname = (newName: string) => {
    setNickname(newName);
    localStorage.setItem('vibepulse_nickname', newName);
  };

  const toggleMode = (targetMode: 'host' | 'audience') => {
    setMode(targetMode);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('mode', targetMode);
    window.history.pushState({}, '', newUrl.toString());
  };

  const handleImportSession = (importedTaps: TapEvent[]) => {
    setRoom((prev) => ({
      ...prev,
      taps: importedTaps,
    }));
  };

  return (
    <div className="min-h-screen bg-[#07080c] relative">
      {/* Floating Mode Switcher */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md">
        <button
          onClick={() => toggleMode('host')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            mode === 'host'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Host Player</span>
        </button>

        <button
          onClick={() => toggleMode('audience')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            mode === 'audience'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Handy Knopf</span>
        </button>
      </div>

      {/* Render Views persistently so audio keeps playing uninterrupted when testing Handy Knopf */}
      <div className={mode === 'host' ? 'block' : 'hidden'}>
        <HostDashboard
          room={room}
          onSyncPlayback={handleHostSyncPlayback}
          onUpdateTracks={handleHostUpdateTracks}
          onResetTaps={handleHostResetTaps}
          onOpenAudienceView={() => toggleMode('audience')}
          onImportSession={handleImportSession}
          onToggleVoting={handleHostToggleVoting}
          onResetVotes={handleHostResetVotes}
        />
      </div>

      <div className={mode === 'audience' ? 'block' : 'hidden'}>
        <AudienceMobileView
          room={room}
          onSendTap={handleAudienceSendTap}
          nickname={nickname}
          onUpdateNickname={handleUpdateNickname}
          connectionStatus={connectionStatus}
          personalTapCount={personalTapCount}
          onSubmitVote={handleAudienceSubmitVote}
        />
      </div>
    </div>
  );
}
