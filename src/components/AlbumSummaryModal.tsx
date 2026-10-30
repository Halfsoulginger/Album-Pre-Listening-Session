import React, { useState, useRef } from 'react';
import { RoomState, TrackInfo, TapEvent } from '../types';
import { formatTime } from '../utils/waveformExtractor';
import { X, Award, Flame, Download, BarChart3, Clock, TrendingUp, Upload, Trophy, Heart } from 'lucide-react';

interface AlbumSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomState;
  onSelectTrack: (trackId: string) => void;
  onImportSession?: (taps: TapEvent[]) => void;
}

export const AlbumSummaryModal: React.FC<AlbumSummaryModalProps> = ({
  isOpen,
  onClose,
  room,
  onSelectTrack,
  onImportSession,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'taps' | 'votes'>('taps');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.taps)) {
          onImportSession?.(parsed.taps);
        } else if (Array.isArray(parsed)) {
          onImportSession?.(parsed);
        }
      } catch (err) {
        console.error('Ungültige JSON-Datei', err);
      }
    };
    reader.readAsText(file);
  };

  // Aggregate stats per track
  const trackStats = room.tracks.map((track) => {
    const trackTaps = room.taps.filter((t) => t.trackId === track.id);
    const totalTaps = trackTaps.length;

    // Count favorite votes for this track
    const totalVotes = (room.votes || []).filter((v) => v.trackIds.includes(track.id)).length;

    // Find hottest 10-second window
    let bestWindowStart = 0;
    let maxWindowTaps = 0;
    const windowSize = 10; // seconds

    for (let s = 0; s < track.duration; s += 2) {
      const tapsInWindow = trackTaps.filter(
        (t) => t.timestamp >= s && t.timestamp < s + windowSize
      ).length;
      if (tapsInWindow > maxWindowTaps) {
        maxWindowTaps = tapsInWindow;
        bestWindowStart = s;
      }
    }

    // Top categories
    const categories: Record<string, number> = {};
    trackTaps.forEach((t) => {
      categories[t.category] = (categories[t.category] || 0) + 1;
    });

    return {
      track,
      totalTaps,
      totalVotes,
      hottestSecond: bestWindowStart,
      hottestTapsCount: maxWindowTaps,
      categories,
    };
  });

  // Sort by highest taps
  const sortedByTaps = [...trackStats].sort((a, b) => b.totalTaps - a.totalTaps);
  // Sort by highest votes
  const sortedByVotes = [...trackStats].sort((a, b) => b.totalVotes - a.totalVotes);

  const totalAlbumTaps = room.taps.length;
  const totalVotesCount = room.votes?.length || 0;

  const exportCSV = () => {
    const headers = ['Typ', 'Track_Titel', 'Zeitstempel_Sekunden', 'Zeitstempel_Formatiert', 'Kategorie', 'Gast', 'Erstellt_Am'];
    
    // Tap rows
    const tapRows = room.taps.map((t) => {
      const track = room.tracks.find((tr) => tr.id === t.trackId);
      return [
        'TAP',
        `"${track?.title || 'Unbekannt'}"`,
        t.timestamp,
        `"${formatTime(t.timestamp)}"`,
        `"${t.category}"`,
        `"${t.userNickname}"`,
        `"${new Date(t.clientCreatedAt).toLocaleTimeString()}"`,
      ].join(',');
    });

    // Vote rows
    const voteRows = (room.votes || []).flatMap((v) =>
      v.trackIds.map((tId) => {
        const track = room.tracks.find((tr) => tr.id === tId);
        return [
          'FAVORITEN_VOTE',
          `"${track?.title || tId}"`,
          '',
          '',
          'Top3',
          `"${v.nickname}"`,
          `"${new Date(v.submittedAt).toLocaleTimeString()}"`,
        ].join(',');
      })
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...tapRows, ...voteRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Album_Auswertung_${room.roomId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(room, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Album_Auswertung_${room.roomId}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Album Gesamtauswertung</h2>
              <p className="text-xs text-slate-400">
                {totalAlbumTaps} Live-Reaktionen &amp; {totalVotesCount} Favoriten-Stimmen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-4 p-1 bg-slate-950 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('taps')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'taps'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Live-Taps &amp; Hitzepole ({totalAlbumTaps})</span>
          </button>

          <button
            onClick={() => setActiveTab('votes')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'votes'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Finale Favoriten-Wahl ({totalVotesCount})</span>
          </button>
        </div>

        {/* ==================================================================== */}
        {/* TAB 1: LIVE TAPS */}
        {/* ==================================================================== */}
        {activeTab === 'taps' && (
          <div className="space-y-4 mt-4">
            {/* Top Winner Card */}
            {sortedByTaps.length > 0 && sortedByTaps[0].totalTaps > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-orange-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-full bg-amber-500 text-slate-950 shadow-md">
                    <Award className="w-6 h-6" />
                  </span>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      Live-Hype Sieger #1
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {sortedByTaps[0].track.title}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Hotteste Stelle:{' '}
                      <strong className="text-orange-400 font-mono">
                        {formatTime(sortedByTaps[0].hottestSecond)}
                      </strong>{' '}
                      ({sortedByTaps[0].hottestTapsCount} Taps im Drop)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-white">
                    {sortedByTaps[0].totalTaps}
                  </span>
                  <span className="text-xs text-slate-400 block">Gesamt-Taps</span>
                </div>
              </div>
            )}

            {/* Ranking List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                Songs nach Live-Taps gerankt:
              </h4>

              {sortedByTaps.map((item, index) => {
                const percentage = totalAlbumTaps > 0
                  ? Math.round((item.totalTaps / totalAlbumTaps) * 100)
                  : 0;

                return (
                  <div
                    key={item.track.id}
                    onClick={() => {
                      onSelectTrack(item.track.id);
                      onClose();
                    }}
                    className="p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs ${
                        index === 0
                          ? 'bg-amber-500 text-slate-950'
                          : index === 1
                          ? 'bg-slate-300 text-slate-950'
                          : index === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        #{index + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100 group-hover:text-white">
                          {item.track.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="font-mono">{formatTime(item.track.duration)}</span>
                          <span>·</span>
                          {item.totalTaps > 0 ? (
                            <span className="text-orange-300 flex items-center gap-1 font-mono">
                              <Flame className="w-3 h-3 text-orange-400 inline" /> Peak bei {formatTime(item.hottestSecond)}
                            </span>
                          ) : (
                            <span className="text-slate-500">Noch keine Taps</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-base font-bold font-mono text-white">
                          {item.totalTaps}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: FINALE FAVORITEN WAHL */}
        {/* ==================================================================== */}
        {activeTab === 'votes' && (
          <div className="space-y-4 mt-4">
            {totalVotesCount > 0 && sortedByVotes.length > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-yellow-500/15 border border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-full bg-amber-500 text-slate-950 shadow-md">
                    <Trophy className="w-6 h-6" />
                  </span>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      Offizieller Favoriten-Gewinner
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {sortedByVotes[0].track.title}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Von <strong className="text-amber-400 font-mono">{sortedByVotes[0].totalVotes}</strong> Gästen in die persönlichen Top-3 gewählt!
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-amber-400">
                    {sortedByVotes[0].totalVotes}
                  </span>
                  <span className="text-xs text-slate-400 block">Stimmen</span>
                </div>
              </div>
            )}

            {totalVotesCount === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl space-y-2">
                <Trophy className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">Noch keine Stimmen abgegeben</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Klicke oben im Host-Dashboard auf <strong>„🏆 Favoriten-Voting öffnen“</strong>, damit deine Gäste auf ihren Smartphones die Top-3 Lieblingssongs auswählen können.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Rangliste nach Favoriten-Stimmen:
                </h4>

                {sortedByVotes.map((item, index) => {
                  const votePercentage = totalVotesCount > 0
                    ? Math.round((item.totalVotes / totalVotesCount) * 100)
                    : 0;

                  return (
                    <div
                      key={item.track.id}
                      className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs ${
                          index === 0
                            ? 'bg-amber-500 text-slate-950'
                            : index === 1
                            ? 'bg-slate-300 text-slate-950'
                            : index === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          #{index + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-white">
                            {item.track.title}
                          </h4>
                          <span className="text-xs text-slate-400">
                            {item.totalVotes === 1 ? '1 Gast' : `${item.totalVotes} Gäste`} haben diesen Song gewählt
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-bold font-mono text-amber-400">
                          {item.totalVotes}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block">
                          {votePercentage}% der Gäste
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Export & Import Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Exportiere die Zeitstempel oder lade eine frühere Session
          </p>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
            {onImportSession && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                title="Gespeicherte JSON-Datei laden"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Session laden</span>
              </button>
            )}
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>CSV Export</span>
            </button>
            <button
              onClick={exportJSON}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON Export</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
