import { cn } from '@/components/ui';
import { Star } from 'lucide-react';
import { REVIEW_RATING_MAX } from '../types';

export interface RatingStarsProps {
  /** 0..5, fractions allowed (the backend stores whole ratings, the average is rounded to 2 decimals). */
  value: number;
  /** When given, the accessible label also announces the number of reviews. */
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl' } as const;

/** Read-only star rating using SVG icons so it does not depend on a web font. */
export function RatingStars({ value, count, size = 'md', className }: RatingStarsProps) {
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), REVIEW_RATING_MAX) : 0;
  const rounded = Math.round(safeValue * 2) / 2;
  const label =
    count == null
      ? `${safeValue} trên ${REVIEW_RATING_MAX}`
      : `${safeValue} trên ${REVIEW_RATING_MAX}, ${count} đánh giá`;

  return (
    <span className={cn('inline-flex items-center', className)} role="img" aria-label={label}>
      {Array.from({ length: REVIEW_RATING_MAX }, (_, index) => index + 1).map((star) => {
        const filled = rounded >= star;
        const half = !filled && rounded >= star - 0.5;
        return (
          <span key={star} aria-hidden="true" className={cn('relative inline-flex size-[1em] shrink-0', SIZES[size])}>
            <Star className={cn('size-full', filled ? 'fill-amber-500 text-amber-500' : 'fill-slate-300 text-slate-300')} />
            {half && (
              <Star className="absolute inset-0 size-full fill-amber-500 text-amber-500" style={{ clipPath: 'inset(0 50% 0 0)' }} />
            )}
          </span>
        );
      })}
    </span>
  );
}
