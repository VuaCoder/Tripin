'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import { useGetAgencyComplaintsQuery, useRespondToComplaintMutation } from '../api/agencyComplaintsApi';
import { CATEGORY_LABELS, COMPLAINT_ERROR_MESSAGES, STATUS_LABELS } from '../labels';
import type { Complaint, ComplaintStatus } from '../types';
import { ComplaintResponseDialog } from './ComplaintResponseDialog';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | ComplaintStatus;

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** Use case "Handle Tour Complaints" for the logged-in Agency. */
export function AgencyComplaintsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const { data, isLoading, isFetching, isError, refetch } = useGetAgencyComplaintsQuery({
    page,
    limit: PAGE_SIZE,
    ...(filter === 'ALL' ? {} : { status: filter }),
  });
  const [respond, { isLoading: isResponding }] = useRespondToComplaintMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Always read the open complaint from the cache so the dialog reflects what the backend returned.
  const selected: Complaint | null = data?.items.find((c) => c.id === selectedId) ?? null;

  const handleSubmit = async (text: string) => {
    if (!selected) return;
    setServerError(null);
    try {
      await respond({ id: selected.id, text }).unwrap();
      setFeedback({ message: 'Đã gửi phản hồi cho khiếu nại.', type: 'success' });
      setSelectedId(null);
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      setServerError((code && COMPLAINT_ERROR_MESSAGES[code]) || getApiErrorMessage(err, 'Không thể gửi phản hồi lúc này. Vui lòng thử lại.'));
      // The complaint may have been answered or closed elsewhere; re-read its real state.
      void refetch();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Khiếu nại về tour</h1>
          <p className="mt-1 text-sm text-slate-500">
            Các khiếu nại liên quan đến tour của bạn. Bạn có thể phản hồi một lần; kiểm duyệt viên sẽ đưa ra quyết định cuối cùng.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Lọc theo trạng thái"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="ALL">Tất cả</option>
            {(Object.keys(STATUS_LABELS) as ComplaintStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
            aria-label="Làm mới"
            title="Làm mới"
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true">
              refresh
            </span>
          </button>
        </div>
      </header>

      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-semibold ${
            feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Đóng thông báo" className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Đang tải danh sách khiếu nại..." />
      ) : isError ? (
        <ErrorState title="Không thể tải khiếu nại" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <EmptyState title="Chưa có khiếu nại nào" description="Khi du khách gửi khiếu nại về tour của bạn, khiếu nại đó sẽ xuất hiện tại đây." />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {data.items.map((c) => {
              const status = STATUS_LABELS[c.status];
              return (
                <li key={c.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                        <span className="text-xs font-semibold text-slate-600">{CATEGORY_LABELS[c.category]}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-800">{c.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Từ {c.reporterName} · {dateTime.format(new Date(c.createdAt))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setServerError(null);
                        setSelectedId(c.id);
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {c.status === 'OPEN' ? 'Xem & phản hồi' : 'Xem chi tiết'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
              <span>
                Trang {data.meta.page} / {data.meta.totalPages} (Tổng {data.meta.total} khiếu nại)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={data.meta.page <= 1 || isFetching}
                  onClick={() => setPage((c) => Math.max(1, c - 1))}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={data.meta.page >= data.meta.totalPages || isFetching}
                  onClick={() => setPage((c) => c + 1)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ComplaintResponseDialog
        open={selected !== null}
        complaint={selected}
        isSubmitting={isResponding}
        serverError={serverError}
        onClose={() => setSelectedId(null)}
        onSubmit={(text) => void handleSubmit(text)}
      />
    </div>
  );
}
