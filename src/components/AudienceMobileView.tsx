import React, { useState } from 'react';
import { RoomState, TrackInfo } from '../types';
import { Users, Radio, Check, Edit2 } from 'lucide-react';

interface AudienceMobileViewProps {
  room: RoomState;
  onSendTap: (category: string) => void;
  nickname: string;
  onUpdateNickname: (name: string) => void;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  personalTapCount: number;
}

export const AudienceMobileView: React.FC<AudienceMobileViewProps> = ({
  room,
  onSendTap,
  nickname,
  onUpdateNickname,
  personalTapCount,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(nickname);

  const currentTrack: TrackInfo | undefined =
    room.tracks.find((t) => t.id === room.currentTrackId) || room.tracks[0];

  const handlePress = (e?: React.TouchEvent | React.MouseEvent) => {
    if (e && 'touches' in e && e.cancelable) {
      e.preventDefault();
    }

    // Subtle tactile button depression (no vibration, no sound, no floating emojis)
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 140);

    // Send tap event cleanly
    onSendTap('fire');
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-200 flex flex-col justify-between p-6 max-w-md mx-auto select-none touch-manipulation">
      {/* Discreet Header */}
      <header className="pt-2 pb-3 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          <span className="font-medium tracking-wide uppercase text-[10px]">
            {room.albumTitle || 'Album Listening'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
          <Users className="w-3 h-3 text-slate-400" />
          <span>{room.activeUsers || 1} im Raum</span>
        </div>
      </header>

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

      {/* CENTER STAGE: REINER ORANGER KNOPF (Wie davor, nur komplett blank ohne Text oder Symbole) */}
      <main className="flex-1 flex flex-col items-center justify-center py-8">
        <div className="relative">
          {/* Subtle ambient outer glow */}
          <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-orange-600/30 via-red-600/20 to-amber-500/20 blur-2xl pointer-events-none" />

          <button
            onTouchStart={handlePress}
            onMouseDown={handlePress}
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
            {/* Subtle inner concave dome ring for tactile depth, completely blank with no icons or text */}
            <div
              className={`w-48 h-48 rounded-full border border-white/20 transition-transform duration-75 ${
                isPressed ? 'scale-95 bg-white/10' : 'bg-gradient-to-b from-white/15 to-transparent'
              }`}
            />
          </button>
        </div>
      </main>

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
