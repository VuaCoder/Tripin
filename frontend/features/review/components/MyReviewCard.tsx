import { Badge } from '@/components/ui';
import type { MyReview } from '../types';
import { formatDate } from '../utils/format';
import { RatingStars } from './RatingStars';

export interface MyReviewCardProps {
  review: MyReview;
}

/** The author's own view of a review, including the moderation state the public list hides. */
export function MyReviewCard({ review }: MyReviewCardProps) {
  const hidden = review.status === 'HIDDEN';

  return (
    <article className="rounded-2xl border border-primary-container/20 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Đánh giá của bạn</p>
        <Badge variant={hidden ? 'warning' : 'success'}>{hidden ? 'Đã bị ẩn' : 'Đang hiển thị'}</Badge>
      </header>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <RatingStars value={review.rating} size="sm" />
        <span className="text-xs text-slate-500">{formatDate(review.createdAt)}</span>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{review.comment}</p>
      {hidden && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {review.hiddenReason ? `Lý do: ${review.hiddenReason}` : 'Đánh giá này đang bị kiểm duyệt ẩn khỏi trang tour.'}
        </p>
      )}
    </article>
  );
}
