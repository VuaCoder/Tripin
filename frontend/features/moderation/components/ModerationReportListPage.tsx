'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Shield,
  ShieldAlert,
  User,
  X,
  XCircle,
} from 'lucide-react';
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

const SELECT_CLASS =
  'rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 cursor-pointer';

/** Use case "Resolve disputes": the queue of reports, with the decision a moderator makes on each one. */
export function ModerationReportListPage() {
  const canResolve = useModerationPermission(PERMISSION.disputeResolve);
  const canBan = useModerationPermission(PERMISSION.accountBan);
  const canModerateReview = useModerationPermission(PERMISSION.reviewModerate);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [targetType, setTargetType] = useState<TargetFilter>('ALL');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [showStats, setShowStats] = useState(true);

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

  // Compute KPI stats
  const stats = useMemo(() => {
    const rawItems = data?.items ?? [];
    const total = data?.meta?.total ?? rawItems.length;
    const openCount = rawItems.filter((r) => r.status === 'OPEN').length;
    const respondedCount = rawItems.filter((r) => r.status === 'AGENCY_RESPONDED').length;
    const resolvedCount = rawItems.filter((r) => r.status === 'RESOLVED').length;
    const rejectedCount = rawItems.filter((r) => r.status === 'REJECTED').length;

    return {
      total,
      openCount,
      respondedCount,
      resolvedCount,
      rejectedCount,
    };
  }, [data?.meta?.total, data?.items]);

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
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Notice Banner - Link to Escalated Disputes */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200/80 bg-teal-50/60 p-3.5 sm:px-4 text-xs text-teal-900 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-teal-100 flex items-center justify-center text-brand-teal shrink-0">
            <ShieldAlert className="size-4" />
          </div>
          <span>
            Bạn cần phân xử các <strong>phiếu khiếu nại tour leo thang</strong> giữa Du khách và Đối tác?
          </span>
        </div>
        <Link
          href="/moderator/complaints"
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 font-bold text-white shadow-2xs hover:bg-teal-800 transition cursor-pointer"
        >
          <span>Đến mục Tranh chấp &amp; CSAT</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Header Banner - Polished executive look with Tripin teal theme */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-teal-50/20 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/70 bg-teal-50/80 px-3 py-0.5 text-xs font-bold text-teal-800">
              <Shield className="size-3.5 text-brand-teal" />
              <span>Ban Kiểm Duyệt Sàn • Báo cáo vi phạm</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Báo cáo &amp; Tranh chấp cộng đồng
            </h1>
            <p className="text-sm text-slate-500">
              Thẩm định báo cáo của du khách về tour, tài khoản đối tác hoặc đánh giá vi phạm tiêu chuẩn.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
            {/* Toggle show/hide stats */}
            <button
              type="button"
              onClick={() => setShowStats((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
              title="Ẩn / hiện phần báo cáo thống kê"
            >
              <BarChart2 className="size-3.5 text-slate-500" />
              <span>{showStats ? 'Ẩn thống kê' : 'Hiện thống kê'}</span>
            </button>

            <button
              type="button"
              disabled={isFetching}
              onClick={() => void refetch()}
              aria-label="Làm mới"
              title="Làm mới"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 text-slate-500 ${isFetching ? 'animate-spin text-brand-teal' : ''}`} />
              <span>{isFetching ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards - Refined white cards with subtle icon boxes */}
        {showStats && (
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-5 border-t border-slate-200/60">
            {/* Card 1: Tổng số báo cáo */}
            <div
              onClick={() => {
                setStatus('ALL');
                setPage(1);
              }}
              className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Tổng báo cáo</span>
                <div className="size-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Shield className="size-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                <span className="text-xs text-slate-400 font-medium">vụ việc</span>
              </div>
            </div>

            {/* Card 2: Chờ xử lý (OPEN) */}
            <div
              onClick={() => {
                setStatus('OPEN');
                setPage(1);
              }}
              className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-2xs hover:shadow-xs ${
                stats.openCount > 0
                  ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400'
                  : 'border-slate-200/90 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className={`text-xs font-semibold ${stats.openCount > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
                  Chờ xử lý
                </span>
                <div
                  className={`size-7 rounded-lg flex items-center justify-center ${
                    stats.openCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <AlertCircle className="size-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className={`text-2xl font-black ${stats.openCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                  {stats.openCount}
                </span>
                <span className={`text-xs font-medium ${stats.openCount > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                  {stats.openCount > 0 ? 'cần duyệt' : 'ổn định'}
                </span>
              </div>
            </div>

            {/* Card 3: Đối tác phản hồi (AGENCY_RESPONDED) */}
            <div
              onClick={() => {
                setStatus('AGENCY_RESPONDED');
                setPage(1);
              }}
              className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-2xs hover:shadow-xs ${
                stats.respondedCount > 0
                  ? 'border-teal-300 bg-teal-50/50 hover:border-teal-400'
                  : 'border-slate-200/90 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className={`text-xs font-semibold ${stats.respondedCount > 0 ? 'text-teal-800' : 'text-slate-500'}`}>
                  Đối tác phản hồi
                </span>
                <div
                  className={`size-7 rounded-lg flex items-center justify-center ${
                    stats.respondedCount > 0 ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Clock className="size-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className={`text-2xl font-black ${stats.respondedCount > 0 ? 'text-brand-teal' : 'text-slate-900'}`}>
                  {stats.respondedCount}
                </span>
                <span className={`text-xs font-medium ${stats.respondedCount > 0 ? 'text-brand-teal font-semibold' : 'text-slate-400'}`}>
                  {stats.respondedCount > 0 ? 'chờ ra quyết định' : 'chưa có'}
                </span>
              </div>
            </div>

            {/* Card 4: Đã giải quyết */}
            <div
              onClick={() => {
                setStatus('RESOLVED');
                setPage(1);
              }}
              className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Đã hoàn tất</span>
                <div className="size-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="size-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{stats.resolvedCount}</span>
                <span className="text-xs text-slate-400 font-medium">đã xử lý</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Status Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-px text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => {
              setStatus('ALL');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              status === 'ALL'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Tất cả</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                status === 'ALL' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatus('OPEN');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              status === 'OPEN'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Chờ xử lý</span>
            {stats.openCount > 0 && (
              <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold animate-pulse">
                {stats.openCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setStatus('AGENCY_RESPONDED');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              status === 'AGENCY_RESPONDED'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Đối tác phản hồi</span>
            {stats.respondedCount > 0 && (
              <span className="rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 text-xs font-bold">
                {stats.respondedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setStatus('RESOLVED');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              status === 'RESOLVED'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Đã giải quyết</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatus('REJECTED');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              status === 'REJECTED'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Đã bác bỏ</span>
          </button>
        </div>
      </div>

      {/* Filter Dropdowns - Placed on their own dedicated row below the tabs */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {/* Accessible select for tests and quick jump */}
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

        {(status !== 'ALL' || targetType !== 'ALL' || category !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setStatus('ALL');
              setTargetType('ALL');
              setCategory('ALL');
              setPage(1);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <X className="size-3 text-slate-400" />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {isLoading ? (
        <LoadingState label="Đang tải danh sách báo cáo..." />
      ) : isError ? (
        <ErrorState
          title="Không thể tải danh sách báo cáo"
          message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
          onAction={() => void refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-2xs">
          <EmptyState
            title="Không có báo cáo nào"
            description="Không có báo cáo vi phạm nào khớp với bộ lọc hiện tại."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {data.items.map((r) => {
              const isPending = r.status === 'OPEN';
              const isResponded = r.status === 'AGENCY_RESPONDED';
              const isResolved = r.status === 'RESOLVED';

              return (
                <li
                  key={r.id}
                  onClick={() => {
                    setServerError(null);
                    setSelectedId(r.id);
                  }}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs cursor-pointer"
                >
                  {/* Top Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      {isPending && (
                        <span className="rounded bg-amber-50 border border-amber-200/70 text-amber-800 px-2 py-0.5 text-xs font-medium">
                          Đang mở
                        </span>
                      )}
                      {isResponded && (
                        <span className="rounded bg-teal-50 border border-teal-200/70 text-teal-800 px-2 py-0.5 text-xs font-medium">
                          Đối tác đã phản hồi
                        </span>
                      )}
                      {isResolved && (
                        <span className="rounded bg-emerald-50 border border-emerald-200/70 text-emerald-800 px-2 py-0.5 text-xs font-medium">
                          Đã giải quyết
                        </span>
                      )}
                      {!isPending && !isResponded && !isResolved && (
                        <span className="rounded bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-medium">
                          Đã bác bỏ
                        </span>
                      )}

                      {/* Target Type Badge */}
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {REPORT_TARGET_LABELS[r.targetType]}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400 font-medium">
                      Gửi {dateTime.format(new Date(r.createdAt))}
                    </span>
                  </div>

                  {/* Description Body */}
                  <div className="mt-2.5">
                    <p className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-brand-teal transition-colors line-clamp-2">
                      {r.description}
                    </p>
                  </div>

                  {/* Footer: Category & Action */}
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 pl-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-teal-50/70 border border-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                        {REPORT_CATEGORY_LABELS[r.category]}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        #{r.id.slice(0, 8)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setServerError(null);
                        setSelectedId(r.id);
                      }}
                      className="inline-flex items-center gap-1 font-bold text-brand-teal group-hover:translate-x-0.5 transition-transform"
                    >
                      <span>
                        {r.status === 'OPEN' || r.status === 'AGENCY_RESPONDED' ? 'Xem & xử lý' : 'Xem chi tiết'}
                      </span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
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

      <DecisionDialog
        open={Boolean(selected)}
        title="Chi tiết báo cáo"
        reasonLabel="Lý do / ghi chú xử lý (bắt buộc)"
        actions={actions}
        isSubmitting={isResolving || isBanning || isModeratingReview}
        serverError={serverError}
        className="max-h-[92vh] max-w-2xl overflow-y-auto"
        onClose={close}
      >
        {selected && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${REPORT_STATUS_LABELS[selected.status].className}`}>
                {REPORT_STATUS_LABELS[selected.status].label}
              </span>
              <span className="text-slate-600 text-xs font-semibold">{REPORT_CATEGORY_LABELS[selected.category]}</span>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
              <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Nội dung báo cáo</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900 font-medium">{selected.description}</p>
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
              <div className="rounded-xl border border-teal-200/80 bg-teal-50/60 p-3.5">
                <p className="text-xs font-bold text-teal-800">
                  Phản hồi của đối tác · {dateTime.format(new Date(selected.agencyResponse.respondedAt))}
                </p>
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

            {/* Lịch sử hội thoại & Trao đổi thực tế giữa hai bên */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="size-4 text-brand-teal" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Hội thoại &amp; Trao đổi thực tế
                  </h4>
                </div>
                {selected.relatedTicket && (
                  <Link
                    href="/moderator/complaints"
                    className="text-xs font-bold text-brand-teal hover:underline flex items-center gap-1"
                    title="Mở toàn màn hình trong Tranh chấp & CSAT"
                  >
                    <span>Mở phân xử ({selected.relatedTicket.ticketCode})</span>
                    <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>

              {selected.relatedTicket && selected.relatedTicket.messages.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-brand-teal">{selected.relatedTicket.ticketCode}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 font-medium truncate max-w-xs">{selected.relatedTicket.subject}</span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {selected.relatedTicket.status}
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2.5 rounded-xl border border-slate-200/90 bg-white p-3 text-xs">
                    {selected.relatedTicket.messages.map((m) => {
                      const isAgency = m.senderRole === 'AGENCY';
                      const isMod = m.senderRole === 'MODERATOR';
                      const isSys = m.senderRole === 'SYSTEM';

                      if (isSys) {
                        return (
                          <div key={m.id} className="text-center my-1.5">
                            <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600 border border-slate-200/60">
                              {m.text}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isAgency ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5 px-1">
                            <span className="font-bold text-slate-700">
                              {m.senderName || (isAgency ? 'Đối tác' : isMod ? 'Kiểm duyệt viên' : 'Du khách')}
                            </span>
                            <span>({m.senderRole})</span>
                            <span>·</span>
                            <span>{dateTime.format(new Date(m.createdAt))}</span>
                          </div>
                          <div
                            className={`max-w-[85%] rounded-2xl p-2.5 text-xs shadow-2xs whitespace-pre-wrap ${
                              isAgency
                                ? 'bg-teal-50/80 border border-teal-200/70 text-teal-950 rounded-br-xs'
                                : 'bg-slate-100 border border-slate-200 text-slate-900 rounded-bl-xs'
                            }`}
                          >
                            <p>{m.text}</p>
                            {m.attachments && m.attachments.length > 0 && (
                              <div className="mt-2 grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-200/60">
                                {m.attachments.map((img, idx) => (
                                  <a
                                    key={idx}
                                    href={img}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group relative block aspect-video overflow-hidden rounded-lg border border-slate-300 bg-slate-100 transition hover:opacity-90"
                                    title="Bấm để xem ảnh phóng to"
                                  >
                                    <img
                                      src={img}
                                      alt={`Đính kèm #${idx + 1}`}
                                      className="h-full w-full object-cover transition group-hover:scale-105"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : selected.directChat && selected.directChat.messages.length > 0 ? (
                <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-slate-200/90 bg-white p-3 text-xs">
                  {selected.directChat.messages.map((m) => {
                    const isReporter = m.senderId === selected.reporterId;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isReporter ? 'items-start' : 'items-end'}`}
                      >
                        <div className="text-[10px] text-slate-400 mb-0.5 px-1">
                          <span className="font-bold text-slate-700">
                            {isReporter ? (selected.reporterName || 'Du khách') : (selected.agencyName || 'Đối tác')}
                          </span>
                          {' · '}
                          {dateTime.format(new Date(m.createdAt))}
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl p-2.5 text-xs ${
                            isReporter
                              ? 'bg-slate-100 border border-slate-200 text-slate-900 rounded-bl-xs'
                              : 'bg-teal-50/80 border border-teal-200/70 text-teal-950 rounded-br-xs'
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-center text-xs text-slate-500">
                  Chưa ghi nhận cuộc hội thoại hoặc tin nhắn trao đổi phát sinh giữa hai bên về tour này.
                </div>
              )}
            </div>
          </>
        )}
      </DecisionDialog>
    </div>
  );
}
