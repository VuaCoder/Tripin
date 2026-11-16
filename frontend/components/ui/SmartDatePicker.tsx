'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface SmartDatePickerProps {
  value?: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];
const MONTH_SHORT = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

type ViewMode = 'day' | 'month' | 'year';

export function SmartDatePicker({
  value,
  onChange,
  placeholder = 'mm/dd/yyyy',
  min,
  max,
  disabled = false,
  className = '',
  id,
}: SmartDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('day');
  const containerRef = useRef<HTMLDivElement>(null);

  const initialDate = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());

  // Year-list base: decade block (e.g. 2020-2029). Adjustable by prev/next decade.
  const [decadeStart, setDecadeStart] = useState<number>(
    Math.floor(initialDate.getFullYear() / 10) * 10,
  );

  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
      setDecadeStart(Math.floor(y / 10) * 10);
    }
  }, [value]);

  // Click outside + Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setView('day');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setView('day');
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

  const displayValue = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const [y, m, d] = value.split('-');
    return `${m}/${d}/${y}`; // match native date input display (mm/dd/yyyy)
  }, [value]);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const isDisabledDate = (dateStr: string) =>
    Boolean((min && dateStr < min) || (max && dateStr > max));

  // Day navigation
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

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    let startingDay = firstDayOfMonth.getDay() - 1;
    if (startingDay === -1) startingDay = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

    for (let i = startingDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 12 : viewMonth;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: false, isDisabled: isDisabledDate(dateStr) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const m = viewMonth + 1;
      const dateStr = `${viewYear}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: true, isDisabled: isDisabledDate(dateStr) });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const m = viewMonth === 11 ? 1 : viewMonth + 2;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: false, isDisabled: isDisabledDate(dateStr) });
    }
    return days;
  }, [viewYear, viewMonth, min, max]);

  const monthOptions = useMemo(() =>
    Array.from({ length: 12 }, (_, idx) => { const m = idx + 1; return m; }),
  []);

  const yearOptions = useMemo(() =>
    Array.from({ length: 10 }, (_, idx) => decadeStart + idx),
  [decadeStart]);

  return (
    <div ref={containerRef} className={`relative block w-full ${className}`}>
      {/* Trigger — looks like a native date input (mm/dd/yyyy) */}
      <div className="relative">
        <input
          id={id}
          type="text"
          readOnly
          role="button"
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder || 'mm/dd/yyyy'}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={`w-full cursor-pointer rounded-xl border bg-white px-3 py-2 pr-9 text-sm outline-none transition placeholder:text-slate-400 ${
            open
              ? 'min-h-11 border-teal-500 focus:ring-2 ring-teal-500/15'
              : 'min-h-11 border-slate-200 hover:border-slate-300'
          } ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-500' : ''}`}
        />
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
            className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer z-[1]"
          >
            <X size={13} />
          </span>
        ) : (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <CalendarIcon size={16} />
          </span>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Chọn ngày"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xl shadow-slate-300/80 animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* ====== DAY VIEW ====== */}
          {view === 'day' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <NavButton onClick={prevMonth} label="Tháng trước"><ChevronLeft size={16} /></NavButton>
                <button
                  type="button"
                  onClick={() => setView('month')}
                  title="Chọn tháng / năm"
                  className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 hover:bg-teal-50 hover:text-teal-800 transition-colors cursor-pointer"
                >
                  <span>{MONTH_NAMES[viewMonth]} {viewYear}</span>
                  <ChevronDownIcon />
                </button>
                <NavButton onClick={nextMonth} label="Tháng tiếp theo"><ChevronRight size={16} /></NavButton>
              </div>

              {/* Weekday Labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {WEEK_DAYS.map((wd) => (
                  <span key={wd} className="text-[11px] font-bold text-slate-400 py-1">{wd}</span>
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
                        setView('day');
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
            </>
          )}

          {/* ====== MONTH VIEW ====== */}
          {view === 'month' && (
            <>
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <NavButton onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewYear((prev) => prev - 1); }} label="Năm trước"><ChevronLeft size={16} /></NavButton>
                <button
                  type="button"
                  onClick={() => setView('year')}
                  title="Chọn năm"
                  className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 hover:bg-teal-50 hover:text-teal-800 transition-colors cursor-pointer"
                >
                  <span>{viewYear}</span>
                  <ChevronDownIcon />
                </button>
                <NavButton onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewYear((prev) => prev + 1); }} label="Năm tiếp theo"><ChevronRight size={16} /></NavButton>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {monthOptions.map((m) => {
                  const selected = value && Number(value.slice(5, 7)) === m && Number(value.slice(0, 4)) === viewYear;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setViewMonth(m - 1);
                        setView('day');
                      }}
                      className={`grid h-9 place-items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                        selected
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-teal-50 hover:text-teal-800'
                      }`}
                    >
                      {MONTH_SHORT[m - 1]}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ====== YEAR VIEW ====== */}
          {view === 'year' && (
            <>
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <NavButton onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDecadeStart((prev) => prev - 10); }} label="Thập kỷ trước"><ChevronLeft size={16} /></NavButton>
                <span className="text-xs font-bold text-slate-800">{decadeStart} – {decadeStart + 9}</span>
                <NavButton onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDecadeStart((prev) => prev + 10); }} label="Thập kỷ tiếp theo"><ChevronRight size={16} /></NavButton>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {yearOptions.map((y) => {
                  const selected = value && Number(value.slice(0, 4)) === y;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setViewYear(y);
                        setView('month');
                      }}
                      className={`grid h-9 place-items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                        selected
                          ? 'bg-teal-600 text-white shadow-xs'
                          : y === new Date().getFullYear()
                          ? 'border border-teal-500 text-teal-700 hover:bg-teal-50'
                          : 'text-slate-700 hover:bg-teal-50 hover:text-teal-800'
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
                setView('day');
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
                setView('day');
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

function NavButton({ onClick, label, children }: {
  onClick: (e: React.MouseEvent) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
