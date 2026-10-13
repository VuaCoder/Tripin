import React, { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/shared';
import {
  useCancelBookingMutation,
  useCompleteBookingMutation,
  useGetMyBookingsQuery,
} from '../api/bookingApi';
import { BookingHistoryCard } from './BookingHistoryCard';
import { BookingHistorySkeleton } from './BookingHistorySkeleton';
import { CancelBookingModal } from './CancelBookingModal';
import { CompleteBookingModal } from './CompleteBookingModal';
import { WriteReviewDialog } from '@/features/review/components';
import { useGetMyReviewsQuery } from '@/features/review/api/reviewApi';
import type { BookingDto, BookingStatus } from '../types';
import type { MyReview } from '@/features/review/types';

const STATUS_TABS: { label: string; value: BookingStatus | 'ALL' }[] = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'Chờ thanh toán', value: 'PENDING' },
  { label: 'Đã xác nhận', value: 'CONFIRMED' },
  { label: 'Đã hoàn thành', value: 'COMPLETED' },
  { label: 'Đã hủy', value: 'CANCELLED' },
];

export function BookingHistoryPage() {
  const [selectedStatus, setSelectedStatus] = useState<BookingStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [cancellingBooking, setCancellingBooking] = useState<BookingDto | null>(null);
  const [completingBooking, setCompletingBooking] = useState<BookingDto | null>(null);
  const [reviewingBooking, setReviewingBooking] = useState<BookingDto | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const queryStatus = selectedStatus === 'ALL' ? undefined : selectedStatus;
  const { data, isLoading, isFetching, isError, refetch } = useGetMyBookingsQuery({
    status: queryStatus,
    page,
    limit: 10,
  });

  const { data: myReviewsData, refetch: refetchReviews } = useGetMyReviewsQuery({ page: 1, limit: 100 });
  const reviewedBookingIds = new Set(myReviewsData?.items?.map((r) => r.bookingId) || []);

  const [cancelBooking, { isLoading: isCancelling }] = useCancelBookingMutation();
  const [completeBooking, { isLoading: isCompleting }] = useCompleteBookingMutation();

  const handleConfirmCancel = async (bookingId: string, reason?: string) => {
    try {
      await cancelBooking({ id: bookingId, reason }).unwrap();
      setCancellingBooking(null);
      setFeedback({
        message: 'Đã hủy đặt chỗ thành công.',
        type: 'success',
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { error?: { message?: string } } })?.data?.error?.message ||
        'Không thể hủy đặt chỗ vào lúc này. Vui lòng thử lại sau.';
      setFeedback({ message: errorMsg, type: 'error' });
    }
  };

  const handleConfirmComplete = async (bookingId: string) => {
    try {
      const res = await completeBooking(bookingId).unwrap();
      setCompletingBooking(null);
      setFeedback({
        message: 'Tuyệt vời! Chuyến đi đã được xác nhận hoàn thành. Hãy chia sẻ cảm nhận bằng một đánh giá nhé!',
        type: 'success',
      });
      // Automatically prompt review dialog
      setReviewingBooking(res);
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { error?: { message?: string } } })?.data?.error?.message ||
        'Không thể xác nhận hoàn thành chuyến đi lúc này. Vui lòng thử lại sau.';
      setFeedback({ message: errorMsg, type: 'error' });
    }
  };

  const handleReviewCreated = (review: MyReview) => {
    setReviewingBooking(null);
    setFeedback({
      message: 'Cảm ơn bạn đã viết đánh giá! Trải nghiệm của bạn sẽ giúp ích cho các du khách khác.',
      type: 'success',
    });
    void refetchReviews();
    setTimeout(() => setFeedback(null), 5000);
  };

  return (
    <div className="space-y-6 animate-fadeInScale pb-12">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Đặt chỗ của tôi
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi tình trạng đơn đặt tour, kiểm tra mã đặt chỗ và quản lý thanh toán thuận tiện.
          </p>
        </div>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
          aria-label="Làm mới"
          title="Làm mới"
          className="flex size-9 items-center justify-center rounded-xl border border-surface-container bg-white text-slate-600 transition-colors hover:bg-surface-container-low hover:text-primary-container disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true">
            refresh
          </span>
        </button>
      </header>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {STATUS_TABS.map((tab) => {
          const isActive = selectedStatus === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setSelectedStatus(tab.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary-container text-white shadow-sm shadow-primary-container/25'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-surface-container-low hover:text-primary-container'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* List content */}
      {isLoading ? (
        <BookingHistorySkeleton />
      ) : isError ? (
        <div className="py-8">
          <ErrorState
            title="Không thể tải danh sách đặt chỗ"
            message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng kiểm tra lại đường truyền."
            actionLabel="Tải lại"
            onAction={() => refetch()}
          />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl bg-white border border-slate-100 p-8 shadow-sm text-center">
          <EmptyState
            title={
              selectedStatus === 'ALL'
                ? 'Bạn chưa có đặt chỗ nào'
                : `Không có đặt chỗ nào trong trạng thái "${STATUS_TABS.find((t) => t.value === selectedStatus)?.label}"`
            }
            description="Hãy bắt đầu chuyến hành trình tuyệt vời của bạn bằng cách khám phá các tour du lịch đa dạng của chúng tôi."
            actionLabel="Khám phá tour ngay"
            onAction={() => window.location.assign('/tours')}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {isFetching && (
            <div className="text-right text-[11px] text-slate-400">
              Đang làm mới dữ liệu...
            </div>
          )}

          <div key={selectedStatus} className="animate-slide-up-fade space-y-3">
            {data.items.map((booking) => (
              <BookingHistoryCard
                key={booking.id}
                booking={booking}
                hasReviewed={reviewedBookingIds.has(booking.id)}
                onOpenCancel={(item) => setCancellingBooking(item)}
                onOpenComplete={(item) => setCompletingBooking(item)}
                onOpenReview={(item) => setReviewingBooking(item)}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {data.meta.totalPages > 1 && (
            <div className="pt-4 flex items-center justify-between text-xs text-slate-600">
              <span>
                Trang {data.meta.page} / {data.meta.totalPages} (Tổng {data.meta.total} đặt chỗ)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={data.meta.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={data.meta.page >= data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <CancelBookingModal
        open={Boolean(cancellingBooking)}
        booking={cancellingBooking}
        isLoading={isCancelling}
        onClose={() => setCancellingBooking(null)}
        onConfirm={handleConfirmCancel}
      />

      {/* Complete Trip Confirmation Modal */}
      <CompleteBookingModal
        open={Boolean(completingBooking)}
        booking={completingBooking}
        isLoading={isCompleting}
        onClose={() => setCompletingBooking(null)}
        onConfirm={handleConfirmComplete}
      />

      {/* Write Review Dialog */}
      {reviewingBooking && (
        <WriteReviewDialog
          open={Boolean(reviewingBooking)}
          onClose={() => setReviewingBooking(null)}
          tourTitle={reviewingBooking.tour.title}
          eligibleBookings={[
            {
              id: reviewingBooking.id,
              bookingCode: reviewingBooking.bookingCode,
              status: reviewingBooking.status,
              tour: { id: reviewingBooking.tour.id, title: reviewingBooking.tour.title },
              departureDate: reviewingBooking.departureDate,
              participants: reviewingBooking.participants,
            },
          ]}
          onCreated={handleReviewCreated}
          onDuplicate={() => {
            void refetchReviews();
            setReviewingBooking(null);
          }}
        />
      )}
    </div>
  );
}
