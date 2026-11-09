'use client';

import Link from 'next/link';
import { SlaTrends } from './SlaTrends';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { ErrorState, LoadingState } from '@/components/shared';
import { useGetModeratorComplaintsQuery } from '@/features/complaints/api/complaintsApi';
import { useGetModerationDashboardQuery } from '../api/moderationApi';
import { PERMISSION } from '../labels';
import { dateTime, ModerationDenied, useModerationPermission } from './ModerationUi';

interface Tile {
  label: string;
  value: number | string;
  hint: string;
  href?: string;
  allowed: boolean;
}

/** Use case "View moderation dashboard": the queues that need a human, straight from the backend. */
export function ModerationDashboardPage() {
  const user = useAppSelector(selectUser);
  const allowed = useModerationPermission(PERMISSION.dashboard);
  const canTours = useModerationPermission(PERMISSION.tourList);
  const canAgencies = useModerationPermission(PERMISSION.agencyVerify);
  const canReports = useModerationPermission(PERMISSION.disputeResolve);
  const canTickets = useModerationPermission(PERMISSION.complaintHandle);
  const { data, isLoading, isError, isFetching, refetch } = useGetModerationDashboardQuery(undefined, { skip: !allowed, pollingInterval: 3_600_000, refetchOnFocus: true });
  const { data: complaintData, isError: complaintError, isLoading: complaintLoading, refetch: refetchComplaints } = useGetModeratorComplaintsQuery({ status: 'ESCALATED', limit: 1 }, { skip: !canReports, pollingInterval: 3_600_000, refetchOnFocus: true });

  if (!allowed) return <ModerationDenied />;

  const tiles: Tile[] = data
    ? [
        { label: 'Tour chờ duyệt', value: data.queues.toursPendingReview ?? 0, hint: 'Cần quyết định duyệt / từ chối', href: '/moderator/tours?status=PENDING_REVIEW', allowed: canTours },
        { label: 'Agency chờ xác minh', value: data.queues.agenciesPendingVerification ?? 0, hint: 'Hồ sơ đối tác mới gửi', href: '/moderator/agencies', allowed: canAgencies },
        { label: 'Tranh chấp khiếu nại', value: complaintError ? 'Lỗi tải dữ liệu' : complaintLoading ? 'Đang tải…' : complaintData?.meta.total ?? '—', hint: `${complaintError ? 'Lỗi tải dữ liệu' : complaintData?.meta.total ?? '…'} ca khiếu nại tour leo thang`, href: '/moderator/complaints', allowed: canReports },
        { label: 'Báo cáo đang mở', value: (data.queues.reportsOpen ?? 0) + (data.queues.reportsAwaitingDecision ?? 0), hint: `${data.queues.reportsAwaitingDecision} chờ quyết định cuối`, href: '/moderator/reports', allowed: canReports },
        { label: 'Khiếu nại hỗ trợ', value: (data.queues.supportTicketsOpen ?? 0) + (data.queues.supportTicketsInProgress ?? 0), hint: `${data.queues.supportTicketsInProgress} đang xử lý`, href: '/moderator/support-tickets', allowed: canTickets },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header Banner - Traveler Profile Style: prominent bold title, zero subtitles */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Xin chào, {user?.fullName || 'Kiểm duyệt viên'}!
        </h1>
      </div>

      {canReports && complaintError && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-sm font-medium text-amber-900">
          Lỗi tải dữ liệu khiếu nại.{' '}
          <button type="button" className="underline font-bold" onClick={() => void refetchComplaints()}>
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
          {/* Bento Block 2: Key Metric Cards in Bento Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {tiles
              .filter((t) => t.allowed)
              .map((t) => {
                const body = (
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.label}</div>
                      <div
                        className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900"
                        data-testid={`tile-${t.label}`}
                      >
                        {t.value}
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] font-medium text-slate-400">{t.hint}</div>
                  </div>
                );
                return t.href && t.allowed ? (
                  <Link
                    key={t.label}
                    href={t.href}
                    className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md"
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    key={t.label}
                    className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs"
                  >
                    {body}
                  </div>
                );
              })}
          </div>

          {/* Bento Block 3 & 4: SLA Trends Chart + Status Overview */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {canReports && (
              <div className={canTours ? 'lg:col-span-8' : 'lg:col-span-12'}>
                <SlaTrends />
              </div>
            )}

            {canTours && (
              <div
                className={`flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs ${
                  canReports ? 'lg:col-span-4' : 'lg:col-span-12'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-900 inline-block" />
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tour theo trạng thái</h2>
                  </div>
                  {Object.keys(data.tours ?? {}).length === 0 ? (
                    <p className="text-sm text-slate-500">Chưa có tour nào trên hệ thống.</p>
                  ) : (
                    <dl className="grid grid-cols-2 gap-3">
                      {Object.entries(data.tours ?? {}).map(([status, count]) => (
                        <div
                          key={status}
                          className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition-colors hover:bg-slate-100/70"
                        >
                          <dt className="text-xs font-semibold text-slate-500">{status}</dt>
                          <dd className="mt-1 text-xl font-extrabold text-slate-900">{count}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                <div className="mt-6 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                  Cập nhật lúc {dateTime.format(new Date(data.generatedAt))}
                  {isFetching ? ' · đang làm mới...' : ''}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
