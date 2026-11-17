'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AgencyCompletionReportModal } from '@/features/agency/AgencyCompletionReportModal';
import { CompletionTourCard } from '@/features/agency/CompletionTourCard';
import { usePendingCompletionsQuery } from '@/features/agency/completionApi';
import { AgencyDenied, AgencyError, AgencyLoading, agencyButton, useAgencyPermission } from '@/features/agency/AgencyCommon';
import { useAppSelector } from '@/store/hooks';
import { selectActiveAgency } from '@/features/auth/store/authSlice';

function CompletionList() {
  const params = useSearchParams();
  const router = useRouter();
  const tourId = params?.get('tourId');
  const departureId = params?.get('departureId');
  const [selected, setSelected] = useState<{ tourId: string; departureId: string } | null>(null);
  useEffect(() => { if (tourId && departureId) setSelected({ tourId, departureId }); }, [tourId, departureId]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const history = status === 'completed';
  const permission = useAgencyPermission('tour:update-own');
  const member = useAppSelector(selectActiveAgency);
  const allowed = permission && ['OWNER', 'MANAGER'].includes(member?.memberRole ?? '');
  const query = usePendingCompletionsQuery({ page, status }, { skip: !allowed, refetchOnMountOrArgChange: true, refetchOnFocus: true });
  if (!allowed) return <AgencyDenied />;
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900">Hoàn tất chuyến đi</h1><p className="mt-2 text-sm text-slate-600">{history ? 'Xem lại các chuyến đi đã hoàn tất và lịch sử báo cáo đã gửi.' : 'Các đợt đã kết thúc và còn booking cần Agency gửi báo cáo.'}</p></div><button className={agencyButton} onClick={() => void query.refetch()} disabled={query.isFetching}>Làm mới</button></div>
    <div role="tablist" aria-label="Trạng thái hoàn tất chuyến đi" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {([{ value: 'pending', label: 'Chờ hoàn tất' }, { value: 'completed', label: 'Lịch sử hoàn tất' }] as const).map(tab => <button key={tab.value} type="button" role="tab" id={`completion-tab-${tab.value}`} aria-selected={status === tab.value} aria-controls="completion-results"
        className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${status === tab.value
          ? 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        onClick={() => { setStatus(tab.value); setPage(1); }}>{tab.label}</button>)}
    </div>
    <section id="completion-results" role="tabpanel" aria-labelledby={`completion-tab-${status}`} aria-busy={query.isFetching}>
    {query.isLoading || (query.isFetching && !query.currentData) ? <AgencyLoading /> : query.error ? <AgencyError message="Không thể tải danh sách chuyến đi." retry={() => void query.refetch()} /> : query.currentData && <>
      {!query.currentData.items.length ? <p className="rounded-xl bg-white p-6 text-slate-600">{history ? 'Chưa có chuyến đi đã hoàn tất.' : 'Không có chuyến đi đang chờ hoàn tất.'}</p> : <ul className="space-y-4">
        {query.currentData.items.map(row => <li key={row.departureId}>
          <CompletionTourCard trip={row} history={history} onOpen={() => setSelected({ tourId: row.tourId, departureId: row.departureId })} />
        </li>)}
      </ul>}
      {(page > 1 || query.currentData.hasNext) && <nav aria-label="Trang chuyến đi" className="mt-5 flex items-center justify-end gap-3"><button className={agencyButton} disabled={page <= 1 || query.isFetching} onClick={() => setPage(p => p - 1)}>Trang trước</button><span className="text-sm">Trang {page}</span><button className={agencyButton} disabled={!query.currentData.hasNext || query.isFetching} onClick={() => setPage(p => p + 1)}>Trang sau</button></nav>}
    </>}
    </section>
    <AgencyCompletionReportModal scope={selected} onClose={() => { setSelected(null); if (tourId || departureId) router.replace('/agency/completions', { scroll: false }); }} />
  </main>;
}
export default function PendingCompletionsPage() {
  return <Suspense fallback={<AgencyLoading />}><CompletionList /></Suspense>;
}
