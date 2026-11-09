import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatDepartureDate, formatParticipants, formatVnd } from '@/lib/travel-format';
import { useCheckoutBookingMutation } from '@/features/payment';
import { BookingStatusBadge } from './BookingStatusBadge';
import type { BookingDto } from '../types';

export interface BookingHistoryCardProps {
  booking: BookingDto;
  onOpenCancel: (booking: BookingDto) => void;
  onOpenComplete?: (booking: BookingDto) => void;
  onOpenReview?: (booking: BookingDto) => void;
  hasReviewed?: boolean;
}

/** `19-22 tháng 11` for one month, the full dates when the trip crosses a month. */
function tripDateRange(start: string, end: string) {
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return formatDepartureDate(start);
  if (from.getMonth() !== to.getMonth() || from.getFullYear() !== to.getFullYear()) {
    return `${formatDepartureDate(start)} → ${formatDepartureDate(end)}`;
  }
  return from.getDate() === to.getDate()
    ? `${to.getDate()} tháng ${to.getMonth() + 1}`
    : `${from.getDate()}-${to.getDate()} tháng ${to.getMonth() + 1}`;
}

export function BookingHistoryCard({
  booking,
  onOpenCancel,
  onOpenComplete,
  onOpenReview,
  hasReviewed = false,
}: BookingHistoryCardProps) {
  const pathname = usePathname();
  const [checkoutBooking, { isLoading: isPaying }] = useCheckoutBookingMutation();

  const detailHref = pathname?.startsWith('/settings')
    ? `/settings/history/${booking.id}`
    : `/traveler/bookings/${booking.id}`;

  const handlePayNow = async () => {
    try {
      const res = await checkoutBooking(booking.id).unwrap();
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch {
      window.location.assign(detailHref);
    }
  };

  const isPending = booking.status === 'PENDING';
  const isConfirmed = booking.status === 'CONFIRMED';

  const initial = (booking.contact.fullName || 'K').trim().charAt(0).toUpperCase();
  const extraGuests = booking.participants - 1;

  const price = (
    <>
      <div className="text-xs text-slate-400">Tổng thanh toán</div>
      <div className="text-lg font-extrabold text-primary-container">{formatVnd(booking.totalAmount)}</div>
      {booking.discountAmount > 0 && (
        <div className="text-[11px] font-medium text-emerald-600">Đã giảm {formatVnd(booking.discountAmount)}</div>
      )}
    </>
  );

  return (
    <article className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-primary-container/30 hover:shadow-md sm:p-5">
      <Link href={detailHref} className="flex items-center gap-3 sm:gap-4">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-36">
          {booking.tour.coverImage ? (
            <img
              src={booking.tour.coverImage}
              alt={booking.tour.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-slate-300">
              <span className="material-symbols-outlined text-3xl" aria-hidden="true">tour</span>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-1 text-base font-bold text-slate-900 transition-colors group-hover:text-primary-container sm:text-lg">
              {booking.tour.title}
            </h3>
            <BookingStatusBadge
              status={booking.status}
              isPaid={booking.isPaid}
              refundRequired={booking.refundRequired}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden="true">calendar_month</span>
              {tripDateRange(booking.departureDate, booking.endDate)}
            </span>

            <span className="flex items-center gap-1.5">
              <span className="flex items-center">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary-container/10 text-[10px] font-bold text-primary ring-2 ring-white">
                  {initial}
                </span>
                {extraGuests > 0 && (
                  <span className="-ml-1.5 flex size-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 ring-2 ring-white">
                    +{extraGuests}
                  </span>
                )}
              </span>
              {formatParticipants(booking.participants)}
            </span>

            {booking.status === 'CANCELLED' && booking.cancelReason && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">info</span>
                {booking.cancelReason === 'PAYMENT_EXPIRED'
                  ? 'Tự động hủy do hết hạn thanh toán'
                  : 'Hủy theo yêu cầu của du khách'}
              </span>
            )}

            {isPending && !booking.isPaid && booking.paymentExpiresAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">timer</span>
                Hạn thanh toán {new Date(booking.paymentExpiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 text-right sm:block">{price}</div>
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:mt-0 sm:border-t-0 sm:pt-0">
        <div className="ml-auto text-right sm:hidden">{price}</div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isConfirmed && onOpenComplete && (
            <button
              type="button"
              onClick={() => onOpenComplete(booking)}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">task_alt</span>
              <span>Hoàn thành tour</span>
            </button>
          )}

          {booking.status === 'COMPLETED' && !hasReviewed && onOpenReview && (
            <button
              type="button"
              onClick={() => onOpenReview(booking)}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-amber-500/20 transition-all hover:bg-amber-600"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">star</span>
              <span>Đánh giá tour</span>
            </button>
          )}

          {(isPending || isConfirmed) && (
            <button
              type="button"
              onClick={() => onOpenCancel(booking)}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-rose-600"
            >
              Hủy đặt chỗ
            </button>
          )}

          {isPending && !booking.isPaid && (
            <button
              type="button"
              onClick={handlePayNow}
              disabled={isPaying}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-container px-4 py-2 text-xs font-bold text-white shadow-sm shadow-primary-container/20 transition-all hover:bg-primary disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">payments</span>
              <span>{isPaying ? 'Đang mở cổng...' : 'Thanh toán ngay'}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
