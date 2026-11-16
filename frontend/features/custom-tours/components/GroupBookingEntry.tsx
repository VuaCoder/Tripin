'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ageUnitPrice } from '@travel-platform/constants';
import { Button } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth';
import { formatVnd } from '@/lib/travel-format';
import { useCreateCustomTourBookingMutation, useGetCustomTourQuery, useSaveCustomTourCheckoutDraftMutation } from '../api';
import { departureLabel, guestSummary } from '../labels';
import { customTourChatHref, customTourHref } from '../links';
import type { CustomTourCheckoutDraft, CustomTourPassengerDraft, CustomTourRequestDto, GuestCounts, PassengerType } from '../types';

const GUEST_LABEL: Record<PassengerType, string> = { ADULT: 'Người lớn', CHILD: 'Trẻ em', INFANT: 'Em bé' };
const GUEST_ORDER: PassengerType[] = ['ADULT', 'CHILD', 'INFANT'];
const PHONE_PATTERN = /^\+?\d{9,15}$/;
/** Pasted numbers carry NBSP, dots, dashes or slashes that the API refuses; keep the digits and one leading +. */
function cleanPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return value.trim().startsWith('+') ? `+${digits}` : digits;
}
const ID_CARD_PATTERN = /^\d{12}$/;
const AUTOSAVE_MS = 800;
/** The server refuses these after the offer went stale; the traveler needs the reason and a way to renegotiate. */
const BOOKING_ERROR_COPY: Record<string, string> = {
  DEPARTURE_PASSED: 'Ngày khởi hành của thỏa thuận đã qua.',
  DEPARTURE_UNAVAILABLE: 'Lịch khởi hành của thỏa thuận không còn mở.',
  TOUR_UNAVAILABLE: 'Tour riêng của thỏa thuận đang tạm dừng.',
};

interface Row extends CustomTourPassengerDraft {
  /** "Người lớn 2" — position within its age group, so the label survives a reload. */
  label: string;
}

interface Form {
  contact: { fullName: string; phone: string };
  notes: string;
  passengers: Row[];
}

/** The accepted group, with whatever the traveler already saved filled in row by row. */
function seedForm(request: CustomTourRequestDto): Form {
  const guests: GuestCounts = request.offer?.guestCounts
    ?? request.guestCounts
    ?? { adults: request.participants, children: 0, infants: 0 };
  const saved = request.checkoutDraft?.passengers ?? [];
  const passengers: Row[] = [];
  let index = 0;
  for (const guestType of GUEST_ORDER) {
    const count = guestType === 'ADULT' ? guests.adults : guestType === 'CHILD' ? guests.children : guests.infants;
    for (let position = 1; position <= count; position += 1) {
      const previous = saved[index];
      const keep = previous?.guestType === guestType ? previous : null;
      passengers.push({
        guestType,
        label: `${GUEST_LABEL[guestType]} ${position}`,
        fullName: keep?.fullName ?? '',
        phone: keep?.phone ?? '',
        idCard: keep?.idCard ?? '',
      });
      index += 1;
    }
  }
  return {
    contact: request.checkoutDraft?.contact ?? { fullName: '', phone: '' },
    notes: request.checkoutDraft?.notes ?? '',
    passengers,
  };
}

/** Trimmed exactly the way the server stores it, so a save does not look dirty again on the echo. */
function toDraft(form: Form): CustomTourCheckoutDraft {
  const notes = form.notes.trim();
  return {
    contact: { fullName: form.contact.fullName.trim(), phone: cleanPhone(form.contact.phone) },
    passengers: form.passengers.map(({ guestType, fullName, phone, idCard }) => ({
      guestType,
      fullName: fullName.trim(),
      phone: cleanPhone(phone),
      idCard: idCard.trim(),
    })),
    ...(notes ? { notes } : {}),
  };
}

function fingerprint(draft?: CustomTourCheckoutDraft | null): string {
  return JSON.stringify({
    contact: { fullName: draft?.contact.fullName.trim() ?? '', phone: draft?.contact.phone.trim() ?? '' },
    passengers: (draft?.passengers ?? []).map((row) => ({
      guestType: row.guestType,
      fullName: row.fullName.trim(),
      phone: row.phone.trim(),
      idCard: row.idCard.trim(),
    })),
    notes: draft?.notes?.trim() ?? '',
  });
}

