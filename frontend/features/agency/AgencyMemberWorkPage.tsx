'use client';
import { useState } from 'react';
import { CalendarCheck, Compass, ImageOff, Pencil } from 'lucide-react';
import { useAgencyContext } from './agencyContext';
import { AgencyPageTitle } from './components/AgencyPageTitle';
import { useTeamWorkToursQuery, useTeamWorkBookingsQuery, useSaveScopedTourContentMutation, type WorkTour } from './teamApi';
import { agencyButton, agencyInput, agencyPanel, bookingStatusNames, dateTime } from './AgencyCommon';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';

const statusTone: Record<string, string> = { CONFIRMED: 'bg-sky-50 text-sky-700 border border-sky-200/80', COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80', CANCELLED: 'bg-rose-50 text-rose-700 border border-rose-200/80', PENDING: 'bg-amber-50 text-amber-700 border border-amber-200/80' };
const fieldNames: Record<string, string> = { title: 'Tiêu đề', summary: 'Tóm tắt', description: 'Mô tả' };
const tourStatusTone: Record<string, string> = { APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200', PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200', REJECTED: 'bg-rose-50 text-rose-700 border-rose-200', DRAFT: 'bg-slate-100 text-slate-700 border-slate-200', SUSPENDED: 'bg-slate-100 text-slate-600 border-slate-200', ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200' };
const tourStatusLabel: Record<string, string> = { APPROVED: 'Đã duyệt', PENDING_REVIEW: 'Chờ duyệt', REJECTED: 'Cần chỉnh sửa', DRAFT: 'Bản nháp', SUSPENDED: 'Tạm ẩn', ARCHIVED: 'Đã lưu trữ' };
const TOURS_PER_PAGE = 10;

export function AgencyMemberWorkPage({ kind }: { kind: 'tours' | 'bookings' }) {
  const agency = useAgencyContext();
  const [page, setPage] = useState(1);
  const tours = useTeamWorkToursQuery(agency?.agencyId ?? '', { skip: kind !== 'tours' || !agency?.permissions.includes('agency:tour-view') });
  const bookings = useTeamWorkBookingsQuery({ agencyId: agency?.agencyId ?? '', page }, { skip: kind !== 'bookings' || !agency?.permissions.includes('agency:booking-monitor') });
  const [save, request] = useSaveScopedTourContentMutation();
  const [editing, setEditing] = useState<WorkTour | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = kind === 'tours' ? tours : bookings;
  const fieldsFor = (tour: WorkTour) => agency?.permissions.includes('tour:update-own') ? ['title','summary','description'] : tour.memberScopes[0]?.allowedFields ?? [];
  const canEdit = (tour: WorkTour) => !!agency?.permissions.includes('agency:tour-content-update') && fieldsFor(tour).length > 0 && !['ARCHIVED','PENDING_REVIEW'].includes(tour.status);
  const tourTotalPages = Math.max(1, Math.ceil((tours.data?.length ?? 0) / TOURS_PER_PAGE));
  const tourPageIndex = Math.min(page, tourTotalPages) - 1;
  const tourPage = (tours.data ?? []).slice(tourPageIndex * TOURS_PER_PAGE, (tourPageIndex + 1) * TOURS_PER_PAGE);
  return <main className="mx-auto max-w-6xl space-y-6 p-4 text-slate-900 sm:p-6">
    <header>{kind === 'tours' ? <AgencyPageTitle icon={Compass}>Nội dung tour được giao</AgencyPageTitle> : <AgencyPageTitle icon={CalendarCheck}>Theo dõi booking</AgencyPageTitle>}</header>
    {notice && <p role="status" className="text-teal-800">{notice}</p>}
    {active.isLoading ? <p role="status">Đang tải dữ liệu…</p> : active.isError ? <div role="alert"><p>Không tải được dữ liệu. Kiểm tra quyền truy cập và thử lại.</p><button className={agencyButton} onClick={() => void active.refetch()}>Thử lại</button></div>
      : kind === 'tours' ? <>
        <section className={agencyPanel}>{!tours.data?.length ? <p className="text-sm text-slate-600">Chưa có tour để hiển thị.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b text-xs font-bold uppercase tracking-wider text-slate-500"><th scope="col" className="px-3 py-3 font-semibold">Ảnh</th><th scope="col" className="px-3 py-3 font-semibold">Tour</th><th scope="col" className="px-3 py-3 font-semibold">Trạng thái</th><th scope="col" className="px-3 py-3 font-semibold">Trường được phép sửa</th><th scope="col" className="w-16 px-3 py-3"><span className="sr-only">Thao tác</span></th></tr></thead>
          <tbody className="divide-y divide-slate-100">{tourPage.map(tour => <tr key={tour.id} className="transition-colors hover:bg-slate-50/70">
            <td className="px-3 py-3"><div className="flex size-14 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">{tour.images?.[0] ? <img src={tour.images[0]} alt="" loading="lazy" className="size-full object-cover" /> : <ImageOff size={18} className="text-slate-400" aria-hidden="true" />}</div></td>
            <td className="px-3 py-4 font-medium break-words text-slate-800">{tour.title}</td>
            <td className="whitespace-nowrap px-3 py-4"><span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${tourStatusTone[tour.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>{tourStatusLabel[tour.status] ?? tour.status}</span></td>
            <td className="px-3 py-4 text-slate-600">{fieldsFor(tour).map(field => fieldNames[field] ?? field).join(', ') || 'Chỉ xem'}</td>
            <td className="px-3 py-4 text-right">{canEdit(tour) && <button type="button" title="Chỉnh nội dung" aria-label={`Chỉnh nội dung ${tour.title}`} className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => { setEditing(tour); setError(''); setNotice(''); setDraft(Object.fromEntries(fieldsFor(tour).map(f => [f, tour[f as 'title' | 'summary' | 'description'] ?? '']))); }}><Pencil size={16} aria-hidden="true" /></button>}</td>
          </tr>)}</tbody>
        </table></div>}</section>
        <Pagination currentPage={tourPageIndex + 1} totalPages={tourTotalPages} totalItems={tours.data?.length} pageSize={TOURS_PER_PAGE} itemLabel="tour" onPageChange={setPage} />
        {editing && <Modal open onClose={() => setEditing(null)} title="Chỉnh nội dung tour" className="max-w-xl"><form className="space-y-4" onSubmit={async event => { event.preventDefault(); setError(''); try { await save({ id: editing.id, patch: draft }).unwrap(); setEditing(null); setNotice('Đã lưu nội dung tour.'); await tours.refetch(); } catch { setError('Không thể lưu. Tour có thể đã đổi trạng thái hoặc phạm vi của bạn đã thay đổi. Tải lại dữ liệu và thử lại.'); } }}>
          <p className="break-words text-sm font-medium text-slate-600">{editing.title}</p>
          {Object.keys(draft).map(field => <label key={field} className="block space-y-1"><span>{field === 'title' ? 'Tiêu đề' : field === 'summary' ? 'Tóm tắt' : 'Mô tả'}</span>
            <textarea className={agencyInput} rows={field === 'description' ? 7 : 2} required={field === 'title'} minLength={field === 'title' ? 5 : undefined} maxLength={field === 'title' ? 200 : field === 'summary' ? 500 : 20000} value={draft[field]} onChange={e => setDraft({ ...draft, [field]: e.target.value })} /></label>)}
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          <div className="flex gap-3"><button disabled={request.isLoading} className={agencyButton}>Lưu nội dung</button><button type="button" disabled={request.isLoading} className={agencyButton} onClick={() => setEditing(null)}>Hủy</button></div>
        </form></Modal>}
      </> : <>
        <section className={agencyPanel}>{!bookings.data?.items.length ? <p className="text-sm text-slate-600">Không có booking ở trang này.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b text-xs font-bold uppercase tracking-wider text-slate-500">{['Chuyến đi', 'Trạng thái', 'Khách', 'Ngày khởi hành'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{bookings.data.items.map(booking => <tr key={booking.id} className="transition-colors hover:bg-slate-50/70">
            <td className="px-3 py-4"><span className="font-semibold text-slate-900">{booking.bookingCode}</span><p className="mt-0.5 break-words text-slate-600">{booking.tourTitle}</p></td>
            <td className="whitespace-nowrap px-3 py-4"><span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${statusTone[booking.status] ?? statusTone.PENDING}`}>{bookingStatusNames[booking.status as keyof typeof bookingStatusNames] ?? booking.status}</span></td>
            <td className="px-3 py-4"><p className="font-medium text-slate-800">{booking.contactName}</p><p className="break-words text-slate-600">{booking.contactPhone} · {booking.participants} khách</p></td>
            <td className="whitespace-nowrap px-3 py-4 text-slate-600">{dateTime(booking.departureDate)}</td>
          </tr>)}</tbody>
        </table></div>}</section>
        <Pagination currentPage={bookings.data?.meta.page ?? page} totalPages={bookings.data?.meta.totalPages ?? 1} totalItems={bookings.data?.meta.total} pageSize={bookings.data?.meta.limit ?? 50} itemLabel="booking" onPageChange={setPage} disabled={bookings.isFetching} />
      </>}
  </main>;
}
