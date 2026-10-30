import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RoomState, TrackInfo } from '../types';
import { SoundcloudWaveform } from './SoundcloudWaveform';
import { QRCodeModal } from './QRCodeModal';
import { AlbumSummaryModal } from './AlbumSummaryModal';
import { formatTime, generateSimulatedWaveform } from '../utils/waveformExtractor';
import { demoSynth } from '../utils/audioSynthesizer';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  QrCode,
  Users,
  Flame,
  BarChart2,
  Trash2,
  Radio,
  Music,
  Zap,
  Trophy,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface HostDashboardProps {
  room: RoomState;
  onSyncPlayback: (isPlaying: boolean, currentTime: number, trackId: string) => void;
  onUpdateTracks: (tracks: TrackInfo[], albumTitle?: string, artistName?: string, currentTrackId?: string) => void;
  onResetTaps: (trackId?: string) => void;
  onOpenAudienceView: () => void;
  onImportSession?: (taps: any[]) => void;
  onToggleVoting?: (active: boolean) => void;
  onResetVotes?: () => void;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  room,
  onSyncPlayback,
  onUpdateTracks,
  onResetTaps,
  onOpenAudienceView,
  onImportSession,
  onToggleVoting,
  onResetVotes,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [audioSourceType, setAudioSourceType] = useState<'file' | 'synth'>('synth');

  // Permanent HTML5 Audio Element for custom uploads and static /songs/... files
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack: TrackInfo =
    room.tracks.find((t) => t.id === room.currentTrackId) || room.tracks[0] || {
      id: 'default',
      title: 'Kein Track geladen',
      duration: 180,
    };

  const trackIndex = Math.max(
    0,
    room.tracks.findIndex((t) => t.id === currentTrack.id)
  );

  // Filter taps belonging to the current track
  const currentTrackTaps = useMemo(() => {
    return room.taps.filter((t) => t.trackId === currentTrack.id);
  }, [room.taps, currentTrack.id]);

  // Compute waveform peaks (use stored, or generate high quality default)
  const currentPeaks = useMemo(() => {
    if (currentTrack.waveformPeaks && currentTrack.waveformPeaks.length > 0) {
      return currentTrack.waveformPeaks;
    }
    return generateSimulatedWaveform(trackIndex, 120);
  }, [currentTrack, trackIndex]);

  // REAL-TIME AGGREGATION FOR 20+ PEOPLE TAPPING SIMULTANEOUSLY:
  // 1. Taps per second calculation (rolling 3-second window)
  const [tapsPerSecond, setTapsPerSecond] = useState(0);
  useEffect(() => {
    const calcRate = () => {
      const now = Date.now();
      const recentWindowTaps = currentTrackTaps.filter(
        (t) => now - t.clientCreatedAt <= 3000
      ).length;
      setTapsPerSecond(Math.round((recentWindowTaps / 3) * 10) / 10);
    };

    calcRate();
    const interval = setInterval(calcRate, 500);
    return () => clearInterval(interval);
  }, [currentTrackTaps]);

  // 2. Intelligent Live Feed Aggregation:
  // Group taps occurring within 2.5 seconds of each other so 20 taps don't flood the UI
  const aggregatedLiveFeed = useMemo(() => {
    if (currentTrackTaps.length === 0) return [];

    const reversed = [...currentTrackTaps].reverse();
    const groups: Array<{
      id: string;
      timestamp: number;
      timeAgoStr: string;
      totalTaps: number;
      userNames: string[];
      latestAt: number;
    }> = [];

    reversed.forEach((tap) => {
      // Find an existing group within 2.5 seconds timestamp
      const existing = groups.find(
        (g) => Math.abs(g.timestamp - tap.timestamp) <= 2.5
      );

      if (existing) {
        existing.totalTaps += 1;
        if (!existing.userNames.includes(tap.userNickname)) {
          existing.userNames.push(tap.userNickname);
        }
      } else {
        const secondsAgo = Math.max(0, Math.round((Date.now() - tap.clientCreatedAt) / 1000));
        groups.push({
          id: tap.id,
          timestamp: tap.timestamp,
          timeAgoStr: secondsAgo < 5 ? 'gerade eben' : `vor ${secondsAgo}s`,
          totalTaps: 1,
          userNames: [tap.userNickname],
          latestAt: tap.clientCreatedAt,
        });
      }
    });

    return groups.slice(0, 10);
  }, [currentTrackTaps]);

  // 3. Top Hype Hotspots (Erkennt Hotspots bereits ab 2 Taps)
  const topHypeSegments = useMemo(() => {
    if (currentTrackTaps.length === 0) return [];
    const windowSize = 6; // seconds
    const segments: Array<{
      start: number;
      end: number;
      count: number;
    }> = [];

    for (let s = 0; s < currentTrack.duration; s += 2) {
      const tapsInSec = currentTrackTaps.filter(
        (t) => t.timestamp >= s && t.timestamp < s + windowSize
      );
      if (tapsInSec.length >= 2) {
        segments.push({
          start: s,
          end: Math.min(s + windowSize, currentTrack.duration),
          count: tapsInSec.length,
        });
      }
    }

    segments.sort((a, b) => b.count - a.count);
    const uniqueSegments: typeof segments = [];
    segments.forEach((seg) => {
      const hasOverlap = uniqueSegments.some(
        (u) => Math.abs(u.start - seg.start) < windowSize
      );
      if (!hasOverlap && uniqueSegments.length < 4) {
        uniqueSegments.push(seg);
      }
    });

    return uniqueSegments;
  }, [currentTrackTaps, currentTrack.duration]);

  // Handle Audio Playback with bulletproof fallback
  const handlePlay = () => {
    setIsPlaying(true);

    const audioEl = audioElementRef.current;
    if (audioEl && currentTrack.audioUrl) {
      audioEl.currentTime = currentTime;
      audioEl
        .play()
        .then(() => {
          setAudioSourceType('file');
        })
        .catch((err) => {
          console.warn('Audio element play failed (falling back to synth):', err);
          setAudioSourceType('synth');
          demoSynth.play(
            trackIndex,
            currentTime,
            (sec) => setCurrentTime(sec),
            () => handleNextTrack()
          );
        });
    } else {
      setAudioSourceType('synth');
      demoSynth.play(
        trackIndex,
        currentTime,
        (sec) => setCurrentTime(sec),
        () => handleNextTrack()
      );
    }

    onSyncPlayback(true, currentTime, currentTrack.id);
  };

  const handlePause = () => {
    setIsPlaying(false);

    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    demoSynth.pause();

    onSyncPlayback(false, currentTime, currentTrack.id);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(newTime, currentTrack.duration));
    setCurrentTime(clamped);

    if (audioElementRef.current && audioSourceType === 'file') {
      audioElementRef.current.currentTime = clamped;
    } else {
      demoSynth.seek(clamped);
    }

    onSyncPlayback(isPlaying, clamped, currentTrack.id);
  };

  const handleSkip = (seconds: number) => {
    handleSeek(currentTime + seconds);
  };

  const handleSelectTrack = (trackId: string) => {
    if (trackId === currentTrack.id) return;
    const wasPlaying = isPlaying;
    handlePause();
    setCurrentTime(0);

    onSyncPlayback(false, 0, trackId);

    if (wasPlaying) {
      setTimeout(() => {
        setIsPlaying(true);
        const nextTrack = room.tracks.find((t) => t.id === trackId);
        if (nextTrack?.audioUrl && audioElementRef.current) {
          audioElementRef.current.currentTime = 0;
          audioElementRef.current
            .play()
            .then(() => setAudioSourceType('file'))
            .catch(() => {
              setAudioSourceType('synth');
              const nextIdx = room.tracks.findIndex((t) => t.id === trackId);
              demoSynth.play(Math.max(0, nextIdx), 0, (sec) => setCurrentTime(sec), () => handleNextTrack());
            });
        } else {
          setAudioSourceType('synth');
          const nextIdx = room.tracks.findIndex((t) => t.id === trackId);
          demoSynth.play(Math.max(0, nextIdx), 0, (sec) => setCurrentTime(sec), () => handleNextTrack());
        }
        onSyncPlayback(true, 0, trackId);
      }, 150);
    }
  };

  const handleNextTrack = () => {
    if (trackIndex < room.tracks.length - 1) {
      handleSelectTrack(room.tracks[trackIndex + 1].id);
    }
  };

  const handlePrevTrack = () => {
    if (currentTime > 3) {
      handleSeek(0);
    } else if (trackIndex > 0) {
      handleSelectTrack(room.tracks[trackIndex - 1].id);
    } else {
      handleSeek(0);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioElementRef.current) {
      audioElementRef.current.volume = newVol;
    }
    demoSynth.setVolume(newVol);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      handleVolumeChange(volume || 0.85);
    } else {
      setIsMuted(true);
      if (audioElementRef.current) audioElementRef.current.volume = 0;
      demoSynth.setVolume(0);
    }
  };



  // Trigger celebration when milestone hit
  const lastCelebratedMilestone = useRef(0);
  useEffect(() => {
    const count = currentTrackTaps.length;
    if (count > 0 && count % 20 === 0 && count !== lastCelebratedMilestone.current) {
      lastCelebratedMilestone.current = count;
      confetti({
        particleCount: 50,
        spread: 90,
        origin: { y: 0.4 },
      });
    }
  }, [currentTrackTaps.length]);

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100 flex flex-col">
      {/* Permanent Native Audio Element with loaded metadata & timeupdate listeners */}
      <audio
        ref={audioElementRef}
        src={currentTrack.audioUrl || undefined}
        onTimeUpdate={() => {
          if (audioElementRef.current && audioSourceType === 'file') {
            setCurrentTime(audioElementRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioElementRef.current && audioElementRef.current.duration) {
            // Update track duration to real duration if different
            currentTrack.duration = Math.round(audioElementRef.current.duration);
          }
        }}
        onEnded={handleNextTrack}
        preload="auto"
      />

      {/* TOP BAR CONTRACT */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-md shadow-orange-600/30">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white whitespace-nowrap">
              VibePulse Studio
            </span>
            <span className="text-[10px] text-orange-400 font-semibold tracking-wider uppercase block -mt-1">
              Host Listening Dashboard
            </span>
          </div>
        </div>

        {/* Live Metrics Strip */}
        <div className="hidden md:flex items-center gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
            <Users className="w-4 h-4 text-orange-400" />
            <span>
              <strong className="text-white font-mono">{room.activeUsers || 0}</strong> Hörer im Raum
            </span>
          </div>

          {/* Live Heat Intensity Meter (Crucial when 20 people tap simultaneously!) */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all ${
            tapsPerSecond >= 8
              ? 'bg-red-600/20 border-red-500 text-red-300 animate-pulse'
              : tapsPerSecond >= 3
              ? 'bg-orange-600/20 border-orange-500 text-orange-300'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}>
            <Zap className="w-4 h-4 text-amber-400" />
            <span>
              <strong className="font-mono font-bold">{tapsPerSecond}</strong> Taps/s
              {tapsPerSecond >= 8 && <span className="ml-1 font-bold">· SAAL KOCHT! 🔥</span>}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* FAVORITEN-VOTING BUTTON */}
          <button
            onClick={() => {
              const nextState = !room.isVotingActive;
              onToggleVoting?.(nextState);
              if (nextState) {
                confetti({
                  particleCount: 50,
                  spread: 60,
                  origin: { y: 0.1 },
                  colors: ['#f59e0b', '#f97316', '#ef4444'],
                });
              }
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shadow-lg ${
              room.isVotingActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 animate-pulse'
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-110 text-white shadow-orange-500/20'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>
              {room.isVotingActive
                ? `🟢 Voting aktiv (${room.votes?.length || 0} Stimmen) – Beenden`
                : '🏆 Favoriten-Voting öffnen'}
            </span>
          </button>

          <button
            onClick={() => setIsQrModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <QrCode className="w-4 h-4 text-orange-400" />
            <span>QR-Code</span>
          </button>

          <button
            onClick={() => setIsSummaryModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <BarChart2 className="w-4 h-4 text-orange-400" />
            <span>Auswertung</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Player, Waveform, Hotspots (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* LIVE VOTING BANNER FOR HOST */}
          {room.isVotingActive && (
            <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-emerald-500/15 border border-orange-500/40 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                    <h3 className="font-bold text-sm text-white">Favoriten-Voting ist geöffnet!</h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Die Gäste wählen auf ihren Handys ihre Top-3 Songs. Bisherige Stimmen: <strong className="text-orange-400 font-mono font-bold">{room.votes?.length || 0}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsSummaryModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300"
                >
                  Live-Ergebnisse
                </button>
                <button
                  onClick={() => onToggleVoting?.(false)}
                  className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white"
                >
                  Voting schließen
                </button>
              </div>
            </div>
          )}

          {/* PLAYER CARD */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold uppercase tracking-wider mb-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping inline-block"></span>
                  <span>Track {trackIndex + 1} von {room.tracks.length}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">{room.albumTitle}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  {currentTrack.title}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>{currentTrack.artist || 'Künstler'} · Dauer: {formatTime(currentTrack.duration)}</span>
                  <span className="text-slate-600">·</span>
                  <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                    audioSourceType === 'file'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {audioSourceType === 'file' ? 'Audiodatei aktiv' : 'Synth-Modus'}
                  </span>
                </div>
              </div>

              {/* Current track hype counter */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-right shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Taps auf diesem Track
                </span>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-2xl font-black font-mono text-white">
                    {currentTrackTaps.length}
                  </span>
                </div>
              </div>
            </div>

            {/* SOUNDCLOUD WAVEFORM */}
            <div className="my-5">
              <SoundcloudWaveform
                peaks={currentPeaks}
                duration={currentTrack.duration}
                currentTime={currentTime}
                taps={currentTrackTaps}
                onSeek={handleSeek}
                isPlaying={isPlaying}
              />
            </div>

            {/* CONTROLS */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevTrack}
                  title="Vorheriger Song"
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={() => handleSkip(-10)}
                  title="-10 Sekunden"
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-mono"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>10s</span>
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white flex items-center justify-center shadow-xl shadow-orange-600/30 transition-transform active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 fill-white" />
                  ) : (
                    <Play className="w-7 h-7 fill-white translate-x-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleSkip(10)}
                  title="+10 Sekunden"
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-mono"
                >
                  <span>10s</span>
                  <RotateCw className="w-4 h-4" />
                </button>

                <button
                  onClick={handleNextTrack}
                  title="Nächster Song"
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Master Volume */}
              <div className="flex items-center gap-2.5 text-slate-400">
                <button
                  onClick={handleToggleMute}
                  className="p-2 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-red-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-24 accent-orange-500 cursor-pointer"
                />
              </div>

              {/* Reset Track Taps */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm(`Alle Taps für "${currentTrack.title}" zurücksetzen?`)) {
                      onResetTaps(currentTrack.id);
                    }
                  }}
                  title="Taps für diesen Track leeren"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-red-500/50 text-slate-400 hover:text-red-400 text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Track leeren</span>
                </button>
              </div>
            </div>
          </div>

          {/* HOTTEST STELLEN CLUSTER */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                  <Flame className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Hottest Stellen im aktuellen Song
                  </h3>
                  <p className="text-xs text-slate-400">
                    Die am häufigsten gedrückten Momente (z. B. Drops oder Hooks)
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-orange-400 font-bold">
                {topHypeSegments.length} Hotspots
              </span>
            </div>

            {topHypeSegments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topHypeSegments.map((segment, idx) => (
                  <div
                    key={`segment-${idx}`}
                    className="p-3.5 bg-slate-950/70 border border-slate-800/80 hover:border-orange-500/50 rounded-2xl transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-orange-400 font-mono">
                          #{idx + 1} Hitzepol
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold font-mono text-[11px]">
                          🔥 {segment.count} Taps
                        </span>
                      </div>
                      <p className="text-base font-extrabold text-white font-mono">
                        {formatTime(segment.start)} – {formatTime(segment.end)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSeek(segment.start)}
                      className="mt-3 w-full py-1.5 px-3 rounded-lg bg-orange-500/10 hover:bg-orange-500 text-orange-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Stelle abspielen</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                <p>Noch keine Hotspots in diesem Song erfasst.</p>
                <p className="text-slate-500 mt-1">
                  Sobald deine Gäste auf den Knopf drücken, werden die heißesten Stellen hier live gebündelt!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Tracklist & Intelligent Aggregated Live Feed (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* TRACKLIST */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold text-white">Album Trackliste</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {room.tracks.length} Songs
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {room.tracks.map((track, idx) => {
                const isCurrent = track.id === currentTrack.id;
                const trackTapsCount = room.taps.filter((t) => t.trackId === track.id).length;

                return (
                  <div
                    key={track.id}
                    onClick={() => handleSelectTrack(track.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isCurrent
                        ? 'bg-orange-500/15 border-orange-500/60 shadow-md shadow-orange-500/10'
                        : 'bg-slate-950/50 border-slate-800/70 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className={`w-5 text-center font-mono text-xs font-bold ${
                        isCurrent ? 'text-orange-400' : 'text-slate-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <h4 className={`text-xs font-bold truncate ${
                          isCurrent ? 'text-white' : 'text-slate-300'
                        }`}>
                          {track.title}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-500">
                          {formatTime(track.duration)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {trackTapsCount > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                          <Flame className="w-3 h-3 text-orange-400" />
                          <span>{trackTapsCount}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">0 Taps</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AGGREGATED LIVE FEED (Designed for 20+ simultaneous guests!) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Live Saal-Reaktionen</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Gebündelt</span>
            </div>

            {aggregatedLiveFeed.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {aggregatedLiveFeed.map((group) => {
                  const isCrowdSurge = group.totalTaps >= 4;
                  return (
                    <div
                      key={group.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isCrowdSurge
                          ? 'bg-gradient-to-r from-orange-600/20 to-red-600/10 border-orange-500/40'
                          : 'bg-slate-950/60 border-slate-800/70'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {isCrowdSurge ? (
                            <span className="font-bold text-orange-400 flex items-center gap-1">
                              <Flame className="w-3.5 h-3.5 text-red-500" />
                              {group.totalTaps}x gedrückt ({group.timeAgoStr})
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-200">
                              {group.userNames[0]} ({group.timeAgoStr})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {group.userNames.slice(0, 3).join(', ')}
                          {group.userNames.length > 3 && ` + ${group.userNames.length - 3} weitere`}
                        </p>
                      </div>

                      <button
                        onClick={() => handleSeek(group.timestamp)}
                        title="Zu dieser Stelle springen"
                        className="text-orange-400 font-mono text-[11px] font-bold px-2 py-1 rounded bg-orange-500/10 hover:bg-orange-500 hover:text-white transition-colors shrink-0"
                      >
                        {formatTime(group.timestamp)}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                <p>Warte auf Klicks der Gäste...</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Wenn 20 Leute gleichzeitig drücken, werden die Taps automatisch übersichtlich zusammengefasst.
                </p>
              </div>
            )}
          </div>

          {/* TEST BANNER */}
          <div className="bg-gradient-to-r from-orange-600/10 to-amber-500/10 border border-orange-500/30 rounded-3xl p-5 shadow-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-1">
              Handy-Knopf selbst testen
            </h4>
            <p className="text-xs text-slate-300 mb-3">
              Öffne die Handy-Ansicht auf diesem Gerät oder teste den reinen Knopf.
            </p>
            <button
              onClick={onOpenAudienceView}
              className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Handy-Knopf öffnen</span>
            </button>
          </div>
        </div>
      </main>

      {/* QR MODAL */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        albumTitle={room.albumTitle}
        artistName={room.artistName}
        roomId={room.roomId}
        onOpenAudienceView={onOpenAudienceView}
      />

      {/* SUMMARY MODAL */}
      <AlbumSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        room={room}
        onSelectTrack={handleSelectTrack}
        onImportSession={onImportSession}
      />
    </div>
  );
};
