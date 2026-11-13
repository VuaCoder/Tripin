'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Clock, X, Check } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';
import { Modal } from './Modal';
import styles from './TimeWheelPicker.module.css';

export type TimePeriod = 'AM' | 'PM';

export interface TimeWheelValue {
  hour: number; // 1 - 12
  minute: number; // 0 - 59
  period: TimePeriod;
  formatted: string; // e.g. "08:30 AM"
  time24: string; // e.g. "08:30" or "20:30"
}

export interface TimeWheelPickerProps {
  value?: string | { hour?: number; minute?: number; period?: TimePeriod };
  defaultValue?: string | { hour?: number; minute?: number; period?: TimePeriod };
  onChange?: (val: TimeWheelValue) => void;
  className?: string;
  showPreviewText?: boolean;
  previewLabel?: string;
  disabled?: boolean;
  itemHeight?: number;
  visibleCount?: number;
  ariaLabel?: string;
}

const DEFAULT_ITEM_HEIGHT = 44;
const DEFAULT_VISIBLE_COUNT = 5;

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS: TimePeriod[] = ['AM', 'PM'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function safeScrollTo(el: HTMLElement, top: number, smooth: boolean = true) {
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  } else {
    el.scrollTop = top;
  }
}

export function parseTimeTo12h(
  input?: string | { hour?: number; minute?: number; period?: TimePeriod }
): { hour: number; minute: number; period: TimePeriod } {
  if (!input) {
    return { hour: 8, minute: 30, period: 'AM' };
  }

  if (typeof input === 'object') {
    const rawH = input.hour ?? 8;
    const rawM = input.minute ?? 30;
    const rawP = input.period ?? 'AM';
    const hour = Math.max(1, Math.min(12, rawH));
    const minute = Math.max(0, Math.min(59, rawM));
    const period: TimePeriod = rawP === 'PM' ? 'PM' : 'AM';
    return { hour, minute, period };
  }

  // Parse string e.g. "08:30 AM", "8:30 PM", "20:45"
  const trimmed = input.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i);
  if (match12) {
    const h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const p = match12[3].toUpperCase() as TimePeriod;
    return {
      hour: Math.max(1, Math.min(12, h)),
      minute: Math.max(0, Math.min(59, m)),
      period: p === 'PM' ? 'PM' : 'AM',
    };
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h24 = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    const period: TimePeriod = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return {
      hour: h12,
      minute: Math.max(0, Math.min(59, m)),
      period,
    };
  }

  return { hour: 8, minute: 30, period: 'AM' };
}

export function formatToTimeValue(
  hour: number,
  minute: number,
  period: TimePeriod
): TimeWheelValue {
  const h = Math.max(1, Math.min(12, hour));
  const m = Math.max(0, Math.min(59, minute));
  const p: TimePeriod = period === 'PM' ? 'PM' : 'AM';
  const formatted = `${pad2(h)}:${pad2(m)} ${p}`;

  let h24 = h % 12;
  if (p === 'PM') h24 += 12;
  const time24 = `${pad2(h24)}:${pad2(m)}`;

  return { hour: h, minute: m, period: p, formatted, time24 };
}

/* =========================================================================
   Wheel Column Component (Reusable 3D Roller)
   ========================================================================= */

interface WheelColumnProps {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  loop?: boolean;
  repeatCount?: number;
  itemHeight: number;
  visibleCount: number;
  disabled?: boolean;
  ariaLabel: string;
}

