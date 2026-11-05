'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDuration, formatVnd } from '../utils';
import { WishlistButton } from '@/features/wishlist/components/WishlistButton';
import type { TourListItem } from '../types';

interface AirbnbTourCarouselProps {
  title: string;
  subtitle?: string;
  tours: TourListItem[];
  viewAllHref: string;
  badgeText?: string;
  isLoading?: boolean;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80';

export function AirbnbTourCarousel({
  title,
  subtitle,
  tours,
  viewAllHref,
  badgeText = 'Được khách yêu thích',
  isLoading = false,
}: AirbnbTourCarouselProps) {
  const router = useRouter();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Airbnb limit: maximum 9 tours per section
  const displayTours = (tours || []).slice(0, 9);

  // Extract up to 3 real tour images for the stacked "Xem tất cả" end card
  const previewImages = displayTours
    .map((t) => t.coverImage)
    .filter(Boolean)
    .slice(0, 3) as string[];

  const updateScrollState = () => {
    if (!sliderRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    updateScrollState();
    const handleResize = () => updateScrollState();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [displayTours]);

  const scroll = (direction: 'left' | 'right') => {
    if (!sliderRef.current) return;
    const scrollAmount = sliderRef.current.clientWidth * 0.75;
    sliderRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (isLoading) {
    return (
      <section className="mb-14">
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="size-9 rounded-full bg-slate-200 animate-pulse" />
            <div className="size-9 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </div>
        <div className="flex gap-4 sm:gap-5 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-[260px] sm:w-[280px] shrink-0 flex flex-col gap-3"
            >
              <div className="aspect-[4/3] w-full rounded-2xl bg-slate-200 animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-1/3 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!displayTours || displayTours.length === 0) {
    return null;
  }

  return (
    <section className="mb-14">
      {/* 1. Header with title link and 60fps prev/next buttons */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="min-w-0">
          <Link
            href={viewAllHref}
            className="group inline-flex items-center gap-2 hover:opacity-85 transition-opacity"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
              {title}
            </h2>
            <span className="material-symbols-outlined text-[20px] text-slate-700 transition-transform duration-200 group-hover:translate-x-1 shrink-0">
              arrow_forward
            </span>
          </Link>
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Carousel Arrow Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            aria-label="Xem các tour phía trước"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:border-slate-800 hover:bg-slate-50 disabled:opacity-30 disabled:border-slate-200 disabled:hover:bg-white disabled:cursor-not-allowed transition-all shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            aria-label="Xem thêm tour tiếp theo"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:border-slate-800 hover:bg-slate-50 disabled:opacity-30 disabled:border-slate-200 disabled:hover:bg-white disabled:cursor-not-allowed transition-all shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* 2. Smooth 60fps Carousel Container */}
      <div
        ref={sliderRef}
        onScroll={updateScrollState}
        className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth py-1 px-1 no-scrollbar snap-x snap-mandatory focus:outline-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {displayTours.map((tour) => {
          const imageSrc = tour.coverImage || FALLBACK_IMAGE;
          const rating = tour.ratingAvg && tour.ratingAvg > 0 ? tour.ratingAvg : 4.9;

          return (
            <div
              key={tour.id}
              onClick={() => router.push(`/tours/${tour.id}`)}
              className="w-[260px] sm:w-[280px] shrink-0 snap-start flex flex-col group cursor-pointer"
            >
              {/* Image Box */}
              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-100 shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt={tour.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                  }}
                />

                {/* Top-Left Badge: "Được khách yêu thích" */}
                {badgeText && (
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-900 shadow-xs border border-white/60 pointer-events-none select-none">
                    {badgeText}
                  </div>
                )}

                {/* Top-Right Heart Wishlist Button: Red heart when saved */}
                <div
                  className="absolute top-2.5 right-2.5 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <WishlistButton
                    tourId={tour.id}
                    className="[&_a]:!bg-black/35 [&_a]:!text-white [&_a]:hover:!bg-black/55 [&_button]:!bg-black/35 [&_button]:!text-white [&_button]:hover:!bg-black/55 [&_button[aria-pressed='true']_svg]:!fill-red-500 [&_button[aria-pressed='true']_svg]:!stroke-red-500 [&_button[aria-pressed='true']_svg]:!text-red-500 [&_a]:!size-8 [&_button]:!size-8 [&_svg]:!size-4"
                  />
                </div>
              </div>

              {/* Tour Details */}
              <div className="pt-2.5 flex flex-col">
                {/* Title & Rating */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-[14px] sm:text-[15px] line-clamp-1 group-hover:text-primary-container transition-colors">
                    {tour.title}
                  </h3>
                  <div className="flex items-center gap-0.5 text-xs font-bold text-slate-900 shrink-0 mt-0.5">
                    <span className="text-amber-500 text-[13px]">★</span>
                    <span>{rating.toFixed(rating % 1 === 0 ? 0 : 1)}</span>
                  </div>
                </div>

                {/* Destination & Duration */}
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                  {tour.destination} • {formatDuration(tour.durationDays)}
                </p>

                {/* Price */}
                <div className="mt-1 text-xs text-slate-600">
                  <span>Giá từ </span>
                  <span className="font-extrabold text-sm text-slate-900">
                    {formatVnd(tour.basePrice)}
                  </span>
                  <span> / khách</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* 3. End Card: "Xem tất cả" (Clean Airbnb Style, no heavy hover shadow) */}
        <div
          onClick={() => router.push(viewAllHref)}
          className="w-[200px] sm:w-[220px] shrink-0 snap-start flex flex-col justify-center items-center text-center rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-400 transition-colors duration-200 group cursor-pointer"
        >
          {/* Stacked Rotated Real Tour Thumbnails */}
          <div className="relative w-28 h-24 flex items-center justify-center my-2">
            {previewImages[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImages[0]}
                alt="Tour preview 1"
                className="absolute w-16 h-16 rounded-xl object-cover shadow-sm -rotate-12 -translate-x-3 border-2 border-white transition-transform duration-200 group-hover:-rotate-16"
              />
            )}
            {previewImages[1] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImages[1]}
                alt="Tour preview 2"
                className="absolute w-16 h-16 rounded-xl object-cover shadow-sm rotate-6 translate-x-3 translate-y-1 border-2 border-white transition-transform duration-200 group-hover:rotate-12"
              />
            )}
            {previewImages[2] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImages[2]}
                alt="Tour preview 3"
                className="absolute w-14 h-14 rounded-lg object-cover shadow-xs rotate-0 -translate-y-3 border-2 border-white"
              />
            )}
          </div>

          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-primary-container transition-colors mt-2">
            Xem tất cả
          </h3>

          <div className="mt-3 flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 group-hover:bg-primary-container group-hover:text-white transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </div>
        </div>
      </div>
    </section>
  );
}
