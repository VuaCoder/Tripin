'use client';

import React, { useState } from 'react';

interface CollageImageGridProps {
  images: (string | undefined)[];
  altTitle?: string;
  className?: string;
}

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80';

export function CollageImageGrid({
  images,
  altTitle = 'Tour collection',
  className = '',
}: CollageImageGridProps) {
  const validImages = images.filter(Boolean) as string[];

  if (validImages.length === 0) {
    return (
      <div
        className={`aspect-square w-full rounded-3xl bg-slate-100 flex items-center justify-center text-slate-300 border border-slate-200/80 ${className}`}
      >
        <span className="material-symbols-outlined text-4xl">favorite</span>
      </div>
    );
  }

  // 1 Tour: Full 1x1 single photo
  if (validImages.length === 1) {
    return (
      <div className={`aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-2xs ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={validImages[0]}
          alt={altTitle}
          className="size-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
      </div>
    );
  }

  // 2 Tours: 2 vertical halves (left / right)
  if (validImages.length === 2) {
    return (
      <div className={`aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-2xs grid grid-cols-2 gap-0.5 ${className}`}>
        {validImages.slice(0, 2).map((img, idx) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={idx}
            src={img}
            alt={`${altTitle} - ${idx + 1}`}
            className="size-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMG;
            }}
          />
        ))}
      </div>
    );
  }

  // 3 Tours: Left half 1 big photo, Right half 2 stacked photos
  if (validImages.length === 3) {
    return (
      <div className={`aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-2xs grid grid-cols-2 gap-0.5 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={validImages[0]}
          alt={`${altTitle} - 1`}
          className="size-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        <div className="grid grid-rows-2 gap-0.5 h-full">
          {validImages.slice(1, 3).map((img, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={idx}
              src={img}
              alt={`${altTitle} - ${idx + 2}`}
              className="size-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_IMG;
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // 4+ Tours: 2x2 grid (4 square photos - Exactly as Image 1)
  return (
    <div className={`aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-2xs grid grid-cols-2 grid-rows-2 gap-0.5 ${className}`}>
      {validImages.slice(0, 4).map((img, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={idx}
          src={img}
          alt={`${altTitle} - ${idx + 1}`}
          className="size-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
      ))}
    </div>
  );
}

