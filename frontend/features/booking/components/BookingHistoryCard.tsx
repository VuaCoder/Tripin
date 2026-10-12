import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatDepartureDate, formatParticipants, formatVnd } from '@/features/cart';
import { useCheckoutBookingMutation } from '@/features/payment';
import { BookingStatusBadge } from './BookingStatusBadge';
import type { BookingDto } from '../types';

export interface BookingHistoryCardProps {
  booking: BookingDto;
  onOpenCancel: (booking: BookingDto) => void;
}

export function BookingHistoryCard({ booking, onOpenCancel }: BookingHistoryCardProps) {
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
  const isCancelled = booking.status === 'CANCELLED';

  // Format dates: departureDate to endDate
  const depStr = formatDepartureDate(booking.departureDate);
  const endStr = formatDepartureDate(booking.endDate);
  const dateRange = depStr === endStr ? depStr : `${depStr} → ${endStr}`;

  return (
    <div className="group rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
      {/* Top row: Booking code, Date created, Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Mã đặt chỗ:</span>
          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
            {booking.bookingCode}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">
            Đặt lúc {new Date(booking.createdAt).toLocaleDateString('vi-VN')}
          </span>
        </div>

        <BookingStatusBadge
          status={booking.status}
          isPaid={booking.isPaid}
          refundRequired={booking.refundRequired}
        />
      </div>

      {/* Main Content */}
      <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Link
            href={detailHref}
            className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-primary-container transition-colors line-clamp-1"
          >
            {booking.tour.title}
          </Link>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-slate-400">calendar_month</span>
              <span>{dateRange}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-slate-400">group</span>
              <span>{formatParticipants(booking.participants)}</span>
            </div>
          </div>

          {/* Cancellation reason info if cancelled */}
          {isCancelled && booking.cancelReason && (
            <div className="text-xs text-rose-600 bg-rose-50/70 border border-rose-100 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">info</span>
              <span>
                {booking.cancelReason === 'PAYMENT_EXPIRED'
                  ? 'Tự động hủy do hết hạn thanh toán (15 phút)'
                  : 'Đã hủy theo yêu cầu của du khách'}
              </span>
            </div>
          )}

          {/* Expiration warning if pending */}
          {isPending && !booking.isPaid && booking.paymentExpiresAt && (
            <div className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200/60 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">timer</span>
              <span>
                Hạn thanh toán: {new Date(booking.paymentExpiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(booking.paymentExpiresAt).toLocaleDateString('vi-VN')})
              </span>
            </div>
          )}
        </div>

        {/* Pricing Column */}
        <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          <div className="text-xs text-slate-400">Tổng thanh toán</div>
          <div className="text-lg sm:text-xl font-extrabold text-primary-container">
            {formatVnd(booking.totalAmount)}
          </div>
          {booking.discountAmount > 0 && (
            <div className="text-[11px] text-emerald-600 font-medium">
              Đã giảm {formatVnd(booking.discountAmount)}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          Người liên hệ: <strong className="text-slate-700">{booking.contact.fullName}</strong> ({booking.contact.phone})
        </div>

        <div className="flex items-center gap-2">
          {/* Cancel button if applicable */}
          {(isPending || isConfirmed) && (
            <button
              type="button"
              onClick={() => onOpenCancel(booking)}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition-colors"
            >
              Hủy đặt chỗ
            </button>
          )}

          {/* Pay now button if pending */}
          {isPending && !booking.isPaid && (
            <button
              type="button"
              onClick={handlePayNow}
              disabled={isPaying}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-container hover:bg-primary text-white px-4 py-2 text-xs font-bold shadow-sm shadow-primary-container/20 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]">payments</span>
              <span>{isPaying ? 'Đang mở cổng...' : 'Thanh toán ngay'}</span>
            </button>
          )}

          {/* Detail Link */}
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 rounded-xl bg-primary-container/10 hover:bg-primary-container text-primary hover:text-white px-4 py-2 text-xs font-bold transition-all border border-primary-container/20"
          >
            <span>Chi tiết</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
