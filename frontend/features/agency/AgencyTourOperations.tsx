'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { toursApi, useAssignAgencyTourGuideMutation, useGetAgencyGuidesQuery, getTourApiMessage } from '@/features/tours/api/toursApi';
import { useDownloadAgencyCustomersMutation } from '@/features/booking/api/bookingApi';
import type { TourDetail } from '@/features/tours/types';
import { AgencyError, AgencyLoading, agencyButton, agencyInput, agencyPanel, dateTime, money, useAgencyPermission } from './AgencyUi';
import { formatCurrencyVndInput, parseCurrencyVndInput } from '@/lib/travel-format';
import { PremiumAvatar } from '@/features/premium/PremiumIdentity';

const assignmentNames: Record<string, string> = { PENDING: 'Chờ hướng dẫn viên xác nhận', ACCEPTED: 'Hướng dẫn viên đã nhận tour', DECLINED: 'Hướng dẫn viên đã từ chối' };

export function AgencyGuidePanel({ tour }: { tour: TourDetail }) {
  const allowed = useAgencyPermission('tour:assign-guide');
  const dispatch = useAppDispatch();
  const [search, setSearch] = useState('');
  const [q, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [guideId, setGuideId] = useState(tour.guideAssignment?.guideId ?? '');
  const [fee, setFee] = useState(tour.guideAssignment?.feePerBooking ? String(tour.guideAssignment.feePerBooking) : '');
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const guides = useGetAgencyGuidesQuery({ q: q || undefined, page }, { skip: !allowed });
  const [assign, state] = useAssignAgencyTourGuideMutation();
  useEffect(() => {
    if (!dirty) { 
      setGuideId(tour.guideAssignment?.guideId ?? ''); 
      setFee(tour.guideAssignment?.feePerBooking ? String(tour.guideAssignment.feePerBooking) : ''); 
    }
  }, [tour.guideAssignment, dirty]);
  if (!allowed) return null;
  const save = async (remove = false) => {
    setFeedback(null);
    const amount = Number(fee || 0);
    if (!remove && (!guideId || fee.trim() === '' || !Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000_000)) { 
      setFeedback({ error: true, message: 'Hãy chọn hướng dẫn viên và nhập phí nguyên VND từ 0 đến 100.000.000.000.' }); 
      return; 
    }
    if (!window.confirm(remove ? 'Gỡ phân công hướng dẫn viên khỏi toàn bộ tour?' : 'Gửi phân công cho toàn bộ tour? hướng dẫn viên sẽ cần xác nhận lời mời mới, kể cả khi chỉ đổi phí.')) return;
    try {
      const saved = await assign({ id: tour.id, guideId: remove ? null : guideId, ...(!remove ? { feePerBooking: amount } : {}) }).unwrap();
      await dispatch(toursApi.util.upsertQueryData('getAgencyTour', tour.id, saved));
      setDirty(false);
      setFeedback({ error: false, message: remove ? 'Đã gỡ phân công.' : 'Đã gửi phân công. Đang chờ hướng dẫn viên xác nhận.' });
    } catch (error) { setFeedback({ error: true, message: getTourApiMessage(error, 'Không thể phân công. Hãy làm mới thông tin tour và thử lại; lựa chọn của bạn được giữ nguyên.') }); }
  };
  const unchanged = guideId === tour.guideAssignment?.guideId && Number(fee || 0) === (tour.guideAssignment?.feePerBooking ?? 0);
  return <section className={agencyPanel}><h2 className="text-lg font-semibold text-slate-900">Hướng dẫn viên</h2><p className="mt-1 text-sm text-slate-600">Một hướng dẫn viên cho toàn bộ tour. Phí tính trên mỗi đơn đặt chỗ, không theo số khách.</p>
    <div className="my-5 rounded-lg bg-slate-50 p-4 text-sm">{tour.guideAssignment ? <div className="space-y-2"><p className="font-semibold">{tour.guide?.fullName || 'hướng dẫn viên đã phân công'}</p><p>{assignmentNames[tour.guideAssignment.status] ?? tour.guideAssignment.status} · {money(tour.guideAssignment.feePerBooking)}/đơn đặt chỗ</p>{tour.guideAssignment.respondedAt && <p>Phản hồi: {dateTime(tour.guideAssignment.respondedAt)}</p>}{tour.guideAssignment.note && <p className="whitespace-pre-wrap break-words">Ghi chú: {tour.guideAssignment.note}</p>}</div> : <p>Chưa có hướng dẫn viên được phân công.</p>}</div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(1); }}><label className="min-w-48 flex-1 space-y-2 text-sm font-medium">Tìm hướng dẫn viên theo tên<input className={agencyInput} maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} /></label><button type="submit" className={agencyButton}>Tìm kiếm</button></form>
    {guides.isLoading ? <AgencyLoading label="Đang tìm hướng dẫn viên…" /> : guides.error ? <div className="mt-4"><AgencyError message={getTourApiMessage(guides.error, 'Không tải được danh sách hướng dẫn viên.')} retry={() => void guides.refetch()} /></div> : <div className="mt-4 space-y-3"><label className="block space-y-2 text-sm font-medium">Chọn hướng dẫn viên<select value={guideId} disabled={guides.isFetching || state.isLoading} className={agencyInput} onChange={(event) => { setGuideId(event.target.value); setDirty(true); }}><option value="">Chọn hướng dẫn viên</option>{guideId && !guides.data?.items.some((guide) => guide.id === guideId) && <option value={guideId}>{guideId === tour.guideAssignment?.guideId ? tour.guide?.fullName || 'hướng dẫn viên hiện tại' : 'hướng dẫn viên đang chọn'}</option>}{guides.data?.items.map((guide) => <option key={guide.id} value={guide.id}>{guide.fullName}{guide.languages.length ? ` · ${guide.languages.join(', ')}` : ''}</option>)}</select></label>{guides.data?.items.length === 0 && <p className="text-sm text-slate-600">Không có hướng dẫn viên đang hoạt động phù hợp. Hãy thử tên khác.</p>}{guides.data && guides.data.meta.totalPages > 1 && <div className="flex items-center justify-between gap-3"><button className={agencyButton} type="button" disabled={page <= 1 || guides.isFetching} onClick={() => setPage((value) => value - 1)}>Trước</button><span className="text-sm">{page}/{guides.data.meta.totalPages}</span><button className={agencyButton} type="button" disabled={page >= guides.data.meta.totalPages || guides.isFetching} onClick={() => setPage((value) => value + 1)}>Sau</button></div>}</div>}
    {!guides.isError && <div className="mt-4 divide-y divide-slate-200">{guides.currentData?.items.map(guide => <div key={guide.id} className="flex items-center gap-4 py-4"><PremiumAvatar url={guide.avatarUrl} name={guide.fullName} active={guide.premiumActive} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{guide.fullName} {guide.premiumActive && <span className="ml-2 text-xs text-amber-800">Premium</span>}</p><a href={`/tour-guides/${guide.id}`} className="text-xs text-teal-800 underline">Xem hồ sơ</a></div><button type="button" disabled={state.isLoading} aria-pressed={guideId === guide.id} className={agencyButton} onClick={() => {setGuideId(guide.id);setDirty(true);}}>{guideId === guide.id ? 'Đã chọn' : 'Chọn'}</button></div>)}</div>}
    <div className="mt-4 space-y-2">
      <label htmlFor="agency-guide-fee-input" className="block text-sm font-medium text-slate-700">
        Phí mỗi đơn đặt chỗ (VND)
      </label>
      <div className="relative">
        <input
          id="agency-guide-fee-input"
          type="text"
          inputMode="numeric"
          placeholder="Ví dụ: 300.000"
          className={agencyInput}
          value={formatCurrencyVndInput(fee)}
          disabled={state.isLoading}
          onKeyDown={(event) => {
            if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
          }}
          onChange={(event) => {
            const parsed = parseCurrencyVndInput(event.target.value);
            setFee(parsed > 0 ? String(parsed) : event.target.value.trim() === '0' ? '0' : '');
            setDirty(true);
          }}
        />
        {fee && Number(fee) > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-teal-700 pointer-events-none">
            ₫
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-xs text-slate-500 font-medium">Gợi ý nhanh:</span>
        {[100_000, 200_000, 300_000, 500_000, 1_000_000].map((val) => (
          <button
            key={val}
            type="button"
            disabled={state.isLoading}
            onClick={() => {
              setFee(String(val));
              setDirty(true);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            {new Intl.NumberFormat('vi-VN').format(val)} ₫
          </button>
        ))}
      </div>
    </div>
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`mt-4 text-sm ${feedback.error ? 'text-red-700' : 'text-teal-800'}`}>{feedback.message}</p>}
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={agencyButton} disabled={state.isLoading || !guideId || unchanged} onClick={() => void save()}>{state.isLoading ? 'Đang lưu…' : 'Gửi phân công'}</button>{tour.guideAssignment && <button type="button" className={agencyButton} disabled={state.isLoading} onClick={() => void save(true)}>Gỡ phân công</button>}</div>
  </section>;
}

