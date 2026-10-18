'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useTourWishlist } from '../hooks';

export interface WishlistButtonProps {
  tourId: string;
  className?: string;
}

const BASE =
  'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Heart toggle for Tour Detail. Guests are sent to the login page, non-travelers (agency, admin...) see nothing,
 * and a failed add/remove shows the backend message under the button.
 */
export function WishlistButton({ tourId, className }: WishlistButtonProps) {
  const { status, isSaved, pending, error, toggle, retry } = useTourWishlist(tourId);

  if (status === 'not-traveler') return null;

  if (status === 'guest') {
    return (
      <div className={className}>
        <Link href="/login" aria-label="Đăng nhập để lưu tour" title="Đăng nhập để lưu tour" className={`${BASE} text-slate-700 hover:bg-slate-50`}>
          <Heart size={21} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={className}>
        <button type="button" onClick={retry} aria-label="Không tải được trạng thái yêu thích. Thử lại" title="Không tải được trạng thái yêu thích. Thử lại" className={`${BASE} text-red-700 hover:bg-red-50`}>
          <Heart size={21} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-pressed={isSaved}
        aria-label={isSaved ? 'Bỏ lưu tour' : 'Lưu tour'}
        title={isSaved ? 'Bỏ lưu tour' : 'Lưu tour'}
        disabled={status === 'loading' || pending}
        onClick={() => void toggle()}
        className={`${BASE} ${
          isSaved
            ? 'text-rose-600 hover:bg-rose-50'
            : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        <Heart size={21} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
