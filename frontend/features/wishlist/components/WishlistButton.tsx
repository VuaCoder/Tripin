'use client';

import Link from 'next/link';
import { useTourWishlist } from '../hooks';

export interface WishlistButtonProps {
  tourId: string;
  className?: string;
}

const BASE =
  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

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
        <Link href="/login" className={`${BASE} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">favorite</span>
          Đăng nhập để lưu tour
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={className}>
        <button type="button" onClick={retry} className={`${BASE} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}>
          Không tải được trạng thái yêu thích. Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-pressed={isSaved}
        disabled={status === 'loading' || pending}
        onClick={() => void toggle()}
        className={`${BASE} ${
          isSaved
            ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span
          className="material-symbols-outlined text-[18px]"
          style={{ fontVariationSettings: `'FILL' ${isSaved ? 1 : 0}` }}
          aria-hidden="true"
        >
          favorite
        </span>
        {isSaved ? 'Đã lưu' : 'Lưu tour'}
      </button>
      {isSaved && !error && (
        <p className="mt-1 text-xs text-slate-500">
          <Link href="/traveler/wishlist" className="underline">
            Xem danh sách yêu thích
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
