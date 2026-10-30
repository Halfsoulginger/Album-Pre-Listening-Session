import React, { useState, useRef, useEffect } from 'react';
import { RoomState, TrackInfo } from '../types';
import { Users, Radio, Check, Edit2, Trophy, Heart, Sparkles, Music2, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AudienceMobileViewProps {
  room: RoomState;
  onSendTap: (category: string) => void;
  nickname: string;
  onUpdateNickname: (name: string) => void;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  personalTapCount: number;
  onSubmitVote?: (trackIds: string[]) => void;
}

export const AudienceMobileView: React.FC<AudienceMobileViewProps> = ({
  room,
  onSendTap,
  nickname,
  onUpdateNickname,
  personalTapCount,
  onSubmitVote,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(nickname);
  const lastPressTimeRef = useRef(0);

  // Voting state
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(`vibepulse_votes_${room.roomId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [hasVoted, setHasVoted] = useState<boolean>(() => {
    return localStorage.getItem(`vibepulse_voted_${room.roomId}`) === 'true';
  });
  const [voteWarning, setVoteWarning] = useState<string | null>(null);

  const currentTrack: TrackInfo | undefined =
    room.tracks.find((t) => t.id === room.currentTrackId) || room.tracks[0];

  const handlePress = (e?: React.SyntheticEvent) => {
    if (e && 'cancelable' in e && e.cancelable) {
      e.preventDefault();
    }

    // Debounce to strictly eliminate mobile touch + mouse synthetic double clicks
    const now = Date.now();
    if (now - lastPressTimeRef.current < 110) {
      return;
    }
    lastPressTimeRef.current = now;

    // Subtle tactile button depression
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 140);

    // Send single tap event cleanly
    onSendTap('fire');
  };

  const toggleTrackSelection = (trackId: string) => {
    setVoteWarning(null);
    if (selectedTrackIds.includes(trackId)) {
      setSelectedTrackIds(selectedTrackIds.filter((id) => id !== trackId));
    } else {
      if (selectedTrackIds.length >= 3) {
        setVoteWarning('Du kannst maximal 3 Lieblingssongs auswählen!');
        setTimeout(() => setVoteWarning(null), 3000);
        return;
      }
      setSelectedTrackIds([...selectedTrackIds, trackId]);
    }
  };

  const handleSubmitVotes = () => {
    if (selectedTrackIds.length === 0) return;
    onSubmitVote?.(selectedTrackIds);
    setHasVoted(true);
    localStorage.setItem(`vibepulse_votes_${room.roomId}`, JSON.stringify(selectedTrackIds));
    localStorage.setItem(`vibepulse_voted_${room.roomId}`, 'true');

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f97316', '#ef4444', '#fbbf24', '#ffffff'],
    });
  };

  const handleResetVoteLocally = () => {
    setHasVoted(false);
  };

  // If voting is open and user has not voted yet or wants to change vote
  const isVotingMode = Boolean(room.isVotingActive);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-200 flex flex-col justify-between p-5 max-w-md mx-auto select-none touch-manipulation">
      {/* Discreet Header */}
      <header className="pt-2 pb-3 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span className="font-medium tracking-wide uppercase text-[10px] text-slate-300 truncate max-w-[170px]">
            {room.albumTitle || 'Album Listening'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
          <Users className="w-3 h-3 text-slate-400" />
          <span>{room.activeUsers || 1} im Raum</span>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* CASE 1: VOTING IST AKTIV */}
      {/* ==================================================================== */}
      {isVotingMode ? (
        <div className="flex-1 flex flex-col py-4 overflow-y-auto">
          {hasVoted ? (
            /* Thank you screen after voting */
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-5 animate-in fade-in duration-300">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shadow-2xl shadow-orange-500/30">
                <Heart className="w-10 h-10 text-white fill-white animate-bounce" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">
                  Danke fürs Mitmachen! ❤️
                </h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Deine Favoriten wurden erfolgreich übertragen und fließen direkt in das Album-Ranking ein!
                </p>
              </div>

              {/* Chosen songs summary */}
              <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400 block">
                  Deine {selectedTrackIds.length} Favoriten:
                </span>
                <div className="space-y-1.5">
                  {selectedTrackIds.map((id, index) => {
                    const track = room.tracks.find((t) => t.id === id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      >
                        <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[10px] font-mono font-bold">
                          #{index + 1}
                        </span>
                        <span className="truncate font-medium">{track?.title || id}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleResetVoteLocally}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 pt-2 underline underline-offset-4"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Auswahl bearbeiten</span>
              </button>
            </div>
          ) : (
            /* Voting selection screen */
            <div className="flex-1 flex flex-col space-y-4">
              <div className="text-center pt-2 pb-1 space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-bold border border-orange-500/20">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Finale Abstimmung</span>
                </div>
                <h2 className="text-xl font-black text-white">
                  Wähle deine Favoriten
                </h2>
                <p className="text-xs text-slate-400">
                  Welche Songs haben dich am meisten gecatcht? (Bis zu 3 Songs)
                </p>
              </div>

              {/* Counter Pill */}
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="text-slate-400">Deine Auswahl:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded-full ${
                  selectedTrackIds.length === 3
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-orange-400'
                }`}>
                  {selectedTrackIds.length} von 3 gewählt
                </span>
              </div>

              {voteWarning && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-center text-xs text-red-300 font-medium animate-in fade-in">
                  {voteWarning}
                </div>
              )}

              {/* Tracks List */}
              <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                {room.tracks.map((track, index) => {
                  const isSelected = selectedTrackIds.includes(track.id);
                  const selectedIndex = selectedTrackIds.indexOf(track.id);

                  return (
                    <button
                      key={track.id}
                      onClick={() => toggleTrackSelection(track.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-orange-500/15 border-orange-500 shadow-md shadow-orange-500/10 text-white'
                          : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                          isSelected
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isSelected ? `#${selectedIndex + 1}` : `${index + 1}`}
                        </span>
                        <div className="truncate">
                          <span className="text-xs font-semibold block truncate">
                            {track.title}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {track.artist || 'TOBIJ'}
                          </span>
                        </div>
                      </div>

                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        isSelected
                          ? 'bg-orange-500 border-orange-400 text-white'
                          : 'border-slate-700 bg-slate-950 text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  onClick={handleSubmitVotes}
                  disabled={selectedTrackIds.length === 0}
                  className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl transition-all ${
                    selectedTrackIds.length > 0
                      ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white hover:brightness-110 shadow-orange-500/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {selectedTrackIds.length === 0
                      ? 'Wähle mindestens 1 Song'
                      : `Favoriten abschicken (${selectedTrackIds.length})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ==================================================================== */
        /* CASE 2: NORMALES HÖREN (REINER ORANGER KNOPF) */
        /* ==================================================================== */
        <>
          {/* Current Track Info: Quiet, unobtrusive */}
          <div className="my-3 px-4 py-3 bg-slate-900/60 border border-slate-800/60 rounded-xl flex items-center justify-between">
            <div className="truncate pr-2">
              <span className="text-[10px] text-slate-400 block font-medium">Aktueller Song:</span>
              <h2 className="text-sm font-semibold text-white truncate">
                {currentTrack?.title || 'Warten auf Start...'}
              </h2>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 shrink-0">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              <span>{room.playbackState.isPlaying ? 'Spielt' : 'Pause'}</span>
            </div>
          </div>

          {/* CENTER STAGE: REINER ORANGER KNOPF */}
          <main className="flex-1 flex flex-col items-center justify-center py-8">
            <div className="relative">
              {/* Subtle ambient outer glow */}
              <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-orange-600/30 via-red-600/20 to-amber-500/20 blur-2xl pointer-events-none" />

              <button
                onPointerDown={handlePress}
                aria-label="Knopf drücken"
                className={`relative w-64 h-64 rounded-full cursor-pointer transition-all duration-75 touch-manipulation border-4 shadow-2xl active:scale-90 flex items-center justify-center ${
                  isPressed
                    ? 'scale-90 bg-gradient-to-tr from-red-600 via-orange-600 to-amber-400 border-amber-200 shadow-[0_0_60px_rgba(249,115,22,0.9)]'
                    : 'bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 border-orange-300/80 shadow-[0_0_40px_rgba(234,88,12,0.6)] hover:brightness-105'
                }`}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Subtle inner concave dome ring for tactile depth */}
                <div
                  className={`w-48 h-48 rounded-full border border-white/20 transition-transform duration-75 ${
                    isPressed ? 'scale-95 bg-white/10' : 'bg-gradient-to-b from-white/15 to-transparent'
                  }`}
                />
              </button>
            </div>
          </main>
        </>
      )}

      {/* Discreet Footer: Quiet tap count & nickname */}
      <footer className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div>
          <span>
            Gedrückt: <strong className="text-white font-mono font-semibold">{personalTapCount}x</strong>
          </span>
        </div>

        <div>
          {isEditingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (tempName.trim()) {
                  onUpdateNickname(tempName.trim());
                }
                setIsEditingName(false);
              }}
              className="flex items-center gap-1"
            >
              <input
                type="text"
                maxLength={20}
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-white w-20 focus:outline-none focus:border-slate-500"
                autoFocus
              />
              <button
                type="submit"
                className="p-1 rounded bg-slate-800 text-white hover:bg-slate-700"
              >
                <Check className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
            >
              <span>{nickname}</span>
              <Edit2 className="w-3 h-3 opacity-60" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
