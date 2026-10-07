'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { useGetTourReviewsQuery } from '../api/reviewApi';
import { useTourReviewEligibility } from '../hooks';
import { REVIEW_PAGE_SIZE, type MyReview, type PublicReview, type ReviewSort } from '../types';
import { MyReviewCard } from './MyReviewCard';
import { RatingStars } from './RatingStars';
import { ReviewCard } from './ReviewCard';
import { WriteReviewDialog } from './WriteReviewDialog';

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'rating_desc', label: 'Điểm cao nhất' },
  { value: 'rating_asc', label: 'Điểm thấp nhất' },
];

/** Keeps one row per review when pages overlap (an invalidation refetch re-reads the current page). */
function dedupeById(reviews: PublicReview[]): PublicReview[] {
  const seen = new Set<string>();
  const unique: PublicReview[] = [];
  for (const review of reviews) {
    if (seen.has(review.id)) continue;
    seen.add(review.id);
    unique.push(review);
  }
  return unique;
}

export interface TourReviewsSectionProps {
  tourId: string;
  tourTitle: string;
  /** Taken from the tour DTO the page already loaded — the list itself only reads reviews. */
  ratingAvg: number;
  ratingCount: number;
}

/**
 * "View reviews" + "Write a review" for one tour: the public list (loading / error / empty / pages) and the
 * eligibility-driven write area. The backend owns every rule; this only mirrors them for the UI.
 */
export function TourReviewsSection({ tourId, tourTitle, ratingAvg, ratingCount }: TourReviewsSectionProps) {
  const router = useRouter();
  const eligibility = useTourReviewEligibility(tourId);

  const [sort, setSort] = useState<ReviewSort>('newest');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PublicReview[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [created, setCreated] = useState<MyReview | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useGetTourReviewsQuery({
    tourId,
    sort,
    page,
    limit: REVIEW_PAGE_SIZE,
  });

  // Pages accumulate; page 1 (a new sort, or a refresh) replaces the list.
  useEffect(() => {
    if (!data) return;
    setItems((previous) => (page === 1 ? data.items : dedupeById([...previous, ...data.items])));
  }, [data, page]);

  // A different tour starts from a clean list (skipped on mount, which must keep the first page).
  const mountedTourId = useRef(tourId);
  useEffect(() => {
    if (mountedTourId.current === tourId) return;
    mountedTourId.current = tourId;
    setPage(1);
    setItems([]);
  }, [tourId]);

  const handleSortChange = useCallback(
    (next: ReviewSort) => {
      if (next === sort) return;
      setSort(next);
      setPage(1);
      setItems([]);
    },
    [sort],
  );

  const handleCreated = useCallback((review: MyReview) => {
    setCreated(review);
    setDialogOpen(false);
    setPage(1);
  }, []);

  const meta = data?.meta;
  const canLoadMore = Boolean(meta && meta.page < meta.totalPages);
  const showLoading = isLoading && items.length === 0;
  const showError = isError && items.length === 0;
  const loginHref = `/login?next=${encodeURIComponent(`/tours/${tourId}`)}`;

  const writeArea = () => {
    switch (eligibility.status) {
      case 'loading':
        return (
          <Button size="sm" loading loadingLabel="Đang kiểm tra..." disabled>
            Viết đánh giá
          </Button>
        );

      case 'guest':
        return (
          <div className="space-y-2">
            <Button size="sm" onClick={() => router.push(loginHref)}>
              Đăng nhập để đánh giá
            </Button>
            <p className="text-xs text-slate-500">Bạn cần đăng nhập bằng tài khoản du khách để viết đánh giá.</p>
          </div>
        );

      case 'not-traveler':
        return <p className="text-xs text-slate-500">Chỉ tài khoản du khách (Traveler) có thể viết đánh giá tour.</p>;

      case 'not-completed':
        return (
          <div className="space-y-2">
            <Button size="sm" disabled>
              Viết đánh giá
            </Button>
            <p className="text-xs text-slate-500">
              Bạn chỉ có thể đánh giá sau khi một chuyến đi của tour này hoàn thành.
            </p>
          </div>
        );

      case 'already-reviewed':
        return (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">Bạn đã đánh giá tour này</p>
            {eligibility.myReviews.map((review) => (
              <MyReviewCard key={review.id} review={review} />
            ))}
          </div>
        );

      case 'error':
        return (
          <div className="space-y-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
            <p className="text-xs font-medium text-red-700">Không kiểm tra được điều kiện đánh giá.</p>
            <Button variant="outline" size="sm" onClick={eligibility.retry}>
              Thử lại
            </Button>
          </div>
        );

      case 'eligible':
      default:
        return (
          <div className="space-y-3">
            <Button
              size="sm"
              onClick={() => {
                setCreated(null);
                setDialogOpen(true);
              }}
            >
              Viết đánh giá
            </Button>
            <p className="text-xs text-slate-500">
              {eligibility.eligibleBookings.length === 1
                ? 'Bạn có 1 chuyến đi đủ điều kiện đánh giá.'
                : `Bạn có ${eligibility.eligibleBookings.length} chuyến đi đủ điều kiện đánh giá.`}
            </p>
            {eligibility.myReviews.map((review) => (
              <MyReviewCard key={review.id} review={review} />
            ))}
          </div>
        );
    }
  };

  return (
    <section aria-labelledby="tour-reviews-heading" className="mt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="tour-reviews-heading" className="text-xl font-extrabold tracking-tight text-slate-900">
            Đánh giá từ du khách
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <RatingStars value={ratingAvg} count={ratingCount} size="sm" />
            <span className="text-sm text-slate-500">
              {ratingCount > 0 ? `${ratingAvg.toFixed(1)}/5 · ${ratingCount} đánh giá` : 'Chưa có đánh giá'}
            </span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Sắp xếp
          <select
            value={sort}
            onChange={(event) => handleSortChange(event.target.value as ReviewSort)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {created && (
            <p
              role="status"
              className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
            >
              Cảm ơn bạn! Đánh giá đã được đăng.
            </p>
          )}

          {showLoading && <LoadingState label="Đang tải đánh giá..." />}

          {showError && (
            <ErrorState
              title="Không tải được đánh giá"
              message="Vui lòng kiểm tra kết nối và thử lại."
              onAction={refetch}
            />
          )}

          {!showLoading && !showError && items.length === 0 && (
            <EmptyState
              title="Chưa có đánh giá nào"
              description="Hãy là người đầu tiên chia sẻ cảm nhận về tour này."
            />
          )}

          {items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}

          {isError && items.length > 0 && (
            <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              Không tải thêm được đánh giá. Vui lòng thử lại.
            </p>
          )}

          {canLoadMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                loading={isFetching}
                loadingLabel="Đang tải thêm..."
                onClick={() => setPage((current) => current + 1)}
              >
                Xem thêm đánh giá
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:self-start">
          <h3 className="text-base font-bold text-slate-900">Chia sẻ trải nghiệm của bạn</h3>
          {writeArea()}
        </aside>
      </div>

      <WriteReviewDialog
        open={dialogOpen && eligibility.status === 'eligible'}
        onClose={() => setDialogOpen(false)}
        tourTitle={tourTitle}
        eligibleBookings={eligibility.eligibleBookings}
        onCreated={handleCreated}
        onDuplicate={eligibility.retry}
      />
    </section>
  );
}
