'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LoadingState } from '@/components/shared';
import { useGetPaymentQuery } from '@/features/payment';
import { formatVnd } from '@/features/cart';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId') ?? '';
  const [pollCount, setPollCount] = useState(0);

  // Poll every 2.5 seconds up to 8 times if status is still PENDING to catch delayed webhooks/reconciles
  const { data: payment, isLoading, isError, refetch } = useGetPaymentQuery(paymentId, {
    skip: !paymentId,
    pollingInterval: pollCount < 8 ? 2500 : 0,
  });

  useEffect(() => {
    if (payment?.status === 'PAID') {
      setPollCount(100); // Stop polling once settled
    } else {
      const timer = setTimeout(() => setPollCount((prev) => prev + 1), 2500);
      return () => clearTimeout(timer);
    }
  }, [payment?.status, pollCount]);

  if (!paymentId) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <span className="material-symbols-outlined text-4xl text-amber-500 mb-2">warning</span>
        <h1 className="text-xl font-bold text-slate-900">Thiếu thông tin giao dịch</h1>
        <p className="mt-2 text-sm text-slate-600">Không tìm thấy mã thanh toán hợp lệ trên đường dẫn.</p>
        <Link
          href="/home"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-container px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState label="Đang đối soát và xác thực giao dịch với PayOS..." />;
  }

  if (isError || !payment) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <span className="material-symbols-outlined text-4xl text-red-500 mb-2">error</span>
        <h1 className="text-xl font-bold text-slate-900">Không thể tải thông tin thanh toán</h1>
        <p className="mt-2 text-sm text-slate-600">Đã có lỗi xảy ra khi kiểm tra trạng thái giao dịch.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Thử tải lại
          </button>
          <Link
            href="/traveler"
            className="rounded-xl bg-primary-container px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary transition-colors"
          >
            Về trang cá nhân
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = payment.status === 'PAID';
  const isPending = payment.status === 'PENDING';
  const paymentDestination = payment.purpose === 'BOOKING'
    ? `/settings/history/${payment.referenceId}`
    : '/traveler';

  if (isPaid) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-emerald-100 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
            Thanh toán thành công
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Giao dịch đã được xác nhận!
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-md">
            Cảm ơn bạn đã hoàn tất thanh toán qua PayOS. Đặt chỗ của bạn đã được chuyển sang trạng thái <strong>Đã xác nhận</strong> và vé điện tử đã được phát hành.
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Mã giao dịch</span>
            <span className="font-mono text-xs font-semibold text-slate-800 truncate max-w-[200px]">{payment.id}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Số tiền thanh toán</span>
            <span className="text-lg font-extrabold text-primary-container">{formatVnd(payment.amount)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Cổng thanh toán</span>
            <span className="font-semibold text-slate-800">PayOS (VietQR / Thẻ)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Trạng thái</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              ĐÃ THANH TOÁN
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-teal-50 border border-teal-100 p-3.5 flex items-start gap-2.5 text-xs text-teal-900 leading-relaxed">
          <span className="material-symbols-outlined text-teal-700 text-[18px] flex-shrink-0 mt-0.5">verified</span>
          <span>Thông tin xác nhận và E-ticket đã được gửi đến tài khoản của bạn. Bạn có thể kiểm tra trong mục Chuyến đi.</span>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          {payment.purpose === 'BOOKING' ? (
            <>
              <Link
                href={`/settings/history/${payment.referenceId}/ticket`}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white py-3 px-4 font-bold text-sm shadow-md shadow-teal-700/20 transition-all text-center"
              >
                <span className="material-symbols-outlined text-[18px]">airplane_ticket</span>
                <span>Xem vé điện tử (E-ticket)</span>
              </Link>
              <Link
                href={paymentDestination}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 py-3 px-4 font-semibold text-sm transition-colors text-center"
              >
                Chi tiết chuyến đi
              </Link>
            </>
          ) : (
            <Link
              href={paymentDestination}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-container hover:bg-primary text-white py-3 px-4 font-bold text-sm shadow-md shadow-primary-container/20 transition-all text-center"
            >
              <span>Xem tài khoản của tôi</span>
            </Link>
          )}
          <Link
            href="/home"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 py-3 px-4 font-semibold text-sm transition-colors text-center"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-amber-100 bg-white p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto mb-4 animate-pulse">
          <span className="material-symbols-outlined text-3xl">hourglass_top</span>
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">Giao dịch đang được xử lý</h1>
        <p className="mt-2 text-sm text-slate-600">
          Hệ thống đang đồng bộ kết quả thanh toán với ngân hàng. Quá trình này thường diễn ra trong vài giây.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            className="w-full inline-flex items-center justify-center rounded-xl bg-primary-container hover:bg-primary text-white py-2.5 font-bold text-sm shadow-sm transition-colors"
          >
            Kiểm tra lại ngay
          </button>
          <Link href={paymentDestination} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            Xem trong trang cá nhân
          </Link>
        </div>
      </div>
    );
  }

  // Cancelled or Expired
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 mx-auto mb-4">
        <span className="material-symbols-outlined text-3xl">info</span>
      </div>
      <h1 className="text-xl font-bold text-slate-900">
        {payment.status === 'CANCELLED' ? 'Giao dịch đã bị hủy' : 'Phiên thanh toán đã hết hạn'}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Đặt chỗ của bạn vẫn được lưu trong hệ thống. Bạn có thể tiến hành thanh toán lại từ bảng điều khiển cá nhân.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href={paymentDestination}
          className="rounded-xl bg-primary-container px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary transition-colors"
        >
          Xem đặt chỗ
        </Link>
        <Link
          href="/home"
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <Suspense fallback={<LoadingState label="Đang kiểm tra giao dịch..." />}>
        <PaymentSuccessContent />
      </Suspense>
    </div>
  );
}
