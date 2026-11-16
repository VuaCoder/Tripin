'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useCompletionAgencyQuery, useCompletionAgenciesQuery, useCompletionReportsQuery, type CompletionAgency, type CompletionReaderQuery } from '../api/completionReaderApi';
import { ModerationDenied, useModerationPermission } from './ModerationUi';
import { CompletionAgencyIdentity } from './CompletionAgencyIdentity';
import { CompletionTourCard } from '@/features/agency/CompletionTourCard';

export const reportInput = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20';
export const reportButton = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50';
export const reportDate = (value: string) => new Date(value).toLocaleString('vi-VN');

function AgencyReports({ agency }: { agency: CompletionAgency }) {
  const [filters, setFilters] = useState({ q: '', from: '', to: '' });
  const [query, setQuery] = useState<CompletionReaderQuery>({ page: 1, agencyId: agency.id });
  const result = useCompletionReportsQuery(query, { refetchOnMountOrArgChange: true });
  return <section aria-label="Báo cáo đã gửi" className="space-y-5">
    <form aria-label={`Tìm báo cáo của ${agency.name}`} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e => { e.preventDefault(); setQuery({ page: 1, agencyId: agency.id, q: filters.q.trim() || undefined,
      from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined }); }}>
      <label className="space-y-2 text-sm font-medium">Tên tour<input className={reportInput} value={filters.q} maxLength={200} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} /></label>
      <label className="space-y-2 text-sm font-medium">Hoàn tất từ ngày<input type="date" className={reportInput} value={filters.from} max={filters.to || undefined} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} /></label>
      <label className="space-y-2 text-sm font-medium">Đến ngày<input type="date" className={reportInput} value={filters.to} min={filters.from || undefined} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} /></label>
      <button type="submit" className={reportButton} disabled={result.isFetching}>Tìm báo cáo</button>
    </form>
    {result.isFetching && <p role="status" className="text-sm text-slate-600">Đang tải báo cáo…</p>}
    {result.error ? <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-5 text-sm text-red-800"><p>Không thể tải báo cáo. Vui lòng thử lại.</p><button className={reportButton} onClick={() => void result.refetch()}>Tải lại</button></div>
      : result.currentData && <>
        <p className="text-sm text-slate-600">{result.currentData.total} báo cáo</p>
        {!result.currentData.items.length ? <p className="py-4 text-sm text-slate-600">Chưa có báo cáo đã gửi phù hợp với bộ lọc.</p> : <ul className="space-y-4">
          {result.currentData.items.map(row => <li key={row.id}>
            <CompletionTourCard trip={{ ...row, destination: row.destination ?? undefined, hasReport: true }} history href={`/moderator/tour-completions/${row.id}`} actionLabel="Xem báo cáo"
              footerNote={`Người gửi gần nhất: ${row.authorName}${row.hasAmendment ? ' · Có báo cáo bổ sung' : ''}`} />
          </li>)}
        </ul>}
        {result.currentData.totalPages > 1 && <nav aria-label="Phân trang báo cáo" className="flex items-center justify-end gap-3"><button className={reportButton} disabled={query.page <= 1 || result.isFetching} onClick={() => setQuery(q => ({ ...q, page: q.page - 1 }))}>Trang trước</button><span className="text-sm">Trang {query.page} / {result.currentData.totalPages}</span><button className={reportButton} disabled={query.page >= result.currentData.totalPages || result.isFetching} onClick={() => setQuery(q => ({ ...q, page: q.page + 1 }))}>Trang sau</button></nav>}
      </>}
  </section>;
}

function AgencyCard({ agency }: { agency: CompletionAgency }) {
  return <li><Link href={`/moderator/tour-completions/agencies/${agency.id}`} className="group flex h-full flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:p-6">
    <CompletionAgencyIdentity agency={agency} />
    <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4">
      <div className="space-y-1"><p className="text-sm font-semibold text-slate-900">{agency.reportCount} báo cáo chuyến đi</p>
        <p className="text-xs leading-5 text-slate-600">{agency.lastCompletedAt ? `Hoàn tất gần nhất ${reportDate(agency.lastCompletedAt)}` : 'Chưa có báo cáo đã gửi'}</p></div>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800">Xem báo cáo<ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
    </div>
  </Link></li>;
}

