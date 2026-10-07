import { cn } from '@/components/ui';
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

/** Read-only star rating. Material Symbols is loaded globally (`globals.css`). */
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
          <span
            key={star}
            aria-hidden="true"
            className={cn('material-symbols-outlined leading-none', SIZES[size], filled || half ? 'text-amber-500' : 'text-slate-300')}
            style={filled || half ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            {half ? 'star_half' : 'star'}
          </span>
        );
      })}
    </span>
  );
}
