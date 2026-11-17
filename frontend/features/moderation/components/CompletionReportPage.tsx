'use client';
import Link from 'next/link';
import { CompletionReportSupplement } from '@/features/agency/CompletionReportSupplement';
import { useCompletionReportQuery } from '../api/completionReaderApi';
import { ModerationDenied, useModerationPermission } from './ModerationUi';
import { reportButton, reportDate } from './CompletionReportsPage';

function ReportDetail({ id, byBooking }: { id: string; byBooking?: boolean }) {
  const query = useCompletionReportQuery({ id, byBooking }, { refetchOnMountOrArgChange: true });
  const data = query.currentData;
  return <main className="space-y-6 text-slate-900">
    <Link href={data?.agencyId ? `/moderator/tour-completions/agencies/${data.agencyId}` : '/moderator/tour-completions'} className={reportButton}>{data?.agencyId ? 'Báo cáo của agency' : 'Tổng kết tour'}</Link>
    {query.isFetching && <p role="status">Đang tải báo cáo…</p>}
    {query.error ? <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-5 text-sm text-red-800"><p>{'status' in query.error && query.error.status === 404 ? 'Chuyến đi này chưa có báo cáo đã gửi.' : 'Không thể tải báo cáo.'}</p><button className={reportButton} onClick={() => void query.refetch()}>Tải lại</button></div> : data && <>
      <header className="space-y-3"><h1 className="text-2xl font-bold">{data.title}</h1><p className="text-slate-700">{data.agencyName} · {data.durationDays} ngày</p>
        <dl className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-3">
          {[['Khởi hành', data.departureAt], ['Kết thúc dự kiến', data.scheduledEndAt], ['Agency hoàn tất', data.completedAt]].map(([title, date]) => <div key={title}><dt className="text-slate-600">{title}</dt><dd className="mt-1 font-semibold">{reportDate(date)}</dd></div>)}
        </dl>
      </header>
      <section aria-labelledby="report-history-title" className="space-y-4"><h2 id="report-history-title" className="text-lg font-bold">Báo cáo và lịch sử đã gửi</h2>
        {data.reports.map((r, index) => <article key={r.id} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <header className="space-y-2"><h3 className="font-bold">Phiên bản {r.revision}{index === 0 ? ' · Mới nhất' : ''}</h3><p className="text-sm text-slate-600">{r.authorName} · {reportDate(r.createdAt)}</p></header>
          <p className="text-sm">Kết thúc thực tế: <strong>{r.actualEndAt ? reportDate(r.actualEndAt) : 'Không ghi nhận'}</strong></p>
          <p className="text-sm">{r.bookingCount} booking · {r.attendedCount} khách tham gia / {data.bookedParticipants} khách đã đặt</p>
          {r.actualGuests && <p className="text-sm text-slate-700">{r.actualGuests.adults} người lớn · {r.actualGuests.children} trẻ em · {r.actualGuests.infants} em bé</p>}
          {[['Tổng kết', r.summary], ['Thay đổi so với kế hoạch', r.changes], ['Sự cố và cách xử lý', r.incidents], ['Lý do bổ sung', r.amendmentReason]].map(([title, value]) => value && <div key={title}><h4 className="text-sm font-semibold">{title}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{value}</p></div>)}
          <CompletionReportSupplement report={r} />
          {!!r.evidence.length && <div><h4 className="text-sm font-semibold">Minh chứng</h4><ul className="mt-2 flex flex-wrap gap-4">{r.evidence.map((href, i) => <li key={i}><a href={href} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-teal-800 underline">Xem minh chứng {i + 1}</a></li>)}</ul></div>}
        </article>)}
      </section>
      {Array.isArray(data.itinerary) && data.itinerary.length > 0 && <details className="rounded-xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold">Lịch trình được lưu cùng chuyến đi</summary><ol className="mt-4 space-y-4">{data.itinerary.map((day, i) => <li key={i}><h3 className="text-sm font-semibold">Ngày {day.day}: {day.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{day.description}</p></li>)}</ol></details>}
    </>}
  </main>;
}
export function CompletionReportPage(props: { id: string; byBooking?: boolean }) {
  return useModerationPermission('tour-completion:view') ? <ReportDetail {...props} /> : <ModerationDenied />;
}
