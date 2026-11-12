'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  Building2,
  Scale,
  ShieldAlert,
  Headphones,
  CheckCircle2,
  PieChart,
  BarChart3,
  ArrowRight,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { ErrorState, LoadingState } from '@/components/shared';
import { useGetModeratorComplaintsQuery } from '@/features/complaints/api/complaintsApi';
import { useGetModerationDashboardQuery } from '../api/moderationApi';
import { PERMISSION } from '../labels';
import { dateTime, ModerationDenied, useModerationPermission } from './ModerationUi';

interface MetricTileConfig {
  label: string;
  value: number | string;
  hint: string;
  href?: string;
  allowed: boolean;
  icon: React.ElementType;
  badge: string;
  theme: {
    bgGradient: string;
    border: string;
    iconBg: string;
    iconText: string;
    badgeBg: string;
    badgeText: string;
    valueText: string;
    glow: string;
  };
}

const TOUR_STATUS_THEME: Record<string, { label: string; color: string; bg: string; text: string }> = {
  APPROVED: { label: 'Đã duyệt / Mở bán', color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  PENDING_REVIEW: { label: 'Chờ kiểm duyệt', color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700' },
  REJECTED: { label: 'Bị từ chối', color: '#ef4444', bg: 'bg-rose-50', text: 'text-rose-700' },
  SUSPENDED: { label: 'Tạm ngưng', color: '#8b5cf6', bg: 'bg-purple-50', text: 'text-purple-700' },
  DRAFT: { label: 'Bản nháp', color: '#64748b', bg: 'bg-slate-100', text: 'text-slate-600' },
  ARCHIVED: { label: 'Lưu trữ', color: '#94a3b8', bg: 'bg-slate-100', text: 'text-slate-500' },
};

/** Use case "View moderation dashboard": high-impact, visual metrics and charts. */
export function ModerationDashboardPage() {
  const user = useAppSelector(selectUser);
  const allowed = useModerationPermission(PERMISSION.dashboard);
  const canTours = useModerationPermission(PERMISSION.tourList);
  const canAgencies = useModerationPermission(PERMISSION.agencyVerify);
  const canReports = useModerationPermission(PERMISSION.disputeResolve);
  const canTickets = useModerationPermission(PERMISSION.complaintHandle);
  const canReviews = useModerationPermission(PERMISSION.reviewModerate);

  const [activeTourStatus, setActiveTourStatus] = useState<string | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useGetModerationDashboardQuery(undefined, {
    skip: !allowed,
    pollingInterval: 3_600_000,
    refetchOnFocus: true,
  });

  const {
    data: complaintData,
    isError: complaintError,
    isLoading: complaintLoading,
    refetch: refetchComplaints,
  } = useGetModeratorComplaintsQuery(
    { status: 'ESCALATED', limit: 1 },
    { skip: !canReports, pollingInterval: 3_600_000, refetchOnFocus: true },
  );

  if (!allowed) return <ModerationDenied />;

  const tiles: MetricTileConfig[] = data
    ? [
        {
          label: 'Tour chờ duyệt',
          value: data.queues.toursPendingReview ?? 0,
          hint: 'Cần quyết định duyệt / từ chối',
          href: '/moderator/tours?status=PENDING_REVIEW',
          allowed: canTours,
          icon: Compass,
          badge: 'Cần duyệt',
          theme: {
            bgGradient: 'bg-white hover:bg-slate-50/60',
            border: 'border-slate-200/90 hover:border-slate-300',
            iconBg: 'bg-slate-100 text-slate-700',
            iconText: 'text-slate-700',
            badgeBg: 'bg-slate-100 text-slate-700 border border-slate-200/60',
            badgeText: 'text-slate-700',
            valueText: 'text-slate-900',
            glow: '',
          },
        },
        {
          label: 'Agency chờ xác minh',
          value: data.queues.agenciesPendingVerification ?? 0,
          hint: 'Hồ sơ pháp lý đối tác mới',
          href: '/moderator/agencies',
          allowed: canAgencies,
          icon: Building2,
          badge: 'Hồ sơ mới',
          theme: {
            bgGradient: 'bg-white hover:bg-slate-50/60',
            border: 'border-slate-200/90 hover:border-slate-300',
            iconBg: 'bg-slate-100 text-slate-700',
            iconText: 'text-slate-700',
            badgeBg: 'bg-slate-100 text-slate-700 border border-slate-200/60',
            badgeText: 'text-slate-700',
            valueText: 'text-slate-900',
            glow: '',
          },
        },
        {
          label: 'Tranh chấp khiếu nại',
          value: complaintError ? 'Lỗi tải dữ liệu' : complaintLoading ? 'Đang tải…' : complaintData?.meta.total ?? '—',
          hint: `${complaintError ? 'Lỗi tải dữ liệu' : complaintData?.meta.total ?? '…'} ca khiếu nại tour leo thang`,
          href: '/moderator/complaints',
          allowed: canReports,
          icon: Scale,
          badge: 'Khẩn cấp',
          theme: {
            bgGradient: 'bg-white hover:bg-rose-50/30',
            border: 'border-rose-200/80 hover:border-rose-300',
            iconBg: 'bg-rose-50 text-rose-600',
            iconText: 'text-rose-600',
            badgeBg: 'bg-rose-50 text-rose-700 border border-rose-200/60',
            badgeText: 'text-rose-700',
            valueText: 'text-rose-600',
            glow: '',
          },
        },
        {
          label: 'Báo cáo đang mở',
          value: (data.queues.reportsOpen ?? 0) + (data.queues.reportsAwaitingDecision ?? 0),
          hint: `${data.queues.reportsAwaitingDecision ?? 0} ca chờ quyết định cuối`,
          href: '/moderator/reports',
          allowed: canReports,
          icon: ShieldAlert,
          badge: 'Cần phân xử',
          theme: {
            bgGradient: 'bg-white hover:bg-amber-50/30',
            border: 'border-amber-200/80 hover:border-amber-300',
            iconBg: 'bg-amber-50 text-amber-700',
            iconText: 'text-amber-700',
            badgeBg: 'bg-amber-50 text-amber-800 border border-amber-200/60',
            badgeText: 'text-amber-800',
            valueText: 'text-slate-900',
            glow: '',
          },
        },
        {
          label: 'Khiếu nại hỗ trợ',
          value: (data.queues.supportTicketsOpen ?? 0) + (data.queues.supportTicketsInProgress ?? 0),
          hint: `${data.queues.supportTicketsInProgress ?? 0} phiếu đang hỗ trợ`,
          href: '/moderator/support-tickets',
          allowed: canTickets,
          icon: Headphones,
          badge: 'Hỗ trợ sàn',
          theme: {
            bgGradient: 'bg-white hover:bg-slate-50/60',
            border: 'border-slate-200/90 hover:border-slate-300',
            iconBg: 'bg-slate-100 text-slate-700',
            iconText: 'text-slate-700',
            badgeBg: 'bg-slate-100 text-slate-700 border border-slate-200/60',
            badgeText: 'text-slate-700',
            valueText: 'text-slate-900',
            glow: '',
          },
        },
      ]
    : [];

  // Donut chart calculations
  const tourEntries = useMemo(() => {
    if (!data?.tours) return [];
    return Object.entries(data.tours).filter(([, count]) => count > 0);
  }, [data?.tours]);

  const totalTours = useMemo(() => {
    return tourEntries.reduce((acc, [, count]) => acc + count, 0);
  }, [tourEntries]);

  // Donut chart SVG path parameters
  const donutRadius = 56;
  const donutCircumference = 2 * Math.PI * donutRadius; // ≈ 351.86

  const gap = tourEntries.length > 1 ? 4 : 0;
  let accumulatedLength = 0;
  const donutSlices = tourEntries.map(([status, count]) => {
    const fraction = totalTours > 0 ? count / totalTours : 0;
    const arcLength = fraction * donutCircumference;
    const visibleLength = Math.max(0.5, arcLength - gap);
    const strokeDasharray = `${visibleLength.toFixed(2)} ${(donutCircumference - visibleLength).toFixed(2)}`;
    const strokeDashoffset = -(accumulatedLength + gap / 2);
    accumulatedLength += arcLength;
    const meta = TOUR_STATUS_THEME[status] ?? {
      label: status,
      color: '#94a3b8',
      bg: 'bg-slate-100',
      text: 'text-slate-600',
    };
    return {
      status,
      count,
      percent: Math.round(fraction * 100),
      strokeDasharray,
      strokeDashoffset,
      meta,
    };
  });

  const activeSlice = donutSlices.find((s) => s.status === activeTourStatus);

  // Queue workload data
  const workloadItems = useMemo(() => {
    if (!data) return [];
    const items = [
      { label: 'Tour chờ duyệt', count: data.queues.toursPendingReview ?? 0, max: 20, color: 'bg-emerald-500', href: '/moderator/tours' },
      { label: 'Đại lý chờ xác minh', count: data.queues.agenciesPendingVerification ?? 0, max: 15, color: 'bg-sky-500', href: '/moderator/agencies' },
      { label: 'Tranh chấp khiếu nại', count: typeof complaintData?.meta.total === 'number' ? complaintData.meta.total : 0, max: 10, color: 'bg-rose-500', href: '/moderator/complaints' },
      { label: 'Báo cáo vi phạm', count: (data.queues.reportsOpen ?? 0) + (data.queues.reportsAwaitingDecision ?? 0), max: 15, color: 'bg-amber-500', href: '/moderator/reports' },
      { label: 'Vé hỗ trợ kỹ thuật', count: (data.queues.supportTicketsOpen ?? 0) + (data.queues.supportTicketsInProgress ?? 0), max: 20, color: 'bg-purple-500', href: '/moderator/support-tickets' },
    ];
    return items;
  }, [data, complaintData]);

  const maxWorkload = useMemo(() => {
    return Math.max(1, ...workloadItems.map((w) => w.count));
  }, [workloadItems]);

  // Review safety ratio
  const reviewsVisible = data?.reviews?.visible ?? 0;
  const reviewsHidden = data?.reviews?.hidden ?? 0;
  const totalReviews = reviewsVisible + reviewsHidden;
  const safetyRate = totalReviews > 0 ? Math.round((reviewsVisible / totalReviews) * 100) : 100;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header Banner */}
      <header className="flex items-center justify-between border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Xin chào, {user?.fullName || 'Kiểm duyệt viên'}!
        </h1>

        <button
          type="button"
          disabled={isFetching}
          onClick={() => {
            void refetch();
            if (canReports) void refetchComplaints();
          }}
          title="Làm mới"
          aria-label="Làm mới"
          className="flex size-10 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {canReports && complaintError && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-sm font-medium text-amber-900 flex items-center justify-between gap-4">
          <span>Lỗi tải dữ liệu khiếu nại.</span>
          <button type="button" className="underline font-bold hover:text-amber-950 cursor-pointer" onClick={() => void refetchComplaints()}>
            Thử lại
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Đang tải dữ liệu kiểm duyệt..." />
      ) : isError || !data ? (
        <ErrorState
          title="Không thể tải bảng điều khiển"
          message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
          onAction={() => {
            void refetch();
            if (canReports) void refetchComplaints();
          }}
        />
      ) : (
        <>
          {/* Bento Grid: 5 Colorful Metric Cards */}
          <section aria-label="Các chỉ số kiểm duyệt quan trọng" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {tiles
              .filter((t) => t.allowed)
              .map((t) => {
                const IconComponent = t.icon;
                const cardContent = (
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center justify-center size-8 rounded-xl ${t.theme.iconBg}`}>
                          <IconComponent className="size-4" />
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-tight ${t.theme.badgeBg}`}>
                          {t.badge}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t.label}</div>
                        <div
                          className={`mt-1 text-2xl font-bold tracking-tight ${t.theme.valueText}`}
                          data-testid={`tile-${t.label}`}
                        >
                          {t.value}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                      <span className="truncate">{t.hint}</span>
                      <ArrowRight className="size-3 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-1" />
                    </div>
                  </div>
                );

                return t.href && t.allowed ? (
                  <Link
                    key={t.label}
                    href={t.href}
                    className={`group rounded-2xl border ${t.theme.bgGradient} ${t.theme.border} p-4 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer`}
                  >
                    {cardContent}
                  </Link>
                ) : (
                  <div
                    key={t.label}
                    className={`rounded-2xl border ${t.theme.bgGradient} ${t.theme.border} p-4 shadow-2xs`}
                  >
                    {cardContent}
                  </div>
                );
              })}
          </section>

          {/* Analytics & Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Tour Status Distribution with SVG Donut Chart (7 cols) */}
            {canTours && (
              <section className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                        <PieChart className="size-4.5" />
                      </span>
                      <div>
                        <h2 className="text-base font-bold text-slate-900 tracking-tight">Phân bổ trạng thái tour</h2>
                        <p className="text-xs text-slate-400">Tỷ lệ tour theo trạng thái kiểm duyệt trên sàn</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                      Tổng: {totalTours} tour
                    </span>
                  </div>

                  {totalTours === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <Compass className="size-10 stroke-[1.2] mb-2 text-slate-300" />
                      <p className="text-sm">Chưa có dữ liệu tour trên hệ thống.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                      {/* SVG Donut Chart with Interactive Center */}
                      <div className="md:col-span-5 flex flex-col items-center justify-center">
                        <div className="relative size-48">
                          <svg
                            className="size-full -rotate-90"
                            viewBox="0 0 160 160"
                            role="img"
                            aria-label="Biểu đồ tròn phân bổ tour"
                          >
                            {/* Background Track */}
                            <circle
                              cx="80"
                              cy="80"
                              r={donutRadius}
                              fill="transparent"
                              stroke="#f1f5f9"
                              strokeWidth="18"
                            />
                            {/* Donut Slices */}
                            {donutSlices.map((slice) => {
                              const isHovered = activeTourStatus === slice.status;
                              return (
                                <circle
                                  key={slice.status}
                                  cx="80"
                                  cy="80"
                                  r={donutRadius}
                                  fill="transparent"
                                  stroke={slice.meta.color}
                                  strokeWidth={isHovered ? '22' : '18'}
                                  strokeDasharray={slice.strokeDasharray}
                                  strokeDashoffset={slice.strokeDashoffset}
                                  strokeLinecap="butt"
                                  className="transition-all duration-300 cursor-pointer origin-center"
                                  style={{
                                    opacity: activeTourStatus && !isHovered ? 0.35 : 1,
                                    filter: isHovered ? `drop-shadow(0 0 6px ${slice.meta.color}80)` : undefined,
                                  }}
                                  onMouseEnter={() => setActiveTourStatus(slice.status)}
                                  onMouseLeave={() => setActiveTourStatus(null)}
                                />
                              );
                            })}
                          </svg>

                          {/* Donut Center: Interactive details on hover */}
                          {activeSlice ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3 animate-in fade-in zoom-in-95 duration-200">
                              <span
                                className="text-3xl font-black tracking-tight"
                                style={{ color: activeSlice.meta.color }}
                              >
                                {activeSlice.count}
                              </span>
                              <span
                                className="text-[11px] font-bold uppercase tracking-wider truncate max-w-[110px]"
                                style={{ color: activeSlice.meta.color }}
                              >
                                {activeSlice.meta.label}
                              </span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
                              <span className="text-3xl font-black text-slate-900 tracking-tight">{totalTours}</span>
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng tour</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Legend & Breakdown List (Without % column, visual bar per status) */}
                      <div className="md:col-span-7 space-y-2">
                        {donutSlices.map((slice) => {
                          const isHovered = activeTourStatus === slice.status;
                          return (
                            <Link
                              key={slice.status}
                              href={`/moderator/tours?status=${slice.status}`}
                              onMouseEnter={() => setActiveTourStatus(slice.status)}
                              onMouseLeave={() => setActiveTourStatus(null)}
                              className={`group block rounded-2xl p-2.5 transition-all cursor-pointer ${
                                isHovered
                                  ? 'bg-slate-100/90 shadow-2xs translate-x-1'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className="size-3 rounded-full shrink-0 shadow-2xs transition-transform group-hover:scale-125"
                                    style={{ backgroundColor: slice.meta.color }}
                                  />
                                  <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-slate-900">
                                    {slice.meta.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className="rounded-lg px-2.5 py-0.5 text-xs font-black shadow-2xs transition-colors"
                                    style={{
                                      backgroundColor: isHovered ? slice.meta.color : '#f1f5f9',
                                      color: isHovered ? '#ffffff' : '#334155',
                                    }}
                                  >
                                    {slice.count}
                                  </span>
                                </div>
                              </div>

                              {/* Visual proportional indicator bar */}
                              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.max(4, slice.percent)}%`,
                                    backgroundColor: slice.meta.color,
                                    opacity: isHovered ? 1 : 0.75,
                                  }}
                                />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-3 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Cập nhật lúc {dateTime.format(new Date(data.generatedAt))}</span>
                  {isFetching && <span className="text-brand-teal font-medium">Đang làm mới...</span>}
                </div>
              </section>
            )}

            {/* Chart 2: Queue Workload & Content Health (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Workload Progress Bars */}
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs flex-1">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                      <BarChart3 className="size-4.5" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">Hàng đợi chờ xử lý</h2>
                      <p className="text-xs text-slate-400">Tải công việc cần giải quyết</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {workloadItems.map((item) => {
                    const percent = Math.min(100, Math.round((item.count / maxWorkload) * 100));
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="group block rounded-2xl p-2 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-slate-700 group-hover:text-slate-900">{item.label}</span>
                          <span className="font-black text-slate-900">{item.count}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                            style={{ width: `${item.count > 0 ? Math.max(8, percent) : 0}%` }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>

              {/* Review Health Gauge */}
              {canReviews && (
                <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-white p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-900 text-sm">Chỉ số an toàn đánh giá</h3>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      {safetyRate}% sạch
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                      <Eye className="size-3.5" />
                      <span>{reviewsVisible} đánh giá hiển thị</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                      <EyeOff className="size-3.5" />
                      <span>{reviewsHidden} đã ẩn vi phạm</span>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
