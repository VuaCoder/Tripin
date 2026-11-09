'use client';
import { FormSelect } from '@/components/ui/FormSelect';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { useGetMyETicketsQuery } from '../api/eTicketApi';
import type { ETicketStatus, PaginatedETickets } from '../types';
import { QRCodeDisplay } from './QRCodeDisplay';

export function ETicketList() {
  const user = useAppSelector(selectUser);
  return <TicketListContent key={user?.id ?? 'guest'} userId={user?.role === 'TRAVELER' ? user.id : undefined} />;
}
function TicketListContent({ userId }: { userId?: string }) {
  const [status, setStatus] = useState<ETicketStatus | ''>('');
  const [page, setPage] = useState(1);
  const [cached, setCached] = useState<PaginatedETickets>();
  const query = useGetMyETicketsQuery({ page, limit: 10, ...(status ? { status } : {}) }, { skip: !userId, refetchOnMountOrArgChange: true });
  const key = `tripri:tickets:v1:${userId}:${status}:${page}`;
  useEffect(() => {
    setCached(undefined);
    if (!userId) return;
    try { const value = JSON.parse(localStorage.getItem(key) ?? 'null') as PaginatedETickets | null; if (value && Array.isArray(value.items) && value.meta) setCached(value); } catch { /* No offline cache. */ }
  }, [key, userId]);
  useEffect(() => { if (userId && query.currentData) { try { localStorage.setItem(key, JSON.stringify(query.currentData)); } catch { /* Storage quota must not block online tickets. */ } } }, [key, userId, query.currentData]);
  const errorStatus = query.error && 'status' in query.error ? query.error.status : undefined;
  const canUseCache = query.isError && (errorStatus === 'FETCH_ERROR' || errorStatus === 'TIMEOUT_ERROR');
  const result = query.currentData ?? (canUseCache ? cached : undefined);
  return <div className="flex min-h-[max(400px,calc(100svh-16rem))] flex-col gap-5">
    <h1 className="text-2xl font-bold">Vé điện tử của tôi</h1>
    {!userId ? <Link href="/login">Đăng nhập để xem vé</Link> : <>
      <label>Trạng thái vé<FormSelect className="ml-3 rounded border p-2" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as ETicketStatus | ''); }}><option value="">Tất cả</option><option value="VALID">Vé hợp lệ</option><option value="USED">Đã hoàn tất</option><option value="CANCELLED">Đã hủy</option></FormSelect></label>
      <div className="flex flex-1 flex-col gap-5">
      {query.isError && <p role="status">{canUseCache && cached ? 'Đang xem vé đã lưu trên thiết bị. Trạng thái sẽ được kiểm tra khi quét vé.' : 'Không tải được vé. Vui lòng kiểm tra kết nối hoặc đăng nhập lại.'}</p>}
      {query.isFetching && !result && <p>Đang tải vé...</p>}
      {result?.items.length === 0 && <p className="flex flex-1 items-center justify-center text-center text-slate-400">Chưa có vé phù hợp.</p>}
      {result?.items.map((ticket) => <article key={ticket.id} className="rounded-2xl border p-4">
        <h2 className="font-semibold">{ticket.tour.title}</h2>
        <p>{new Date(ticket.departureDate).toLocaleString('vi-VN')} · {ticket.participants} khách</p>
        {ticket.tour.meetingPoint && <p>Điểm đón: {ticket.tour.meetingPoint}</p>}
        <p>{ticket.status === 'VALID' ? 'Vé hợp lệ' : ticket.status === 'USED' ? 'Đã hoàn tất' : 'Đã hủy'} · {ticket.code}</p>
        {ticket.status === 'VALID' && <QRCodeDisplay value={ticket.code} />}
        <Link className="underline" href={`/traveler/tickets/${ticket.id}`}>Xem chi tiết vé</Link>
      </article>)}
      </div>
      {result && <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-slate-400"><button className="transition-colors hover:text-slate-800 focus-visible:text-slate-800" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Trang trước</button><span className="transition-colors hover:text-slate-800">Trang {page}/{Math.max(1, result.meta.totalPages)}</span><button className="transition-colors hover:text-slate-800 focus-visible:text-slate-800" disabled={page >= result.meta.totalPages || query.isFetching} onClick={() => setPage(page + 1)}>Trang sau</button></div>}
    </>}
  </div>;
}
