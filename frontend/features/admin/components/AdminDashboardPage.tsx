'use client';
import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Coins, CreditCard, Ticket, Users, Map, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { useGetAdminDashboardQuery } from '../api/adminApi';
import type { DashboardArgs } from '../types';
import { dateSelectionError, dateSelectionQuery, recentDays, type DateSelection } from '../utils/filters';
import { AdminDateFields } from './AdminDateFields';
import { DistributionChart, RevenueChart } from './AdminCharts';
import { AdminFrame, Feedback, money, panel, timestamp, toolbar, useAdminSession } from './AdminUi';

function Change({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return <span className="text-xs text-slate-400">Toàn bộ thời gian</span>;
  const change = previous ? (current - previous) / previous * 100 : null;
  const down = current < previous;
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${down ? 'text-orange-600' : 'text-teal-700'}`}>
    {down ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
    {change === null ? current ? 'Mới phát sinh' : 'Không đổi' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}<span className="ml-1 font-normal text-slate-400">so với kỳ trước</span>
  </span>;
}
export function AdminDashboardPage() {
  const { ready } = useAdminSession();
  const [selection, setSelection] = useState<DateSelection>(() => recentDays(30));
  const [args, setArgs] = useState<DashboardArgs>(() => dateSelectionQuery(recentDays(30)));
  const [preset, setPreset] = useState<number | null>(30);
  const [error, setError] = useState<string | null>(null);
  const query = useGetAdminDashboardQuery(args, { skip: !ready, refetchOnMountOrArgChange: true });
  const d = query.currentData;
  const apply = (range: DateSelection) => {
    const found = dateSelectionError(range, 366); setError(found);
    if (!found) setArgs(dateSelectionQuery(range));
  };
  if (!ready) return null;
  const filters = <>
    <form className={`${toolbar} sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]`} noValidate onSubmit={(e) => { e.preventDefault(); setPreset(null); apply(selection); }}>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 xl:col-span-3"><span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays size={17} className="text-teal-600" />Khoảng thời gian báo cáo</span><div className="flex flex-wrap gap-1 rounded-lg bg-slate-50 p-1">{[7, 30, 90, 365].map((days) => <button type="button" key={days} onClick={() => { const next = recentDays(days); setSelection(next); setPreset(days); apply(next); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${preset === days ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>{days} ngày</button>)}</div></div>
      <AdminDateFields prefix="dashboard" value={selection} onChange={(value) => { setSelection(value); setPreset(null); }} />
      <div className="flex items-center gap-2"><Button type="submit">Áp dụng</Button><Button variant="ghost" onClick={() => { setSelection({ from: '', to: '' }); setArgs({}); setPreset(null); setError(null); }}>Toàn thời gian</Button></div>
      <p className="text-xs leading-5 text-slate-400 sm:col-span-2 xl:col-span-3">Ngày được tính theo giờ Việt Nam. Doanh thu theo ngày xác nhận booking/thanh toán gói; biểu đồ nhóm tháng UTC. Chỉ gồm booking đã xác nhận hoặc hoàn tất.</p>
    </form>
    <Feedback error={error} />
  </>;
  return <AdminFrame title="Dashboard chi tiết" description="Theo dõi hiệu quả kinh doanh, so sánh các kỳ và nắm bắt hoạt động trên toàn nền tảng." error={query.error} loading={!d} refreshing={query.isFetching && !!d} onRefresh={() => void query.refetch()} filters={filters}>
    {d && <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold text-slate-700">Hiệu quả kinh doanh <span className="ml-2 rounded-full bg-teal-50 px-2 py-1 text-[10px] font-medium text-teal-700">{d.period ? 'Trong kỳ đã chọn' : 'Toàn thời gian'}</span></h2><p className="text-[11px] text-slate-400">Dữ liệu lúc {timestamp(d.generatedAt)} · Backend có cache tối đa 30 giây.</p></div>
      {d.period && <p className="text-xs text-slate-400">Kỳ trước: {timestamp(d.period.previousFrom)} → {timestamp(d.period.previousTo)} (cùng độ dài).</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { label: 'Tổng tiền booking', value: d.revenue.gross, previous: d.comparison?.gross, icon: CreditCard, color: 'bg-teal-50 text-teal-700' },
        { label: 'Hoa hồng nền tảng', value: d.revenue.commission, previous: d.comparison?.commission, icon: Coins, color: 'bg-orange-50 text-orange-600' },
        { label: 'Phần doanh thu đại lý', value: d.revenue.net, previous: d.comparison?.net, icon: Ticket, color: 'bg-sky-50 text-sky-600' },
        { label: 'Doanh thu gói dịch vụ', value: d.revenue.subscriptions.amount, previous: d.comparison?.subscriptions.amount, icon: ShieldCheck, color: 'bg-violet-50 text-violet-600' },
      ].map(({ label, value, previous, icon: Icon, color }) => <section className={panel} key={label}><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-medium text-slate-500">{label}</h3><span className={`rounded-lg p-2 ${color}`}><Icon size={16} /></span></div><p className="mt-4 break-words text-xl font-bold tracking-tight text-slate-900 tabular-nums xl:text-2xl">{money(value)}</p><div className="mt-3"><Change current={value} previous={previous} /></div></section>)}</div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]"><RevenueChart rows={d.monthly} scopeLabel={[d.monthly[0]?.month, d.monthly[d.monthly.length - 1]?.month].join(' - ') + ' (UTC)'} /><div className="space-y-5"><section className={panel}><p className="text-xs text-slate-500">Booking đã xác nhận / hoàn tất</p><p className="my-3 text-3xl font-bold text-slate-900 tabular-nums">{d.revenue.bookings}</p><Change current={d.revenue.bookings} previous={d.comparison?.bookings} /><div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">Thanh toán gói dịch vụ <strong className="float-right text-slate-900">{d.revenue.subscriptions.count}</strong></div></section><DistributionChart title="Booking theo trạng thái" values={d.bookings.byStatus} subtitle={d.period ? 'Booking tạo trong kỳ đã chọn' : 'Toàn bộ thời gian'} /></div></div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 pt-3"><h2 className="font-bold text-slate-800">Tổng quan nền tảng</h2><span className="text-xs text-slate-400">Hiện trạng toàn hệ thống · Không lọc theo kỳ doanh thu</span></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { label: 'Tổng người dùng', value: d.users.total, icon: Users }, { label: 'Người dùng mới (30 ngày)', value: d.users.newLast30Days, icon: Users }, { label: 'Tổng tour', value: d.tours.total, icon: Map }, { label: 'Gói dịch vụ đang hoạt động', value: d.subscriptions.active, icon: Ticket },
      ].map(({ label, value, icon: Icon }) => <section className={`${panel} flex items-center gap-4`} key={label}><span className="rounded-xl bg-slate-50 p-3 text-slate-400"><Icon size={20} /></span><div><h3 className="text-xs text-slate-500">{label}</h3><p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString('vi-VN')}</p></div></section>)}</div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><DistributionChart title="Người dùng theo vai trò" values={d.users.byRole} subtitle="Cơ cấu tài khoản toàn hệ thống" /><DistributionChart title="Tour theo trạng thái" values={d.tours.byStatus} subtitle="Hiện trạng danh mục tour" /><div className="space-y-5"><DistributionChart title="Người dùng theo trạng thái" values={d.users.byStatus} subtitle="Tình trạng tài khoản" /><section className={`${panel} space-y-3`}><h2 className="text-sm font-bold">Cần xử lý</h2><p className="flex justify-between text-sm text-slate-500">Báo cáo đang mở <strong className="text-orange-600">{d.moderation.reportsOpen}</strong></p><p className="flex justify-between text-sm text-slate-500">Yêu cầu hỗ trợ đang mở <strong className="text-orange-600">{d.moderation.supportTicketsOpen}</strong></p></section></div></div>
    </>}
  </AdminFrame>;
}
