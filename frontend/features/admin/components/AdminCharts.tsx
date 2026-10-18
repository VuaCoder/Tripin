'use client';
import { useState } from 'react';
import { BarChart3, Activity } from 'lucide-react';
import type { Dashboard } from '../types';
import { control, money, panel } from './AdminUi';

const palette = ['#0f766e', '#38bdf8', '#fb923c', '#8b5cf6', '#e879a8', '#94a3b8'];
const labels: Record<string, string> = {
  TRAVELER: 'Khách du lịch', AGENCY: 'Đại lý', TOUR_GUIDE: 'Hướng dẫn viên', MODERATOR: 'Kiểm duyệt viên', SUPER_ADMIN: 'Super Admin',
  ACTIVE: 'Hoạt động', BANNED: 'Đã khóa', PENDING_VERIFICATION: 'Chờ xác minh', APPROVED: 'Đã duyệt', DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Chờ duyệt', REJECTED: 'Từ chối', SUSPENDED: 'Tạm ngưng', ARCHIVED: 'Lưu trữ',
  CONFIRMED: 'Đã xác nhận', COMPLETED: 'Hoàn thành', PENDING: 'Chờ thanh toán', CANCELLED: 'Đã hủy',
};
export function DistributionChart({ title, values, subtitle }: { title: string; values: Record<string, number>; subtitle: string }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return <section className={panel}>
    <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div><BarChart3 size={19} className="text-slate-300" /></div>
    <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${title}: tổng ${total}`}>{entries.map(([key, n], i) => <div key={key} style={{ width: `${total ? n / total * 100 : 0}%`, background: palette[i % palette.length] }}><span className="sr-only">{labels[key] ?? key}: {n}</span></div>)}</div>
    <dl className="space-y-4">{entries.map(([key, n], i) => <div key={key}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><dt className="flex items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: palette[i % palette.length] }} />{labels[key] ?? key}</dt><dd className="font-semibold tabular-nums text-slate-900">{n.toLocaleString('vi-VN')} <span className="ml-2 inline-block min-w-9 text-right text-xs font-normal text-slate-400">{total ? (n / total * 100).toFixed(0) : 0}%</span></dd></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-50"><div className="h-full rounded-full" style={{ width: `${total ? n / total * 100 : 0}%`, background: palette[i % palette.length] }} /></div></div>)}</dl>
    {!total && <p className="py-4 text-center text-sm text-slate-400">Chưa có dữ liệu trong phạm vi này.</p>}
  </section>;
}
export function RevenueChart({ rows, scopeLabel = 'Tháng UTC' }: { rows: Dashboard['monthly']; scopeLabel?: string }) {
  const [view, setView] = useState<'revenue' | 'bookings'>('revenue');
  const [active, setActive] = useState<number | null>(null);
  const series = view === 'revenue' ? [
    { label: 'Tổng tiền', color: '#0f766e', values: rows.map((r) => r.gross) },
    { label: 'Đại lý', color: '#38bdf8', values: rows.map((r) => r.gross - r.commission) },
    { label: 'Hoa hồng', color: '#fb923c', values: rows.map((r) => r.commission) },
  ] : [{ label: 'Booking', color: '#0f766e', values: rows.map((r) => r.bookings) }];
  const maximum = Math.max(1, ...series.flatMap((s) => s.values));
  const max = Math.ceil(maximum / 4) * 4;
  const x = (index: number) => rows.length === 1 ? 395 : 70 + index / (rows.length - 1) * 650;
  const y = (value: number) => 226 - value / max * 180;
  const format = (value: number) => view === 'revenue' ? money(value) : value.toLocaleString('vi-VN');
  const selected = active === null ? undefined : rows[active];
  return <section className={panel}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="flex items-center gap-2 font-bold text-slate-900"><Activity size={18} className="text-teal-600" />Xu hướng theo tháng</h2><p className="mt-1 text-xs text-slate-400">{view === 'revenue' ? 'Tổng tiền, phần đại lý và hoa hồng' : 'Booking đã xác nhận / hoàn tất'} · {scopeLabel}</p></div><select aria-label="Chỉ số biểu đồ" className={`${control} !w-auto`} value={view} onChange={(e) => { setView(e.target.value as typeof view); setActive(null); }}><option value="revenue">Doanh thu (VND)</option><option value="bookings">Số booking</option></select></div>
    <div className="mb-3 flex flex-wrap gap-5 text-xs">{series.map((s) => <span key={s.label} className="flex items-center gap-2 text-slate-500"><span className="h-2 w-5 rounded-full" style={{ background: s.color }} />{s.label}</span>)}</div>
    {rows.length ? <>
      <div className="overflow-x-auto"><svg viewBox="0 0 760 264" role="img" aria-label={view === 'revenue' ? 'Biểu đồ so sánh tổng tiền, doanh thu đại lý và hoa hồng' : 'Biểu đồ số booking theo tháng'} className="min-w-[500px] w-full">
        {[0, 1, 2, 3, 4].map((tick) => { const value = max * tick / 4; return <g key={tick}><line x1="70" x2="720" y1={y(value)} y2={y(value)} stroke="#e2e8f0" strokeDasharray="3 5" /><text x="60" y={y(value) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}</text></g>; })}
        {series.map((s) => <g key={s.label}><polyline points={s.values.map((value, i) => `${x(i)},${y(value)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{s.values.map((value, i) => <circle key={i} cx={x(i)} cy={y(value)} r={active === i ? 5 : 3.5} fill={s.color} stroke="white" strokeWidth="2" tabIndex={0} role="img" aria-label={`${rows[i].month}, ${s.label}: ${format(value)}`} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}><title>{rows[i].month} · {s.label}: {format(value)}</title></circle>)}</g>)}
        {rows.map((r, i) => <text key={r.month} x={x(i)} y="253" textAnchor="middle" fontSize="10" fill="#94a3b8">{r.month}</text>)}
      </svg></div>
      <div aria-live="polite" className="min-h-8 text-xs text-slate-500">{selected && active !== null ? `${selected.month} · ${series.map((s) => `${s.label}: ${format(s.values[active])}`).join(' · ')}` : 'Di chuột hoặc dùng Tab vào điểm biểu đồ để xem số liệu.'}</div>
      <details className="mt-3 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-teal-700">Xem bảng số liệu chi tiết</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs tabular-nums"><caption className="sr-only">Dữ liệu nguồn cho biểu đồ doanh thu</caption><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Tháng</th><th className="p-3">Booking</th><th className="p-3">Tổng tiền</th><th className="p-3">Hoa hồng</th></tr></thead><tbody>{rows.map((r) => <tr key={r.month} className="border-t border-slate-100"><td className="p-3">{r.month}</td><td className="p-3">{r.bookings}</td><td className="p-3">{money(r.gross)}</td><td className="p-3">{money(r.commission)}</td></tr>)}</tbody></table></div></details>
    </> : <p className="py-16 text-center text-sm text-slate-400">Chưa có dữ liệu theo tháng trong kỳ này.</p>}
  </section>;
}
