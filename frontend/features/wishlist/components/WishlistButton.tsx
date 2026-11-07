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
  onGuestClick?: () => void;
}

const BASE =
  'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 cursor-pointer';

/**
 * Heart toggle for tours with Optimistic UI & Automatic addition to newest collection.
 * Displays floating bottom toast on save & remove:
 * - Save: "[Cover] Đã lưu vào **[Tên]**    Thay đổi"
 * - Remove: "[Cover] Đã xoá khỏi **[Tên]**"
 */
export function WishlistButton({
  tourId,
  tourTitle,
  tourCoverImage,
  className,
  onGuestClick,
}: WishlistButtonProps) {
  const { status, isSaved, error, toggle, retry } = useTourWishlist(tourId);

  if (status === 'not-traveler') return null;

  if (status === 'guest') {
    if (onGuestClick) {
      return (
        <div className={className}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onGuestClick();
            }}
            aria-label="Lưu tour yêu thích"
            title="Đăng nhập để lưu tour"
            className={`${BASE} text-slate-700 hover:bg-slate-50`}
          >
            <Heart size={21} aria-hidden="true" />
          </button>
        </div>
      );
    }
    return (
      <div className={className}>
        <Link
          href="/login"
          aria-label="Đăng nhập để lưu tour"
          title="Đăng nhập để lưu tour"
          className={`${BASE} text-slate-700 hover:bg-slate-50`}
        >
          <Heart size={21} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={retry}
          aria-label="Không tải được trạng thái yêu thích. Thử lại"
          title="Không tải được trạng thái yêu thích. Thử lại"
          className={`${BASE} text-red-700 hover:bg-red-50`}
        >
          <Heart size={21} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isSaved) {
      // Auto-save to newest collection and show floating toast
      const latest = addTourToLatestCollection(tourId);
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
        className={`${BASE} text-slate-700 hover:bg-slate-50`}
      >
        <Heart
          size={21}
          fill={isSaved ? '#ef4444' : 'none'}
          className={isSaved ? '!text-red-500 !stroke-red-500 !fill-red-500' : ''}
          aria-hidden="true"
        />
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
