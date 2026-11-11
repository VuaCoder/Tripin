'use client';

import { useState, type ReactNode } from 'react';
import { Popover, Button } from 'antd';
import { ChevronDown, Minus, Plus, RotateCcw, Users } from 'lucide-react';
import { guestTotal, type GuestCounts } from '@travel-platform/constants';
import { cn } from './cn';

export interface GuestGroupDropdownProps {
  value: GuestCounts | null;
  onChange: (next: GuestCounts | null) => void;
  minTotal?: number;
  maxTotal?: number;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  id?: string;
  describedBy?: string;
  invalid?: boolean;
  className?: string;
  triggerIcon?: ReactNode;
}

const ROWS: Array<{
  key: keyof GuestCounts;
  label: string;
  hint: string;
  decreaseLabel: string;
  increaseLabel: string;
  inputLabel: string;
}> = [
  {
    key: 'adults',
    label: 'Người lớn',
    hint: 'Từ 13 tuổi trở lên',
    decreaseLabel: 'Giảm số người lớn',
    increaseLabel: 'Tăng số người lớn',
    inputLabel: 'Số người lớn',
  },
  {
    key: 'children',
    label: 'Trẻ em',
    hint: 'Từ 2 – 12 tuổi',
    decreaseLabel: 'Giảm số trẻ em',
    increaseLabel: 'Tăng số trẻ em',
    inputLabel: 'Số trẻ em',
  },
  {
    key: 'infants',
    label: 'Em bé',
    hint: 'Dưới 2 tuổi',
    decreaseLabel: 'Giảm số em bé',
    increaseLabel: 'Tăng số em bé',
    inputLabel: 'Số em bé',
  },
];

export function formatGuestGroupSummary(counts: GuestCounts | null, emptyLabel = 'Chưa giới hạn (tùy chọn)'): string {
  if (!counts) return emptyLabel;
  const total = guestTotal(counts);
  const parts: string[] = [];
  if (counts.adults > 0) parts.push(`${counts.adults} người lớn`);
  if (counts.children > 0) parts.push(`${counts.children} trẻ em`);
  if (counts.infants > 0) parts.push(`${counts.infants} em bé`);
  return parts.length > 0 ? `${total} khách (${parts.join(', ')})` : `${total} khách`;
}

