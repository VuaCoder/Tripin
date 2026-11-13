'use client';
import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Coins, CreditCard, Ticket, Users, Map, ShieldCheck } from 'lucide-react';
import { useGetAdminDashboardQuery } from '../api/adminApi';
import type { DashboardArgs } from '../types';
import { dateSelectionQuery, recentDays } from '../utils/filters';
import { DistributionChart, RevenueChart } from './AdminCharts';
import { AdminFrame, money, panel, useAdminSession } from './AdminUi';
import { AdminDashboardSkeleton } from './AdminSkeletons';

function Change({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  const change = previous ? (current - previous) / previous * 100 : null;
  const down = current < previous;
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${down ? 'text-orange-600' : 'text-teal-700'}`}>
    {down ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
    {change === null ? current ? 'Mới phát sinh' : 'Không đổi' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
  </span>;
}
export function AdminDashboardPage() {
  const { ready } = useAdminSession();
  const [args, setArgs] = useState<DashboardArgs>(() => dateSelectionQuery(recentDays(30)));
  const [rangeDays, setRangeDays] = useState(30);
  const query = useGetAdminDashboardQuery(args, { skip: !ready, refetchOnMountOrArgChange: true, pollingInterval: 3_600_000, refetchOnFocus: true });
  const d = query.currentData;
  const updateRange = (days: number) => {
    setRangeDays(days);
    setArgs(dateSelectionQuery(recentDays(days)));
  };
  if (!ready) return null;
  return <AdminFrame title="Dashboard" error={query.error} loading={!d} loadingSkeleton={<AdminDashboardSkeleton />} refreshing={query.isFetching && !!d} onRefresh={() => query.refetch()}>
    {d && <>
      <h2 className="text-sm font-bold text-slate-700">Hiệu quả kinh doanh</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { label: 'Tổng tiền booking', value: d.revenue.gross, previous: d.comparison?.gross, icon: CreditCard, color: 'bg-teal-50 text-teal-700' },
        { label: 'Hoa hồng nền tảng', value: d.revenue.commission, previous: d.comparison?.commission, icon: Coins, color: 'bg-orange-50 text-orange-600' },
        { label: 'Phần doanh thu đại lý', value: d.revenue.net, previous: d.comparison?.net, icon: Ticket, color: 'bg-sky-50 text-sky-600' },
        { label: 'Doanh thu gói dịch vụ', value: d.revenue.subscriptions.amount, previous: d.comparison?.subscriptions.amount, icon: ShieldCheck, color: 'bg-violet-50 text-violet-600' },
      ].map(({ label, value, previous, icon: Icon, color }) => <section className={panel} key={label}><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-medium text-slate-500">{label}</h3><span className={`rounded-lg p-2 ${color}`}><Icon size={16} /></span></div><p className="mt-4 break-words text-xl font-bold tracking-tight text-slate-900 tabular-nums xl:text-2xl">{money(value)}</p><div className="mt-3"><Change current={value} previous={previous} /></div></section>)}</div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]"><RevenueChart rows={d.monthly} rangeDays={rangeDays} onRangeChange={updateRange} /><div className="space-y-5"><section className={panel}><h3 className="text-sm font-semibold text-slate-700">Booking đã xác nhận / hoàn tất</h3><p className="my-3 text-3xl font-bold text-slate-900 tabular-nums">{d.revenue.bookings}</p><Change current={d.revenue.bookings} previous={d.comparison?.bookings} /><div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">Thanh toán gói dịch vụ <strong className="float-right text-slate-900">{d.revenue.subscriptions.count}</strong></div></section><DistributionChart title="Booking theo trạng thái" values={d.bookings.byStatus} /></div></div>
      <div className="border-b border-slate-200 pb-3 pt-3"><h2 className="font-bold text-slate-800">Tổng quan nền tảng</h2></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { label: 'Tổng người dùng', value: d.users.total, icon: Users }, { label: 'Người dùng mới (30 ngày)', value: d.users.newLast30Days, icon: Users }, { label: 'Tổng tour', value: d.tours.total, icon: Map }, { label: 'Gói dịch vụ đang hoạt động', value: d.subscriptions.active, icon: Ticket },
      ].map(({ label, value, icon: Icon }) => <section className={`${panel} flex items-center gap-4`} key={label}><span className="rounded-xl bg-slate-50 p-3 text-slate-400"><Icon size={20} /></span><div><h3 className="text-xs text-slate-500">{label}</h3><p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString('vi-VN')}</p></div></section>)}</div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><DistributionChart title="Người dùng theo vai trò" values={d.users.byRole} /><DistributionChart title="Tour theo trạng thái" values={d.tours.byStatus} /><div className="space-y-5"><DistributionChart title="Người dùng theo trạng thái" values={d.users.byStatus} /><section className={`${panel} space-y-3`}><h2 className="text-sm font-bold">Cần xử lý</h2><p className="flex justify-between text-sm text-slate-500">Báo cáo đang mở <strong className="text-orange-600">{d.moderation.reportsOpen}</strong></p><p className="flex justify-between text-sm text-slate-500">Yêu cầu hỗ trợ đang mở <strong className="text-orange-600">{d.moderation.supportTicketsOpen}</strong></p></section></div></div>
    </>}
  </AdminFrame>;
}
