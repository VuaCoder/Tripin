'use client';

/* eslint-disable @next/next/no-img-element -- tour covers are arbitrary remote URLs; the card only needs a thumbnail */
import Link from 'next/link';
import { formatDepartureDate, formatDuration, formatVnd } from '@/features/cart';
import type { WishlistItem } from '../types';

export interface WishlistItemCardProps {
  item: WishlistItem;
  /** A remove request for this tour is in flight. */
  busy?: boolean;
  onRemove?: (tourId: string) => void;
}

/**
 * One saved tour. Available tours link to Tour Detail; tours that are no longer public (suspended, archived,
 * deleted) have no card from the backend, so only a notice and the remove button are shown.
 */
export function WishlistItemCard({ item, busy = false, onRemove }: WishlistItemCardProps) {
  const { tour } = item;
  const detailHref = `/tours/${item.tourId}`;

  return (
    <article
      data-testid="wishlist-item"
      aria-busy={busy || undefined}
      className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
    >
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-low text-primary-container">
        {tour?.coverImage ? (
          <img src={tour.coverImage} alt={tour.title} className="h-full w-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-3xl" aria-hidden="true">travel_explore</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {item.available && tour ? (
              <>
                <h3 className="truncate text-sm font-bold text-slate-900">
                  <Link href={detailHref} className="hover:text-primary-container hover:underline">
                    {tour.title}
                  </Link>
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {tour.destination} · {formatDuration(tour.durationDays)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Khởi hành gần nhất: {formatDepartureDate(tour.nextDepartureDate)}
                </p>
              </>
            ) : (
              <h3 className="text-sm font-bold text-slate-500">Tour không còn khả dụng</h3>
            )}
          </div>

          <button
            type="button"
            aria-label="Bỏ khỏi danh sách yêu thích"
            title="Bỏ khỏi danh sách yêu thích"
            disabled={busy}
            onClick={() => onRemove?.(item.tourId)}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
          </button>
        </div>

        {!item.available || !tour ? (
          <p role="status" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <span className="material-symbols-outlined align-middle text-[16px]" aria-hidden="true">warning</span>{' '}
            Tour này đã ngừng bán hoặc đã bị gỡ. Bạn có thể bỏ nó khỏi danh sách.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Từ <span className="text-sm font-bold text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatVnd(tour.basePrice)}</span> / khách
            </span>
            <Link
              href={detailHref}
              className="rounded-full bg-primary-container px-4 py-1.5 text-xs font-bold text-white transition-colors hover:opacity-90"
            >
              Xem chi tiết
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
