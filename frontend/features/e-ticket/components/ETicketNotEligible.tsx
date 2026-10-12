'use client';

import React from 'react';
import Link from 'next/link';
import type { BookingDto } from '@/features/booking';
import { useCheckoutBookingMutation } from '@/features/payment';

export interface ETicketNotEligibleProps {
  booking?: BookingDto | null;
  bookingId?: string;
  onPayNow?: () => void;
}

export function ETicketNotEligible({ booking, bookingId }: ETicketNotEligibleProps) {
  const [checkoutBooking, { isLoading: isCheckingOut }] = useCheckoutBookingMutation();
  const targetBookingId = booking?.id || bookingId;

  const isPending = booking?.status === 'PENDING' && !booking?.isPaid;
  const isCancelled = booking?.status === 'CANCELLED';

  const handlePay = async () => {
    if (!targetBookingId) return;
    try {
      const res = await checkoutBooking(targetBookingId).unwrap();
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch {
      window.location.href = `/settings/history/${targetBookingId}`;
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-amber-200/80 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 border border-amber-200 text-amber-600">
        <span className="material-symbols-outlined text-3xl">
          {isCancelled ? 'block' : 'hourglass_empty'}
        </span>
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider mb-2">
        {isCancelled ? 'Đơn đặt chỗ đã bị hủy' : 'Chưa đủ điều kiện phát hành vé'}
      </span>

      <h2 className="text-xl font-black text-slate-900 tracking-tight">
        {isCancelled ? 'Không thể cấp vé điện tử' : 'Đơn đặt chỗ chưa được thanh toán'}
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {isCancelled
          ? 'Đặt chỗ này đã bị hủy nên vé điện tử không còn hiệu lực hoặc chưa từng được cấp. Nếu bạn cần hỗ trợ, vui lòng gửi phản hồi.'
          : 'Vé điện tử (E-ticket) chỉ được hệ thống tự động phát hành sau khi đơn đặt chỗ được thanh toán thành công và chuyển sang trạng thái ĐÃ XÁC NHẬN.'}
      </p>

      {booking && (
        <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs text-left space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Mã đặt chỗ:</span>
            <span className="font-mono font-bold text-slate-800">{booking.bookingCode}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Tour:</span>
            <span className="font-semibold text-slate-800 truncate max-w-[200px]">{booking.tour.title}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Trạng thái thanh toán:</span>
            <span className="font-bold text-amber-700">Chưa thanh toán</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
        {isPending && (
          <button
            type="button"
            onClick={handlePay}
            disabled={isCheckingOut}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-container px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-primary-container/20 hover:bg-primary transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px]">payments</span>
            <span>{isCheckingOut ? 'Đang mở PayOS...' : 'Thanh toán ngay để nhận vé'}</span>
          </button>
        )}

        {targetBookingId && (
          <Link
            href={`/settings/history/${targetBookingId}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Chi tiết đặt chỗ
          </Link>
        )}

        <Link
          href="/settings/history"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Đặt chỗ của tôi
        </Link>
      </div>
    </div>
  );
}
