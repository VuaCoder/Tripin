'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, FormField, Input } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorCode, getApiErrorMessage, selectUser } from '@/features/auth';
import { formatDepartureDate, formatVnd } from '@/features/cart';
import { useGetTourQuery } from '@/features/tours';
import { useAppSelector } from '@/store/hooks';
import { useCreateBookingMutation, useLazyPreviewPromotionQuery } from '../api/bookingApi';
import type { PromotionPreview } from '../types';

const PHONE_PATTERN = /^\+?[0-9 ().-]{6,20}$/;
const PROMOTION_CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;
const MAX_PARTICIPANTS = 50;

function retryKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().replace(/-/g, '');
  return `retry${Date.now()}`;
}

function bookingErrorMessage(error: unknown, fallback: string): string {
  switch (getApiErrorCode(error)) {
    case 'NOT_ENOUGH_SEATS':
      return 'Số chỗ trống vừa thay đổi. Hãy giảm số khách hoặc chọn ngày khởi hành khác.';
    case 'DEPARTURE_UNAVAILABLE':
      return 'Ngày khởi hành này hiện không còn nhận đặt chỗ.';
    case 'TOUR_UNAVAILABLE':
      return 'Tour này hiện không còn nhận đặt chỗ.';
    case 'BOOKING_AMOUNT_TOO_LOW':
      return 'Tổng giá trị booking không hợp lệ. Vui lòng kiểm tra lại mã giảm giá.';
    case 'PROMOTION_EXHAUSTED':
      return 'Mã giảm giá đã hết lượt sử dụng.';
    case 'PROMOTION_INACTIVE':
    case 'PROMOTION_EXPIRED':
      return 'Mã giảm giá này đã hết hiệu lực.';
    case 'PROMOTION_NOT_STARTED':
      return 'Mã giảm giá này chưa đến thời gian áp dụng.';
    case 'PROMOTION_NOT_APPLICABLE':
      return 'Mã giảm giá này không áp dụng cho tour đã chọn.';
    case 'PROMOTION_MIN_ORDER':
      return 'Booking chưa đạt giá trị tối thiểu để dùng mã giảm giá này.';
    default:
      return getApiErrorMessage(error, fallback);
  }
}

