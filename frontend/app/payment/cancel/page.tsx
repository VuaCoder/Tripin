'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LoadingState } from '@/components/shared';
import { useGetPaymentQuery, useCheckoutBookingMutation } from '@/features/payment';
import { formatVnd } from '@/features/cart';

function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId') ?? '';

  const { data: payment, isLoading } = useGetPaymentQuery(paymentId, {
    skip: !paymentId,
  });

  const [checkoutBooking, { isLoading: isRechecking }] = useCheckoutBookingMutation();

  const handleRetryPayment = async () => {
    if (!payment?.referenceId) return;
    try {
      const res = await checkoutBooking(payment.referenceId).unwrap();
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch {
      window.location.assign('/traveler');
    }
  };

  if (isLoading) {
    return <LoadingState label="Đang kiểm tra thông tin..." />;
  }

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 text-center shadow-sm">
      <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mx-auto mb-4">
        <span className="material-symbols-outlined text-3xl">cancel</span>
      </div>
      
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">
        Thanh toán chưa hoàn tất
      </span>

      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
        Giao dịch đã được hủy
      </h1>

      <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
        Bạn vừa hủy phiên giao dịch tại cổng PayOS hoặc phiên thanh toán bị gián đoạn. Đặt chỗ của bạn vẫn được lưu tạm thời.
      </p>

      {payment && (
        <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-2.5 text-sm text-left">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Số tiền cần thanh toán</span>
            <span className="font-extrabold text-primary-container">{formatVnd(payment.amount)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Mã giao dịch</span>
            <span className="font-mono text-xs font-semibold text-slate-700 truncate max-w-[200px]">{payment.id}</span>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200/60 p-3.5 text-xs text-amber-900 leading-relaxed text-left flex items-start gap-2.5">
        <span className="material-symbols-outlined text-amber-700 text-[18px] flex-shrink-0 mt-0.5">schedule</span>
        <span>
          Lưu ý: Thời gian giữ chỗ có giới hạn (15 phút). Vui lòng hoàn tất thanh toán sớm để đảm bảo giữ chỗ và giá ưu đãi của bạn.
        </span>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        {payment?.referenceId && (
          <button
            type="button"
            onClick={handleRetryPayment}
            disabled={isRechecking}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-container hover:bg-primary text-white py-3 px-4 font-bold text-sm shadow-md shadow-primary-container/20 transition-all text-center disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">replay</span>
            <span>{isRechecking ? 'Đang mở lại...' : 'Thanh toán lại'}</span>
          </button>
        )}
        <Link
          href="/traveler"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 py-3 px-5 font-semibold text-sm transition-colors text-center"
        >
          Về trang cá nhân
        </Link>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <Suspense fallback={<LoadingState label="Đang tải..." />}>
        <PaymentCancelContent />
      </Suspense>
    </div>
  );
}
