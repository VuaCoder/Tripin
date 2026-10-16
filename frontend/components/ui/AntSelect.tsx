'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface AntSelectOption<T = string> {
  value: T;
  label: React.ReactNode;
}

export interface AntSelectProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: AntSelectOption<T>[];
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  size?: 'small' | 'middle' | 'large';
  disabled?: boolean;
  prefix?: React.ReactNode;
}

export function AntSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục',
  className = '',
  dropdownClassName = '',
  size = 'middle',
  disabled = false,
  prefix,
}: AntSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const sizeClasses = {
    small: 'h-8 px-2.5 text-xs',
    middle: 'h-9 px-3 text-sm',
    large: 'h-11 px-3.5 text-sm',
  }[size];

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button - Ant Design Style */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group flex w-full items-center justify-between gap-2.5 rounded-lg border bg-white font-medium transition-all duration-200 cursor-pointer ${sizeClasses} ${
          open
            ? 'border-teal-600 ring-2 ring-teal-600/15 shadow-xs'
            : 'border-slate-300 hover:border-teal-500'
        } ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {prefix && <span className="shrink-0 text-slate-400 group-hover:text-slate-500">{prefix}</span>}
          <span className={`truncate text-left ${selectedOption ? 'text-slate-800' : 'text-slate-400'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180 text-teal-600' : 'group-hover:text-slate-600'
          }`}
        />
      </button>

      {/* Floating Dropdown Menu - Ant Design Style */}
      {open && (
        <div
          role="listbox"
          className={`absolute left-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-xl shadow-slate-200/80 animate-in fade-in-50 zoom-in-95 duration-150 ${dropdownClassName}`}
        >
          <div className="max-h-60 overflow-y-auto p-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={String(option.value)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-teal-50/80 font-semibold text-teal-800'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check size={14} className="shrink-0 text-teal-600" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