function AgencyList() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<{ page: number; q?: string }>({ page: 1 });
  const result = useCompletionAgenciesQuery(query, { refetchOnMountOrArgChange: true });
  return <main className="space-y-6 text-slate-900">
    <header><h1 className="text-2xl font-bold">Tổng kết tour</h1><p className="mt-2 text-sm text-slate-600">Chọn agency để xem báo cáo chuyến đi và lịch sử bổ sung.</p></header>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setQuery({ page: 1, q: search.trim() || undefined }); }}>
      <label className="w-full space-y-2 text-sm font-medium sm:max-w-sm">Tên agency<input className={reportInput} value={search} maxLength={200} onChange={e => setSearch(e.target.value)} /></label>
      <button type="submit" className={reportButton} disabled={result.isFetching}>Tìm agency</button>
    </form>
    {result.isFetching && <p role="status" className="text-sm text-slate-600">Đang tải danh sách agency…</p>}
    {result.error ? <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-5 text-sm text-red-800"><p>Không thể tải danh sách agency.</p><button className={reportButton} onClick={() => void result.refetch()}>Tải lại</button></div> : result.currentData && <>
      <p className="text-sm text-slate-600">{result.currentData.total} agency{query.q ? ' phù hợp' : ' trong hệ thống'}</p>
      {result.currentData.items.length ? <ul className="grid gap-4 lg:grid-cols-2">{result.currentData.items.map(agency => <AgencyCard key={agency.id} agency={agency} />)}</ul>
        : <p className="rounded-xl bg-white p-6 text-sm text-slate-600">{query.q ? 'Không tìm thấy agency phù hợp.' : 'Hệ thống chưa có agency.'}</p>}
      {result.currentData.totalPages > 1 && <nav aria-label="Phân trang agency" className="flex flex-wrap items-center justify-end gap-3">
        <button className={reportButton} disabled={query.page <= 1 || result.isFetching} onClick={() => setQuery(q => ({ ...q, page: q.page - 1 }))}>Trang trước</button>
        <span className="text-sm">Trang {query.page} / {result.currentData.totalPages}</span>
        <button className={reportButton} disabled={query.page >= result.currentData.totalPages || result.isFetching} onClick={() => setQuery(q => ({ ...q, page: q.page + 1 }))}>Trang sau</button>
      </nav>}
    </>}
  </main>;
}
export function CompletionReportsPage() {
  return useModerationPermission('tour-completion:view') ? <AgencyList /> : <ModerationDenied />;
}

function AgencyReportScreen({ agencyId }: { agencyId: string }) {
  const result = useCompletionAgencyQuery(agencyId, { refetchOnMountOrArgChange: true });
  return <main className="space-y-6 text-slate-900">
    <Link href="/moderator/tour-completions" className={reportButton}>Danh sách agency</Link>
    {result.error ? <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-5 text-sm text-red-800"><p>{'status' in result.error && result.error.status === 404 ? 'Không tìm thấy agency.' : 'Không thể tải thông tin agency.'}</p><button className={reportButton} onClick={() => void result.refetch()}>Tải lại</button></div>
      : result.currentData ? <>
        <header className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><CompletionAgencyIdentity agency={result.currentData} prominent />
          <p className="border-t border-slate-100 pt-4 text-sm text-slate-600">{result.currentData.reportCount} báo cáo chuyến đi{result.currentData.lastCompletedAt ? ` · Hoàn tất gần nhất ${reportDate(result.currentData.lastCompletedAt)}` : ''}</p></header>
        <AgencyReports key={agencyId} agency={result.currentData} />
      </> : <p role="status" className="text-sm text-slate-600">Đang tải thông tin agency…</p>}
  </main>;
}

export function CompletionAgencyReportsPage({ agencyId }: { agencyId: string }) {
  return useModerationPermission('tour-completion:view') ? <AgencyReportScreen key={agencyId} agencyId={agencyId} /> : <ModerationDenied />;
}
