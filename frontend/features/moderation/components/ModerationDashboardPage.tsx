'use client';

import Link from 'next/link';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { ErrorState, LoadingState } from '@/components/shared';
import { useGetModerationDashboardQuery } from '../api/moderationApi';
import { PERMISSION } from '../labels';
import { dateTime, ModerationDenied, useModerationPermission } from './ModerationUi';

interface Tile {
  label: string;
  value: number;
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
  const { data, isLoading, isError, isFetching, refetch } = useGetModerationDashboardQuery(undefined, { skip: !allowed });

  if (!allowed) return <ModerationDenied />;

  const tiles: Tile[] = data
    ? [
        { label: 'Tour chờ duyệt', value: data.queues.toursPendingReview, hint: 'Cần quyết định duyệt / từ chối', href: '/moderator/tours?status=PENDING_REVIEW', allowed: canTours },
        { label: 'Agency chờ xác minh', value: data.queues.agenciesPendingVerification, hint: 'Hồ sơ đối tác mới gửi', href: '/moderator/agencies', allowed: canAgencies },
        { label: 'Báo cáo đang mở', value: data.queues.reportsOpen + data.queues.reportsAwaitingDecision, hint: `${data.queues.reportsAwaitingDecision} chờ quyết định cuối`, allowed: false },
        { label: 'Khiếu nại hỗ trợ', value: data.queues.supportTicketsOpen + data.queues.supportTicketsInProgress, hint: `${data.queues.supportTicketsInProgress} đang xử lý`, allowed: false },
      ]
    : [];

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/60 bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 p-6 shadow-sm sm:p-8 md:flex-row md:items-center">
        <div>
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-100/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-900">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">verified</span>
            Ban Kiểm Duyệt Nội Dung
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Xin chào, {user?.fullName || 'Kiểm duyệt viên'}!</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">Theo dõi hàng đợi kiểm duyệt tour và xác minh hồ sơ đối tác.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canTours && (
            <Link href="/moderator/tours" className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800">
              Danh sách tour
            </Link>
          )}
          {canAgencies && (
            <Link href="/moderator/agencies" className="rounded-xl border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-800 hover:bg-purple-50">
              Xác minh agency
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Đang tải dữ liệu kiểm duyệt..." />
      ) : isError || !data ? (
        <ErrorState title="Không thể tải bảng điều khiển" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => {
              const body = (
                <>
                  <div className="mb-1 text-xs font-medium text-slate-500">{t.label}</div>
                  <div className="text-2xl font-bold text-slate-900" data-testid={`tile-${t.label}`}>{t.value}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{t.hint}</div>
                </>
              );
              return t.href && t.allowed ? (
                <Link key={t.label} href={t.href} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:border-purple-200">
                  {body}
                </Link>
              ) : (
                <div key={t.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  {body}
                </div>
              );
            })}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-slate-900">Tour theo trạng thái</h2>
            {Object.keys(data.tours).length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có tour nào trên hệ thống.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {Object.entries(data.tours).map(([status, count]) => (
                  <div key={status} className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{status}</dt>
                    <dd className="text-lg font-bold text-slate-900">{count}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mt-4 text-xs text-slate-400">
              Cập nhật lúc {dateTime.format(new Date(data.generatedAt))}
              {isFetching ? ' · đang làm mới...' : ''}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