interface Problem {
  /** The input the message belongs under, so the traveler sees it on the field instead of only in the summary. */
  field: string;
  /** Short name for the summary line. */
  label: string;
  message: string;
}

const PHONE_HINT = 'Số điện thoại chưa hợp lệ (cần 9–15 số).';

/** What still stops a save; empty means the form is complete enough for the API. */
function problems(form: Form): Problem[] {
  const found: Problem[] = [];
  if (form.contact.fullName.trim().length < 2) {
    found.push({ field: 'contact-fullName', label: 'họ tên người liên hệ', message: 'Cần họ tên người liên hệ.' });
  }
  if (!PHONE_PATTERN.test(cleanPhone(form.contact.phone))) {
    found.push({ field: 'contact-phone', label: 'SĐT người liên hệ', message: PHONE_HINT });
  }
  form.passengers.forEach((row, index) => {
    if (row.fullName.trim().length < 2) {
      found.push({ field: `passenger-${index}-fullName`, label: `họ tên ${row.label}`, message: 'Cần họ tên hành khách.' });
    }
    if (!PHONE_PATTERN.test(cleanPhone(row.phone))) {
      found.push({ field: `passenger-${index}-phone`, label: `SĐT ${row.label}`, message: PHONE_HINT });
    }
    const idCard = row.idCard.trim();
    if (!ID_CARD_PATTERN.test(idCard)) {
      found.push({
        field: `passenger-${index}-idCard`,
        label: `CCCD ${row.label}${idCard ? ' (cần 12 số)' : ''}`,
        message: idCard ? 'CCCD phải đủ 12 số.' : 'Cần CCCD 12 số.',
      });
    }
  });
  // A shared card is the fault of both rows, so both fields say so.
  const cards = form.passengers.map((row) => row.idCard.trim()).filter(Boolean);
  form.passengers.forEach((row, index) => {
    const card = row.idCard.trim();
    if (card && cards.indexOf(card) !== cards.lastIndexOf(card)) {
      found.push({ field: `passenger-${index}-idCard`, label: 'CCCD bị trùng', message: 'CCCD bị trùng với hành khách khác.' });
    }
  });
  return found;
}

