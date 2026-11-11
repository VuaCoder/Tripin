'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useTourWishlist } from '../hooks';
import {
  addTourToLatestCollection,
  getTourCollectionNames,
  removeTourFromAllCollections,
} from '../utils/wishlistCollections';
import { showWishlistToast } from './WishlistToast';

export interface WishlistButtonProps {
  tourId: string;
  tourTitle?: string;
  tourCoverImage?: string;
  className?: string;
  variant?: 'icon' | 'circle' | 'pill' | 'ghost';
  onGuestClick?: () => void;
}

const ICON_BASE =
  'inline-flex items-center justify-center p-1.5 bg-transparent hover:bg-transparent border-0 outline-none transition-transform duration-150 active:scale-90 hover:scale-110 cursor-pointer select-none';

const PILL_BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all shadow-2xs cursor-pointer select-none active:scale-95';

const CIRCLE_BASE =
  'inline-flex size-10 items-center justify-center rounded-full border transition-all shadow-2xs cursor-pointer select-none active:scale-95';

/**
 * Heart toggle for tours with Optimistic UI & Automatic addition to chosen/latest collection.
 * - variant="icon" (default): borderless clean floating heart with drop shadow (for cards/carousels)
 * - variant="circle": circular icon-only button for toolbars/headers
 * - variant="pill": structured action pill button with label text
 */
export function WishlistButton({
  tourId,
  tourTitle,
  tourCoverImage,
  className,
  variant = 'icon',
  onGuestClick,
}: WishlistButtonProps) {
  const { status, isSaved, error, toggle, retry } = useTourWishlist(tourId);

  if (status === 'not-traveler') return null;

  const isPill = variant === 'pill';
  const isCircle = variant === 'circle';
  const isGhost = variant === 'ghost';

  if (status === 'guest') {
    if (onGuestClick) {
      return (
        <div className={className}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onGuestClick();
            }}
            aria-label="Lưu tour yêu thích"
            title="Đăng nhập để lưu tour"
            className={
              isPill
                ? `${PILL_BASE} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-rose-600`
                : isCircle
                  ? `${CIRCLE_BASE} border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-rose-500`
                  : ICON_BASE
            }
          >
            <Heart
              size={isPill ? 16 : isCircle ? 20 : 22}
              fill={isPill || isCircle || isGhost ? 'none' : 'rgba(0, 0, 0, 0.3)'}
              className={
                isGhost
                  ? 'size-5.5 shrink-0 text-slate-400 hover:text-rose-500 stroke-[2] transition-colors'
                  : isPill || isCircle
                    ? 'size-5 shrink-0 text-slate-600 stroke-[2]'
                    : 'text-white stroke-white fill-black/30 stroke-[2] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]'
              }
              aria-hidden="true"
            />
            {isPill && <span>Lưu</span>}
          </button>
        </div>
      );
    }
    return (
      <div className={className}>
        <Link
          href="/login"
          onClick={(e) => {
            e.stopPropagation();
          }}
          aria-label="Đăng nhập để lưu tour"
          title="Đăng nhập để lưu tour"
          className={
            isPill
              ? `${PILL_BASE} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-rose-600`
              : isCircle
                ? `${CIRCLE_BASE} border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-rose-500`
                : ICON_BASE
          }
        >
          <Heart
            size={isPill ? 16 : isCircle ? 20 : 22}
            fill={isPill || isCircle || isGhost ? 'none' : 'rgba(0, 0, 0, 0.3)'}
            className={
              isGhost
                ? 'size-5.5 shrink-0 text-slate-400 hover:text-rose-500 stroke-[2] transition-colors'
                : isPill || isCircle
                  ? 'size-5 shrink-0 text-slate-600 stroke-[2]'
                  : 'text-white stroke-white fill-black/30 stroke-[2] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]'
            }
            aria-hidden="true"
          />
          {isPill && <span>Lưu</span>}
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            retry();
          }}
          aria-label="Không tải được trạng thái yêu thích. Thử lại"
          title="Không tải được trạng thái yêu thích. Thử lại"
          className={
            isPill
              ? `${PILL_BASE} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`
              : isCircle
                ? `${CIRCLE_BASE} border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100`
                : ICON_BASE
          }
        >
          <Heart
            size={isPill ? 16 : isCircle ? 20 : 22}
            fill="none"
            className={
              isPill || isCircle
                ? 'size-5 shrink-0 text-red-500 stroke-[2]'
                : 'text-red-500 stroke-red-500 stroke-[2]'
            }
            aria-hidden="true"
          />
          {isPill && <span>Thử lại</span>}
        </button>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSaved) {
      // Auto-save to chosen/latest collection and show floating toast
      const snapshot = tourTitle
        ? {
            id: tourId,
            title: tourTitle,
            coverImage: tourCoverImage,
          }
        : undefined;
      const latest = addTourToLatestCollection(tourId, snapshot);
      showWishlistToast({
        tourId,
        tourTitle,
        tourCoverImage,
        collectionName: latest.name,
        collectionId: latest.id,
        action: 'saved',
      });
    } else {
      // Find collection name before removing and show removed toast
      const existingNames = getTourCollectionNames(tourId);
      const targetName = existingNames[0] || 'Danh sách yêu thích';
      removeTourFromAllCollections(tourId);
      showWishlistToast({
        tourId,
        tourTitle,
        tourCoverImage,
        collectionName: targetName,
        collectionId: '',
        action: 'removed',
      });
    }

    void toggle();
  };

  return (
    <div className={className}>
      <button
        type="button"
        aria-pressed={isSaved}
        aria-label={isSaved ? 'Bỏ lưu tour' : 'Lưu tour yêu thích'}
        title={isSaved ? 'Bỏ lưu tour' : 'Lưu tour yêu thích'}
        onClick={handleClick}
        className={
          isPill
            ? `${PILL_BASE} ${
                isSaved
                  ? 'border-rose-200 bg-rose-50/80 text-rose-700 hover:bg-rose-100/90'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-rose-600'
              }`
            : isCircle
              ? `${CIRCLE_BASE} ${
                  isSaved
                    ? 'border-rose-200 bg-rose-50/80 text-rose-500 hover:bg-rose-100/90'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-rose-500'
                }`
              : ICON_BASE
        }
      >
        <Heart
          size={isPill ? 16 : isCircle ? 20 : 22}
          fill={
            isSaved
              ? '#ef4444'
              : isPill || isCircle || isGhost
                ? 'none'
                : 'rgba(0, 0, 0, 0.3)'
          }
          className={
            isGhost
              ? `size-5.5 shrink-0 transition-transform duration-150 ${
                  isSaved
                    ? 'text-red-500 fill-red-500 stroke-red-500'
                    : 'text-slate-400 hover:text-rose-500 stroke-slate-400 stroke-[2]'
                }`
              : isPill || isCircle
                ? `size-5 shrink-0 transition-transform duration-150 ${
                    isSaved
                      ? 'text-rose-500 fill-rose-500 stroke-rose-500'
                      : 'text-slate-600 stroke-slate-600 stroke-[2]'
                  }`
                : `transition-all duration-200 ${
                    isSaved
                      ? '!text-red-500 !stroke-red-500 !fill-red-500 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                      : 'text-white stroke-white fill-black/30 stroke-[2] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]'
                  }`
          }
          aria-hidden="true"
        />
        {isPill && <span>{isSaved ? 'Đã lưu' : 'Lưu'}</span>}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
