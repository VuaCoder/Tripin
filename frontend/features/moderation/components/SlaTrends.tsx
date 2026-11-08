'use client';
import { useState } from 'react';
import { baseApi } from '@/store/api/baseApi';
type Row = { day: string; onTime: number; nearOverdue: number; breached: number; unknown: number };
const api = baseApi.injectEndpoints({ endpoints: (build) => ({ slaTrend: build.query<{ generatedAt: string; rows: Row[] }, number>({ query: (days) => ({ url: '/moderation/sla', params: { days } }), transformResponse: (r: { data: { generatedAt: string; rows: Row[] } }) => r.data }) }) });
export function SlaTrends() {
  const [days, setDays] = useState(7);
  const query = api.useSlaTrendQuery(days, { pollingInterval: 3_600_000, refetchOnFocus: true });
  const max = Math.max(1, ...(query.data?.rows.map((r) => r.onTime + r.nearOverdue + r.breached + r.unknown) ?? []));
  return <section className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Xu hướng SLA kiểm duyệt</h2><select aria-label="Khoảng thời gian SLA" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 ngày</option><option value={30}>30 ngày</option></select></div>
    <p className="text-xs text-slate-500">Nhóm theo ngày tạo phiếu, giờ Việt Nam. Gần hạn: còn tối đa 20% thời hạn xử lý. Phiếu cũ thiếu deadline được hiển thị riêng.</p>
    {query.isLoading ? <p>Đang tải…</p> : query.isError ? <p role="alert">Không tải được SLA. <button className="underline" onClick={() => void query.refetch()}>Thử lại</button></p> : <div className="overflow-x-auto"><div className="flex h-44 min-w-[420px] items-end gap-2" role="img" aria-label="Biểu đồ khối lượng theo SLA">{query.data?.rows.map((r) => <div key={r.day} className="flex h-full min-w-3 flex-1 flex-col justify-end" title={`${r.day}: đúng hạn ${r.onTime}, gần hạn ${r.nearOverdue}, quá hạn ${r.breached}, chưa rõ ${r.unknown}`}>
      <div className="bg-slate-300" style={{ height: `${r.unknown / max * 100}%` }} /><div className="bg-red-500" style={{ height: `${r.breached / max * 100}%` }} /><div className="bg-amber-400" style={{ height: `${r.nearOverdue / max * 100}%` }} /><div className="bg-teal-500" style={{ height: `${r.onTime / max * 100}%` }} /><span className="mt-2 text-[9px]">{r.day.slice(5)}</span></div>)}</div></div>}
    <p className="text-xs">🟩 Đúng hạn · 🟨 Gần hạn · 🟥 Quá hạn · ⬜ Thiếu dữ liệu lịch sử</p>
    <details><summary className="text-sm">Xem bảng số liệu</summary><table className="w-full text-sm"><thead><tr><th>Ngày</th><th>Đúng hạn</th><th>Gần hạn</th><th>Quá hạn</th><th>Chưa rõ</th></tr></thead><tbody>{query.data?.rows.map((r) => <tr key={r.day}><td>{r.day}</td><td>{r.onTime}</td><td>{r.nearOverdue}</td><td>{r.breached}</td><td>{r.unknown}</td></tr>)}</tbody></table></details>
  </section>;
}
