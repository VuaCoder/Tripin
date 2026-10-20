'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import { useGetMyReportsQuery } from '../api/reportApi';
import { REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS, REPORT_TARGET_LABELS } from '../labels';
import type { ReportStatus } from '../types';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | ReportStatus;

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** Use case "Send report" (read side): the reports the logged-in traveler filed, with their outcome. */
export function MyReportsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const { data, isLoading, isFetching, isError, refetch } = useGetMyReportsQuery({
    page,
    limit: PAGE_SIZE,
    ...(filter === 'ALL' ? {} : { status: filter }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Báo cáo của tôi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Các báo cáo bạn đã gửi và kết quả xử lý từ kiểm duyệt viên.
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
            {(Object.keys(REPORT_STATUS_LABELS) as ReportStatus[]).map((s) => (
              <option key={s} value={s}>
                {REPORT_STATUS_LABELS[s].label}
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
            <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true">refresh</span>
          </button>
        </div>
      </header>

      {isLoading ? (
        <LoadingState label="Đang tải báo cáo..." />
      ) : isError ? (
        <ErrorState title="Không thể tải báo cáo" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Chưa có báo cáo nào" description="Khi bạn báo cáo một tour hoặc một đánh giá, báo cáo đó sẽ xuất hiện tại đây." />
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {data.items.map((r) => {
              const status = REPORT_STATUS_LABELS[r.status];
              return (
                <li key={r.id} className="rounded-2xl border border-surface-container bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                    <span className="text-xs font-semibold text-slate-600">{REPORT_CATEGORY_LABELS[r.category]}</span>
                    <span className="text-xs text-slate-400">
                      {REPORT_TARGET_LABELS[r.targetType]} · {dateTime.format(new Date(r.createdAt))}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{r.description}</p>

                  {r.agencyResponse && (
                    <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <p className="text-xs font-bold text-blue-800">
                        Phản hồi của đối tác · {dateTime.format(new Date(r.agencyResponse.respondedAt))}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{r.agencyResponse.text}</p>
                    </div>
                  )}

                  {r.resolution && (
                    <div
                      className={`mt-2 rounded-xl border p-3 ${
                        r.resolution.decision === 'RESOLVED' ? 'border-emerald-100 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p className={`text-xs font-bold ${r.resolution.decision === 'RESOLVED' ? 'text-emerald-800' : 'text-slate-600'}`}>
                        Quyết định của kiểm duyệt viên · {dateTime.format(new Date(r.resolution.resolvedAt))}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{r.resolution.note}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <Pagination
            currentPage={data.meta.page}
            totalPages={data.meta.totalPages}
            totalItems={data.meta.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            disabled={isFetching}
            showInfo
            itemLabel="báo cáo"
          />
        </div>
      )}
    </div>
  );
}
