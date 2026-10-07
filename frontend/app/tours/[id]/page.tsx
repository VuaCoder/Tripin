'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, MapPin } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/shared';
import { RatingStars, TourReviewsSection, formatDuration, formatVnd, useGetTourDetailQuery } from '@/features/review';

/**
 * Thin public tour page: enough context for the reviews block ("View public review" / "Write a review").
 * The full tour detail design (gallery, itinerary, departures, booking CTA) is a separate task — this page
 * deliberately stays a header plus the reviews section.
 */
export default function TourDetailPage() {
  const params = useParams<{ id: string }>();
  const tourId = typeof params?.id === 'string' ? params.id : '';

  const { data: tour, isLoading, isError, refetch } = useGetTourDetailQuery(tourId, { skip: !tourId });

  return (
    <AppShell role="PUBLIC">
      <Link
        href="/tours"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-primary-container"
      >
        <ArrowLeft className="size-4" /> Danh sách tour
      </Link>

      {!tourId || isError ? (
        <div className="mt-6">
          <ErrorState
            title="Không tìm thấy tour"
            message="Tour này không tồn tại hoặc đã ngừng hiển thị."
            actionLabel="Thử lại"
            onAction={refetch}
          />
        </div>
      ) : isLoading || !tour ? (
        <LoadingState label="Đang tải thông tin tour..." className="mt-6" />
      ) : (
        <>
          <article className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            {tour.coverImage && (
              // Tour images are remote URLs and no `next.config` image host is whitelisted on this branch.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tour.coverImage} alt={tour.title} className="h-56 w-full object-cover sm:h-72" />
            )}

            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden="true" />
                  {tour.destination}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-4" aria-hidden="true" />
                  {formatDuration(tour.durationDays)}
                </span>
                {tour.agency && <span>Tổ chức bởi {tour.agency.name}</span>}
              </div>

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{tour.title}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RatingStars value={tour.ratingAvg} count={tour.ratingCount} size="sm" />
                <span className="text-sm text-slate-500">
                  {tour.ratingCount > 0 ? `${tour.ratingAvg.toFixed(1)}/5 · ${tour.ratingCount} đánh giá` : 'Chưa có đánh giá'}
                </span>
              </div>

              <p className="mt-3 text-lg font-extrabold text-primary-container" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatVnd(tour.basePrice)} <span className="text-xs font-semibold text-slate-500">/ khách</span>
              </p>

              {tour.description && (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{tour.description}</p>
              )}
            </div>
          </article>

          <TourReviewsSection
            tourId={tour.id}
            tourTitle={tour.title}
            ratingAvg={tour.ratingAvg}
            ratingCount={tour.ratingCount}
          />
        </>
      )}
    </AppShell>
  );
}
