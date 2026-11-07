'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GuestLoginPromptModal } from '@/components/shared';
import { WishlistButton } from '@/features/wishlist/components/WishlistButton';
import type { TourListItem } from '../types';
import { formatCategoryName, formatDepartureDate, formatDuration, formatVnd } from '../utils';

export interface TourCardProps {
  tour: TourListItem;
  categoryName?: string;
}

/** Card công khai cho 1 tour — hiển thị trên trang khám phá. */
export function TourCard({ tour, categoryName }: TourCardProps) {
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const providerName = tour.agency?.name ?? 'Nhà cung cấp Tripri';
  const [coverFailed, setCoverFailed] = useState(false);

  const cardClassName =
    'group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-shadow duration-300 hover:shadow-xl hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer transform-gpu';

  return (
    <>
      <div
        onClick={() => router.push(`/tours/${tour.id}`)}
        className={cardClassName}
        role="group"
        aria-label={tour.title}
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl bg-gradient-to-br from-teal-900 via-primary-container to-teal-500 isolate [transform:translateZ(0)]">
          {tour.coverImage && !coverFailed ? (
            // Tour cover URLs are configured by agencies and may come from different remote hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tour.coverImage}
              alt={tour.title}
              onError={() => setCoverFailed(true)}
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 will-change-transform"
            />
          ) : (
            <div className="flex size-full items-end bg-[radial-gradient(circle_at_80%_15%,rgba(255,255,255,.32),transparent_32%)] p-4 text-white">
              <span className="material-symbols-outlined text-3xl" aria-hidden="true">landscape</span>
            </div>
          )}
          {categoryName && (
            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-teal-900 shadow-sm backdrop-blur pointer-events-none select-none">
              {formatCategoryName(categoryName)}
            </span>
          )}

          {/* Heart / Wishlist Button (Identical to Home page AirbnbTourCarousel) */}
          <div
            className="absolute right-3 top-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <WishlistButton
              tourId={tour.id}
              tourTitle={tour.title}
              tourCoverImage={tour.coverImage}
              onGuestClick={() => setShowLoginModal(true)}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
            <span className="material-symbols-outlined text-[16px] text-primary-container" aria-hidden="true">location_on</span>
            {tour.destination}
          </p>
          <h2 className="mt-2 line-clamp-2 text-base font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-primary-container">
            <Link
              href={`/tours/${tour.id}`}
              onClick={(e) => e.stopPropagation()}
              prefetch={false}
              className="focus:outline-none hover:underline"
            >
              {tour.title}
            </Link>
          </h2>
          {tour.summary && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">{tour.summary}</p>}

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[16px]" aria-hidden="true">schedule</span>{formatDuration(tour.durationDays)}</span>
            <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-amber-500" aria-hidden="true">star</span>{tour.ratingCount > 0 ? `${tour.ratingAvg.toFixed(1)} (${tour.ratingCount})` : 'Chưa có đánh giá'}</span>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              {tour.agency?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tour.agency.avatarUrl} alt="" className="size-6 rounded-full border border-slate-100 object-cover" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-800">{providerName.charAt(0).toUpperCase()}</span>
              )}
              <span className="truncate">Bởi {providerName}</span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0 text-xs text-slate-500">
                <span className="block">Khởi hành gần nhất</span>
                <span className="font-semibold text-slate-700">{formatDepartureDate(tour.nextDepartureDate)}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-[11px] font-medium text-slate-500">Chỉ từ</span>
                <strong className="text-base font-extrabold text-primary-container" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatVnd(tour.basePrice)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GuestLoginPromptModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        redirectUrl={`/tours/${tour.id}`}
        tourTitle={tour.title}
      />
    </>
  );
}
