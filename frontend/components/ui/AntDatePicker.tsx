'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface AntDatePickerProps {
  value?: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  size?: 'small' | 'middle' | 'large';
  id?: string;
}

const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

export function AntDatePicker({
  value,
  onChange,
  placeholder = 'Chọn ngày',
  min,
  max,
  disabled = false,
  className = '',
  size = 'middle',
  id,
}: AntDatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize view date based on current value or today
  const initialDate = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());

  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value]);

  // Click outside and escape key handling
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

  // Format display text (e.g., DD/MM/YYYY)
  const displayValue = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }, [value]);

  // Month navigation
  const prevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Build grid days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

    // Day of week: 0 (Sun) to 6 (Sat) -> convert to 0 (Mon) to 6 (Sun)
    let startingDay = firstDayOfMonth.getDay() - 1;
    if (startingDay === -1) startingDay = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

    // Prev month days
    for (let i = startingDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 12 : viewMonth;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isDisabled: Boolean((min && dateStr < min) || (max && dateStr > max)),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const m = viewMonth + 1;
      const dateStr = `${viewYear}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: true,
        isDisabled: Boolean((min && dateStr < min) || (max && dateStr > max)),
      });
    }

    // Next month days to fill 42 cells (6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const m = viewMonth === 11 ? 1 : viewMonth + 2;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        isDisabled: Boolean((min && dateStr < min) || (max && dateStr > max)),
      });
    }

    return days;
  }, [viewYear, viewMonth, min, max]);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const sizeClasses = {
    small: 'h-8 px-2.5 text-xs',
    middle: 'h-9 px-3 text-sm',
    large: 'h-11 px-3.5 text-sm',
  }[size];

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button - Ant Design Style */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`group flex w-full items-center justify-between gap-2.5 rounded-lg border bg-white font-medium transition-all duration-200 cursor-pointer ${sizeClasses} ${
          open
            ? 'border-teal-600 ring-2 ring-teal-600/15 shadow-xs'
            : 'border-slate-300 hover:border-teal-500'
        } ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CalendarIcon size={16} className={`shrink-0 transition-colors ${open ? 'text-teal-600' : 'text-teal-600/80 group-hover:text-teal-700'}`} />
          <span className={`truncate text-left ${displayValue ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
            {displayValue || placeholder}
          </span>
        </div>

        {value && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            title="Xóa ngày"
            aria-label="Xóa ngày"
            className="shrink-0 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={14} />
          </span>
        ) : null}
      </button>

      {/* Floating Modern Calendar Popup */}
      {open && (
        <div
          role="dialog"
          aria-label="Chọn ngày"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xl shadow-slate-300/80 animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Tháng trước"
              className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-xs font-bold text-slate-800">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={nextMonth}
              aria-label="Tháng tiếp theo"
              className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEK_DAYS.map((wd) => (
              <span key={wd} className="text-[11px] font-bold text-slate-400 py-1">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ dateStr, dayNum, isCurrentMonth, isDisabled }) => {
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(dateStr);
                    setOpen(false);
                  }}
                  className={`grid size-8 place-items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-xs font-bold scale-105'
                      : isToday
                      ? 'border border-teal-500 text-teal-700 hover:bg-teal-50'
                      : !isCurrentMonth
                      ? 'text-slate-300 hover:text-slate-600'
                      : 'text-slate-700 hover:bg-teal-50 hover:text-teal-800'
                  } ${isDisabled ? 'cursor-not-allowed opacity-25 hover:bg-transparent hover:text-slate-300' : ''}`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Quick Actions Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-slate-500 hover:text-rose-600 font-semibold cursor-pointer"
            >
              Xóa
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayStr);
                setOpen(false);
              }}
              className="text-teal-700 hover:text-teal-900 font-bold hover:underline cursor-pointer"
            >
              Hôm nay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
