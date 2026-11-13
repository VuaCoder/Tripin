'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export interface BackButtonProps {
  label?: string;
  fallbackUrl?: string;
  onClick?: () => void;
  className?: string;
  showLabel?: boolean;
}

/**
 * Shared BackButton component for traveler and public pages.
 * Displays the standard traveler circular chevron-left back button.
 * Supports smart history navigation with fallback URL and custom onClick.
 */
export function BackButton({
  label = 'Quay lại',
  fallbackUrl = '/tours',
  onClick,
  className = '',
  showLabel = false,
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onClick) {
      onClick();
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center text-slate-700 hover:text-slate-900 transition-colors cursor-pointer group ${
        showLabel
          ? 'gap-1.5 text-sm font-semibold hover:bg-slate-100 px-2.5 py-1.5 rounded-full'
          : 'size-9 items-center justify-center rounded-full hover:bg-slate-100'
      } ${className}`}
      aria-label={label}
      title={label}
    >
      <span
        className="material-symbols-outlined text-[24px] transition-transform duration-200 group-hover:-translate-x-0.5 select-none"
        aria-hidden="true"
      >
        chevron_left
      </span>
      {showLabel && <span>{label}</span>}
    </button>
  );
}
