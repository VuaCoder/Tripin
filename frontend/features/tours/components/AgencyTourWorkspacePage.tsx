'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { getTourApiMessage, useDeleteAgencyTourMutation, useGetAgencyTourQuery, useRestoreAgencyTourMutation, useSetAgencyTourAvailabilityMutation, useSetAgencyTourItineraryMutation, useSubmitAgencyTourMutation } from '../api/toursApi';
import type { TourDeparture, TourItineraryDay } from '../types';
import { toursApi } from '../api/toursApi';
import { useAppDispatch } from '@/store/hooks';
import { AgencyCustomersPanel, AgencyGuidePanel } from '@/features/agency/AgencyTourOperations';
import { AgencyDenied, useAgencyPermission } from '@/features/agency/AgencyUi';
import { ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';
import { AgencyTourStepper } from './AgencyTourStepper';
import { AgencyTourLivePreview } from './AgencyTourLivePreview';
import { AntDatePicker } from '@/components/ui';
import { formatCurrencyVndInput, parseCurrencyVndInput } from '@/lib/travel-format';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20';
const emptyDay = (day: number, toDay?: number): TourItineraryDay => ({ day, toDay, title: '', description: '', activities: [] });
type DepartureForm = { id?: string; date: string; capacity: number; price: number; isOpen: boolean; remaining?: number };
const statusText: Record<string, string> = { DRAFT: 'Bản nháp', PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Cần chỉnh sửa', SUSPENDED: 'Tạm ẩn', ARCHIVED: 'Đã lưu trữ' };

export function AgencyTourWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const canView = useAgencyPermission('tour:update-own');
  const dispatch = useAppDispatch();
  const { currentData: tour, isLoading, isFetching, error, refetch } = useGetAgencyTourQuery(id, { skip: !canView, pollingInterval: 30_000, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true });
  const [saveItinerary, itineraryState] = useSetAgencyTourItineraryMutation();
  const [saveAvailability, availabilityState] = useSetAgencyTourAvailabilityMutation();
  const [submitTour, submitState] = useSubmitAgencyTourMutation();
  const [deleteTour, deleteState] = useDeleteAgencyTourMutation();
  const [restoreTour, restoreState] = useRestoreAgencyTourMutation();
  const [days, setDaysState] = useState<TourItineraryDay[]>([]);
  const [departures, setDeparturesState] = useState<DepartureForm[]>([]);
  const itineraryDirty = useRef(false);
  const availabilityDirty = useRef(false);
  const itinerarySnapshot = useRef('');
  const availabilitySnapshot = useRef('');
  const setDays: Dispatch<SetStateAction<TourItineraryDay[]>> = (next) => { itineraryDirty.current = true; setDaysState(next); };
  const setDepartures: Dispatch<SetStateAction<DepartureForm[]>> = (next) => { availabilityDirty.current = true; setDeparturesState(next); };
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    itineraryDirty.current = false; availabilityDirty.current = false;
    itinerarySnapshot.current = ''; availabilitySnapshot.current = '';
  }, [id]);

  useEffect(() => {
    if (!tour) return;
    const itinerary = JSON.stringify(tour.itinerary);
    const availability = JSON.stringify(tour.departures);
    if (!itineraryDirty.current && itinerary !== itinerarySnapshot.current) {
      setDaysState(tour.itinerary.map((item) => ({ ...item, activities: [...(item.activities ?? [])] })));
      itinerarySnapshot.current = itinerary;
    }
    if (!availabilityDirty.current && availability !== availabilitySnapshot.current) {
      setDeparturesState(tour.departures.map((item: TourDeparture) => ({ id: item.id, date: item.date.slice(0, 10), capacity: item.capacity, price: item.price, isOpen: item.isOpen, remaining: item.remaining })));
      availabilitySnapshot.current = availability;
    }
  }, [tour]);

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setMessage(''); setErrorText('');
    try { await operation(); setMessage(success); }
    catch (e) {
      const msg = getTourApiMessage(e, 'Không thể lưu thay đổi. Vui lòng thử lại.');
      setErrorText(msg);
      const isMissingDeparture = (e as { data?: { error?: { code?: string } }; error?: { data?: { error?: { code?: string } } } })?.data?.error?.code === 'NO_OPEN_DEPARTURE' || (e as { error?: { data?: { error?: { code?: string } } } })?.error?.data?.error?.code === 'NO_OPEN_DEPARTURE' || msg.includes('Khởi hành');
      if (isMissingDeparture) {
        setStep(2);
      }
    }
  };
  const saveDays = (event: FormEvent) => {
    event.preventDefault();
    if (!tour) return;
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (!d.day || d.day < 1 || d.day > tour.durationDays) {
        setErrorText(`Ngày bắt đầu của mục thứ ${i + 1} phải từ 1 đến ${tour.durationDays}.`);
        return;
      }
      if (d.toDay && (d.toDay < d.day || d.toDay > tour.durationDays)) {
        setErrorText(`Khoảng ngày của mục thứ ${i + 1} không hợp lệ: ngày kết thúc (${d.toDay}) phải từ ngày ${d.day} đến ${tour.durationDays}.`);
        return;
      }
    }
    const sorted = [...days].sort((a, b) => a.day - b.day);
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = sorted[i].toDay && sorted[i].toDay! > sorted[i].day ? sorted[i].toDay! : sorted[i].day;
      const nextStart = sorted[i + 1].day;
      if (currentEnd >= nextStart) {
        const curLabel = sorted[i].toDay && sorted[i].toDay! > sorted[i].day ? `Ngày ${sorted[i].day} – ${sorted[i].toDay}` : `Ngày ${sorted[i].day}`;
        const nextLabel = sorted[i + 1].toDay && sorted[i + 1].toDay! > sorted[i + 1].day ? `Ngày ${sorted[i + 1].day} – ${sorted[i + 1].toDay}` : `Ngày ${sorted[i + 1].day}`;
        setErrorText(`Lịch trình bị trùng lặp thời gian: ${curLabel} đè lên ${nextLabel}. Vui lòng điều chỉnh lại.`);
        return;
      }
    }
    void run(async () => {
      const payload = sorted.map((d) => ({
        day: d.day,
        toDay: d.toDay && d.toDay > d.day ? d.toDay : undefined,
        title: d.title.trim(),
        description: d.description?.trim() || undefined,
        activities: d.activities ?? [],
      }));
      const saved = await saveItinerary({ id, days: payload }).unwrap();
      await dispatch(toursApi.util.upsertQueryData('getAgencyTour', id, saved));
      itineraryDirty.current = false;
      itinerarySnapshot.current = JSON.stringify(saved.itinerary);
      setDaysState(saved.itinerary);
    }, 'Đã lưu lịch trình.');
  };
  const saveDepartures = (event: FormEvent) => {
    event.preventDefault();
    const now = Date.now();
    const hasInvalidDate = departures.some((departure) => {
      const original = departure.id ? tour?.departures.find((item) => item.id === departure.id)?.date.slice(0, 10) : undefined;
      return (!departure.id || departure.date !== original) && new Date(`${departure.date}T00:00:00.000Z`).getTime() <= now;
    });
    if (hasInvalidDate) { setErrorText('Ngày khởi hành mới hoặc ngày được thay đổi phải bắt đầu từ ngày mai trở đi.'); return; }
    void run(async () => {
      const saved = await saveAvailability({
        id,
        departures: departures.map(({ remaining: _remaining, price, ...departure }) => {
          const effectivePrice = (!price || price <= 0) && tour ? tour.basePrice : price;
          return {
            ...departure,
            date: new Date(`${departure.date}T00:00:00.000Z`).toISOString(),
            ...(effectivePrice !== tour?.basePrice ? { priceOverride: effectivePrice } : {}),
          };
        }),
      }).unwrap();
      await dispatch(toursApi.util.upsertQueryData('getAgencyTour', id, saved));
      availabilityDirty.current = false;
      availabilitySnapshot.current = '';
      setDeparturesState(saved.departures.map((item) => ({ id: item.id, date: item.date.slice(0, 10), capacity: item.capacity, price: item.price, isOpen: item.isOpen, remaining: item.remaining })));
    }, 'Đã cập nhật ngày khởi hành.');
  };
  const submit = () => {
    void run(() => submitTour(id).unwrap(), 'Tour đã được gửi để kiểm duyệt.');
  };
  const remove = async () => {
    if (!tour || !window.confirm(`Lưu trữ tour “${tour.title}”?`)) return;
    setErrorText('');
    try { await deleteTour(id).unwrap(); window.location.assign('/agency/tours'); }
    catch (e) { setErrorText(getTourApiMessage(e, 'Không thể lưu trữ tour.')); }
  };
  const handleRestore = async () => {
    if (!tour || !window.confirm(`Khôi phục tour “${tour.title}” về bản nháp để tiếp tục sử dụng?`)) return;
    setErrorText('');
    setMessage('');
    try {
      const restored = await restoreTour(id).unwrap();
      await dispatch(toursApi.util.upsertQueryData('getAgencyTour', id, restored));
      setMessage('Đã khôi phục tour về bản nháp thành công!');
    } catch (e) {
      setErrorText(getTourApiMessage(e, 'Không thể khôi phục tour.'));
    }
  };

  if (!canView) return <AgencyDenied />;
  if (isLoading || (!tour && isFetching)) return <main className="mx-auto max-w-6xl p-6" role="status">Đang tải thông tin tour…</main>;
  if (error || !tour) return <main className="mx-auto max-w-6xl p-6"><p role="alert" className="text-red-700">{getTourApiMessage(error, 'Không tìm thấy tour hoặc bạn không có quyền truy cập.')}</p><button onClick={() => void refetch()} className="mt-3 rounded-lg border px-4 py-2">Thử tải lại</button></main>;

  const isArchived = tour.status === 'ARCHIVED';
  const isPendingReview = tour.status === 'PENDING_REVIEW';
  const locked = isPendingReview || isArchived;
  const busy = itineraryState.isLoading || availabilityState.isLoading || submitState.isLoading || deleteState.isLoading || restoreState.isLoading;
  const maxCoveredDay = days.length === 0 ? 0 : Math.max(0, ...days.map((d) => (d.toDay && d.toDay > d.day ? d.toDay : d.day)));
  const nextStartDay = tour ? Math.min(tour.durationDays, maxCoveredDay + 1) : 1;
  const isScheduleFull = tour ? maxCoveredDay >= tour.durationDays : false;

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between">
      <Link href="/agency/tours" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-primary-container hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><ArrowLeft size={16} aria-hidden="true" />Danh sách tour</Link>
      <button 
        type="button" 
        disabled={isFetching} 
        onClick={() => void refetch()} 
        aria-label="Làm mới trạng thái"
        title="Làm mới trạng thái"
        className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-50"
      >
        <RotateCw size={17} className={isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />
      </button>
    </div>
    <header className="mb-7 mt-4 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tour.title}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{statusText[tour.status]}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{tour.destination} · {tour.durationDays} ngày · {new Intl.NumberFormat('vi-VN').format(tour.basePrice)} ₫</p>
        {tour.statusReason && <p className="mt-2 text-sm text-amber-800">Ghi chú kiểm duyệt: {tour.statusReason}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {isArchived && (
          <button
            type="button"
            onClick={() => void handleRestore()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <span>{restoreState.isLoading ? 'Đang khôi phục…' : 'Khôi phục tour'}</span>
          </button>
        )}
        <Link href={`/agency/tours/${id}/edit?from=/agency/tours/${id}`} aria-disabled={locked} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${locked ? 'pointer-events-none border-slate-200 text-slate-400' : 'border-slate-300 text-slate-700'}`}>Sửa thông tin</Link>
        {tour.status !== 'APPROVED' && !isArchived && (
          <button type="button" onClick={submit} disabled={busy || locked} className="rounded-lg bg-primary-container px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitState.isLoading ? 'Đang gửi…' : 'Gửi duyệt'}</button>
        )}
        {!isArchived && (
          <button type="button" onClick={() => void remove()} disabled={busy || locked} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Lưu trữ</button>
        )}
      </div>
    </header>
    {isPendingReview && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Tour đang chờ xét duyệt. Thông tin và lịch trình tạm khóa chỉnh sửa; bạn vẫn có thể điều chỉnh ngày khởi hành và số chỗ.</p>}
    {isArchived && <p className="mb-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700 border border-slate-200">Tour này đã được lưu trữ (ngừng hoạt động). Bấm nút <strong>Khôi phục tour</strong> ở trên để chuyển về Bản nháp và tiếp tục chỉnh sửa.</p>}
    {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {errorText && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{errorText}</p>}
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
    <div className="min-w-0 space-y-6">
    <AgencyTourStepper
      active={step}
      onChange={setStep}
      allowSkip={true}
      steps={[
        { id: 1, title: 'Lịch trình', complete: days.length > 0 },
        { id: 2, title: 'Khởi hành', complete: departures.some((d) => d.isOpen && Boolean(d.date)) },
        { id: 3, title: 'Hướng dẫn viên', complete: Boolean(tour.guide) },
        { id: 4, title: 'Khách hàng' },
      ]}
    />
    <div hidden={step !== 3}>
      <AgencyGuidePanel key={id} tour={tour} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Quay lại: Khởi hành</span>
        </button>
        <button
          type="button"
          onClick={() => setStep(4)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
        >
          <span>Sang bước 4: Khách hàng</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
    <div hidden={step !== 4}>
      <AgencyCustomersPanel key={`customers-${id}`} tour={tour} />
      <div className="mt-5 flex justify-start border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Quay lại: Hướng dẫn viên</span>
        </button>
      </div>
    </div>
    <div className="space-y-6">
      <div hidden={step !== 1} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Lịch trình tour</h2>
              <p className="text-sm text-slate-600">
                Tổng thời lượng: <span className="font-semibold text-slate-900">{tour.durationDays} ngày</span>. Hỗ trợ thiết lập từng ngày hoặc gộp khoảng ngày.
              </p>
            </div>
            <button
              type="button"
              disabled={locked || isScheduleFull}
              onClick={() => setDays((current) => [...current, emptyDay(nextStartDay)])}
              className="rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              + Thêm ngày
            </button>
          </div>
          <form onSubmit={saveDays} className="space-y-4" aria-busy={itineraryState.isLoading}>
            {days.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Chưa có lịch trình. Thêm ngày đầu tiên để bắt đầu.</p>}
            {days.map((day, index) => (
              <fieldset key={index} disabled={locked} className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition-all hover:border-slate-300">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex shrink-0 items-center rounded-lg bg-teal-700 px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
                      {day.toDay && day.toDay > day.day ? `Ngày ${day.day} – ${day.toDay}` : `Ngày ${day.day}`}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                      <label className="flex items-center gap-1">
                        <span className="text-slate-500">Từ ngày</span>
                        <input
                          type="number"
                          min={1}
                          max={tour.durationDays}
                          value={day.day}
                          onKeyDown={(e) => {
                            if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                          }}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDays((prev) => prev.map((item, i) => i === index ? { ...item, day: val } : item));
                          }}
                          className="w-12 rounded border border-slate-200 px-1 py-0.5 text-center text-xs font-semibold text-slate-900 outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container"
                          title="Ngày bắt đầu"
                        />
                      </label>
                      <span className="text-slate-400">–</span>
                      <label className="flex items-center gap-1">
                        <span className="text-slate-500">đến</span>
                        <input
                          type="number"
                          min={day.day}
                          max={tour.durationDays}
                          placeholder="1 ngày"
                          value={day.toDay ?? ''}
                          onKeyDown={(e) => {
                            if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                          }}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            setDays((prev) => prev.map((item, i) => i === index ? { ...item, toDay: val } : item));
                          }}
                          className="w-14 rounded border border-slate-200 px-1 py-0.5 text-center text-xs font-semibold text-slate-900 outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container placeholder:font-normal placeholder:text-slate-400"
                          title="Ngày kết thúc (để trống nếu lịch trình trong 1 ngày)"
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDays((prev) => prev.filter((_, i) => i !== index))}
                    className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700 hover:underline transition-colors"
                  >
                    Xóa ngày
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Tiêu đề ngày</label>
                  <input
                    aria-label={`Tiêu đề ${day.toDay && day.toDay > day.day ? `ngày ${day.day} - ${day.toDay}` : `ngày ${day.day}`}`}
                    required
                    minLength={2}
                    maxLength={200}
                    value={day.title}
                    onChange={(e) => setDays((prev) => prev.map((item, i) => i === index ? { ...item, title: e.target.value } : item))}
                    placeholder={day.toDay && day.toDay > day.day ? `VD: Khám phá Đà Nẵng - Bán đảo Sơn Trà & Bà Nà Hills` : `VD: Đón sân bay - Khám phá trung tâm thành phố`}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Nội dung chi tiết</label>
                  <textarea
                    aria-label={`Nội dung ${day.toDay && day.toDay > day.day ? `ngày ${day.day} - ${day.toDay}` : `ngày ${day.day}`}`}
                    maxLength={5000}
                    rows={4}
                    value={day.description ?? ''}
                    onChange={(e) => setDays((prev) => prev.map((item, i) => i === index ? { ...item, description: e.target.value } : item))}
                    placeholder="Mô tả chi tiết lịch trình, các hoạt động tham quan, trải nghiệm và bữa ăn trong ngày..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-3.5 text-sm leading-relaxed text-slate-800 outline-none transition-colors focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 placeholder:text-slate-400"
                  />
                </div>
              </fieldset>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <button
                type="submit"
                disabled={locked || itineraryState.isLoading}
                className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 shadow-sm"
              >
                {itineraryState.isLoading ? 'Đang lưu…' : 'Lưu lịch trình'}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white transition-colors ml-auto"
              >
                <span>Sang bước 2: Khởi hành</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </section>

        {/* Lịch trình đang thiết lập placed right under Itinerary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm">
          <h2 className="text-base font-bold text-slate-900">Lịch trình đang thiết lập</h2>
          <ol className="mt-3 space-y-2 text-slate-600">
            {days.map((day, index) => {
              const label = day.toDay && day.toDay > day.day ? `Ngày ${day.day} – ${day.toDay}` : `Ngày ${day.day}`;
              return (
                <li key={index} className="flex items-start gap-2">
                  <span className="font-semibold text-slate-800 whitespace-nowrap">{label}:</span>
                  <span className="text-slate-700">{day.title || 'Chưa nhập tiêu đề'}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-slate-600 border-t border-slate-100 pt-3">
            {departures.filter((departure) => departure.isOpen).length} ngày khởi hành đang mở.
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Bản xem trước. Chỉ cập nhật hệ thống sau khi bạn lưu từng mục.
          </p>
        </div>
      </div>

      <section hidden={step !== 2} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Ngày khởi hành</h2><p className="text-sm text-slate-600">Chỗ còn lại được giữ theo số ghế đã bán.</p></div><button type="button" disabled={departures.length >= 200} onClick={() => setDepartures((current) => [...current, { date: '', capacity: tour?.maxGroupSize && tour.maxGroupSize > 0 ? tour.maxGroupSize : 10, price: tour.basePrice, isOpen: true }])} className="rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">+ Thêm ngày</button></div>
        <form onSubmit={saveDepartures} className="space-y-4" aria-busy={availabilityState.isLoading}>
          {departures.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Chưa thiết lập ngày khởi hành.</p>}
          {departures.map((departure, index) => {
            const sold = departure.remaining === undefined ? 0 : departure.capacity - departure.remaining;
            const dateLocked = sold > 0;
            return (
              <fieldset key={departure.id ?? `new-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Ngày khởi hành</span>
                  <AntDatePicker
                    value={departure.date}
                    disabled={dateLocked}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(d) => setDepartures((prev) => prev.map((item, i) => i === index ? { ...item, date: d } : item))}
                    className="w-full"
                    size="middle"
                    placeholder="Chọn ngày khởi hành"
                  />
                </div>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Sức chứa
                  <input
                    type="number"
                    required
                    min={Math.max(1, sold)}
                    max={10000}
                    value={departure.capacity}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                    }}
                    onChange={(e) => setDepartures((prev) => prev.map((item, i) => i === index ? { ...item, capacity: Number(e.target.value) } : item))}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Giá riêng (VND)
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyVndInput(departure.price)}
                    placeholder={tour ? formatCurrencyVndInput(tour.basePrice) : 'Ví dụ: 500.000'}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                    }}
                    onChange={(e) => {
                      const parsed = parseCurrencyVndInput(e.target.value);
                      setDepartures((prev) => prev.map((item, i) => i === index ? { ...item, price: parsed } : item));
                    }}
                    className={inputClass}
                  />
                </label>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={departure.isOpen}
                      onChange={(e) => setDepartures((prev) => prev.map((item, i) => i === index ? { ...item, isOpen: e.target.checked } : item))}
                    />
                    Đang mở
                  </label>
                  <span className="text-xs text-slate-500">Đã bán {sold}/{departure.capacity}</span>
                  <button
                    type="button"
                    disabled={dateLocked}
                    onClick={() => setDepartures((prev) => prev.filter((_, i) => i !== index))}
                    className="text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Gỡ
                  </button>
                </div>
                {dateLocked && (
                  <p className="sm:col-span-2 text-xs text-amber-800">
                    Đã có khách: không thể đổi ngày hoặc gỡ. Hãy đóng ngày khởi hành.
                  </p>
                )}
              </fieldset>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Quay lại: Lịch trình</span>
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={availabilityState.isLoading}
                className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 shadow-sm"
              >
                {availabilityState.isLoading ? 'Đang lưu…' : 'Lưu ngày khởi hành'}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
              >
                <span>Sang bước 3: HDV</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </form>
      </section>
    </div></div>
    <aside aria-label="Xem trước tour" className="min-w-0 lg:sticky lg:top-6">
      <AgencyTourLivePreview title={tour.title} destination={tour.destination} durationDays={tour.durationDays} basePrice={tour.basePrice} images={tour.images ?? []} summary={tour.summary} inclusions={tour.inclusions ?? []} guide={tour.guide} />
    </aside></div>
  </main>;
}
