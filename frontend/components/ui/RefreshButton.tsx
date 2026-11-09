'use client';

import React from 'react';

export interface RefreshButtonProps {
  onClick: () => void;
  isFetching?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  title?: string;
}

export function RefreshButton({
  onClick,
  isFetching = false,
  disabled = false,
  className = '',
  'aria-label': ariaLabel = 'Làm mới',
  title = 'Làm mới',
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || isFetching}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-primary-container disabled:opacity-50 ${className}`}
    >
      <span
        className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`}
        aria-hidden="true"
      >
        refresh
      </span>
    </button>
  );
}