export function AgencyCustomersPanel({ tour }: { tour: TourDetail }) {
  const allowed = useAgencyPermission('agency:export-customers');
  const [departureId, setDepartureId] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [download, state] = useDownloadAgencyCustomersMutation();
  if (!allowed) return null;
  const exportPdf = async () => {
    setError(''); setDone(false);
    try { await download({ tourId: tour.id, departureId: departureId || undefined }).unwrap(); setDone(true); }
    catch (error) { setError(getTourApiMessage(error, 'Không tải được PDF. Hãy kiểm tra quyền truy cập và thử lại.')); }
  };
  const invalidDeparture = !!departureId && !tour.departures.some((departure) => departure.id === departureId);
  return <section className={agencyPanel}><h2 className="text-lg font-semibold text-slate-900">Danh sách khách PDF</h2><p className="mt-1 text-sm text-slate-600">Chỉ gồm đơn đặt chỗ đã xác nhận hoặc hoàn thành. Tối đa 5.000 đơn đặt chỗ; danh sách rỗng vẫn có thể xuất.</p><label className="mt-5 block space-y-2 text-sm font-medium">Phạm vi xuất<select className={agencyInput} value={departureId} disabled={state.isLoading} onChange={(event) => { setDepartureId(event.target.value); setDone(false); setError(''); }}><option value="">Toàn bộ tour</option>{invalidDeparture && <option value={departureId}>Ngày khởi hành đã bị gỡ — hãy chọn lại</option>}{tour.departures.map((departure) => <option key={departure.id} value={departure.id}>{dateTime(departure.date)}</option>)}</select></label>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}{done && <p role="status" className="mt-4 text-sm text-teal-800">Đã chuẩn bị tệp PDF để tải xuống.</p>}<button type="button" className={`${agencyButton} mt-5`} disabled={state.isLoading || invalidDeparture} onClick={() => void exportPdf()}>{state.isLoading ? 'Đang xuất PDF…' : 'Tải danh sách khách PDF'}</button></section>;
}
