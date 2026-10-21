'use client';
import { calculateGuestPrice, guestTotal, type GuestCounts } from '@travel-platform/constants';
import { TourGuestSelector } from '@/features/tours/components/detail/TourGuestSelector';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, FormField, Input } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorCode, getApiErrorMessage, selectUser } from '@/features/auth';
import { formatDepartureDate, formatVnd } from '@/lib/travel-format';
import { useGetTourQuery } from '@/features/tours';
import { useAppSelector } from '@/store/hooks';
import { useCreateBookingMutation, useGetAvailablePromotionsQuery, useLazyPreviewPromotionQuery, useGetMyVouchersQuery } from '../api/bookingApi';
import type { PromotionPreview } from '../types';
import { Building2, CheckCircle2, Sparkles, Tag, Ticket, X } from 'lucide-react';

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
  const { data: availablePromos } = useGetAvailablePromotionsQuery({ tourId }, { skip: !tourId });
  const { data: myVouchers } = useGetMyVouchersQuery(undefined, { skip: !user });
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

  // Separated promotions state
  const [agencyPromotionCode, setAgencyPromotionCode] = useState('');
  const [agencyPromotionPreview, setAgencyPromotionPreview] = useState<PromotionPreview | null>(null);
  const [agencyPromotionError, setAgencyPromotionError] = useState<string | null>(null);

  const [platformPromotionCode, setPlatformPromotionCode] = useState('');
  const [platformPromotionPreview, setPlatformPromotionPreview] = useState<PromotionPreview | null>(null);
  const [platformPromotionError, setPlatformPromotionError] = useState<string | null>(null);

  const [participants, setParticipants] = useState(
    Number.isFinite(participantsParam) && participantsParam > 0 ? participantsParam : 1,
  );
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; general?: string }>({});
  const [children, setChildren] = useState(() => Math.max(0, Number(params.get('children')) || 0));
  const [infants, setInfants] = useState(() => Math.max(0, Number(params.get('infants')) || 0));
  const clientRequestId = useRef(retryKey());

  useEffect(() => {
    if (user?.fullName && !fullName) setFullName(user.fullName);
    if (user?.phone && !phone) setPhone(user.phone);
  }, [user, fullName, phone]);

  const clearAgencyPromotion = () => {
    setAgencyPromotionCode('');
    setAgencyPromotionPreview(null);
    setAgencyPromotionError(null);
  };

  const clearPlatformPromotion = () => {
    setPlatformPromotionCode('');
    setPlatformPromotionPreview(null);
    setPlatformPromotionError(null);
  };

  const clearAllPromotions = () => {
    setAgencyPromotionPreview(null);
    setAgencyPromotionError(null);
    setPlatformPromotionPreview(null);
    setPlatformPromotionError(null);
  };

  const checkAgencyPromotion = async (codeToUse?: string, currentSubtotal?: number): Promise<boolean> => {
    const code = (codeToUse ?? agencyPromotionCode).trim();
    if (!code) {
      setAgencyPromotionPreview(null);
      setAgencyPromotionError(null);
      return true;
    }
    if (!PROMOTION_CODE_PATTERN.test(code)) {
      setAgencyPromotionPreview(null);
      setAgencyPromotionError('Mã gồm 3–30 ký tự: chữ cái, số, dấu gạch ngang hoặc gạch dưới.');
      return false;
    }
    const orderSubtotal = currentSubtotal ?? subtotal;
    try {
      const preview = await previewPromotion({ code, tourId, subtotal: orderSubtotal }).unwrap();
      if (preview.scope !== 'AGENCY') {
        setAgencyPromotionPreview(null);
        setAgencyPromotionError('Mã này là ưu đãi của Nền tảng Tripin. Vui lòng nhập vào ô Khuyến mãi nền tảng.');
        return false;
      }
      if (preview.finalAmount < 1) {
        setAgencyPromotionPreview(null);
        setAgencyPromotionError('Mã giảm giá khiến tổng thanh toán không hợp lệ.');
        return false;
      }
      setAgencyPromotionPreview(preview);
      setAgencyPromotionError(null);
      return true;
    } catch (error) {
      setAgencyPromotionPreview(null);
      setAgencyPromotionError(bookingErrorMessage(error, 'Không thể áp dụng mã ưu đãi của nhà cung cấp này.'));
      return false;
    }
  };

  const checkPlatformPromotion = async (codeToUse?: string, currentSubtotal?: number): Promise<boolean> => {
    const code = (codeToUse ?? platformPromotionCode).trim();
    if (!code) {
      setPlatformPromotionPreview(null);
      setPlatformPromotionError(null);
      return true;
    }
    if (!PROMOTION_CODE_PATTERN.test(code)) {
      setPlatformPromotionPreview(null);
      setPlatformPromotionError('Mã gồm 3–30 ký tự: chữ cái, số, dấu gạch ngang hoặc gạch dưới.');
      return false;
    }
    const orderSubtotal = Math.max(0, (currentSubtotal ?? subtotal) - (agencyPromotionPreview?.discountAmount ?? 0));
    try {
      const preview = await previewPromotion({ code, tourId, subtotal: orderSubtotal }).unwrap();
      if (preview.scope !== 'PLATFORM') {
        setPlatformPromotionPreview(null);
        setPlatformPromotionError('Mã này là ưu đãi của Nhà cung cấp. Vui lòng nhập vào ô Khuyến mãi nhà cung cấp.');
        return false;
      }
      if (preview.finalAmount < 1) {
        setPlatformPromotionPreview(null);
        setPlatformPromotionError('Mã giảm giá khiến tổng thanh toán không hợp lệ.');
        return false;
      }
      setPlatformPromotionPreview(preview);
      setPlatformPromotionError(null);
      return true;
    } catch (error) {
      setPlatformPromotionPreview(null);
      setPlatformPromotionError(bookingErrorMessage(error, 'Không thể áp dụng mã ưu đãi của sàn Tripin này.'));
      return false;
    }
  };

  const applyQuickAgencyCode = (code: string) => {
    setAgencyPromotionCode(code);
    void checkAgencyPromotion(code, subtotal);
  };

  const applyQuickPlatformCode = (code: string) => {
    setPlatformPromotionCode(code);
    void checkPlatformPromotion(code, subtotal);
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
  const guestCounts: GuestCounts = { adults: participants - children - infants, children, infants };
  let subtotal = 0;
  let pricingError = '';
  try { subtotal = calculateGuestPrice(unitPrice, participants, guestCounts, tour.agePricing).subtotal; }
  catch { pricingError = 'Vui lòng kiểm tra số khách và chính sách độ tuổi của tour.'; }

  const agencyDiscount = agencyPromotionPreview?.discountAmount ?? 0;
  const platformDiscount = platformPromotionPreview?.discountAmount ?? 0;
  const totalDiscount = agencyDiscount + platformDiscount;
  const finalEstimate = Math.max(0, subtotal - totalDiscount);

  const maxParticipants = Math.min(MAX_PARTICIPANTS, departure.remaining);
  const departureDate = departure.date;

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
    let latestAgePricing = tour.agePricing;
    try {
      const refreshedTour = await refetchTour().unwrap();
      latestAgePricing = refreshedTour.agePricing;
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
    if (pricingError) { setErrors({ general: pricingError }); return; }
    let latestSubtotal = 0;
    try { latestSubtotal = calculateGuestPrice(latestUnitPrice, participants, guestCounts, latestAgePricing).subtotal; }
    catch { setErrors({ general: 'Chính sách giá đã thay đổi. Vui lòng chọn lại hành khách.' }); return; }

    if (agencyPromotionCode.trim() && !(await checkAgencyPromotion(agencyPromotionCode.trim(), latestSubtotal))) return;
    const subtotalAfterAgency = Math.max(0, latestSubtotal - (agencyPromotionPreview?.discountAmount ?? 0));
    if (platformPromotionCode.trim() && !(await checkPlatformPromotion(platformPromotionCode.trim(), subtotalAfterAgency))) return;

    try {
      const created = await createBooking({
        tourId,
        departureId,
        participants,
        ...(tour.agePricing ? { guestCounts } : {}),
        contact: { fullName: fullName.trim(), phone: phone.trim() },
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(agencyPromotionPreview ? { agencyPromotionCode: agencyPromotionPreview.code } : {}),
        ...(platformPromotionPreview ? { platformPromotionCode: platformPromotionPreview.code } : {}),
        clientRequestId: clientRequestId.current,
      }).unwrap();
      router.replace(`/settings/history/${created.id}`);
    } catch (error) {
      setErrors({ general: bookingErrorMessage(error, 'Không tạo được đặt chỗ. Vui lòng thử lại.') });
    }
  };

  return (
    <div className="grid gap-6 pb-12 lg:grid-cols-[minmax(0,1fr)_340px]">
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

        {tour.agePricing ? (
          <TourGuestSelector
            value={guestCounts}
            onChange={(next) => {
              setParticipants(guestTotal(next));
              setChildren(next.children);
              setInfants(next.infants);
              clearAllPromotions();
            }}
            max={maxParticipants}
            unitPrice={unitPrice}
            pricing={tour.agePricing}
          />
        ) : (
          <FormField label="Số khách" htmlFor="booking-participants" hint={`Tối đa ${maxParticipants} khách cho ngày khởi hành này.`}>
            <Input
              id="booking-participants"
              type="number"
              min={1}
              max={maxParticipants}
              value={participants}
              onChange={(event) => {
                setParticipants(Number(event.target.value));
                clearAllPromotions();
              }}
            />
          </FormField>
        )}

        {/* ================= KHUYẾN MÃI (CHIA 2 PHẦN: NHÀ CUNG CẤP & NỀN TẢNG) ================= */}
        <div className="space-y-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-brand-teal" />
            <h2 className="text-sm font-bold text-slate-900">Mã giảm giá chuyến đi</h2>
          </div>
          <p className="text-xs text-slate-500">
            Bạn có thể áp dụng đồng thời mã ưu đãi của Nhà cung cấp tour và mã ưu đãi của Nền tảng Tripin.
          </p>

          {/* 1. KHUYẾN MÃI TỪ NHÀ CUNG CẤP */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Building2 className="h-4 w-4 text-indigo-600" />
                Khuyến mãi từ Nhà cung cấp
              </span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                Đại lý tour
              </span>
            </div>

            {agencyPromotionPreview ? (
              <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/80 p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="font-bold text-indigo-950">{agencyPromotionPreview.code}</span>
                    <span className="ml-2 font-semibold text-indigo-700">
                      - {formatVnd(agencyPromotionPreview.discountAmount)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearAgencyPromotion}
                  className="rounded p-1 text-slate-400 hover:bg-indigo-100 hover:text-red-600 transition"
                  title="Gỡ mã"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="booking-agency-promotion"
                    value={agencyPromotionCode}
                    onChange={(e) => {
                      setAgencyPromotionCode(e.target.value.toUpperCase());
                      setAgencyPromotionError(null);
                    }}
                    placeholder="VD: AGENCY10"
                    maxLength={30}
                    autoComplete="off"
                    invalid={Boolean(agencyPromotionError)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void checkAgencyPromotion()}
                    loading={isPreviewingPromotion}
                  >
                    Áp dụng
                  </Button>
                </div>
                {agencyPromotionError && (
                  <p className="text-xs text-red-600">{agencyPromotionError}</p>
                )}

                {/* Gợi ý ưu đãi tự động từ Agency */}
                {availablePromos?.autoAgency && !agencyPromotionPreview && (
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-indigo-300 bg-indigo-50/60 p-2.5 text-xs">
                    <div>
                      <span className="font-bold text-indigo-950">⚡ {availablePromos.autoAgency.title}</span>
                      <p className="text-[11px] text-slate-500">
                        Giảm {availablePromos.autoAgency.discountType === 'PERCENT' ? `${availablePromos.autoAgency.discountValue}%` : formatVnd(availablePromos.autoAgency.discountValue)}
                      </p>
                    </div>
                    {availablePromos.autoAgency.code && (
                      <button
                        type="button"
                        onClick={() => applyQuickAgencyCode(availablePromos.autoAgency!.code!)}
                        className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 transition"
                      >
                        Áp dụng
                      </button>
                    )}
                  </div>
                )}

                {availablePromos?.agency && availablePromos.agency.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[11px] font-medium text-slate-500 mb-1.5">Mã khả dụng của tour này:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availablePromos.agency.filter((p) => Boolean(p.code)).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyQuickAgencyCode(p.code!)}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50/50 px-2 py-1 text-[11px] font-medium text-indigo-800 transition hover:bg-indigo-100"
                        >
                          <Tag className="h-3 w-3 text-indigo-600" />
                          <span>{p.code}</span>
                          <span className="text-slate-500">
                            ({p.discountType === 'PERCENT' ? `-${p.discountValue}%` : `-${formatVnd(p.discountValue)}`})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. KHUYẾN MÃI TỪ NỀN TẢNG TRIPIN */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Sparkles className="h-4 w-4 text-brand-teal" />
                Khuyến mãi từ Nền tảng Tripin
              </span>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                Toàn sàn
              </span>
            </div>

            {platformPromotionPreview ? (
              <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50/80 p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-teal shrink-0" />
                  <div>
                    <span className="font-bold text-teal-950">{platformPromotionPreview.code}</span>
                    <span className="ml-2 font-semibold text-brand-teal">
                      - {formatVnd(platformPromotionPreview.discountAmount)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearPlatformPromotion}
                  className="rounded p-1 text-slate-400 hover:bg-teal-100 hover:text-red-600 transition"
                  title="Gỡ mã"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="booking-platform-promotion"
                    value={platformPromotionCode}
                    onChange={(e) => {
                      setPlatformPromotionCode(e.target.value.toUpperCase());
                      setPlatformPromotionError(null);
                    }}
                    placeholder="VD: TRIPIN2026"
                    maxLength={30}
                    autoComplete="off"
                    invalid={Boolean(platformPromotionError)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void checkPlatformPromotion()}
                    loading={isPreviewingPromotion}
                  >
                    Áp dụng
                  </Button>
                </div>
                {platformPromotionError && (
                  <p className="text-xs text-red-600">{platformPromotionError}</p>
                )}

                {/* Gợi ý ưu đãi tự động từ Tripin Platform */}
                {availablePromos?.autoPlatform && !platformPromotionPreview && (
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-teal-300 bg-teal-50/60 p-2.5 text-xs">
                    <div>
                      <span className="font-bold text-teal-950">⚡ {availablePromos.autoPlatform.title}</span>
                      <p className="text-[11px] text-slate-500">
                        Giảm {availablePromos.autoPlatform.discountType === 'PERCENT' ? `${availablePromos.autoPlatform.discountValue}%` : formatVnd(availablePromos.autoPlatform.discountValue)}
                      </p>
                    </div>
                    {availablePromos.autoPlatform.code && (
                      <button
                        type="button"
                        onClick={() => applyQuickPlatformCode(availablePromos.autoPlatform!.code!)}
                        className="rounded-lg bg-brand-teal px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-700 transition"
                      >
                        Áp dụng
                      </button>
                    )}
                  </div>
                )}

                {/* Danh sách voucher thu thập trong ví của người dùng */}
                {myVouchers && myVouchers.filter((v) => !v.isUsed && v.promotion).length > 0 && (
                  <div className="pt-1.5 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Ticket className="h-3 w-3 text-brand-teal" />
                      Voucher trong ví của bạn:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {myVouchers.filter((v) => !v.isUsed && v.promotion).map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            if (v.promotion?.code) {
                              applyQuickPlatformCode(v.promotion.code);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50/60 px-2 py-1 text-[11px] font-medium text-violet-900 transition hover:bg-violet-100"
                        >
                          <Sparkles className="h-3 w-3 text-violet-600" />
                          <span>{v.promotion!.title}</span>
                          <span className="font-bold text-violet-700">
                            ({v.promotion!.discountType === 'PERCENT' ? `-${v.promotion!.discountValue}%` : `-${formatVnd(v.promotion!.discountValue)}`})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availablePromos?.platform && availablePromos.platform.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[11px] font-medium text-slate-500 mb-1.5">Mã toàn sàn Tripin khả dụng:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availablePromos.platform.filter((p) => Boolean(p.code)).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyQuickPlatformCode(p.code!)}
                          className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50/50 px-2 py-1 text-[11px] font-medium text-teal-900 transition hover:bg-teal-100"
                        >
                          <Tag className="h-3 w-3 text-brand-teal" />
                          <span>{p.code}</span>
                          <span className="text-slate-500">
                            ({p.discountType === 'PERCENT' ? `-${p.discountValue}%` : `-${formatVnd(p.discountValue)}`})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
          {tour.agePricing && (
            <>
              <div className="flex justify-between gap-3"><dt>Người lớn × {guestCounts.adults}</dt><dd>{formatVnd(unitPrice * guestCounts.adults)}</dd></div>
              <div className="flex justify-between gap-3"><dt>Trẻ em × {children}</dt><dd>{formatVnd(Math.round(unitPrice * tour.agePricing.childPercent / 100) * children)}</dd></div>
              <div className="flex justify-between gap-3"><dt>Em bé × {infants}</dt><dd>{formatVnd(Math.round(unitPrice * tour.agePricing.infantPercent / 100) * infants)}</dd></div>
            </>
          )}
          <div className="flex items-center justify-between gap-3 text-slate-600">
            <dt>Tạm tính ({participants} khách)</dt>
            <dd className="font-semibold text-slate-800">{formatVnd(subtotal)}</dd>
          </div>
          {agencyPromotionPreview && (
            <div className="flex items-center justify-between gap-3 text-indigo-700">
              <dt className="flex items-center gap-1">
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Đại lý</span>
                <span>{agencyPromotionPreview.code}</span>
              </dt>
              <dd className="font-semibold">-{formatVnd(agencyPromotionPreview.discountAmount)}</dd>
            </div>
          )}
          {platformPromotionPreview && (
            <div className="flex items-center justify-between gap-3 text-teal-700">
              <dt className="flex items-center gap-1">
                <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">Sàn Tripin</span>
                <span>{platformPromotionPreview.code}</span>
              </dt>
              <dd className="font-semibold">-{formatVnd(platformPromotionPreview.discountAmount)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <dt className="font-semibold text-slate-800">Tổng dự kiến</dt>
            <dd className="text-lg font-extrabold text-primary-container" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatVnd(finalEstimate)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Giá, mã giảm giá và số chỗ được backend kiểm tra lại khi bạn xác nhận đặt chỗ.</p>
      </aside>
    </div>
  );
}
