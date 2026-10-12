'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeDisplay({ value, size = 180, className = '' }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(value, {
      width: size * 2, // high DPI
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isMounted) setDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative p-3 bg-white rounded-2xl border-2 border-slate-200/80 shadow-inner group">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`Mã QR ${value}`}
            width={size}
            height={size}
            className="rounded-lg object-contain"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center bg-slate-50 rounded-lg text-slate-400 animate-pulse text-xs"
          >
            Đang tạo mã QR...
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl transition-colors cursor-pointer" onClick={handleCopy} title="Bấm để sao chép mã vé">
        <span className="font-mono text-xs font-bold tracking-wider text-slate-800">
          {value}
        </span>
        <span className="material-symbols-outlined text-[16px] text-slate-500">
          {copied ? 'check' : 'content_copy'}
        </span>
      </div>
      {copied && (
        <span className="text-[10px] text-emerald-600 font-semibold mt-1 animate-fadeIn">
          Đã sao chép mã vé!
        </span>
      )}
    </div>
  );
}
