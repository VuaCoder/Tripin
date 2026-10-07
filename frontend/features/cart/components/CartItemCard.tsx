'use client';

/* eslint-disable @next/next/no-img-element -- tour covers are arbitrary remote URLs; the card only needs a thumbnail */
import type { CartItem } from '../types';
import { CART_UNAVAILABLE_LABELS } from '../types';
import { formatDepartureDate, formatDuration, formatVnd } from '../utils/format';
import { Button } from '@/components/ui';

/** Mirrors the backend `BOOKING_POLICY.MAX_PARTICIPANTS` ceiling. */
export const CART_UI_LIMITS = { MAX_PARTICIPANTS: 50 } as const;

export interface CartItemCardProps {
  item: CartItem;
  /** A mutation for this line is in flight. */
  busy?: boolean;
  onUpdateParticipants?: (id: string, participants: number) => void;
  onRemove?: (id: string) => void;
  onContinue?: (item: CartItem) => void;
}

/**
 * One cart line: tour summary, departure, head-count control and the two actions the business rules allow —
 * "book this line" (only while bookable) and "remove" (always).
 */
export function CartItemCard({ item, busy = false, onUpdateParticipants, onRemove, onContinue }: CartItemCardProps) {
  // A line whose head-count no longer fits is still editable (the departure itself is bookable), everything else is not.
  const canEditParticipants = item.available || item.unavailableReason === 'NOT_ENOUGH_SEATS';
  const maxParticipants = Math.min(CART_UI_LIMITS.MAX_PARTICIPANTS, item.departure?.remaining ?? CART_UI_LIMITS.MAX_PARTICIPANTS);
  const reason = item.unavailableReason ?? 'DEPARTURE_UNAVAILABLE';

  return (
    <article
      data-testid="cart-item"
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex gap-4"
      aria-busy={busy || undefined}
    >
      <div className="hidden sm:flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-low text-primary-container">
        {item.tour?.coverImage ? (
          <img src={item.tour.coverImage} alt={item.tour.title} className="h-full w-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-3xl" aria-hidden="true">travel_explore</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">
              {item.tour?.title ?? 'Tour không còn khả dụng'}
            </h3>
            {item.tour && (
              <p className="mt-0.5 text-xs text-slate-500">
                {item.tour.destination} · {formatDuration(item.tour.durationDays)}
              </p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">
              Khởi hành: {formatDepartureDate(item.departure?.date)}
            </p>
          </div>

          <button
            type="button"
            aria-label="Xóa khỏi giỏ hàng"
            title="Xóa khỏi giỏ hàng"
            disabled={busy}
            onClick={() => onRemove?.(item.id)}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
          </button>
        </div>

        {!item.available && (
          <p role="status" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <span className="material-symbols-outlined align-middle text-[16px]" aria-hidden="true">warning</span>{' '}
            {CART_UNAVAILABLE_LABELS[reason]}
            {reason === 'NOT_ENOUGH_SEATS' && item.departure ? ` (còn ${item.departure.remaining} chỗ)` : ''}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            {item.unitPrice != null && (
              <span className="text-xs text-slate-500">
                <span className="font-semibold text-slate-800">{formatVnd(item.unitPrice)}</span> / khách
              </span>
            )}

            {canEditParticipants && (
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Số khách">
                <button
                  type="button"
                  aria-label="Giảm số khách"
                  disabled={busy || item.participants <= 1}
                  onClick={() => onUpdateParticipants?.(item.id, item.participants - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">remove</span>
                </button>
                <span className="min-w-6 text-center text-sm font-semibold text-slate-800" aria-live="polite">
                  {item.participants}
                </span>
                <button
                  type="button"
                  aria-label="Tăng số khách"
                  disabled={busy || item.participants >= maxParticipants}
                  onClick={() => onUpdateParticipants?.(item.id, item.participants + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {item.subtotal != null && (
              <span className="text-sm font-bold text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatVnd(item.subtotal)}
              </span>
            )}
            <Button size="sm" disabled={!item.available || busy} onClick={() => onContinue?.(item)}>
              Đặt chỗ
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
