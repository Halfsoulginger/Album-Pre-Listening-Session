import React, { useRef, useState, useMemo } from 'react';
import { TapEvent } from '../types';
import { formatTime } from '../utils/waveformExtractor';
import { Flame } from 'lucide-react';

interface SoundcloudWaveformProps {
  peaks: number[];
  duration: number;
  currentTime: number;
  taps: TapEvent[];
  onSeek: (seconds: number) => void;
  isPlaying: boolean;
}

export const SoundcloudWaveform: React.FC<SoundcloudWaveformProps> = ({
  peaks,
  duration,
  currentTime,
  taps,
  onSeek,
  isPlaying,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; time: number } | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<{
    second: number;
    count: number;
  } | null>(null);

  const totalBars = peaks.length > 0 ? peaks.length : 120;
  const safeDuration = Math.max(1, duration);

  // Compute tap density per bar and cluster hot points intelligently
  const { tapDensity, maxTapsInBar, clusters } = useMemo(() => {
    const density = new Array(totalBars).fill(0);

    taps.forEach((t) => {
      const fraction = Math.min(0.999, Math.max(0, t.timestamp / safeDuration));
      const barIndex = Math.floor(fraction * totalBars);
      density[barIndex] = (density[barIndex] || 0) + 1;
    });

    const max = Math.max(...density, 1);

    // Merge adjacent active bars into consolidated clusters (prevents clutter when 20 people press simultaneously)
    // Cluster window: ~4 seconds
    const clusterWindowBars = Math.max(3, Math.round((4 / safeDuration) * totalBars));
    const rawHotspots: Array<{ centerBar: number; second: number; count: number }> = [];

    for (let i = 0; i < totalBars; i++) {
      if (density[i] >= 1) {
        // Calculate taps in window
        let windowCount = 0;
        let peakBar = i;
        let peakVal = 0;

        const half = Math.floor(clusterWindowBars / 2);
        const start = Math.max(0, i - half);
        const end = Math.min(totalBars - 1, i + half);

        for (let j = start; j <= end; j++) {
          windowCount += density[j];
          if (density[j] > peakVal) {
            peakVal = density[j];
            peakBar = j;
          }
        }

        // THRESHOLD: Bereits ab 2 Taps in diesem Segment gibt es einen Hotspot-Pin!
        if (windowCount >= 2) {
          rawHotspots.push({
            centerBar: peakBar,
            second: Math.round((peakBar / totalBars) * safeDuration),
            count: windowCount,
          });
          // Advance past window to prevent duplicates
          i = end;
        }
      }
    }

    // Sort by tap count and deduplicate close pins (minimum 6% distance between pins)
    rawHotspots.sort((a, b) => b.count - a.count);
    const finalClusters: Array<{
      barIndex: number;
      second: number;
      count: number;
      percentage: number;
    }> = [];

    rawHotspots.forEach((spot) => {
      const pct = (spot.centerBar / totalBars) * 100;
      const isTooClose = finalClusters.some((c) => Math.abs(c.percentage - pct) < 6.5);
      if (!isTooClose && finalClusters.length < 8) {
        finalClusters.push({
          barIndex: spot.centerBar,
          second: spot.second,
          count: spot.count,
          percentage: pct,
        });
      }
    });

    // Re-sort clusters by timeline percentage
    finalClusters.sort((a, b) => a.percentage - b.percentage);

    return {
      tapDensity: density,
      maxTapsInBar: max,
      clusters: finalClusters,
    };
  }, [taps, totalBars, safeDuration]);

  // Click & Seek handling
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.min(1, Math.max(0, clickX / rect.width));
    const targetSecond = fraction * safeDuration;
    onSeek(targetSecond);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const fraction = Math.min(1, Math.max(0, mouseX / rect.width));
    setHoverPosition({
      x: mouseX,
      time: fraction * safeDuration,
    });
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
  };

  const progressPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  return (
    <div className="w-full select-none bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl relative">
      {/* Waveform Header / Legend */}
      <div className="flex items-center justify-between pb-3 text-xs text-slate-400 border-b border-slate-800/80 mb-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200">SoundCloud-Style Hype-Wellenform</span>
          <span className="text-slate-500">·</span>
          <span className="text-orange-400 font-bold flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 inline text-orange-400" />
            {taps.length} Taps
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 inline-block"></span>
            <span>Ungespielt</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block"></span>
            <span>Gespielt</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500 shadow-sm shadow-red-500/50 inline-block"></span>
            <span className="text-slate-200">Hitzepol ({clusters.length} Cluster)</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Waveform Canvas Container */}
      <div
        ref={containerRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-44 w-full cursor-pointer flex flex-col justify-end group pt-6 pb-2"
        role="slider"
        aria-label="Audio Waveform Scrubber"
        aria-valuemin={0}
        aria-valuemax={safeDuration}
        aria-valuenow={currentTime}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(Math.min(safeDuration, currentTime + 5));
          if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
        }}
      >
        {/* SoundCloud-style Comment / Vibe Markers on top */}
        <div className="absolute top-0 left-0 right-0 h-7 pointer-events-auto">
          {clusters.map((cluster, i) => {
            const isVeryHot = cluster.count >= 8;
            return (
              <button
                key={`cluster-${i}-${cluster.second}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(cluster.second);
                  setSelectedCluster(cluster);
                }}
                title={`${formatTime(cluster.second)}: ${cluster.count} Taps`}
                className={`absolute top-0 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black font-mono transition-transform hover:scale-125 z-20 shadow-lg ${
                  isVeryHot
                    ? 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 text-white ring-2 ring-red-400/60 shadow-orange-500/40'
                    : 'bg-slate-800 text-amber-300 border border-slate-700 hover:bg-slate-700'
                }`}
                style={{ left: `${cluster.percentage}%` }}
              >
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>{cluster.count}</span>
              </button>
            );
          })}
        </div>

        {/* Heatmap Glow Backdrop Layer */}
        <div className="absolute bottom-2 left-0 right-0 h-32 flex items-end gap-[2px] opacity-50 pointer-events-none">
          {peaks.map((_, i) => {
            const count = tapDensity[i] || 0;
            const heatRatio = count / maxTapsInBar;
            const heatHeight = Math.max(8, heatRatio * 100);
            return (
              <div
                key={`heat-${i}`}
                className="flex-1 rounded-t-sm transition-all duration-300"
                style={{
                  height: `${heatHeight}%`,
                  background:
                    count > 0
                      ? heatRatio > 0.5
                        ? 'linear-gradient(to top, rgba(239, 68, 68, 0.95), rgba(249, 115, 22, 0.75))'
                        : heatRatio > 0.2
                        ? 'linear-gradient(to top, rgba(249, 115, 22, 0.75), rgba(245, 158, 11, 0.45))'
                        : 'linear-gradient(to top, rgba(245, 158, 11, 0.4), transparent)'
                      : 'transparent',
                }}
              />
            );
          })}
        </div>

        {/* Waveform Bars Layer */}
        <div className="relative h-28 w-full flex items-center gap-[2px] z-10">
          {peaks.map((val, i) => {
            const barProgress = (i / totalBars) * 100;
            const isPlayed = barProgress <= progressPercent;
            const count = tapDensity[i] || 0;
            const heatRatio = count / maxTapsInBar;

            const heightPercent = Math.max(8, val * 95);

            let barColor = isPlayed ? '#f97316' : '#334155';
            if (count > 0) {
              if (heatRatio > 0.5) {
                barColor = isPlayed ? '#ef4444' : '#b91c1c';
              } else if (heatRatio > 0.2) {
                barColor = isPlayed ? '#ff7a00' : '#d97706';
              } else {
                barColor = isPlayed ? '#fb923c' : '#78350f';
              }
            }

            return (
              <div
                key={`bar-${i}`}
                className="flex-1 flex flex-col justify-center items-center h-full"
              >
                <div
                  className={`w-full rounded-full transition-all duration-150 ${
                    isPlayed ? 'shadow-[0_0_8px_rgba(249,115,22,0.4)]' : ''
                  } ${count > 0 && heatRatio > 0.4 ? 'ring-1 ring-red-400/50 shadow-sm shadow-red-500' : ''}`}
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Real-time Playhead Scrubber */}
        <div
          className="absolute top-6 bottom-2 w-[2px] bg-white z-30 pointer-events-none transition-all duration-75"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded-full shadow-[0_0_12px_#ff5500]"></div>
          {isPlaying && (
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-orange-400 animate-ping opacity-75"></div>
          )}
        </div>

        {/* Hover scrub cursor line and tooltip */}
        {hoverPosition && (
          <div
            className="absolute top-6 bottom-2 w-[1px] bg-slate-300/80 z-20 pointer-events-none"
            style={{ left: `${hoverPosition.x}px` }}
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white font-mono text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
              {formatTime(hoverPosition.time)}
            </div>
          </div>
        )}
      </div>

      {/* Timeline Time labels at bottom */}
      <div className="flex items-center justify-between pt-1 text-[11px] font-mono tabular-nums text-slate-400">
        <span className="text-orange-400 font-semibold">{formatTime(currentTime)}</span>
        <div className="flex gap-16 text-slate-600 hidden sm:flex">
          <span>{formatTime(safeDuration * 0.25)}</span>
          <span>{formatTime(safeDuration * 0.5)}</span>
          <span>{formatTime(safeDuration * 0.75)}</span>
        </div>
        <span>{formatTime(safeDuration)}</span>
      </div>

      {/* Selected hotspot detail popover */}
      {selectedCluster && (
        <div className="mt-3 p-3 bg-slate-800/95 border border-orange-500/40 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 font-bold font-mono">
              Zeitstempel {formatTime(selectedCluster.second)}:
            </span>
            <span className="text-slate-100 font-bold">
              🔥 {selectedCluster.count} Leute haben hier gedrückt!
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSeek(selectedCluster.second)}
              className="px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs"
            >
              Abspielen
            </button>
            <button
              onClick={() => setSelectedCluster(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-700"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
