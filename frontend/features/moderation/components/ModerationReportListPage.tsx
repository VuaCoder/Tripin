'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import { RatingStars } from '@/features/review/components';
import { REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS, REPORT_TARGET_LABELS } from '@/features/report/labels';
import type { ReportCategory, ReportStatus, ReportTarget } from '@/features/report/types';
import { useBanAccountMutation, useGetModerationReportsQuery, useModerateReviewMutation, useResolveReportMutation } from '../api/moderationApi';
import { PERMISSION, RESOLUTION_MAX, REVIEW_STATUS_LABELS } from '../labels';
import type { ModerationReport } from '../types';
import { DecisionDialog, type DecisionAction } from './DecisionDialog';
import { dateTime, FeedbackBanner, ModerationDenied, moderationErrorMessage, useModerationPermission, type Feedback } from './ModerationUi';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | ReportStatus;
type TargetFilter = 'ALL' | ReportTarget;
type CategoryFilter = 'ALL' | ReportCategory;

const STATUSES = Object.keys(REPORT_STATUS_LABELS) as ReportStatus[];
const TARGETS = Object.keys(REPORT_TARGET_LABELS) as ReportTarget[];
const CATEGORIES = Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[];

const SELECT_CLASS = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';

/** Use case "Resolve disputes": the queue of reports, with the decision a moderator makes on each one. */
export function ModerationReportListPage() {
  const canResolve = useModerationPermission(PERMISSION.disputeResolve);
  const canBan = useModerationPermission(PERMISSION.accountBan);
  const canModerateReview = useModerationPermission(PERMISSION.reviewModerate);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [targetType, setTargetType] = useState<TargetFilter>('ALL');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const { data, isLoading, isFetching, isError, refetch } = useGetModerationReportsQuery(
    {
      page,
      limit: PAGE_SIZE,
      ...(status === 'ALL' ? {} : { status }),
      ...(targetType === 'ALL' ? {} : { targetType }),
      ...(category === 'ALL' ? {} : { category }),
    },
    { skip: !canResolve },
  );
  const [resolveReport, { isLoading: isResolving }] = useResolveReportMutation();
  const [banAccount, { isLoading: isBanning }] = useBanAccountMutation();
  const [moderateReview, { isLoading: isModeratingReview }] = useModerateReviewMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!canResolve) return <ModerationDenied />;

  // Always read the open report from the cache so the dialog reflects what the backend returned.
  const selected: ModerationReport | null = data?.items.find((r) => r.id === selectedId) ?? null;

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
  if (selected && (selected.status === 'OPEN' || selected.status === 'AGENCY_RESPONDED')) {
    actions.push(
      {
        key: 'resolve',
        label: 'Chấp nhận báo cáo',
        tone: 'positive',
        requiresReason: true,
        maxReason: RESOLUTION_MAX,
        onConfirm: (note) =>
          void decide(
            () => resolveReport({ id: selected.id, decision: 'RESOLVED', note }).unwrap(),
            'Đã chấp nhận báo cáo và thông báo cho các bên.',
            'Không thể xử lý báo cáo lúc này. Vui lòng thử lại.',
          ),
      },
      {
        key: 'reject',
        label: 'Bác bỏ báo cáo',
        tone: 'negative',
        requiresReason: true,
        maxReason: RESOLUTION_MAX,
        onConfirm: (note) =>
          void decide(
            () => resolveReport({ id: selected.id, decision: 'REJECTED', note }).unwrap(),
            'Đã bác bỏ báo cáo và thông báo cho các bên.',
            'Không thể xử lý báo cáo lúc này. Vui lòng thử lại.',
          ),
      },
    );
  }
  // A report about an account is the one place the violating account id is known to this queue.
  if (selected?.targetType === 'USER' && canBan) {
    actions.push({
      key: 'ban',
      label: 'Khoá tài khoản bị báo cáo',
      tone: 'negative',
      requiresReason: true,
      onConfirm: (reason) =>
        void decide(
          () => banAccount({ id: selected.targetId, reason }).unwrap(),
          'Đã khoá tài khoản vi phạm.',
          'Không thể khoá tài khoản này. Vui lòng kiểm tra lại quyền và trạng thái tài khoản.',
        ),
    });
  }
  // A report about a review is judged here, so hiding it is offered here too instead of in a second screen.
  if (selected?.review && canModerateReview) {
    const hide = selected.review.status === 'VISIBLE';
    actions.push({
      key: 'review',
      label: hide ? 'Ẩn đánh giá' : 'Khôi phục đánh giá',
      tone: hide ? 'negative' : 'positive',
      requiresReason: hide,
      onConfirm: (reason) =>
        void decide(
          () => moderateReview({ id: selected.targetId, hide, ...(hide ? { reason } : {}) }).unwrap(),
          hide ? 'Đã ẩn đánh giá.' : 'Đã khôi phục đánh giá.',
          'Không thể cập nhật đánh giá này. Vui lòng kiểm tra lại quyền và trạng thái đánh giá.',
        ),
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-1 py-2 sm:px-0">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Báo cáo &amp; tranh chấp</h1>
          <p className="mt-1 text-sm text-slate-500">
            Báo cáo của du khách về tour, tài khoản đối tác hoặc đánh giá. Đối tác có thể phản hồi một lần trước khi bạn ra quyết định cuối cùng.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            className={SELECT_CLASS}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {REPORT_STATUS_LABELS[s].label}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc theo đối tượng"
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as TargetFilter);
              setPage(1);
            }}
            className={SELECT_CLASS}
          >
            <option value="ALL">Mọi đối tượng</option>
            {TARGETS.map((t) => (
              <option key={t} value={t}>
                {REPORT_TARGET_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc theo loại vấn đề"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as CategoryFilter);
              setPage(1);
            }}
            className={SELECT_CLASS}
          >
            <option value="ALL">Mọi loại vấn đề</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {REPORT_CATEGORY_LABELS[c]}
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
        <LoadingState label="Đang tải danh sách báo cáo..." />
      ) : isError ? (
        <ErrorState title="Không thể tải danh sách báo cáo" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <EmptyState title="Không có báo cáo nào" description="Không có báo cáo nào khớp với bộ lọc hiện tại." />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {data.items.map((r) => {
              const label = REPORT_STATUS_LABELS[r.status];
              return (
                <li key={r.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${label.className}`}>{label.label}</span>
                        <span className="text-xs font-semibold text-slate-600">{REPORT_CATEGORY_LABELS[r.category]}</span>
                        <span className="text-xs text-slate-500">{REPORT_TARGET_LABELS[r.targetType]}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-800">{r.description}</p>
                      <p className="mt-1 text-xs text-slate-500">Gửi {dateTime.format(new Date(r.createdAt))}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setServerError(null);
                        setSelectedId(r.id);
                      }}
                      className="rounded-xl border border-purple-200 px-3 py-1.5 text-sm font-semibold text-purple-800 hover:bg-purple-50"
                    >
                      {r.status === 'OPEN' || r.status === 'AGENCY_RESPONDED' ? 'Xem & xử lý' : 'Xem chi tiết'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination currentPage={data.meta.page} totalPages={data.meta.totalPages} totalItems={data.meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={isFetching} showInfo itemLabel="báo cáo" />
        </div>
      )}

      <DecisionDialog
        open={Boolean(selected)}
        title="Chi tiết báo cáo"
        reasonLabel="Lý do / ghi chú xử lý (bắt buộc)"
        actions={actions}
        isSubmitting={isResolving || isBanning || isModeratingReview}
        serverError={serverError}
        onClose={close}
      >
        {selected && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${REPORT_STATUS_LABELS[selected.status].className}`}>
                {REPORT_STATUS_LABELS[selected.status].label}
              </span>
              <span className="text-slate-600">{REPORT_CATEGORY_LABELS[selected.category]}</span>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Nội dung báo cáo</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-800">{selected.description}</p>
            </div>
            {selected.review && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">Đánh giá bị báo cáo</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${REVIEW_STATUS_LABELS[selected.review.status].className}`}>
                    {REVIEW_STATUS_LABELS[selected.review.status].label}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <RatingStars value={selected.review.rating} size="sm" />
                  <span className="font-semibold text-slate-800">{selected.review.authorName ?? 'Không xác định'}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{selected.review.comment}</p>
                {selected.review.hiddenReason && (
                  <p className="mt-1 text-xs text-amber-900">
                    <span className="font-bold">Lý do ẩn gần nhất:</span> {selected.review.hiddenReason}
                  </p>
                )}
              </div>
            )}
            <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 rounded-xl border border-slate-100 p-3 text-xs">
              <dt className="text-slate-500">Đối tượng</dt>
              <dd className="font-semibold break-words text-slate-800">
                {REPORT_TARGET_LABELS[selected.targetType]}
                {selected.targetName ? ` · ${selected.targetName}` : ''}
              </dd>
              <dt className="text-slate-500">Người báo cáo</dt>
              <dd className="font-semibold break-words text-slate-800">{selected.reporterName ?? 'Không xác định'}</dd>
              {selected.agencyName && (
                <>
                  <dt className="text-slate-500">Đối tác liên quan</dt>
                  <dd className="font-semibold break-words text-slate-800">{selected.agencyName}</dd>
                </>
              )}
              {selected.tourTitle && (
                <>
                  <dt className="text-slate-500">Tour liên quan</dt>
                  <dd className="font-semibold break-words text-slate-800">{selected.tourTitle}</dd>
                </>
              )}
              {selected.bookingCode && (
                <>
                  <dt className="text-slate-500">Đơn đặt chỗ</dt>
                  <dd className="font-semibold text-slate-800">{selected.bookingCode}</dd>
                </>
              )}
            </dl>
            {selected.agencyResponse && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-bold text-blue-800">Phản hồi của đối tác · {dateTime.format(new Date(selected.agencyResponse.respondedAt))}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{selected.agencyResponse.text}</p>
              </div>
            )}
            {selected.resolution && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-bold text-emerald-800">
                  Quyết định trước đó ({selected.resolution.decision === 'RESOLVED' ? 'chấp nhận' : 'bác bỏ'}) · {dateTime.format(new Date(selected.resolution.resolvedAt))}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{selected.resolution.note}</p>
              </div>
            )}
          </>
        )}
      </DecisionDialog>
    </div>
  );
}
