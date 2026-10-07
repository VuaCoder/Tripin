'use client';

import { useId } from 'react';
import { cn } from '@/components/ui';
import { REVIEW_RATING_MAX, REVIEW_RATING_MIN } from '../types';

export interface RatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  /** Id of the visible label; the radio group points at it so the field is announced correctly. */
  labelledBy?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}

const STARS = Array.from(
  { length: REVIEW_RATING_MAX - REVIEW_RATING_MIN + 1 },
  (_, index) => REVIEW_RATING_MIN + index,
);

/** 1..5 rating picker: real radio inputs (keyboard + screen reader friendly), stars as the visual. */
export function RatingInput({ value, onChange, labelledBy, describedBy, invalid = false, disabled = false }: RatingInputProps) {
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className="flex flex-wrap items-center gap-1"
    >
      {STARS.map((star) => (
        <label
          key={star}
          className={cn('relative cursor-pointer rounded-lg', disabled && 'cursor-not-allowed opacity-60')}
        >
          {/* The input covers the star: the whole star is the hit target and the input stays focusable. */}
          <input
            type="radio"
            name={name}
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
            disabled={disabled}
            aria-label={`${star} sao`}
            className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <span
            aria-hidden="true"
            className={cn(
              'material-symbols-outlined block p-0.5 text-3xl leading-none transition-colors',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-teal peer-focus-visible:ring-offset-1',
              star <= value ? 'text-amber-500' : 'text-slate-300',
            )}
            style={star <= value ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            star
          </span>
        </label>
      ))}
      <span className="ml-2 text-sm font-semibold text-slate-600">{value > 0 ? `${value}/${REVIEW_RATING_MAX}` : 'Chưa chọn'}</span>
    </div>
  );
}