export function GuestGroupDropdown({
  value,
  onChange,
  minTotal = 1,
  maxTotal = 10_000,
  disabled = false,
  allowEmpty = false,
  emptyLabel = 'Chưa giới hạn (tùy chọn)',
  id,
  describedBy,
  invalid = false,
  className,
  triggerIcon,
}: GuestGroupDropdownProps) {
  const [open, setOpen] = useState(false);

  const current: GuestCounts = value ?? { adults: 0, children: 0, infants: 0 };
  const total = guestTotal(current);

  const commit = (candidate: GuestCounts) => {
    const clean: GuestCounts = {
      adults: Math.max(0, Math.min(maxTotal, Math.trunc(candidate.adults || 0))),
      children: Math.max(0, Math.min(maxTotal, Math.trunc(candidate.children || 0))),
      infants: Math.max(0, Math.min(maxTotal, Math.trunc(candidate.infants || 0))),
    };
    const nextTotal = guestTotal(clean);
    if (nextTotal > maxTotal) return;
    if (allowEmpty && nextTotal === 0) {
      onChange(null);
      return;
    }
    if (nextTotal < minTotal) return;
    onChange(clean);
  };

  const stepGroup = (key: keyof GuestCounts, delta: number) => {
    if (disabled) return;
    if (!value && delta > 0) {
      const seeded: GuestCounts = { adults: 0, children: 0, infants: 0, [key]: Math.max(minTotal, 1) };
      commit(seeded);
      return;
    }
    const nextVal = Math.max(0, current[key] + delta);
    commit({ ...current, [key]: nextVal });
  };

  const setGroupDirect = (key: keyof GuestCounts, raw: string) => {
    if (disabled) return;
    const digits = raw.replace(/\D+/g, '');
    const parsed = digits === '' ? 0 : Number(digits);
    if (!Number.isFinite(parsed)) return;
    const others = total - current[key];
    const minForField = allowEmpty ? 0 : Math.max(0, minTotal - others);
    const maxForField = Math.max(0, maxTotal - others);
    const clamped = Math.max(minForField, Math.min(maxForField, parsed));
    commit({ ...current, [key]: clamped });
  };

  const content = (
    <div className="w-[300px] sm:w-[320px] space-y-3 p-1" role="group" aria-label="Điều chỉnh số lượng khách theo độ tuổi">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Phân bổ số khách</p>
          <p className="text-sm font-bold text-slate-900">
            {value ? `Tổng: ${total} khách` : 'Chưa đặt giới hạn'}
          </p>
        </div>
        {allowEmpty && value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Bỏ giới hạn
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {ROWS.map((row) => {
          const val = current[row.key];
          const othersTotal = total - val;
          const minForRow = allowEmpty ? 0 : Math.max(0, minTotal - othersTotal);
          const canDecrease = !disabled && val > minForRow;
          const canIncrease = !disabled && total < maxTotal;

          return (
            <div key={row.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 leading-tight">{row.label}</p>
                <p className="text-xs font-medium text-slate-500">{row.hint}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="default"
                  size="small"
                  shape="circle"
                  disabled={!canDecrease}
                  onClick={() => stepGroup(row.key, -1)}
                  aria-label={row.decreaseLabel}
                  icon={<Minus className="size-3.5" />}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={row.inputLabel}
                  value={val}
                  disabled={disabled}
                  onChange={(e) => setGroupDirect(row.key, e.target.value)}
                  className="w-12 rounded-lg border border-slate-200 bg-white py-1 text-center text-sm font-bold text-slate-900 tabular-nums outline-none focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/15 disabled:bg-slate-100 disabled:text-slate-400"
                />
                <Button
                  type="default"
                  size="small"
                  shape="circle"
                  disabled={!canIncrease}
                  onClick={() => stepGroup(row.key, 1)}
                  aria-label={row.increaseLabel}
                  icon={<Plus className="size-3.5" />}
                />
              </div>
            </div>
          );
        })}
      </div>

      {minTotal > 1 && (
        <p className="text-[11px] font-medium text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
          Tối thiểu {minTotal} khách do đã có khách đặt chỗ.
        </p>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={disabled ? false : open}
      onOpenChange={(nextOpen) => { if (!disabled) setOpen(nextOpen); }}
      placement="bottomLeft"
      zIndex={1100}
    >
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          'flex min-h-[42px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition outline-none',
          disabled
            ? 'cursor-not-allowed border-[#d9d9d9] bg-black/[0.04] text-black/25'
            : invalid
              ? 'cursor-pointer border-red-400 bg-white ring-2 ring-red-100'
              : open
                ? 'cursor-pointer border-[#087e8b] bg-white ring-2 ring-[#087e8b]/15'
                : 'cursor-pointer border-[#d9d9d9] bg-white hover:border-[#087e8b]',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {triggerIcon ?? <Users className={cn('size-4 shrink-0', disabled ? 'text-slate-400' : 'text-[#087e8b]')} aria-hidden="true" />}
          <span
            className={cn(
              'truncate text-[13.5px] font-semibold tabular-nums',
              disabled ? 'text-slate-400 font-medium' : value ? 'text-slate-900' : 'text-slate-400',
            )}
          >
            {formatGuestGroupSummary(value, emptyLabel)}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 transition-transform', disabled ? 'text-slate-300' : 'text-slate-400', open && !disabled && 'rotate-180 text-[#087e8b]')}
          aria-hidden="true"
        />
      </button>
    </Popover>
  );
}

