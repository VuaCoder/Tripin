import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { formatDepartureDate, formatParticipants, formatVnd } from '@/features/cart';
import { useCheckoutBookingMutation } from '@/features/payment';
import { LoadingState } from '@/components/shared';
import {
  useCancelBookingMutation,
  useCompleteBookingMutation,
  useGetBookingByIdQuery,
} from '../api/bookingApi';
import { BookingStatusBadge } from './BookingStatusBadge';
import { CancelBookingModal } from './CancelBookingModal';
import { CompleteBookingModal } from './CompleteBookingModal';
import { ETicketModal, useGetETicketByBookingIdQuery } from '@/features/e-ticket';
import { WriteReviewDialog } from '@/features/review/components';
import { useGetMyReviewsQuery } from '@/features/review/api/reviewApi';
import type { MyReview } from '@/features/review/types';

export interface BookingDetailPageProps {
  bookingId: string;
}

export function BookingDetailPage({ bookingId }: BookingDetailPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const backHref = pathname?.startsWith('/settings') ? '/settings/history' : '/traveler/bookings';

  const { data: booking, isLoading, isError, error, refetch } = useGetBookingByIdQuery(bookingId);
  const [checkoutBooking, { isLoading: isPaying }] = useCheckoutBookingMutation();
  const [cancelBooking, { isLoading: isCancelling }] = useCancelBookingMutation();
  const [completeBooking, { isLoading: isCompleting }] = useCompleteBookingMutation();

  const [openCancelModal, setOpenCancelModal] = useState(false);
  const [openCompleteModal, setOpenCompleteModal] = useState(false);
  const [openTicketModal, setOpenTicketModal] = useState(false);
  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: myReviewsData, refetch: refetchReviews } = useGetMyReviewsQuery(
    { page: 1, limit: 100 },
    { skip: !booking },
  );

  const hasReviewedThisBooking = Boolean(
    myReviewsData?.items?.some((r) => r.bookingId === bookingId),
  );

  const isEligibleForTicket = Boolean(booking?.isPaid && (booking?.status === 'CONFIRMED' || booking?.status === 'COMPLETED'));
  const { data: ticket } = useGetETicketByBookingIdQuery(bookingId, { skip: !isEligibleForTicket });

  const handlePayNow = async () => {
    if (!booking) return;
    try {
      const res = await checkoutBooking(booking.id).unwrap();
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { error?: { message?: string } } })?.data?.error?.message ||
        'Không thể mở liên kết thanh toán PayOS. Vui lòng thử lại sau.';
      setNotice({ message: errorMsg, type: 'error' });
    }
  };

  const handleConfirmCancel = async (id: string, reason?: string) => {
    try {
      await cancelBooking({ id, reason }).unwrap();
      setOpenCancelModal(false);
      setNotice({ message: 'Đặt chỗ đã được hủy thành công.', type: 'success' });
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { error?: { message?: string } } })?.data?.error?.message ||
        'Không thể hủy đặt chỗ vào lúc này.';
      setNotice({ message: errorMsg, type: 'error' });
    }
  };

  const handleConfirmComplete = async (id: string) => {
    try {
      await completeBooking(id).unwrap();
      setOpenCompleteModal(false);
      setNotice({
        message: 'Tuyệt vời! Chuyến đi đã được ghi nhận hoàn thành. Bạn có thể viết đánh giá ngay bây giờ!',
        type: 'success',
      });
      // Proactively open review dialog for seamless UX
      setOpenReviewDialog(true);
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { error?: { message?: string } } })?.data?.error?.message ||
        'Không thể cập nhật trạng thái hoàn thành lúc này.';
      setNotice({ message: errorMsg, type: 'error' });
    }
  };

  const handleReviewCreated = (review: MyReview) => {
    setOpenReviewDialog(false);
    setNotice({
      message: 'Cảm ơn bạn đã đánh giá chuyến đi! Đánh giá của bạn đã được ghi nhận.',
      type: 'success',
    });
    void refetchReviews();
  };

  if (isLoading) {
    return (
      <div className="py-20">
        <LoadingState label="Đang tải thông tin chi tiết đặt chỗ..." />
      </div>
    );
  }

  // Handle 404 / IDOR or generic error
  if (isError || !booking) {
    const is404 = (error as { status?: number })?.status === 404;
    return (
      <div className="max-w-lg mx-auto my-16 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">
            {is404 ? 'lock' : 'error'}
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {is404 ? 'Không tìm thấy đặt chỗ' : 'Lỗi tải dữ liệu'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {is404
            ? 'Đặt chỗ này không tồn tại hoặc bạn không có quyền truy cập vào thông tin này.'
            : 'Đã có sự cố khi kết nối tới hệ thống. Vui lòng thử lại.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={backHref}
            className="rounded-xl bg-primary-container px-5 py-2.5 text-xs font-bold text-white hover:bg-primary transition-colors"
          >
            Về danh sách đặt chỗ
          </Link>
          {!is404 && (
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Thử lại
            </button>
          )}
        </div>
      </div>
    );
  }

  const isPending = booking.status === 'PENDING';
  const isConfirmed = booking.status === 'CONFIRMED';
  const isCompleted = booking.status === 'COMPLETED';
  const isCancelled = booking.status === 'CANCELLED';

  const depStr = formatDepartureDate(booking.departureDate);
  const endStr = formatDepartureDate(booking.endDate);
  const dateRange = depStr === endStr ? depStr : `${depStr} → ${endStr}`;

  return (
    <div className="space-y-6 pb-16 animate-fadeInScale">
      {/* Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Quay lại Đặt chỗ của tôi</span>
        </button>

        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
          Mã: {booking.bookingCode}
        </span>
      </div>

      {/* Alert banner if notice */}
      {notice && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              {notice.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <BookingStatusBadge
                status={booking.status}
                isPaid={booking.isPaid}
                refundRequired={booking.refundRequired}
              />
              <span className="text-xs text-slate-400">
                Tạo ngày {new Date(booking.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </div>
            <h1 className="max-w-2xl text-xl font-extrabold leading-snug tracking-tight text-slate-900 sm:text-2xl">
              {booking.tour.title}
            </h1>
          </div>

          {/* Quick Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 xl:justify-end">
            {isEligibleForTicket && (
              <button
                type="button"
                onClick={() => setOpenTicketModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm shadow-teal-600/20 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">airplane_ticket</span>
                <span>Xem E-ticket</span>
              </button>
            )}

            {/* Traveler Proactive Complete Action */}
            {isConfirmed && (
              <button
                type="button"
                onClick={() => setOpenCompleteModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">task_alt</span>
                <span>Hoàn thành chuyến đi</span>
              </button>
            )}

            {/* Review Button when COMPLETED */}
            {isCompleted && !hasReviewedThisBooking && (
              <button
                type="button"
                onClick={() => setOpenReviewDialog(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 text-xs font-bold shadow-sm shadow-amber-500/20 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">star</span>
                <span>Đánh giá tour</span>
              </button>
            )}

            {isCompleted && hasReviewedThisBooking && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-600">
                <span className="material-symbols-outlined text-amber-500 text-[18px]">check_circle</span>
                <span>Đã đánh giá</span>
              </span>
            )}

            {(isPending || isConfirmed) && (
              <button
                type="button"
                onClick={() => setOpenCancelModal(true)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-rose-600 transition-colors"
              >
                Hủy đặt chỗ
              </button>
            )}

            <Link
              href={`/tours/${booking.tour.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 text-xs font-semibold transition-colors"
            >
              <span>Xem trang tour</span>
              <span className="material-symbols-outlined text-base">open_in_new</span>
            </Link>
          </div>
        </div>

        {/* Pending payment countdown notice */}
        {isPending && !booking.isPaid && booking.paymentExpiresAt && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            <span className="material-symbols-outlined text-amber-700 text-lg flex-shrink-0 mt-0.5">schedule</span>
            <div>
              <strong className="block font-bold mb-0.5">Thời hạn giữ chỗ có hạn</strong>
              <span>
                Vui lòng hoàn tất thanh toán trước{' '}
                <strong>
                  {new Date(booking.paymentExpiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                  ngày {new Date(booking.paymentExpiresAt).toLocaleDateString('vi-VN')}
                </strong>{' '}
                để đảm bảo giữ chỗ và mức giá ưu đãi. Sau thời gian này, đặt chỗ sẽ tự động bị hủy.
              </span>
              <p className="mt-2 text-xs text-amber-800">
                Vé điện tử (E-ticket) sẽ được phát hành tự động ngay khi bạn hoàn tất thanh toán.
              </p>
            </div>
          </div>
        )}

        {/* Confirmed E-ticket notice & banner */}
        {isEligibleForTicket && (
          <div className="mt-5 rounded-2xl bg-gradient-to-r from-teal-50 via-teal-50/80 to-emerald-50 border border-teal-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-teal-900 leading-relaxed shadow-sm">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-teal-700 text-2xl flex-shrink-0 mt-0.5">verified</span>
              <div>
                <strong className="block font-bold text-sm text-slate-900 mb-0.5">
                  Đặt chỗ đã xác nhận & Vé điện tử (E-ticket) đã sẵn sàng!
                </strong>
                <span>
                  Mã đặt chỗ <strong className="font-mono">{booking.bookingCode}</strong>. Bạn có thể mở vé điện tử để quét mã QR hoặc in vé đem theo khi đi tour.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setOpenTicketModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 font-bold text-xs shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[17px]">qr_code_2</span>
                <span>Xem E-ticket</span>
              </button>
              <Link
                href={`/settings/history/${booking.id}/ticket`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 text-teal-800 px-3.5 py-2.5 font-semibold text-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[17px]">print</span>
                <span>Trang in vé</span>
              </Link>
            </div>
          </div>
        )}

        {/* Cancelled notice */}
        {isCancelled && (
          <div className="mt-5 rounded-2xl bg-rose-50 border border-rose-100 p-4 flex items-start gap-3 text-xs text-rose-900 leading-relaxed">
            <span className="material-symbols-outlined text-rose-600 text-lg flex-shrink-0 mt-0.5">cancel</span>
            <div>
              <strong className="block font-bold mb-0.5">Đặt chỗ đã bị hủy</strong>
              <span>
                Lý do:{' '}
                {booking.cancelReason === 'PAYMENT_EXPIRED'
                  ? 'Quá thời hạn thanh toán 15 phút của hệ thống.'
                  : 'Yêu cầu hủy từ phía du khách.'}
                {booking.refundRequired && ' Hệ thống đang xử lý thủ tục hoàn tiền cho bạn.'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Info & Financials */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols): Tour & Travel details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Schedule & Participants Card */}
          <div className="space-y-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
              <span className="material-symbols-outlined text-primary-container text-xl">calendar_month</span>
              <span>Lịch trình & Số lượng khách</span>
            </h2>

            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-slate-500">Thời gian chuyến đi</span>
                <p className="font-bold text-slate-800">{dateRange}</p>
                <span className="text-[11px] text-slate-500">Khởi hành từ ngày đã chọn</span>
              </div>

              <div className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-slate-500">Số lượng người tham gia</span>
                <p className="font-bold text-slate-800">{formatParticipants(booking.participants)}</p>
                <span className="text-[11px] text-slate-500">Người lớn & trẻ em</span>
              </div>
            </div>
          </div>

          {/* Contact Person Card */}
          <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
              <span className="material-symbols-outlined text-primary-container text-xl">person</span>
              <span>Thông tin người liên hệ</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400">Họ và tên</span>
                <p className="font-bold text-slate-800">{booking.contact.fullName}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400">Số điện thoại</span>
                <p className="font-bold text-slate-800">{booking.contact.phone}</p>
              </div>

              {booking.notes && (
                <div className="sm:col-span-2 space-y-1 pt-2 border-t border-slate-100">
                  <span className="text-slate-400">Ghi chú đặc biệt cho nhà cung cấp</span>
                  <p className="text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                    &quot;{booking.notes}&quot;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Milestones */}
          <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
              <span className="material-symbols-outlined text-primary-container text-xl">timeline</span>
              <span>Lịch sử trạng thái</span>
            </h2>

            <div className="space-y-4 border-l-2 border-slate-100 ml-3 pl-5 text-xs">
              {/* Step 1: Created */}
              <div className="relative">
                <span className="absolute -left-[27px] top-0 w-3 h-3 rounded-full bg-slate-400 border-2 border-white shadow-sm" />
                <p className="font-bold text-slate-800">Đặt chỗ được khởi tạo</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  {new Date(booking.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>

              {/* Step 2: Confirmed or Paid */}
              {booking.confirmedAt && (
                <div className="relative">
                  <span className="absolute -left-[27px] top-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                  <p className="font-bold text-emerald-800">Thanh toán thành công & Xác nhận</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {new Date(booking.confirmedAt).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}

              {/* Step 3: Completed */}
              {booking.completedAt && (
                <div className="relative">
                  <span className="absolute -left-[27px] top-0 w-3 h-3 rounded-full bg-teal-500 border-2 border-white shadow-sm" />
                  <p className="font-bold text-teal-800">Chuyến đi đã hoàn tất</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {new Date(booking.completedAt).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}

              {/* Step 4: Cancelled */}
              {booking.cancelledAt && (
                <div className="relative">
                  <span className="absolute -left-[27px] top-0 w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow-sm" />
                  <p className="font-bold text-rose-800">Đặt chỗ đã bị hủy</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {new Date(booking.cancelledAt).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Payment & Financial Summary */}
        <div className="space-y-6">
          <div className="space-y-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm lg:sticky lg:top-28 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
              <span className="material-symbols-outlined text-primary-container text-xl">receipt_long</span>
              <span>Chi tiết thanh toán</span>
            </h2>

            <dl className="space-y-3 border-b border-slate-100 pb-4 text-sm">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 text-slate-600">
                <dt>Đơn giá mỗi khách</dt>
                <dd className="whitespace-nowrap font-semibold text-slate-800">{formatVnd(booking.unitPrice)}</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 text-slate-600">
                <dt>Số lượng khách</dt>
                <dd className="whitespace-nowrap font-semibold text-slate-800">{booking.participants} khách</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 text-slate-600">
                <dt>Tạm tính</dt>
                <dd className="whitespace-nowrap font-semibold text-slate-800">{formatVnd(booking.subtotal)}</dd>
              </div>

              {booking.discountAmount > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 rounded-xl bg-emerald-50/70 p-3 text-emerald-700">
                  <dt>Mã ưu đãi {booking.promotion ? `(${booking.promotion.code})` : ''}</dt>
                  <dd className="whitespace-nowrap font-bold">-{formatVnd(booking.discountAmount)}</dd>
                </div>
              )}
            </dl>

            <div className="rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3.5">
              <span className="block text-sm font-bold text-slate-800">Tổng thanh toán</span>
              <span className="mt-1 block whitespace-nowrap text-xl font-extrabold text-primary-container">
                {formatVnd(booking.totalAmount)}
              </span>
            </div>

            {/* Payment Method / Gateway Badge */}
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
              <div>
                <span className="block text-slate-500">Cổng thanh toán</span>
                <strong className="mt-1 block text-slate-800">PayOS · VietQR / Thẻ</strong>
              </div>
              <div className="border-t border-slate-200/70 pt-3">
                <span className="block text-slate-500">Trạng thái thanh toán</span>
                <span className={`mt-1 block font-bold ${booking.isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {booking.isPaid ? 'Đã thanh toán đủ' : 'Chưa nhận tiền'}
                </span>
              </div>
              {booking.refundRequired && (
                <div className="pt-2 border-t border-slate-200/60 text-purple-700 font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">currency_exchange</span>
                  <span>Đang xử lý hoàn tiền</span>
                </div>
              )}
            </div>

            {/* Big Action button */}
            {isPending && !booking.isPaid && (
              <button
                type="button"
                onClick={handlePayNow}
                disabled={isPaying}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-container hover:bg-primary text-white py-3.5 px-4 font-bold text-sm shadow-md shadow-primary-container/20 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">payments</span>
                <span>{isPaying ? 'Đang mở PayOS...' : 'Thanh toán ngay'}</span>
              </button>
            )}

            {isEligibleForTicket && (
              <button
                type="button"
                onClick={() => setOpenTicketModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white py-3 px-4 font-bold text-xs shadow-md shadow-teal-700/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">airplane_ticket</span>
                <span>Mở vé điện tử (E-ticket)</span>
              </button>
            )}

            {/* Sidebar Proactive Complete Action */}
            {isConfirmed && (
              <button
                type="button"
                onClick={() => setOpenCompleteModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">task_alt</span>
                <span>Xác nhận hoàn thành chuyến đi</span>
              </button>
            )}

            {/* Sidebar Write Review Action */}
            {isCompleted && !hasReviewedThisBooking && (
              <button
                type="button"
                onClick={() => setOpenReviewDialog(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white py-3 px-4 font-bold text-xs shadow-md shadow-amber-500/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">star</span>
                <span>Đánh giá chuyến đi này</span>
              </button>
            )}

            {isCompleted && hasReviewedThisBooking && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center text-xs font-semibold text-amber-800 flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-amber-600 text-base">check_circle</span>
                <span>Bạn đã gửi đánh giá cho chuyến đi này</span>
              </div>
            )}

            {isConfirmed && (
              <Link
                href="/tours"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 py-3 px-4 font-bold text-xs transition-colors"
              >
                <span className="material-symbols-outlined text-base">travel_explore</span>
                <span>Khám phá thêm điểm đến</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <CancelBookingModal
        open={openCancelModal}
        booking={booking}
        isLoading={isCancelling}
        onClose={() => setOpenCancelModal(false)}
        onConfirm={handleConfirmCancel}
      />

      {/* Complete Trip Confirmation Modal */}
      <CompleteBookingModal
        open={openCompleteModal}
        booking={booking}
        isLoading={isCompleting}
        onClose={() => setOpenCompleteModal(false)}
        onConfirm={handleConfirmComplete}
      />

      {/* E-Ticket Modal */}
      <ETicketModal
        open={openTicketModal}
        ticket={ticket ?? null}
        onClose={() => setOpenTicketModal(false)}
      />

      {/* Write Review Dialog */}
      {isCompleted && (
        <WriteReviewDialog
          open={openReviewDialog}
          onClose={() => setOpenReviewDialog(false)}
          tourTitle={booking.tour.title}
          eligibleBookings={[
            {
              id: booking.id,
              bookingCode: booking.bookingCode,
              status: booking.status,
              tour: { id: booking.tour.id, title: booking.tour.title },
              departureDate: booking.departureDate,
              participants: booking.participants,
            },
          ]}
          onCreated={handleReviewCreated}
          onDuplicate={() => {
            void refetchReviews();
            setOpenReviewDialog(false);
          }}
        />
      )}
    </div>
  );
}
