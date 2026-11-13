'use client';

import { useEffect, useMemo, useState } from 'react';
import { guestTotal, type GuestCounts } from '@travel-platform/constants';
import { Button, cn } from '@/components/ui';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import { TourContentFields } from '@/features/tours/components/TourContentFields';
import { validateTourEditor } from '@/features/tours/components/tourEditorValidation';
import { TourGuestSelector } from '@/features/tours/components/detail/TourGuestSelector';
import { useGetAgencyTourQuery, useGetTourCategoriesQuery } from '@/features/tours/api/toursApi';
import { toTourContentInput } from '@/features/tours/utils';
import type { TourContentInput } from '@/features/tours/types';
import { useDecideCustomTourMutation, useSaveCustomTourDraftMutation, useSendCustomTourOfferMutation } from '../api';
import type { CustomTourRequestDto } from '../types';

type SaveState = { state: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

// Date-only convention everywhere else in the app: a `YYYY-MM-DD` day is UTC midnight.
const dayValue = (value?: string | Date) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const defaultGuests = (participants: number): GuestCounts => ({ adults: participants, children: 0, infants: 0 });

/**
 * Agency side of the chat panel: the negotiated terms of the private tour, saved with the request revision.
 * Everything the form touches lives on the clone, so the normal tour endpoints stay closed to it (D-85).
 */
export function AgencyOfferEditor({ request, onRefetch }: { request: CustomTourRequestDto; onRefetch: () => void }) {
  const privateTourId = request.privateTour?.id ?? '';
  const tour = useGetAgencyTourQuery(privateTourId, { skip: !privateTourId });
  const categories = useGetTourCategoriesQuery();
  const [saveDraft, saveState] = useSaveCustomTourDraftMutation();
  const [sendOffer, offerState] = useSendCustomTourOfferMutation();
  const [decide, decideState] = useDecideCustomTourMutation();

  const [form, setForm] = useState<TourContentInput | null>(null);
  const [guests, setGuests] = useState<GuestCounts>(request.guestCounts ?? defaultGuests(request.participants));
  const [date, setDate] = useState(dayValue(request.startDate ? new Date(request.startDate) : undefined));
  const [baseline, setBaseline] = useState<{ content: string; guests: string; date: string } | null>(null);
  const [status, setStatus] = useState<SaveState>({ state: 'idle' });

  // The clone carries the live terms; the request only knows the day the traveler asked for.
  useEffect(() => {
    if (form || !tour.data) return;
    const next = toTourContentInput(tour.data);
    const nextDate = dayValue(tour.data.departures[0]?.date ?? (request.startDate ? new Date(request.startDate) : undefined));
    setForm(next);
    setDate(nextDate);
    setBaseline({ content: JSON.stringify(next), guests: JSON.stringify(guests), date: nextDate });
  }, [form, tour.data, request.startDate, guests]);

  const draft = useMemo(() => {
    if (!form) return null;
    const { maxGroupSize: _headCountIsFixed, ...content } = form;
    return { content, guestCounts: guests, departure: date ? { date: new Date(date).toISOString() } : undefined };
  }, [form, guests, date]);

  const errors = form ? Object.values(validateTourEditor(form)).filter((message): message is string => Boolean(message)) : [];
  const missingForm = !form || tour.isError;
  const countsMismatch = guestTotal(guests) !== request.participants;
  const dateMissing = !date || new Date(date).getTime() <= Date.now();
  const dirty = Boolean(
    form && baseline && (JSON.stringify(form) !== baseline.content || JSON.stringify(guests) !== baseline.guests || date !== baseline.date),
  );
  const editable = request.status === 'NEGOTIATING' || request.status === 'OFFERED';
  const saving = saveState.isLoading || offerState.isLoading || decideState.isLoading;
  const canSave = editable && !missingForm && errors.length === 0 && !countsMismatch && !dateMissing && !saving;
  const canSend = canSave && request.status === 'NEGOTIATING' && !dirty;

  const failed = (error: unknown, fallback: string) => {
    if (getApiErrorCode(error) === 'CONCURRENT_UPDATE') {
      setStatus({ state: 'error', message: 'Bản đã được thay đổi ở nơi khác. Đã tải bản mới, dữ liệu bạn đang nhập vẫn được giữ.' });
      onRefetch();
      return;
    }
    setStatus({ state: 'error', message: getApiErrorMessage(error, fallback) });
  };

  const save = async () => {
    if (!canSave || !draft || !form) return;
    setStatus({ state: 'saving' });
    try {
      await saveDraft({ id: request.id, revision: request.revision, ...draft }).unwrap();
      setStatus({ state: 'saved' });
      setBaseline({ content: JSON.stringify(form), guests: JSON.stringify(guests), date });
    } catch (error) {
      failed(error, 'Không lưu được thỏa thuận. Vui lòng thử lại.');
    }
  };

  const send = async () => {
    if (!canSend) return;
    setStatus({ state: 'saving' });
    try {
      await sendOffer({ id: request.id, revision: request.revision }).unwrap();
      setStatus({ state: 'saved', message: 'Đã gửi thỏa thuận cho khách.' });
    } catch (error) {
      failed(error, 'Không gửi được thỏa thuận. Vui lòng thử lại.');
    }
  };

  const accept = async () => {
    setStatus({ state: 'saving' });
    try {
      await decide({ id: request.id, decision: 'ACCEPT' }).unwrap();
      setStatus({ state: 'saved', message: 'Đã nhận tư vấn đoàn.' });
    } catch (error) {
      failed(error, 'Không nhận được yêu cầu. Vui lòng thử lại.');
    }
  };

  if (request.status === 'SUBMITTED') {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <p>Nhận yêu cầu để bắt đầu tư vấn lịch trình và gửi thỏa thuận cho đoàn.</p>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{request.participants} người · {request.notes || 'Khách chưa ghi chú.'}</p>
        <Button onClick={() => void accept()} loading={saving}>Nhận tư vấn</Button>
        {status.message && <p role="alert" className="text-sm text-red-700">{status.message}</p>}
      </div>
    );
  }

  if (request.status === 'DECLINED' || request.status === 'CANCELLED') {
    return <p className="text-sm text-slate-600">Yêu cầu đã đóng, không còn gì để chỉnh sửa.</p>;
  }

  if (request.status === 'ACCEPTED') {
    return (
      <div className="space-y-2 text-sm text-slate-700">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">Khách đã chấp nhận thỏa thuận.</p>
        {request.currentBooking ? (
          <p>
            Đoàn đã đặt chỗ <strong>{request.currentBooking.bookingCode}</strong>
            {request.currentBooking.isPaid ? ' và đã thanh toán.' : ', đang chờ thanh toán.'}
          </p>
        ) : (
          <p>Đoàn đang nhập thông tin hành khách. Bạn chỉnh sửa tiếp trong chat nếu khách yêu cầu thay đổi.</p>
        )}
      </div>
    );
  }

  if (tour.isLoading) return <p role="status" className="text-sm text-slate-600">Đang tải lịch trình riêng…</p>;
  if (tour.isError || !form) {
    return (
      <div role="alert" className="space-y-2 text-sm text-red-700">
        Không tải được tour riêng của đoàn.{' '}
        <button type="button" className="underline" onClick={() => void tour.refetch()}>Thử lại</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Số khách tối đa của tour riêng luôn bằng số người của đoàn ({request.participants}).
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700" htmlFor="custom-tour-panel-date">
          Ngày khởi hành
          <input
            id="custom-tour-panel-date"
            type="date"
            value={date}
            onChange={(event) => { setDate(event.target.value); setStatus({ state: 'idle' }); }}
            aria-invalid={dateMissing || undefined}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
          />
          {dateMissing && <span className="block text-xs font-medium text-red-600">Chọn ngày khởi hành ở tương lai.</span>}
        </label>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-slate-700">Cơ cấu đoàn</p>
          <TourGuestSelector value={guests} onChange={setGuests} max={request.participants} unitPrice={form.basePrice} pricing={form.agePricing} />
          <p className={countsMismatch ? 'text-xs font-medium text-red-600' : 'text-xs text-slate-500'}>
            Tổng {guestTotal(guests)}/{request.participants} người.
          </p>
        </div>
      </div>

      {categories.isLoading ? (
        <p role="status" className="text-sm text-slate-600">Đang tải danh mục…</p>
      ) : (
        <TourContentFields value={form} onChange={setForm} categories={categories.data ?? []} />
      )}

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {errors.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}

      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="text-xs font-medium text-slate-600">
            {status.state === 'saving' ? 'Đang lưu…' : status.state === 'saved' ? 'Đã lưu' : status.state === 'error' ? 'Lưu lỗi' : ''}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => void save()} disabled={!canSave} loading={saveState.isLoading}>Lưu nháp</Button>
            <Button variant="outline" onClick={() => void send()} disabled={!canSend} loading={offerState.isLoading}>Gửi thỏa thuận</Button>
          </div>
        </div>
        {dirty && request.status === 'NEGOTIATING' && <p className="text-xs text-amber-700">Lưu nháp trước khi gửi thỏa thuận.</p>}
        {request.status === 'OFFERED' && <p className="text-xs text-slate-600">Đã gửi thỏa thuận, khách đang xem. Lưu thay đổi sẽ thu hồi bản đã gửi.</p>}
        {status.message && <p role="status" className={cn('text-xs font-medium', status.state === 'error' ? 'text-red-700' : 'text-emerald-700')}>{status.message}</p>}
      </div>
    </div>
  );
}
