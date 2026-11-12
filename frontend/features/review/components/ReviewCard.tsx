import { useState } from 'react';
import type { PublicReview } from '../types';
import { formatReviewDate } from '../utils/format';
import { RatingStars } from './RatingStars';
import { ReviewPhotos } from './ReviewPhotos';

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

/** One public review in Airbnb vertical card style. */
export function ReviewCard({ review }: ReviewCardProps) {
  // One malformed row must not take the whole list down: fall back to the backend's own placeholder.
  const author = review.author ?? { name: 'Traveler' };
  const [expanded, setExpanded] = useState(false);
  const isLong = (review.comment?.length ?? 0) > 160;

  return (
    <article className="flex flex-col py-2">
      {/* Header with avatar, name & time */}
      <header className="flex items-center gap-3">
        {author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatarUrl}
            alt={author.name}
            className="size-11 shrink-0 rounded-full object-cover ring-1 ring-slate-100"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700"
          >
            {initialsOf(author.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-slate-900">{author.name}</p>
          <p className="text-xs text-slate-500">Du khách trên Tripri</p>
        </div>
      </header>

      {/* Stars & Relative Date */}
      <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-600">
        <RatingStars value={review.rating} size="sm" />
        <span aria-hidden="true" className="text-slate-400">·</span>
        <span className="font-medium text-slate-500">{formatReviewDate(review.createdAt)}</span>
      </div>

      {/* Comment body with "Hiển thị thêm" */}
      <div className="mt-2">
        <p
          className={`whitespace-pre-line text-[14px] leading-relaxed text-slate-800 font-normal ${
            !expanded && isLong ? 'line-clamp-3' : ''
          }`}
        >
          {review.comment}
        </p>
        {!expanded && isLong && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 text-[14px] font-semibold text-slate-900 underline underline-offset-2 hover:text-teal-700"
          >
            Hiển thị thêm
          </button>
        )}
      </div>

      {review.images && review.images.length > 0 && (
        <div className="mt-3">
          <ReviewPhotos images={review.images} author={author.name} />
        </div>
      )}
    </article>
  );
}