function WheelColumn({
  items,
  value,
  onChange,
  loop = false,
  repeatCount = 5,
  itemHeight,
  visibleCount,
  disabled = false,
  ariaLabel,
}: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const hasMovedRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInternalScrollRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // For looping columns, replicate items array
  const fullItems = useMemo(() => {
    if (!loop) return items;
    const res: string[] = [];
    for (let i = 0; i < repeatCount; i++) {
      res.push(...items);
    }
    return res;
  }, [items, loop, repeatCount]);

  const middleRepeatBlock = loop ? Math.floor(repeatCount / 2) : 0;
  const baseCount = items.length;

  // Center offset padding (rows above and below center)
  const padRows = Math.floor(visibleCount / 2);
  const centerPadPx = padRows * itemHeight;

  // Find index in fullItems corresponding to current value
  const targetIndex = useMemo(() => {
    const rawIdx = items.indexOf(value);
    const validIdx = rawIdx >= 0 ? rawIdx : 0;
    if (!loop) return validIdx;
    return middleRepeatBlock * baseCount + validIdx;
  }, [items, value, loop, middleRepeatBlock, baseCount]);

  // Initial scroll to value
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const targetTop = targetIndex * itemHeight;
    if (Math.abs(el.scrollTop - targetTop) > 1) {
      isInternalScrollRef.current = true;
      el.scrollTop = targetTop;
      setScrollTop(targetTop);
      setTimeout(() => {
        isInternalScrollRef.current = false;
      }, 50);
    }
  }, [targetIndex, itemHeight]);

  // Handle snapping and looping reset
  const snapToNearest = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const currentTop = el.scrollTop;
    const rawIndex = Math.round(currentTop / itemHeight);
    const clampedIndex = loop
      ? Math.max(0, Math.min(fullItems.length - 1, rawIndex))
      : Math.max(0, Math.min(items.length - 1, rawIndex));

    const targetTop = clampedIndex * itemHeight;

    // Smooth snap if not exact
    if (Math.abs(el.scrollTop - targetTop) > 1) {
      safeScrollTo(el, targetTop, true);
    }

    const selectedValue = fullItems[clampedIndex] ?? items[0];
    onChange(selectedValue);

    // If loop, check boundary and silently reset to middle block
    if (loop) {
      const minSafeBlock = 1;
      const maxSafeBlock = repeatCount - 2;
      const currentBlock = Math.floor(clampedIndex / baseCount);

      if (currentBlock <= minSafeBlock || currentBlock >= maxSafeBlock) {
        const valInBase = clampedIndex % baseCount;
        const middleTargetIndex = middleRepeatBlock * baseCount + valInBase;
        const middleTop = middleTargetIndex * itemHeight;

        setTimeout(() => {
          if (!containerRef.current) return;
          isInternalScrollRef.current = true;
          containerRef.current.scrollTop = middleTop;
          setScrollTop(middleTop);
          setTimeout(() => {
            isInternalScrollRef.current = false;
          }, 40);
        }, 120);
      }
    }
  }, [baseCount, fullItems, itemHeight, items, loop, middleRepeatBlock, onChange, repeatCount]);

  // Handle native scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      setScrollTop(containerRef.current.scrollTop);
    });

    if (isInternalScrollRef.current || isDragging) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      snapToNearest();
    }, 90);
  }, [isDragging, snapToNearest]);

  // Mouse drag support for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    const el = containerRef.current;
    if (!el) return;

    setIsDragging(true);
    hasMovedRef.current = false;
    startYRef.current = e.clientY;
    startScrollTopRef.current = el.scrollTop;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      if (Math.abs(deltaY) > 3) {
        hasMovedRef.current = true;
      }
      if (containerRef.current) {
        containerRef.current.scrollTop = startScrollTopRef.current - deltaY;
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);
      setTimeout(() => {
        snapToNearest();
      }, 20);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const el = containerRef.current;
    if (!el) return;

    const currentIndex = Math.round(scrollTop / itemHeight);

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = Math.max(0, currentIndex - 1);
      safeScrollTo(el, nextIndex * itemHeight, true);
      onChange(fullItems[nextIndex] ?? items[0]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(fullItems.length - 1, currentIndex + 1);
      safeScrollTo(el, nextIndex * itemHeight, true);
      onChange(fullItems[nextIndex] ?? items[0]);
    }
  };

  // Click on item to center it
  const handleItemClick = (index: number) => {
    if (disabled || hasMovedRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    safeScrollTo(el, index * itemHeight, true);
    onChange(fullItems[index]);
  };

  const viewportHeight = visibleCount * itemHeight;

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuenow={items.indexOf(value)}
      aria-valuetext={value}
      tabIndex={disabled ? -1 : 0}
      onScroll={handleScroll}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      style={{
        height: `${viewportHeight}px`,
        perspective: '1000px',
      }}
      className={cn(
        styles.wheelScroll,
        'relative w-16 sm:w-20 cursor-grab outline-none focus-visible:ring-1 focus-visible:ring-teal-500/30 rounded-lg',
        isDragging && styles.wheelScrollDragging,
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {/* Top & Bottom spacer to center the items */}
      <div style={{ height: `${centerPadPx}px` }} aria-hidden="true" />

      {fullItems.map((item, idx) => {
        // Distance in rows from current scroll center
        const normalized = idx - scrollTop / itemHeight;
        const absNorm = Math.abs(normalized);

        // Skip heavy rendering for items far outside the viewport
        if (absNorm > padRows + 1.2) {
          return (
            <div
              key={idx}
              style={{ height: `${itemHeight}px` }}
              className={styles.wheelItem}
              aria-hidden="true"
            />
          );
        }

        // 3D Cylinder curve calculations
        const rotateX = Math.max(-75, Math.min(75, -normalized * 22));
        const scale = Math.max(0.72, 1 - absNorm * 0.1);
        const opacity = Math.max(0.18, 1 - absNorm * 0.32);
        const isCenter = absNorm < 0.5;

        return (
          <div
            key={idx}
            onClick={() => handleItemClick(idx)}
            style={{
              height: `${itemHeight}px`,
              transform: `perspective(800px) rotateX(${rotateX}deg) scale(${scale})`,
              opacity,
            }}
            className={cn(
              styles.wheelItem,
              'flex items-center justify-center transition-colors duration-150 select-none cursor-pointer',
              isCenter
                ? 'font-bold text-slate-900 dark:text-white text-xl sm:text-2xl drop-shadow-sm'
                : 'font-medium text-slate-400 dark:text-slate-500 text-base sm:text-lg hover:text-slate-600 dark:hover:text-slate-300'
            )}
            aria-selected={isCenter}
          >
            {item}
          </div>
        );
      })}

      <div style={{ height: `${centerPadPx}px` }} aria-hidden="true" />
    </div>
  );
}

/* =========================================================================
   Main TimeWheelPicker Component
   ========================================================================= */

export function TimeWheelPicker({
  value: controlledValue,
  defaultValue,
  onChange,
  className,
  showPreviewText = true,
  previewLabel = 'Thời gian đã chọn:',
  disabled = false,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  visibleCount = DEFAULT_VISIBLE_COUNT,
  ariaLabel = 'Bộ chọn thời gian 3D',
}: TimeWheelPickerProps) {
  const isControlled = controlledValue !== undefined;
  const initial = useMemo(
    () => parseTimeTo12h(controlledValue ?? defaultValue),
    [controlledValue, defaultValue]
  );

  const [internalTime, setInternalTime] = useState(initial);
  const currentTime = isControlled ? parseTimeTo12h(controlledValue) : internalTime;

  // Notify parent on change
  const triggerChange = useCallback(
    (h: number, m: number, p: TimePeriod) => {
      const nextVal = formatToTimeValue(h, m, p);
      if (!isControlled) {
        setInternalTime({ hour: h, minute: m, period: p });
      }
      onChange?.(nextVal);
    },
    [isControlled, onChange]
  );

  const handleHourChange = useCallback(
    (newHourStr: string) => {
      const h = parseInt(newHourStr, 10);
      triggerChange(h, currentTime.minute, currentTime.period);
    },
    [currentTime.minute, currentTime.period, triggerChange]
  );

  const handleMinuteChange = useCallback(
    (newMinuteStr: string) => {
      const m = parseInt(newMinuteStr, 10);
      triggerChange(currentTime.hour, m, currentTime.period);
    },
    [currentTime.hour, currentTime.period, triggerChange]
  );

  const handlePeriodChange = useCallback(
    (newPeriodStr: string) => {
      const p = newPeriodStr as TimePeriod;
      triggerChange(currentTime.hour, currentTime.minute, p);
    },
    [currentTime.hour, currentTime.minute, triggerChange]
  );

  const formattedTime = useMemo(
    () =>
      `${pad2(currentTime.hour)}:${pad2(currentTime.minute)} ${currentTime.period}`,
    [currentTime.hour, currentTime.minute, currentTime.period]
  );

  const padRows = Math.floor(visibleCount / 2);
  const highlightTop = padRows * itemHeight;
  const pickerHeight = visibleCount * itemHeight;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'relative mx-auto w-full max-w-[320px] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm select-none dark:border-slate-800 dark:bg-slate-900',
        disabled && 'pointer-events-none opacity-60',
        className
      )}
    >
      {/* 3D Wheel Frame */}
      <div
        style={{ height: `${pickerHeight}px` }}
        className="relative w-full overflow-hidden flex items-center justify-center"
      >
        {/* Center Highlight Bar (Rounded pill for the selected row) */}
        <div
          style={{
            top: `${highlightTop}px`,
            height: `${itemHeight}px`,
          }}
          className="pointer-events-none absolute inset-x-2 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-inner z-0"
          aria-hidden="true"
        />

        {/* Top Fade Gradient */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white via-white/85 to-transparent dark:from-slate-900 dark:via-slate-900/85 z-20"
          aria-hidden="true"
        />

        {/* Bottom Fade Gradient */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/85 to-transparent dark:from-slate-900 dark:via-slate-900/85 z-20"
          aria-hidden="true"
        />

        {/* Columns Horizontal Layout: [Giờ] : [Phút] : [AM/PM] */}
        <div className="relative z-10 flex h-full w-full items-center justify-center gap-1 sm:gap-1.5">
          {/* Cột 1: Giờ (01 - 12) - Cuộn lặp vô tận */}
          <WheelColumn
            items={HOURS_12}
            value={pad2(currentTime.hour)}
            onChange={handleHourChange}
            loop={true}
            repeatCount={7}
            itemHeight={itemHeight}
            visibleCount={visibleCount}
            disabled={disabled}
            ariaLabel="Chọn giờ"
          />

          {/* Dấu hai chấm ngăn cách ':' */}
          <div
            style={{ height: `${itemHeight}px` }}
            className="flex items-center justify-center text-lg sm:text-xl font-bold text-slate-700 dark:text-slate-200 select-none pb-0.5 px-0.5 z-10"
            aria-hidden="true"
          >
            :
          </div>

          {/* Cột 2: Phút (00 - 59) - Cuộn lặp vô tận */}
          <WheelColumn
            items={MINUTES_60}
            value={pad2(currentTime.minute)}
            onChange={handleMinuteChange}
            loop={true}
            repeatCount={5}
            itemHeight={itemHeight}
            visibleCount={visibleCount}
            disabled={disabled}
            ariaLabel="Chọn phút"
          />

          {/* Khoảng cách tinh tế */}
          <div className="w-1" aria-hidden="true" />

          {/* Cột 3: Buổi (AM / PM) - Không lặp */}
          <WheelColumn
            items={PERIODS}
            value={currentTime.period}
            onChange={handlePeriodChange}
            loop={false}
            itemHeight={itemHeight}
            visibleCount={visibleCount}
            disabled={disabled}
            ariaLabel="Chọn buổi (AM hoặc PM)"
          />
        </div>
      </div>

      {/* Dòng hiển thị thời gian thực ở đáy */}
      {showPreviewText && (
        <div className="mt-3.5 flex items-center justify-center gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 text-xs text-slate-500 dark:text-slate-400">
          <Clock size={13} className="text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <span>{previewLabel}</span>
          <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 font-mono text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            {formattedTime}
          </span>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   TimePicker (Dropdown / Popover Trigger for Forms)
   ========================================================================= */

export interface TimePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (formatted: string, value: TimeWheelValue) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  error?: boolean;
  allowClear?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function TimePicker({
  value: controlledValue,
  defaultValue = '',
  onChange,
  placeholder = 'Chọn giờ...',
  disabled = false,
  className = '',
  id,
  name,
  error = false,
  allowClear = true,
  size = 'md',
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(controlledValue ?? defaultValue);
  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside or escape key
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleWheelChange = (val: TimeWheelValue) => {
    if (controlledValue === undefined) {
      setInternalValue(val.formatted);
    }
    onChange?.(val.formatted, val);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (controlledValue === undefined) {
      setInternalValue('');
    }
    const emptyVal = formatToTimeValue(8, 0, 'AM');
    onChange?.('', emptyVal);
  };

  const handleSetNow = () => {
    const now = new Date();
    const h24 = now.getHours();
    const m = now.getMinutes();
    const p: TimePeriod = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const val = formatToTimeValue(h12, m, p);
    handleWheelChange(val);
  };

  const sizeClasses = {
    sm: 'min-h-9 px-2.5 py-1.5 text-xs rounded-lg',
    md: 'min-h-11 px-3.5 py-2 text-sm rounded-xl',
    lg: 'min-h-12 px-4 py-2.5 text-base rounded-xl',
  }[size];

  return (
    <div ref={containerRef} className={cn('relative inline-block w-full', className)}>
      {/* Hidden input for HTML form submissions */}
      {name && <input type="hidden" name={name} value={currentValue} />}

      {/* Input trigger */}
      <div
        id={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(!open);
          }
        }}
        className={cn(
          'flex w-full items-center justify-between border bg-white transition select-none cursor-pointer outline-none dark:bg-slate-900',
          sizeClasses,
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/15'
            : open
            ? 'border-teal-500 ring-2 ring-teal-500/15'
            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
          disabled && 'cursor-not-allowed opacity-50 bg-slate-50 dark:bg-slate-800'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock size={16} className={currentValue ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'} />
          <span className={cn('truncate font-medium', currentValue ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500')}>
            {currentValue || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-2">
          {allowClear && !!currentValue && !disabled && (
            <button
              type="button"
              aria-label="Xóa thời gian"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Floating Popover containing TimeWheelPicker */}
      {open && (
        <div className="absolute left-0 mt-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 w-[290px] sm:w-[310px]">
            <TimeWheelPicker
              value={currentValue || '08:30 AM'}
              onChange={handleWheelChange}
              showPreviewText={false}
              className="border-0 p-0 shadow-none bg-transparent"
            />
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSetNow}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 px-2 py-1 rounded-md hover:bg-teal-50 dark:hover:bg-teal-950/40 transition"
              >
                Bây giờ
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 active:scale-95 transition"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   TimeWheelModal (Dialog Picker Wrapper)
   ========================================================================= */

export interface TimeWheelModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  value?: string;
  onConfirm?: (formatted: string, value: TimeWheelValue) => void;
}

export function TimeWheelModal({
  open,
  onClose,
  title = 'Chọn thời gian',
  value: initialValue = '08:30 AM',
  onConfirm,
}: TimeWheelModalProps) {
  const [val, setVal] = useState<TimeWheelValue>(() => {
    const p = parseTimeTo12h(initialValue);
    return formatToTimeValue(p.hour, p.minute, p.period);
  });

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center justify-center py-2">
        <TimeWheelPicker
          value={val.formatted}
          onChange={setVal}
          showPreviewText={true}
          className="border-0 shadow-none p-0"
        />
        <div className="mt-5 flex w-full items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              onConfirm?.(val.formatted, val);
              onClose();
            }}
          >
            Xác nhận
          </Button>
        </div>
      </div>
    </Modal>
  );
}
