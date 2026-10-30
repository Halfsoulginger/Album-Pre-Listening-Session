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
  audioUrl?: string; // blob URL or synthesized identifier
  waveformPeaks?: number[]; // precomputed or decoded waveform peaks (0..1)
  isCustomUpload?: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // in seconds
  updatedAt: number; // Date.now() timestamp
}

export interface VoteSubmission {
  userId: string;
  nickname: string;
  trackIds: string[];
  submittedAt: number;
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
  isVotingActive?: boolean;
  votes?: VoteSubmission[];
}

export interface HotspotCluster {
  startSecond: number;
  endSecond: number;
  tapCount: number;
  topCategory: string;
  peakSecond: number;
}
