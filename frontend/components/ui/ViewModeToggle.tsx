'use client';

import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from './cn';

export interface ViewModeToggleProps {
  value: 'grid' | 'list';
  onChange: (value: 'grid' | 'list') => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function ViewModeToggle({
  value,
  onChange,
  className,
  size = 'md',
}: ViewModeToggleProps) {
  const options = [
    { value: 'grid' as const, label: 'Dạng lưới', icon: LayoutGrid },
    { value: 'list' as const, label: 'Dạng danh sách', icon: List },
  ];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl border border-slate-300 bg-slate-100 p-1 shadow-2xs select-none',
        className
      )}
      role="group"
      aria-label="Kiểu hiển thị tour"
    >
      {options.map(({ value: val, label, icon: Icon }) => {
        const isActive = value === val;
        return (
          <button
            key={val}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => onChange(val)}
            className={cn(
              'flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer',
              size === 'sm' ? 'size-8' : 'size-9',
              isActive
                ? 'bg-white text-teal-800 border border-slate-200/90 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            )}
          >
            <Icon
              className={cn(
                size === 'sm' ? 'size-4' : 'size-4.5',
                isActive ? 'stroke-[2.5]' : 'stroke-[2.2]'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
