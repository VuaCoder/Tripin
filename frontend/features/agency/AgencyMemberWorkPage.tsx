'use client';
import { useState } from 'react';
import { useAgencyContext } from './agencyContext';
import { useTeamWorkToursQuery, useTeamWorkBookingsQuery, useSaveScopedTourContentMutation, type WorkTour } from './teamApi';
import { agencyButton, agencyInput } from './AgencyCommon';

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
  return <main className="mx-auto max-w-6xl space-y-6 p-4 text-slate-900 sm:p-6">
    <header><h1 className="text-3xl font-bold">{kind === 'tours' ? 'Nội dung tour được giao' : 'Theo dõi booking'}</h1><p className="mt-2 max-w-3xl text-slate-600">{kind === 'tours' ? 'Chỉ cập nhật những tour và trường thông tin được giao. Giá, thanh toán và lịch chỗ không thay đổi tại đây.' : 'Thông tin liên hệ tối thiểu phục vụ vận hành. Màn hình này không cấp quyền xem tài chính hoặc xuất danh sách khách hàng.'}</p></header>
    {error && <p role="alert" className="text-red-800">{error}</p>}{notice && <p role="status" className="text-teal-800">{notice}</p>}
    {active.isLoading ? <p role="status">Đang tải dữ liệu…</p> : active.isError ? <div role="alert"><p>Không tải được dữ liệu. Kiểm tra quyền truy cập và thử lại.</p><button className={agencyButton} onClick={() => void active.refetch()}>Thử lại</button></div>
      : kind === 'tours' ? <>
        {!tours.data?.length ? <p>Chưa có tour để hiển thị.</p> : <ul className="divide-y divide-slate-200 rounded-xl bg-white px-5">{tours.data.map(tour => <li key={tour.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><h2 className="break-words font-semibold">{tour.title}</h2><p className="text-sm text-slate-600">{tour.status} · {fieldsFor(tour).length ? 'Có trường được phép sửa' : 'Chỉ xem'}</p></div>
          {agency?.permissions.includes('agency:tour-content-update') && fieldsFor(tour).length > 0 && !['ARCHIVED','PENDING_REVIEW'].includes(tour.status) && <button className={agencyButton} onClick={() => { setEditing(tour); setError(''); setNotice(''); setDraft(Object.fromEntries(fieldsFor(tour).map(f => [f, tour[f as 'title' | 'summary' | 'description'] ?? '']))); }}>Chỉnh nội dung<span className="sr-only"> {tour.title}</span></button>}</li>)}</ul>}
        {editing && <form className="space-y-4 rounded-xl bg-white p-5" onSubmit={async event => { event.preventDefault(); setError(''); try { await save({ id: editing.id, patch: draft }).unwrap(); setEditing(null); setNotice('Đã lưu nội dung tour.'); await tours.refetch(); } catch { setError('Không thể lưu. Tour có thể đã đổi trạng thái hoặc phạm vi của bạn đã thay đổi. Tải lại dữ liệu và thử lại.'); } }}>
          <h2 className="text-xl font-semibold">Chỉnh nội dung: {editing.title}</h2>{Object.keys(draft).map(field => <label key={field} className="block space-y-1"><span>{field === 'title' ? 'Tiêu đề' : field === 'summary' ? 'Tóm tắt' : 'Mô tả'}</span>
            <textarea className={agencyInput} rows={field === 'description' ? 7 : 2} required={field === 'title'} minLength={field === 'title' ? 5 : undefined} maxLength={field === 'title' ? 200 : field === 'summary' ? 500 : 20000} value={draft[field]} onChange={e => setDraft({ ...draft, [field]: e.target.value })} /></label>)}
          <div className="flex gap-3"><button disabled={request.isLoading} className={agencyButton}>Lưu nội dung</button><button type="button" disabled={request.isLoading} className={agencyButton} onClick={() => setEditing(null)}>Hủy</button></div>
        </form>}
      </> : <>
        {!bookings.data?.length ? <p>Không có booking ở trang này.</p> : <ul className="divide-y divide-slate-200 rounded-xl bg-white px-5">{bookings.data.map(booking => <li key={booking.id} className="space-y-1 py-4"><h2 className="break-words font-semibold">{booking.bookingCode} · {booking.tourTitle}</h2><p>{booking.status} · {booking.participants} khách · {new Date(booking.departureDate).toLocaleDateString('vi-VN')}</p><p className="break-words text-sm text-slate-600">Liên hệ: {booking.contactName} · {booking.contactPhone}</p></li>)}</ul>}
        <nav className="flex items-center gap-3" aria-label="Phân trang booking"><button className={agencyButton} disabled={page <= 1 || bookings.isFetching} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className={agencyButton} disabled={(bookings.data?.length ?? 0) < 50 || bookings.isFetching} onClick={() => setPage(page + 1)}>Trang sau</button></nav>
      </>}
  </main>;
}
