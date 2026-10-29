import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Maximize2, Minimize2, Smartphone, Sparkles, ExternalLink, Globe, Settings2, Download } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumTitle: string;
  artistName: string;
  roomId: string;
  onOpenAudienceView: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  albumTitle,
  artistName,
  roomId,
  onOpenAudienceView,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isBeamerMode, setIsBeamerMode] = useState(false);
  const [customDomain, setCustomDomain] = useState<string>(() => {
    return localStorage.getItem('vibepulse_custom_domain') || '';
  });
  const [showDomainEditor, setShowDomainEditor] = useState(false);

  // Compute actual join URL:
  // If custom domain is entered (e.g. Render, Railway, or local IP), use it.
  // Otherwise use window.location.origin
  const baseOrigin = customDomain.trim() || (typeof window !== 'undefined' ? window.location.origin : '');
  const joinUrl = baseOrigin
    ? `${baseOrigin.replace(/\/+$/, '')}${typeof window !== 'undefined' ? window.location.pathname : '/'}?mode=audience&room=${encodeURIComponent(roomId)}`
    : `https://example.com/?mode=audience&room=${roomId}`;

  useEffect(() => {
    if (isOpen && joinUrl) {
      QRCode.toDataURL(joinUrl, {
        width: 480,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code', err));
    }
  }, [isOpen, joinUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveCustomDomain = (newDomain: string) => {
    setCustomDomain(newDomain);
    localStorage.setItem('vibepulse_custom_domain', newDomain);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all ${
      isBeamerMode ? 'bg-black/95 p-0' : ''
    }`}>
      <div
        className={`bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all ${
          isBeamerMode
            ? 'w-full h-full rounded-none flex flex-col items-center justify-center p-8'
            : 'max-w-md w-full p-6'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
              <Smartphone className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">QR-Code für Gäste</h2>
              <p className="text-xs text-slate-400">Mit dem Handy scannen und live mitfeiern</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBeamerMode(!isBeamerMode)}
              title={isBeamerMode ? 'Normaler Modus' : 'Beamer / Großbild-Modus'}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              {isBeamerMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Beamer Mode Banner */}
        {isBeamerMode && (
          <div className="text-center mb-6">
            <span className="text-orange-400 font-semibold tracking-wider uppercase text-xs">
              {artistName} präsentiert
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white mt-1">
              {albumTitle}
            </h1>
            <p className="text-slate-300 text-lg mt-2 max-w-xl mx-auto">
              Scanne den QR-Code mit deiner Smartphone-Kamera und drücke den Knopf bei deinen Lieblingsstellen!
            </p>
          </div>
        )}

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center">
          <div className={`p-4 bg-white rounded-2xl shadow-xl border-4 border-orange-500/30 ${
            isBeamerMode ? 'p-6 max-w-sm' : 'max-w-[260px]'
          }`}>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code zum Beitreten"
                className="w-full h-auto aspect-square object-contain rounded-lg"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                QR-Code wird generiert...
              </div>
            )}
          </div>

          {/* Room Code Badge */}
          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
            <span>Raum-Code:</span>
            <strong className="text-orange-400 uppercase tracking-widest">{roomId}</strong>
          </div>
        </div>

        {/* Link & Settings (hidden in beamer mode) */}
        {!isBeamerMode && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium truncate">
                <Globe className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">Scannen mit Handy-Kamera</span>
              </span>
              <button
                onClick={() => setShowDomainEditor(!showDomainEditor)}
                className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-[11px] font-semibold shrink-0"
              >
                <Settings2 className="w-3 h-3" />
                <span>Domain anpassen</span>
              </button>
            </div>

            {/* Custom domain editor (e.g. for Render, Railway, or local IP) */}
            {showDomainEditor && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                <p className="text-[11px] text-slate-300 font-medium">
                  Hostest du auf Render, Railway oder eigener Domain?
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    placeholder={typeof window !== 'undefined' ? window.location.origin : 'https://...'}
                    value={customDomain}
                    onChange={(e) => handleSaveCustomDomain(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-orange-500 font-mono"
                  />
                  {customDomain && (
                    <button
                      onClick={() => handleSaveCustomDomain('')}
                      className="px-2 py-1.5 text-[11px] bg-slate-800 text-slate-400 hover:text-white rounded-lg"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Der QR-Code aktualisiert sich sofort für diese Zieladresse.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-xl">
              <input
                type="text"
                readOnly
                value={joinUrl}
                className="bg-transparent text-xs text-slate-300 flex-1 truncate font-mono px-2 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  onClose();
                  onOpenAudienceView();
                }}
                className="text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium underline-offset-4 hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auf diesem Gerät als Gast öffnen</span>
              </button>

              <a
                href={joinUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <span>Neuer Tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Direct Project ZIP Download for GitHub / Render */}
            <div className="pt-2 border-t border-slate-800/80">
              <a
                href="/api/download-zip"
                download="Album-Pre-Listening-Session.zip"
                className="w-full py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700/60 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-orange-400" />
                <span>Projekt-ZIP herunterladen (für GitHub / Render)</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