/** Direct tour booking confirmation; pricing and availability are checked by the backend on creation. */
export function BookingEntryPage() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useAppSelector(selectUser);
  const tourId = params.get('tourId') ?? '';
  const departureId = params.get('departureId') ?? '';
  const participantsParam = Number(params.get('participants'));

  const { data: tour, isLoading: isTourLoading, isError: isTourError, refetch: refetchTour } = useGetTourQuery(tourId, {
    skip: !tourId,
  });
  const [createBooking, { isLoading: isSubmitting }] = useCreateBookingMutation();
  const [previewPromotion, { isFetching: isPreviewingPromotion }] = useLazyPreviewPromotionQuery();

  const departure = useMemo(
    () => tour?.departures.find((d) => d.id === departureId),
    [departureId, tour],
  );
  const departureAvailable = Boolean(
    departure && departure.isOpen && departure.remaining > 0 && new Date(departure.date).getTime() > Date.now(),
  );

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [notes, setNotes] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const [promotionPreview, setPromotionPreview] = useState<PromotionPreview | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [participants, setParticipants] = useState(
    Number.isFinite(participantsParam) && participantsParam > 0 ? participantsParam : 1,
  );
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; general?: string }>({});
  const clientRequestId = useRef(retryKey());

  useEffect(() => {
    if (user?.fullName && !fullName) setFullName(user.fullName);
    if (user?.phone && !phone) setPhone(user.phone);
  }, [user, fullName, phone]);

  const clearPromotionPreview = () => {
    setPromotionPreview(null);
    setPromotionError(null);
  };

  const checkPromotion = async (subtotal: number): Promise<boolean> => {
    const code = promotionCode.trim();
    if (!code) {
      clearPromotionPreview();
      return true;
    }
    if (!PROMOTION_CODE_PATTERN.test(code)) {
      setPromotionPreview(null);
      setPromotionError('Mã giảm giá gồm 3–30 ký tự: chữ cái, số, dấu gạch nối hoặc gạch dưới.');
      return false;
    }
    try {
      const preview = await previewPromotion({ code, tourId, subtotal }).unwrap();
      if (preview.finalAmount < 1) {
        setPromotionPreview(null);
        setPromotionError('Mã giảm giá khiến tổng thanh toán không hợp lệ.');
        return false;
      }
      setPromotionPreview(preview);
      setPromotionError(null);
      return true;
    } catch (error) {
      setPromotionPreview(null);
      setPromotionError(bookingErrorMessage(error, 'Không thể áp dụng mã giảm giá này.'));
      return false;
    }
  };

  if (!tourId || !departureId) {
    return (
      <ErrorState
        title="Thiếu thông tin đặt chỗ"
        message="Vui lòng chọn một tour và ngày khởi hành để tiếp tục."
        actionLabel="Khám phá tour"
        onAction={() => router.push('/tours')}
      />
    );
  }

  if (isTourLoading) return <LoadingState label="Đang tải thông tin tour..." />;

  if (isTourError || !tour) {
    return (
      <ErrorState
        title="Không thể tải tour"
        message="Chúng tôi chưa thể kiểm tra tour bạn đã chọn. Vui lòng thử lại."
        actionLabel="Thử lại"
        onAction={() => void refetchTour()}
      />
    );
  }

  if (!departure) {
    return (
      <ErrorState
        title="Không tìm thấy ngày khởi hành"
        message="Ngày khởi hành đã chọn không còn tồn tại trong hệ thống."
        actionLabel="Quay lại xem tour"
        onAction={() => router.push(`/tours/${tourId}`)}
      />
    );
  }

  if (!departureAvailable) {
    return (
      <ErrorState
        title="Ngày khởi hành đã hết chỗ"
        message="Ngày khởi hành này hiện không còn nhận đặt chỗ hoặc đã diễn ra."
        actionLabel="Chọn ngày khác"
        onAction={() => router.push(`/tours/${tourId}`)}
      />
    );
  }

  const title = tour.title;
  const unitPrice = departure.price;
  const subtotal = unitPrice * participants;
  const finalEstimate = promotionPreview?.finalAmount ?? subtotal;
  const maxParticipants = Math.min(MAX_PARTICIPANTS, departure.remaining);
  const departureDate = departure.date;

  const handleApplyPromotion = async () => {
    if (!Number.isInteger(participants) || participants < 1 || participants > maxParticipants) {
      setErrors({ general: `Số khách phải từ 1 đến ${maxParticipants}.` });
      return;
    }
    await checkPromotion(subtotal);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (fullName.trim().length < 2) next.fullName = 'Vui lòng nhập họ tên (ít nhất 2 ký tự).';
    if (!PHONE_PATTERN.test(phone.trim())) next.phone = 'Số điện thoại không hợp lệ.';
    if (!Number.isInteger(participants) || participants < 1 || participants > maxParticipants) {
      next.general = `Số khách phải từ 1 đến ${maxParticipants}.`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    let latestUnitPrice: number | undefined;
    try {
      const refreshedTour = await refetchTour().unwrap();
      const latestDeparture = refreshedTour.departures.find((d) => d.id === departureId);
      if (!latestDeparture || !latestDeparture.isOpen || latestDeparture.remaining < 1 || new Date(latestDeparture.date).getTime() <= Date.now()) {
        setErrors({ general: 'Ngày khởi hành này hiện không còn nhận đặt chỗ.' });
        return;
      }
      const latestMaxParticipants = Math.min(MAX_PARTICIPANTS, latestDeparture.remaining);
      if (participants > latestMaxParticipants) {
        setErrors({ general: `Chỉ còn ${latestMaxParticipants} chỗ cho ngày khởi hành này.` });
        return;
      }
      latestUnitPrice = latestDeparture.price;
    } catch (error) {
      setErrors({ general: bookingErrorMessage(error, 'Không thể kiểm tra lại số chỗ. Vui lòng thử lại.') });
      return;
    }

    if (latestUnitPrice == null) {
      setErrors({ general: 'Không thể xác định giá tour hiện tại. Vui lòng thử lại.' });
      return;
    }
    if (!(await checkPromotion(latestUnitPrice * participants))) return;

    try {
      const created = await createBooking({
        tourId,
        departureId,
        participants,
        contact: { fullName: fullName.trim(), phone: phone.trim() },
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(promotionCode.trim() ? { promotionCode: promotionCode.trim() } : {}),
        clientRequestId: clientRequestId.current,
      }).unwrap();
      router.replace(`/settings/history/${created.id}`);
    } catch (error) {
      setErrors({ general: bookingErrorMessage(error, 'Không tạo được đặt chỗ. Vui lòng thử lại.') });
    }
  };


  return (
    <div className="grid gap-6 pb-12 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6" noValidate>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Hoàn tất thông tin đặt chỗ</h1>
          <p className="mt-1 text-sm text-slate-500">Thông tin liên hệ dùng để xác nhận chuyến đi của bạn.</p>
        </div>
        <FormField label="Họ và tên" htmlFor="booking-fullName" required error={errors.fullName}>
          <Input id="booking-fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn A" invalid={Boolean(errors.fullName)} autoComplete="name" />
        </FormField>
        <FormField label="Số điện thoại" htmlFor="booking-phone" required error={errors.phone}>
          <Input id="booking-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0901234567" inputMode="tel" invalid={Boolean(errors.phone)} autoComplete="tel" />
        </FormField>
        <FormField label="Số khách" htmlFor="booking-participants" hint={`Tối đa ${maxParticipants} khách cho ngày khởi hành này.`}>
          <Input id="booking-participants" type="number" min={1} max={maxParticipants} value={participants} onChange={(event) => { setParticipants(Number(event.target.value)); clearPromotionPreview(); }} />
        </FormField>
        <FormField label="Mã giảm giá" htmlFor="booking-promotion" hint="Không bắt buộc — có thể kiểm tra trước khi xác nhận." error={promotionError ?? undefined}>
          <div className="flex gap-2">
            <Input id="booking-promotion" value={promotionCode} onChange={(event) => { setPromotionCode(event.target.value.toUpperCase()); clearPromotionPreview(); }} placeholder="VD: SAVE10" maxLength={30} autoComplete="off" />
            <Button type="button" variant="outline" onClick={() => void handleApplyPromotion()} loading={isPreviewingPromotion}>Áp dụng</Button>
          </div>
        </FormField>
        <FormField label="Ghi chú" htmlFor="booking-notes" hint="Không bắt buộc">
          <textarea id="booking-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={500} placeholder="Yêu cầu đặc biệt cho chuyến đi..." className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20" />
        </FormField>
        {errors.general && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{errors.general}</p>}
        <Button type="submit" className="w-full" loading={isSubmitting}>Xác nhận đặt chỗ</Button>
      </form>

      <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-base font-bold text-slate-900">Chuyến đi của bạn</h2>
        <p className="mt-2 text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-xs text-slate-500">Khởi hành: {formatDepartureDate(departureDate)}</p>
        {unitPrice != null && <p className="mt-1 text-xs text-slate-500">{formatVnd(unitPrice)} / khách</p>}
        <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
          <div className="flex items-center justify-between gap-3 text-slate-600"><dt>Tạm tính ({participants} khách)</dt><dd className="font-semibold text-slate-800">{formatVnd(subtotal)}</dd></div>
          {promotionPreview && <div className="flex items-center justify-between gap-3 text-emerald-700"><dt>Ưu đãi {promotionPreview.code}</dt><dd className="font-semibold">-{formatVnd(promotionPreview.discountAmount)}</dd></div>}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><dt className="font-semibold text-slate-800">Tổng dự kiến</dt><dd className="text-lg font-extrabold text-primary-container" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatVnd(finalEstimate)}</dd></div>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Giá, mã giảm giá và số chỗ được backend kiểm tra lại khi bạn xác nhận đặt chỗ.</p>
      </aside>
    </div>
  );
}
