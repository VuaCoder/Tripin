'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import { RatingStars } from '@/features/review/components';
import { useBanAccountMutation, useGetModerationReviewsQuery, useModerateReviewMutation } from '../api/moderationApi';
import { PERMISSION, REVIEW_STATUS_LABELS } from '../labels';
import type { ModerationReview, ReviewStatus } from '../types';
import { DecisionDialog, type DecisionAction } from './DecisionDialog';
import { dateTime, FeedbackBanner, ModerationDenied, moderationErrorMessage, useModerationPermission, type Feedback } from './ModerationUi';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | ReviewStatus;

/** Use case "Moderate reviews": hide a violating review (with a reason) or restore it. */
export function ModerationReviewListPage() {
  const canModerate = useModerationPermission(PERMISSION.reviewModerate);
  const canBan = useModerationPermission(PERMISSION.accountBan);

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const { data, isLoading, isFetching, isError, refetch } = useGetModerationReviewsQuery(
    { page, limit: PAGE_SIZE, ...(filter === 'ALL' ? {} : { status: filter }) },
    { skip: !canModerate },
  );
  const [moderateReview, { isLoading: isModerating }] = useModerateReviewMutation();
  const [banAccount, { isLoading: isBanning }] = useBanAccountMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!canModerate) return <ModerationDenied />;

  // Always read the open review from the cache so the dialog reflects what the backend returned.
  const selected: ModerationReview | null = data?.items.find((r) => r.id === selectedId) ?? null;

  const close = () => {
    setSelectedId(null);
    setServerError(null);
  };

  // The UI only reports success after the backend has confirmed (`unwrap` throws on any error).
  const decide = async (run: () => Promise<unknown>, successMessage: string, failure: string) => {
    setServerError(null);
    try {
      await run();
      setFeedback({ message: successMessage, type: 'success' });
      close();
    } catch (err: unknown) {
      setServerError(moderationErrorMessage(err, failure));
      void refetch();
    }
  };

  const actions: DecisionAction[] = [];
  if (selected?.status === 'VISIBLE') {
    actions.push({
      key: 'hide',
      label: 'Ẩn đánh giá',
      tone: 'negative',
      requiresReason: true,
      onConfirm: (reason) =>
        void decide(
          () => moderateReview({ id: selected.id, hide: true, reason }).unwrap(),
          'Đã ẩn đánh giá và cập nhật điểm của tour.',
          'Không thể ẩn đánh giá lúc này. Vui lòng thử lại.',
        ),
    });
  }
  if (selected?.status === 'HIDDEN') {
    actions.push({
      key: 'restore',
      label: 'Khôi phục đánh giá',
      tone: 'positive',
      requiresReason: false,
      onConfirm: () =>
        void decide(
          () => moderateReview({ id: selected.id, hide: false }).unwrap(),
          'Đã khôi phục đánh giá và cập nhật điểm của tour.',
          'Không thể khôi phục đánh giá lúc này. Vui lòng thử lại.',
        ),
    });
  }
  // The review author is the violating account this queue knows.
  if (selected && canBan) {
    actions.push({
      key: 'ban',
      label: 'Khoá tài khoản tác giả',
      tone: 'negative',
      requiresReason: true,
      onConfirm: (reason) =>
        void decide(
          () => banAccount({ id: selected.travelerId, reason }).unwrap(),
          'Đã khoá tài khoản vi phạm.',
          'Không thể khoá tài khoản này. Vui lòng kiểm tra lại quyền và trạng thái tài khoản.',
        ),
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-1 py-2 sm:px-0">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Kiểm duyệt đánh giá</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ẩn đánh giá vi phạm (kèm lý do) hoặc khôi phục đánh giá đã bị ẩn. Điểm trung bình của tour được tính lại ngay.
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
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((s) => (
              <option key={s} value={s}>
                {REVIEW_STATUS_LABELS[s].label}
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

      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {isLoading ? (
        <LoadingState label="Đang tải danh sách đánh giá..." />
      ) : isError ? (
        <ErrorState title="Không thể tải danh sách đánh giá" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <EmptyState title="Không có đánh giá nào" description="Không có đánh giá nào khớp với bộ lọc hiện tại." />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {data.items.map((r) => {
              const label = REVIEW_STATUS_LABELS[r.status];
              return (
                <li key={r.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${label.className}`}>{label.label}</span>
                        <RatingStars value={r.rating} size="sm" />
                        <span className="text-xs text-slate-500">{r.tourTitle}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-800">{r.comment}</p>
                      <p className="mt-1 text-xs text-slate-500">Viết {dateTime.format(new Date(r.createdAt))}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setServerError(null);
                        setSelectedId(r.id);
                      }}
                      className="rounded-xl border border-purple-200 px-3 py-1.5 text-sm font-semibold text-purple-800 hover:bg-purple-50"
                    >
                      Xem &amp; xử lý
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination currentPage={data.meta.page} totalPages={data.meta.totalPages} totalItems={data.meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={isFetching} showInfo itemLabel="đánh giá" />
        </div>
      )}

      <DecisionDialog
        open={Boolean(selected)}
        title="Chi tiết đánh giá"
        reasonLabel={selected?.status === 'HIDDEN' ? 'Lý do (bắt buộc khi khoá tài khoản)' : 'Lý do ẩn đánh giá (bắt buộc)'}
        actions={actions}
        isSubmitting={isModerating || isBanning}
        serverError={serverError}
        onClose={close}
      >
        {selected && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${REVIEW_STATUS_LABELS[selected.status].className}`}>
                {REVIEW_STATUS_LABELS[selected.status].label}
              </span>
              <RatingStars value={selected.rating} size="sm" />
              <span className="text-slate-600">{selected.tourTitle}</span>
            </div>
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-800">{selected.comment}</p>
            <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 rounded-xl border border-slate-100 p-3 text-xs">
              <dt className="text-slate-500">Tác giả</dt>
              <dd className="font-semibold break-words text-slate-800">{selected.travelerName ?? 'Không xác định'}</dd>
              {selected.agencyName && (
                <>
                  <dt className="text-slate-500">Đối tác</dt>
                  <dd className="font-semibold break-words text-slate-800">{selected.agencyName}</dd>
                </>
              )}
              <dt className="text-slate-500">Tour</dt>
              <dd className="font-semibold break-words text-slate-800">{selected.tourTitle}</dd>
            </dl>
            {selected.hiddenReason && (
              <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-900">
                <span className="font-bold">Lý do ẩn gần nhất:</span> {selected.hiddenReason}
              </p>
            )}
          </>
        )}
      </DecisionDialog>
    </div>
  );
}
