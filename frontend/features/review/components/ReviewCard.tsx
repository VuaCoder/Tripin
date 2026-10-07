import type { PublicReview } from '../types';
import { formatDate } from '../utils/format';
import { RatingStars } from './RatingStars';

/** "Nguyen A." -> "NA" (the backend already masks the author, so this is all the avatar needs). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export interface ReviewCardProps {
  review: PublicReview;
}

/** One public review. The author is shown exactly as the backend masked it. */
export function ReviewCard({ review }: ReviewCardProps) {
  // One malformed row must not take the whole list down: fall back to the backend's own placeholder.
  const author = review.author ?? { name: 'Traveler' };

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {author.avatarUrl ? (
            // Remote avatar hosts are not whitelisted in a `next.config` on this branch.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-sm font-bold text-primary-container"
            >
              {initialsOf(author.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{author.name}</p>
            <p className="text-xs text-slate-500">{formatDate(review.createdAt)}</p>
          </div>
        </div>
        <RatingStars value={review.rating} size="sm" className="shrink-0" />
      </header>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{review.comment}</p>
    </article>
  );
}
