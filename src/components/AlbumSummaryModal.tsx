import React from 'react';
import { RoomState, TrackInfo, TapEvent } from '../types';
import { formatTime } from '../utils/waveformExtractor';
import { X, Award, Flame, Download, BarChart3, Clock, TrendingUp } from 'lucide-react';

interface AlbumSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomState;
  onSelectTrack: (trackId: string) => void;
}

export const AlbumSummaryModal: React.FC<AlbumSummaryModalProps> = ({
  isOpen,
  onClose,
  room,
  onSelectTrack,
}) => {
  if (!isOpen) return null;

  // Aggregate stats per track
  const trackStats = room.tracks.map((track) => {
    const trackTaps = room.taps.filter((t) => t.trackId === track.id);
    const totalTaps = trackTaps.length;

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
      hottestSecond: bestWindowStart,
      hottestTapsCount: maxWindowTaps,
      categories,
    };
  });

  // Sort by highest taps
  const sortedStats = [...trackStats].sort((a, b) => b.totalTaps - a.totalTaps);
  const totalAlbumTaps = room.taps.length;

  const exportCSV = () => {
    const headers = ['Track_Titel', 'Zeitstempel_Sekunden', 'Zeitstempel_Formatiert', 'Kategorie', 'Gast', 'Erstellt_Am'];
    const rows = room.taps.map((t) => {
      const track = room.tracks.find((tr) => tr.id === t.trackId);
      return [
        `"${track?.title || 'Unbekannt'}"`,
        t.timestamp,
        `"${formatTime(t.timestamp)}"`,
        `"${t.category}"`,
        `"${t.userNickname}"`,
        `"${new Date(t.clientCreatedAt).toLocaleTimeString()}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Album_Feedback_${room.roomId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(room, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Album_Feedback_${room.roomId}_${Date.now()}.json`);
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
                {totalAlbumTaps} Gesamte Reaktionen für "{room.albumTitle}"
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

        {/* Top Winner Card */}
        {sortedStats.length > 0 && sortedStats[0].totalTaps > 0 && (
          <div className="my-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-orange-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-full bg-amber-500 text-slate-950 shadow-md">
                <Award className="w-6 h-6" />
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Publikumsliebling #1
                </span>
                <h3 className="text-base font-bold text-white">
                  {sortedStats[0].track.title}
                </h3>
                <p className="text-xs text-slate-300">
                  Hotteste Stelle:{' '}
                  <strong className="text-orange-400 font-mono">
                    {formatTime(sortedStats[0].hottestSecond)}
                  </strong>{' '}
                  ({sortedStats[0].hottestTapsCount} Taps im Drop)
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-orange-400">
                {sortedStats[0].totalTaps}
              </span>
              <span className="text-[10px] block text-slate-400 uppercase">Taps</span>
            </div>
          </div>
        )}

        {/* Tracks Ranking List */}
        <div className="space-y-3 mt-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Song-Ranking & Spitzenmomente
          </h3>
          {sortedStats.map((item, index) => {
            const percentage = totalAlbumTaps > 0 ? Math.round((item.totalTaps / totalAlbumTaps) * 100) : 0;
            return (
              <div
                key={item.track.id}
                onClick={() => {
                  onSelectTrack(item.track.id);
                  onClose();
                }}
                className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between hover:border-orange-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-mono font-bold text-slate-500 group-hover:text-orange-400">
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

        {/* Export Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Exportiere die Zeitstempel für Logic, Ableton oder dein Team
          </p>
          <div className="flex items-center gap-2">
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