function Field({ id, label, value, onChange, placeholder, inputMode, maxLength, error }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: 'numeric' | 'tel';
  maxLength?: number;
  error?: string;
}) {
  // A field only turns red once it holds something: an empty required field stays in the bottom summary.
  const shown = value.trim() ? error : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Autofill writes the DOM without a React event, so the field would claim a value the form never got.
        onBlur={(event) => {
          if (event.target.value !== value) onChange(event.target.value);
        }}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={shown ? true : undefined}
        aria-describedby={shown ? `${id}-error` : undefined}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-1 ${
          shown
            ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
            : 'border-slate-200 focus:border-brand-teal focus:ring-brand-teal'
        }`}
      />
      {shown && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">{shown}</p>
      )}
    </div>
  );
}

/**
 * Checkout for an accepted group booking: the terms come frozen from the offer, the traveler only fills in the people.
 * The form saves itself 800ms after the last keystroke and is restored from the server on any device.
 */
export function GroupBookingEntry({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { data: request, isLoading, isError, refetch } = useGetCustomTourQuery(requestId);
  const [save, { isLoading: isSaving }] = useSaveCustomTourCheckoutDraftMutation();
  const [createBooking, { isLoading: isBooking }] = useCreateCustomTourBookingMutation();
  const [form, setForm] = useState<Form | null>(null);
  const [baseline, setBaseline] = useState('');
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState('');
  const [error, setError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const formRef = useRef<Form | null>(null);
  const revision = useRef(0);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const serverRevision = request?.checkoutRevision ?? 0;

  // Seed once: every later refetch (one follows each save) must not overwrite what is being typed.
  useEffect(() => {
    if (!request || formRef.current) return;
    const seeded = seedForm(request);
    formRef.current = seeded;
    revision.current = request.checkoutRevision;
    setBaseline(fingerprint(toDraft(seeded)));
    setForm(seeded);
  }, [request]);

  // Another device saved first: adopt its revision so "Thử lại" is accepted instead of failing forever.
  useEffect(() => {
    revision.current = Math.max(revision.current, serverRevision);
  }, [serverRevision]);

  // The request already has its booking (or a retry created it meanwhile): there is nothing left to fill in here.
  const currentBooking = request?.currentBooking;
  useEffect(() => {
    if (currentBooking) router.replace(`/settings/history/${currentBooking.id}`);
  }, [currentBooking, router]);

  const update = useCallback((patch: (current: Form) => Form) => {
    setForm((current) => {
      if (!current) return current;
      const next = patch(current);
      formRef.current = next;
      return next;
    });
  }, []);

  // Reads the live ref, so a save queued behind another still sends the latest keystrokes. True = the server has
  // exactly what is on screen now, which is what booking requires.
  const runSave = useCallback(async (): Promise<boolean> => {
    const current = formRef.current;
    if (!current || problems(current).length > 0) return false;
    const draft = toDraft(current);
    setPhase('saving');
    setError('');
    try {
      const saved = await save({ id: requestId, checkoutRevision: revision.current, ...draft }).unwrap();
      revision.current = saved.checkoutRevision;
      setBaseline(fingerprint(saved.checkoutDraft ?? draft));
      setSavedAt(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      setPhase('saved');
      return true;
    } catch (failure) {
      const code = getApiErrorCode(failure);
      setPhase('error');
      setError(
        code === 'CONCURRENT_UPDATE'
          ? 'Bản nháp vừa được lưu ở thiết bị khác. Nhấn "Thử lại" để ghi đè bằng nội dung đang nhập.'
          : getApiErrorMessage(failure, 'Không lưu được thông tin hành khách.'),
      );
      if (code === 'CONCURRENT_UPDATE') void refetch();
      return false;
    }
  }, [requestId, save, refetch]);

  const current = form ? fingerprint(toDraft(form)) : '';
  const problemsFound = form ? problems(form) : [];
  const missing = problemsFound.map((problem) => problem.label);
  const problemOn = (field: string) => problemsFound.find((problem) => problem.field === field)?.message;
  const complete = Boolean(form) && problemsFound.length === 0;
  const dirty = Boolean(form) && current !== baseline;

  // Debounce only a complete form: the API stores the whole roster or nothing, so half-typed rows cannot be saved.
  useEffect(() => {
    if (!dirty || !complete) return;
    const timer = setTimeout(() => {
      queue.current = queue.current.then(runSave);
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [current, dirty, complete, runSave]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const retry = () => {
    queue.current = queue.current.then(runSave);
  };

  /** The form is the booking's passenger list, so it is saved once more and only then turned into the booking. */
  const submit = useCallback(async () => {
    setBookingError('');
    const saved = await queue.current.then(runSave);
    if (!saved) return;
    try {
      const booking = await createBooking({ id: requestId }).unwrap();
      router.replace(`/settings/history/${booking.id}`);
    } catch (failure) {
      const code = getApiErrorCode(failure);
      setBookingError(BOOKING_ERROR_COPY[code ?? ''] ?? getApiErrorMessage(failure, 'Không tạo được booking. Vui lòng thử lại.'));
    }
  }, [createBooking, requestId, router, runSave]);

  if (isLoading) return <LoadingState label="Đang tải yêu cầu booking đoàn..." />;
  if (isError || !request) {
    return (
      <ErrorState
        title="Không tải được yêu cầu"
        message="Chúng tôi chưa thể mở yêu cầu booking đoàn này. Vui lòng thử lại."
        actionLabel="Thử lại"
        onAction={() => void refetch()}
      />
    );
  }
  if (currentBooking) return <LoadingState label="Đang mở booking của bạn..." />;
  if (request.nextStep !== 'ENTER_PASSENGERS' || !request.offer) {
    const href = customTourHref(request, 'TRAVELER');
    return (
      <ErrorState
        title="Chưa tới bước nhập hành khách"
        message="Yêu cầu này chưa chốt thỏa thuận hoặc đã có booking. Hãy quay lại yêu cầu để xem bước tiếp theo."
        actionLabel="Về yêu cầu"
        onAction={() => router.push(href ?? '/traveler/custom-tours')}
      />
    );
  }
  const offer = request.offer;
  if (new Date(offer.departureDate).getTime() <= Date.now()) {
    return (
      <ErrorState
        title="Ngày khởi hành đã qua"
        message="Thỏa thuận này đã qua ngày khởi hành nên không thể đặt chỗ. Hãy trao đổi với đại lý để chốt ngày mới — giá và thông tin hành khách vẫn được giữ."
        actionLabel="Trao đổi với đại lý"
        onAction={() => router.push(customTourChatHref(request, 'TRAVELER'))}
      />
    );
  }
  if (!form) return <LoadingState label="Đang chuẩn bị biểu mẫu..." />;

  const href = customTourHref(request, 'TRAVELER');
  const chatHref = customTourChatHref(request, 'TRAVELER');
  const priceRows = [
    { key: 'adults', label: GUEST_LABEL.ADULT, count: offer.guestCounts.adults, price: offer.unitPrice },
    { key: 'children', label: GUEST_LABEL.CHILD, count: offer.guestCounts.children, price: ageUnitPrice(offer.unitPrice, offer.agePricing, 'child') },
    { key: 'infants', label: GUEST_LABEL.INFANT, count: offer.guestCounts.infants, price: ageUnitPrice(offer.unitPrice, offer.agePricing, 'infant') },
  ].filter((row) => row.count > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Booking đoàn đã chốt</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Nhập thông tin hành khách</h1>
        <p className="mt-1 text-sm text-slate-600">
          {guestSummary(request)} · Khởi hành {departureLabel(offer.departureDate) ?? 'chưa chốt ngày'}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section aria-labelledby="group-trip" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="group-trip" className="text-base font-bold text-slate-900">Chuyến đi của đoàn</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-slate-500">Tour</dt>
                <dd className="font-semibold text-slate-900">{offer.content?.title ?? request.privateTour?.title ?? request.sourceTour?.title}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">Ngày khởi hành</dt>
                <dd className="text-slate-800">{departureLabel(offer.departureDate) ?? 'Chưa chốt'}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Ngày, số khách và giá đã chốt trong thỏa thuận nên không sửa được ở đây.
              {href && (
                <>
                  {' '}Cần đổi?{' '}
                  <Link href={href} className="font-semibold text-brand-teal underline">Trao đổi với đại lý</Link>.
                </>
              )}
            </p>
          </section>

          <section aria-labelledby="group-contact" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="group-contact" className="text-base font-bold text-slate-900">Người liên hệ</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                id="contact-fullName"
                label="Họ và tên"
                value={form.contact.fullName}
                onChange={(value) => update((item) => ({ ...item, contact: { ...item.contact, fullName: value } }))}
                placeholder="VD: Nguyễn Văn A"
                maxLength={120}
                error={problemOn('contact-fullName')}
              />
              <Field
                id="contact-phone"
                label="Số điện thoại"
                value={form.contact.phone}
                onChange={(value) => update((item) => ({ ...item, contact: { ...item.contact, phone: value } }))}
                placeholder="VD: 0912 345 678"
                inputMode="tel"
                maxLength={20}
                error={problemOn('contact-phone')}
              />
            </div>
          </section>

          <section aria-labelledby="group-members" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="group-members" className="text-base font-bold text-slate-900">Hành khách ({form.passengers.length})</h2>
            <p className="mt-1 text-xs text-slate-500">Mỗi thành viên cần họ tên, số điện thoại và CCCD 12 số, kể cả trẻ em và em bé.</p>
            <div className="mt-4 space-y-4">
              {form.passengers.map((row, index) => (
                <div key={`${row.guestType}-${row.label}`} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Hành khách {index + 1}</span>
                    <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">{row.label}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field
                        id={`passenger-${index}-fullName`}
                        label="Họ và tên"
                        value={row.fullName}
                        onChange={(value) => update((item) => ({
                          ...item,
                          passengers: item.passengers.map((entry, at) => (at === index ? { ...entry, fullName: value } : entry)),
                        }))}
                        placeholder="VD: Nguyễn Văn B"
                        maxLength={120}
                        error={problemOn(`passenger-${index}-fullName`)}
                      />
                    </div>
                    <Field
                      id={`passenger-${index}-phone`}
                      label="Số điện thoại"
                      value={row.phone}
                      onChange={(value) => update((item) => ({
                        ...item,
                        passengers: item.passengers.map((entry, at) => (at === index ? { ...entry, phone: value } : entry)),
                      }))}
                      placeholder="VD: 0912 345 678"
                      inputMode="tel"
                      maxLength={20}
                      error={problemOn(`passenger-${index}-phone`)}
                    />
                    <Field
                      id={`passenger-${index}-idCard`}
                      label="CCCD (12 số)"
                      value={row.idCard}
                      onChange={(value) => update((item) => ({
                        ...item,
                        passengers: item.passengers.map((entry, at) => (at === index ? { ...entry, idCard: value } : entry)),
                      }))}
                      placeholder="VD: 001204012345"
                      inputMode="numeric"
                      maxLength={12}
                      error={problemOn(`passenger-${index}-idCard`)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="group-notes" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="group-notes" className="text-base font-bold text-slate-900">Ghi chú cho đại lý</h2>
            <label htmlFor="group-notes-input" className="sr-only">Ghi chú cho đại lý</label>
            <textarea
              id="group-notes-input"
              value={form.notes}
              onChange={(event) => update((item) => ({ ...item, notes: event.target.value }))}
              rows={3}
              maxLength={500}
              placeholder="VD: Đoàn có người lớn tuổi, cần phòng tầng thấp."
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
            />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section aria-labelledby="group-price" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 id="group-price" className="text-base font-bold text-slate-900">Giá đã chốt</h2>
            <table className="mt-2 w-full text-left text-sm">
              <caption className="sr-only">Bảng giá thỏa thuận</caption>
              <tbody>
                {priceRows.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    <td className="py-1.5">{row.label} × {row.count}</td>
                    <td className="py-1.5 text-right">{row.price === null ? '—' : formatVnd(row.price * row.count)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold text-slate-900">
                  <th scope="row" className="py-2 text-left">Tổng cộng</th>
                  <td className="py-2 text-right">{formatVnd(offer.subtotal)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-2 text-xs text-slate-500">Giá trong thỏa thuận, không áp dụng voucher hay khuyến mãi.</p>
          </section>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 mt-6 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            {phase === 'saving' && <p role="status" aria-live="polite" className="font-medium text-slate-600">Đang lưu…</p>}
            {phase === 'saved' && <p role="status" aria-live="polite" className="font-medium text-emerald-700">Đã lưu lúc {savedAt}</p>}
            {phase === 'error' && <p role="alert" className="font-medium text-red-700">{error}</p>}
            {dirty && !complete && (
              <p className="mt-1 text-amber-700">
                Chưa lưu — còn thiếu {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` và ${missing.length - 3} mục khác` : ''}.
              </p>
            )}
            {phase === 'idle' && !dirty && (
              <p className="text-slate-500">
                {request.checkoutDraft ? 'Thông tin đã được lưu. Bạn có thể quay lại sau.' : 'Thông tin được lưu tự động khi bạn nhập xong.'}
              </p>
            )}
            {bookingError && (
              <p role="alert" className="mt-1 font-medium text-red-700">
                {bookingError}{' '}
                <Link href={chatHref} className="underline">Trao đổi với đại lý</Link>
              </p>
            )}
          </div>
          {phase === 'error' && (
            <Button variant="outline" size="sm" onClick={retry} loading={isSaving} loadingLabel="Đang lưu...">Thử lại</Button>
          )}
          <Button
            onClick={() => void submit()}
            loading={isBooking}
            loadingLabel="Đang tạo booking..."
            disabled={!complete || isSaving}
          >
            Đặt chỗ và thanh toán
          </Button>
        </div>
      </div>
    </div>
  );
}
