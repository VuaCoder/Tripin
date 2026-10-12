import React, { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import {
  useCancelBookingMutation,
  useGetMyBookingsQuery,
} from '../api/bookingApi';
import { BookingHistoryCard } from './BookingHistoryCard';
import { CancelBookingModal } from './CancelBookingModal';
import type { BookingDto, BookingStatus } from '../types';

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
  const [cancelFeedback, setCancelFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const queryStatus = selectedStatus === 'ALL' ? undefined : selectedStatus;
  const { data, isLoading, isFetching, isError, refetch } = useGetMyBookingsQuery({
    status: queryStatus,
    page,
    limit: 10,
  });

  const [cancelBooking, { isLoading: isCancelling }] = useCancelBookingMutation();

  const handleConfirmCancel = async (bookingId: string, reason?: string) => {
    try {
      await cancelBooking({ id: bookingId, reason }).unwrap();
      setCancellingBooking(null);
      setCancelFeedback({
        message: 'Đã hủy đặt chỗ thành công.',
        type: 'success',
      });
      setTimeout(() => setCancelFeedback(null), 5000);
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { error?: { message?: string } } })?.data?.error?.message ||
        'Không thể hủy đặt chỗ vào lúc này. Vui lòng thử lại sau.';
      setCancelFeedback({ message: errorMsg, type: 'error' });
    }
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

      {/* Cancel Feedback Banner */}
      {cancelFeedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 ${
            cancelFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              {cancelFeedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{cancelFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setCancelFeedback(null)}
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
        <div className="py-12">
          <LoadingState label="Đang tải danh sách đặt chỗ của bạn..." />
        </div>
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
            onAction={() => window.location.assign('/explore')}
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
                onOpenCancel={(item) => setCancellingBooking(item)}
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
    </div>
  );
}
