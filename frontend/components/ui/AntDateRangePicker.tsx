'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, ArrowRight } from 'lucide-react';

export interface AntDateRangePickerProps {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  onChange: (range: { startDate?: string; endDate?: string }) => void;
  placeholder?: [string, string];
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

export function AntDateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = ['Từ ngày', 'Đến ngày'],
  min,
  max,
  disabled = false,
  className = '',
  size = 'middle',
  id,
}: AntDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Temporary selection state during picking
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Base calendar month view
  const initialDate = useMemo(() => {
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const [y, m, d] = startDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [startDate]);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());

  useEffect(() => {
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const [y, m] = startDate.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [startDate]);

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

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

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

  // Calendar days generation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

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
    middle: 'h-10 px-3 text-sm',
    large: 'h-11 px-3.5 text-sm',
  }[size];

  // Handle click on calendar day
  const handleDaySelect = (dayStr: string) => {
    if (!startDate || (startDate && endDate)) {
      // Start a new range selection
      onChange({ startDate: dayStr, endDate: undefined });
    } else if (startDate && !endDate) {
      if (dayStr < startDate) {
        // Swap if clicked earlier
        onChange({ startDate: dayStr, endDate: startDate });
      } else {
        onChange({ startDate, endDate: dayStr });
      }
      setOpen(false);
    }
  };

  const activeEffectiveEnd = endDate || (startDate && hoverDate && hoverDate >= startDate ? hoverDate : undefined);

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {/* Range Input Trigger - Ant Design style */}
      <div
        id={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        className={`group flex w-full items-center justify-between gap-2 rounded-xl border bg-white font-medium transition-all duration-200 cursor-pointer ${sizeClasses} ${
          open
            ? 'border-brand-teal ring-2 ring-brand-teal/15 shadow-sm'
            : 'border-slate-200 hover:border-brand-teal'
        } ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CalendarIcon size={16} className={`shrink-0 transition-colors ${open ? 'text-brand-teal' : 'text-slate-400 group-hover:text-brand-teal'}`} />
          
          {/* Start date display */}
          <span className={`truncate text-left ${startDate ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
            {formatDateDisplay(startDate) || placeholder[0]}
          </span>

          <ArrowRight size={13} className="shrink-0 text-slate-300" />

          {/* End date display */}
          <span className={`truncate text-left ${endDate ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
            {formatDateDisplay(endDate) || placeholder[1]}
          </span>
        </div>

        {(startDate || endDate) && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ startDate: undefined, endDate: undefined });
            }}
            title="Xóa khoảng ngày"
            aria-label="Xóa khoảng ngày"
            className="shrink-0 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={14} />
          </span>
        ) : null}
      </div>

      {/* Floating Modern Calendar Popup */}
      {open && (
        <div
          role="dialog"
          aria-label="Chọn khoảng ngày khởi hành"
          className="absolute left-0 top-full z-50 mt-1.5 w-76 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl shadow-slate-900/10 animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Header indicator */}
          <div className="mb-2.5 flex items-center justify-between text-xs font-medium text-slate-500 border-b border-slate-100 pb-2">
            <span>
              {!startDate ? (
                'Chọn ngày bắt đầu'
              ) : !endDate ? (
                'Chọn ngày kết thúc'
              ) : (
                <span className="text-brand-teal font-semibold">Đã chọn dải ngày</span>
              )}
            </span>
            {(startDate || endDate) && (
              <span className="text-[11px] text-slate-400">
                {formatDateDisplay(startDate)} {endDate ? `→ ${formatDateDisplay(endDate)}` : ''}
              </span>
            )}
          </div>

          {/* Month Navigator */}
          <div className="flex items-center justify-between mb-3">
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
          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map(({ dateStr, dayNum, isCurrentMonth, isDisabled }) => {
              const isStart = dateStr === startDate;
              const isEnd = dateStr === (endDate || (startDate && hoverDate ? hoverDate : ''));
              const inRange = Boolean(
                startDate &&
                activeEffectiveEnd &&
                dateStr > startDate &&
                dateStr < activeEffectiveEnd
              );
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dateStr}
                  className={`relative flex items-center justify-center py-0.5 ${
                    inRange ? 'bg-teal-50' : ''
                  } ${isStart && activeEffectiveEnd && isCurrentMonth ? 'rounded-l-lg bg-teal-50' : ''} ${
                    isEnd && startDate && isCurrentMonth ? 'rounded-r-lg bg-teal-50' : ''
                  }`}
                  onMouseEnter={() => {
                    if (startDate && !endDate && dateStr >= startDate) {
                      setHoverDate(dateStr);
                    }
                  }}
                >
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleDaySelect(dateStr)}
                    className={`grid size-8 place-items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isStart || isEnd
                        ? 'bg-brand-teal text-white shadow-xs font-bold scale-105 z-10'
                        : inRange
                        ? 'text-teal-900 font-bold hover:bg-teal-100'
                        : isToday
                        ? 'border border-brand-teal text-brand-teal hover:bg-teal-50'
                        : !isCurrentMonth
                        ? 'text-slate-300 hover:text-slate-600'
                        : 'text-slate-700 hover:bg-slate-100'
                    } ${isDisabled ? 'cursor-not-allowed opacity-25 hover:bg-transparent hover:text-slate-300' : ''}`}
                  >
                    {dayNum}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Actions Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
            <button
              type="button"
              onClick={() => {
                onChange({ startDate: undefined, endDate: undefined });
                setOpen(false);
              }}
              className="text-slate-500 hover:text-rose-600 font-semibold cursor-pointer"
            >
              Xóa chọn
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange({ startDate: todayStr, endDate: todayStr });
                  setOpen(false);
                }}
                className="text-brand-teal hover:text-teal-800 font-bold hover:underline cursor-pointer"
              >
                Hôm nay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
