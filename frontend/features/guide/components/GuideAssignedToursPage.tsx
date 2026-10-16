'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { useAnswerAssignmentMutation, useGetAssignedToursQuery } from '../api/guideApi';
import type { GuideAssignedTour } from '../types';
import { GuideAssignmentCard } from './GuideAssignmentCard';
import { GuideAssignmentDialog } from './GuideAssignmentDialog';

const PAGE_SIZE = 10;

/** Use cases "View Assigned Tours" and "Verify Assigned Tours" for the logged-in Tour guide. */
export function GuideAssignedToursPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, refetch } = useGetAssignedToursQuery({ page, limit: PAGE_SIZE }, { pollingInterval: 30_000, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true });
  const [answerAssignment, { isLoading: isAnswering }] = useAnswerAssignmentMutation();

  const [pending, setPending] = useState<{ tour: GuideAssignedTour; accept: boolean } | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleConfirm = async (note?: string) => {
    if (!pending) return;
    try {
      await answerAssignment({ tourId: pending.tour.id, accept: pending.accept, note }).unwrap();
      setFeedback({
        message: pending.accept ? 'Bạn đã nhận tour thành công.' : 'Bạn đã từ chối tour này.',
        type: 'success',
      });
      setPending(null);
    } catch (err: unknown) {
      setFeedback({
        message: getApiErrorMessage(err, 'Không thể gửi phản hồi lúc này. Vui lòng thử lại sau.'),
        type: 'error',
      });
      setPending(null);
      // The tour may have been reassigned or answered elsewhere; re-read the assignment.
      void refetch();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Tour nhận dẫn</h1>
          <p className="mt-1 text-sm text-slate-500">
            Các tour đại lý đã phân công cho bạn. Hãy xác nhận nhận hoặc từ chối từng tour.
          </p>
        </div>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
          aria-label="Làm mới"
          title="Làm mới"
          className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand-teal disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true">
            refresh
          </span>
        </button>
      </header>

      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-semibold ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedback.message}</span>
          </span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Đóng thông báo" className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Đang tải danh sách tour được phân công..." />
      ) : isError ? (
        <ErrorState
          title="Không thể tải danh sách tour"
          message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng kiểm tra lại đường truyền."
          onAction={() => void refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <EmptyState
            title="Chưa có tour nào được phân công"
            description="Khi đại lý phân công bạn phụ trách một tour, tour đó sẽ xuất hiện tại đây để bạn xác nhận."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {data.items.map((tour) => (
              <GuideAssignmentCard key={tour.id} tour={tour} onAnswer={(item, accept) => setPending({ tour: item, accept })} />
            ))}
          </div>

          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
              <span>
                Trang {data.meta.page} / {data.meta.totalPages} (Tổng {data.meta.total} tour)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={data.meta.page <= 1 || isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={data.meta.page >= data.meta.totalPages || isFetching}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <GuideAssignmentDialog
        open={Boolean(pending)}
        tour={pending?.tour ?? null}
        accept={pending?.accept ?? true}
        isLoading={isAnswering}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
