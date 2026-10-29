import React, { useRef, useState } from 'react';
import { Upload, Music, Plus, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { TrackInfo } from '../types';
import { extractWaveformFromBlob } from '../utils/waveformExtractor';

interface TrackUploaderProps {
  onTracksAdded: (newTracks: TrackInfo[]) => void;
  onRestoreDemos: () => void;
}

export const TrackUploader: React.FC<TrackUploaderProps> = ({
  onTracksAdded,
  onRestoreDemos,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith('audio/') ||
        /\.(mp3|wav|m4a|aac|flac|ogg|aiff)$/i.test(f.name)
    );

    if (audioFiles.length === 0) return;

    setIsProcessing(true);
    const newTracks: TrackInfo[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      setProcessingStatus(`Analysiere "${file.name}" (${i + 1}/${audioFiles.length})...`);

      // Clean track title: strip extension and numbering prefixes if wanted
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      const blobUrl = URL.createObjectURL(file);

      // Extract real waveform and duration using Web Audio API
      const { peaks, duration } = await extractWaveformFromBlob(file, 120);

      newTracks.push({
        id: `custom-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        title: cleanTitle,
        artist: 'Eigenes Album',
        duration: duration || 180,
        audioUrl: blobUrl,
        waveformPeaks: peaks,
        isCustomUpload: true,
      });
    }

    setIsProcessing(false);
    setProcessingStatus('');
    onTracksAdded(newTracks);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">
            Eigene Songs reinladen
          </h3>
          <span className="text-xs text-slate-400">· MP3, WAV, FLAC, M4A</span>
        </div>

        <button
          onClick={onRestoreDemos}
          className="text-xs text-slate-400 hover:text-orange-400 flex items-center gap-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Demo-Songs laden</span>
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
        multiple
        className="hidden"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-orange-500 bg-orange-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-950'
        }`}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-2">
            <RefreshCw className="w-8 h-8 text-orange-400 animate-spin mb-2" />
            <p className="text-sm font-medium text-white">{processingStatus}</p>
            <p className="text-xs text-slate-400 mt-1">
              Wellenform & Frequenzen werden in Echtzeit berechnet...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center mb-2">
              <Plus className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-200">
              Dateien hier hineinziehen oder klicken
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Lade einzelne Tracks oder dein ganzes Album auf einmal hoch
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
