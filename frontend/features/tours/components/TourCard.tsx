'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/features/auth';
import { GuestLoginPromptModal } from '@/components/shared';
import { usePreloader } from '@/components/preloader';
import { useTourWishlist } from '@/features/wishlist/hooks/useTourWishlist';
import type { TourListItem } from '../types';
import { formatCategoryName, formatDepartureDate, formatDuration, formatVnd } from '../utils';

export interface TourCardProps {
  tour: TourListItem;
  categoryName?: string;
}

/** Card công khai cho 1 tour — hiển thị trên trang khám phá. */
export function TourCard({ tour, categoryName }: TourCardProps) {
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const providerName = tour.agency?.name ?? 'Nhà cung cấp Tripri';
  const [coverFailed, setCoverFailed] = useState(false);
  const wishlist = useTourWishlist(tour.id);

  const { stop: stopPreloader } = usePreloader();

  const handleCardClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      e.stopPropagation();
      stopPreloader();
      setShowLoginModal(true);
    }
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated || wishlist.status === 'guest') {
      stopPreloader();
      setShowLoginModal(true);
      return;
    }
    if (wishlist.status === 'ready' && !wishlist.pending) {
      void wishlist.toggle();
    }
  };

  const cardClassName =
    'group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 cursor-pointer';

  const cardInner = (
    <>
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-teal-900 via-primary-container to-teal-500">
        {tour.coverImage && !coverFailed ? (
          // Tour cover URLs are configured by agencies and may come from different remote hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tour.coverImage} alt={tour.title} onError={() => setCoverFailed(true)} className="size-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-end bg-[radial-gradient(circle_at_80%_15%,rgba(255,255,255,.32),transparent_32%)] p-4 text-white">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">landscape</span>
          </div>
        )}
        {categoryName && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-teal-900 shadow-sm backdrop-blur">
            {formatCategoryName(categoryName)}
          </span>
        )}

        {/* Heart / Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlistClick}
          aria-label={wishlist.isSaved ? 'Bỏ lưu tour' : 'Lưu tour yêu thích'}
          className={`absolute right-3 top-3 flex size-8 items-center justify-center rounded-full transition-all duration-200 ${
            wishlist.isSaved
              ? 'bg-rose-500 text-white shadow-md hover:bg-rose-600'
              : 'bg-black/25 text-white backdrop-blur-sm hover:bg-black/40'
          } ${wishlist.pending ? 'animate-pulse' : ''}`}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: wishlist.isSaved ? "'FILL' 1" : "'FILL' 0" }}>
            favorite
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
          <span className="material-symbols-outlined text-[16px] text-primary-container" aria-hidden="true">location_on</span>
          {tour.destination}
        </p>
        <h2 className="mt-2 line-clamp-2 text-base font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-primary-container">
          {tour.title}
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
    </>
  );

  return (
    <>
      {isAuthenticated ? (
        <Link href={`/tours/${tour.id}`} className={cardClassName}>
          {cardInner}
        </Link>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={handleCardClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCardClick(e as unknown as React.MouseEvent);
            }
          }}
          className={cardClassName}
        >
          {cardInner}
        </div>
      )}
      <GuestLoginPromptModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        redirectUrl={`/tours/${tour.id}`}
        tourTitle={tour.title}
      />
    </>
  );
}
