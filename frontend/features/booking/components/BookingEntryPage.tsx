'use client';
import { usePremiumVouchersQuery } from '@/features/premium/api';
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
import { Building2, CheckCircle2, ChevronRight, Sparkles, Tag, Ticket, TicketPercent, X } from 'lucide-react';
import { handlePromotionCodeChange, handlePromotionCodeKeyDown } from '@/features/promotions/codeHelper';
import { ShopeePromotionModal } from './ShopeePromotionModal';

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
  const premiumVouchers = usePremiumVouchersQuery(user?.id ?? '',{ skip: !user || user.role !== 'TRAVELER' });
  const [premiumVoucherId,setPremiumVoucherId] = useState('');
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

  const [voucherModalOpen, setVoucherModalOpen] = useState(false);

  const [participants, setParticipants] = useState(
    Number.isFinite(participantsParam) && participantsParam > 0 ? participantsParam : 1,
  );
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; general?: string }>({});
  const [children, setChildren] = useState(() => Math.max(0, Number(params.get('children')) || 0));
  const [infants, setInfants] = useState(() => Math.max(0, Number(params.get('infants')) || 0));
  const clientRequestId = useRef(retryKey());

  const myAgencyVouchers = useMemo(() => {
    if (!myVouchers) return [];
    const now = Date.now();
    return myVouchers.filter((v) => {
      if (v.isUsed || !v.promotion || !v.promotion.code) return false;
      const promo = v.promotion;
      if (!promo.isActive) return false;
      if (new Date(promo.endsAt).getTime() <= now) return false;
      if (promo.scope !== 'AGENCY') return false;
      const currentAgencyId = tour?.agency?.id || tour?.agencyId;
      if (promo.ownerId && currentAgencyId && promo.ownerId !== currentAgencyId) return false;
      if (promo.targetTourIds?.length && !promo.targetTourIds.includes(tourId)) return false;
      return true;
    });
  }, [myVouchers, tour?.agency?.id, tour?.agencyId, tourId]);

  const myPlatformVouchers = useMemo(() => {
    if (!myVouchers) return [];
    const now = Date.now();
    return myVouchers.filter((v) => {
      if (v.isUsed || !v.promotion || !v.promotion.code) return false;
      const promo = v.promotion;
      if (!promo.isActive) return false;
      if (new Date(promo.endsAt).getTime() <= now) return false;
      if (promo.scope !== 'PLATFORM') return false;
      if (promo.targetTourIds?.length && !promo.targetTourIds.includes(tourId)) return false;
      return true;
    });
  }, [myVouchers, tourId]);

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
      setAgencyPromotionCode(code);
      setPremiumVoucherId('');
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
      setPlatformPromotionCode(code);
      setPremiumVoucherId('');
      setPlatformPromotionPreview(preview);
      setPlatformPromotionError(null);
      return true;
    } catch (error) {
      setPlatformPromotionPreview(null);
      setPlatformPromotionError(bookingErrorMessage(error, 'Không thể áp dụng mã ưu đãi của sàn Tripin này.'));
      return false;
    }
  };

  const handleApplyDirectCode = async (code: string): Promise<{ success: boolean; message?: string }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return { success: false, message: 'Vui lòng nhập mã voucher.' };
    if (!PROMOTION_CODE_PATTERN.test(cleanCode)) {
      return { success: false, message: 'Mã gồm 3–30 ký tự: chữ cái, số, dấu gạch ngang hoặc gạch dưới.' };
    }

    try {
      const preview = await previewPromotion({ code: cleanCode, tourId, subtotal }).unwrap();
      if (preview.scope === 'AGENCY') {
        if (preview.finalAmount < 1) {
          return { success: false, message: 'Mã giảm giá khiến tổng thanh toán không hợp lệ.' };
        }
        setAgencyPromotionCode(cleanCode);
        setPremiumVoucherId('');
      setAgencyPromotionPreview(preview);
        setAgencyPromotionError(null);
        return { success: true, message: `Đã áp dụng mã nhà cung cấp ${cleanCode} (-${formatVnd(preview.discountAmount)})` };
      } else {
        const orderSubtotal = Math.max(0, subtotal - (agencyPromotionPreview?.discountAmount ?? 0));
        const platformPreview = await previewPromotion({ code: cleanCode, tourId, subtotal: orderSubtotal }).unwrap();
        if (platformPreview.finalAmount < 1) {
          return { success: false, message: 'Mã giảm giá khiến tổng thanh toán không hợp lệ.' };
        }
        setPlatformPromotionCode(cleanCode);
        setPremiumVoucherId('');
        setPlatformPromotionPreview(platformPreview);
        setPlatformPromotionError(null);
        return { success: true, message: `Đã áp dụng mã toàn sàn Tripin ${cleanCode} (-${formatVnd(platformPreview.discountAmount)})` };
      }
    } catch (error) {
      return { success: false, message: bookingErrorMessage(error, 'Không thể áp dụng mã ưu đãi này.') };
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
  const chosenPremium = premiumVouchers.currentData?.find(v => v.id === premiumVoucherId && !v.heldAt && v.terms.tourIds.includes(tourId) && new Date(v.endsAt) > new Date() && subtotal >= v.terms.minOrderAmount);
  const premiumDiscount = chosenPremium ? Math.min(subtotal,chosenPremium.terms.discountType === 'PERCENT' ? Math.min(Math.floor(subtotal * chosenPremium.terms.discountValue / 100), chosenPremium.terms.maxDiscountAmount ?? subtotal) : chosenPremium.terms.discountValue) : 0;
  const totalDiscount = premiumVoucherId ? premiumDiscount : agencyDiscount + platformDiscount;
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

    if (premiumVoucherId && (!chosenPremium || agencyPromotionCode.trim() || platformPromotionCode.trim())) { setErrors({ general:'Voucher Premium không cộng với mã khác. Hãy xóa mã hoặc bỏ chọn voucher.' }); return; }
    if (!premiumVoucherId && agencyPromotionCode.trim() && !(await checkAgencyPromotion(agencyPromotionCode.trim(), latestSubtotal))) return;
    const subtotalAfterAgency = Math.max(0, latestSubtotal - (agencyPromotionPreview?.discountAmount ?? 0));
    if (!premiumVoucherId && platformPromotionCode.trim() && !(await checkPlatformPromotion(platformPromotionCode.trim(), subtotalAfterAgency))) return;

    try {
      const created = await createBooking({
        tourId,
        departureId,
        participants,
        ...(tour.agePricing ? { guestCounts } : {}),
        contact: { fullName: fullName.trim(), phone: phone.trim() },
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(premiumVoucherId ? { premiumVoucherId } : {}),
        ...(!premiumVoucherId && agencyPromotionPreview ? { agencyPromotionCode: agencyPromotionPreview.code } : {}),
        ...(!premiumVoucherId && platformPromotionPreview ? { platformPromotionCode: platformPromotionPreview.code } : {}),
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
        <div className="space-y-2 border-b border-amber-200 pb-4"><label htmlFor="premium-booking-voucher" className="text-sm font-semibold text-amber-900">Voucher Premium</label>{premiumVouchers.isError ? <p role="alert" className="text-sm text-red-800">Không tải được voucher. <button type="button" className="underline" onClick={() => void premiumVouchers.refetch()}>Thử lại</button></p> : <select id="premium-booking-voucher" className="w-full rounded-lg border border-amber-300 bg-white p-3 text-sm" value={premiumVoucherId} onChange={e => { setPremiumVoucherId(e.target.value); if(e.target.value) { clearAgencyPromotion();clearPlatformPromotion(); } }}><option value="">Không dùng voucher Premium</option>{premiumVouchers.currentData?.filter(v => !v.heldAt && v.terms.tourIds.includes(tourId) && new Date(v.endsAt) > new Date() && subtotal >= v.terms.minOrderAmount).map(v => <option key={v.id} value={v.id}>{v.terms.title} · Hạn {new Date(v.endsAt).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</option>)}</select>}<p className="text-xs text-slate-600">Mỗi đơn dùng một voucher Premium, không cộng với mã khác.{premiumVoucherId && ` Giảm dự kiến ${formatVnd(premiumDiscount)}.`}</p></div>
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

        {/* ================= TRIPIN VOUCHER BAR (SHOPEE STYLE) ================= */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-4.5 shadow-xs transition hover:border-slate-300">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setVoucherModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setVoucherModalOpen(true);
              }
            }}
            className="flex items-center justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-teal ring-1 ring-teal-500/20 group-hover:bg-brand-teal group-hover:text-white transition-colors">
                <TicketPercent className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">Tripin Voucher</span>
                  {(agencyPromotionPreview || platformPromotionPreview) && (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                      Đã áp dụng {(agencyPromotionPreview ? 1 : 0) + (platformPromotionPreview ? 1 : 0)} mã
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {totalDiscount > 0
                    ? `Tiết kiệm ${formatVnd(totalDiscount)} cho chuyến đi`
                    : 'Chọn hoặc nhập mã giảm giá nhà cung cấp & nền tảng'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-teal group-hover:text-teal-700 transition">
              <span>{agencyPromotionPreview || platformPromotionPreview ? 'Thay đổi' : 'Chọn hoặc nhập mã'}</span>
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>

          {/* Applied voucher chips with direct remove button */}
          {(agencyPromotionPreview || platformPromotionPreview) && (
            <div className="mt-3.5 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {agencyPromotionPreview && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 py-1 pl-2.5 pr-1.5 text-xs">
                  <Building2 className="size-3.5 text-indigo-600" />
                  <span className="font-bold text-indigo-900">{agencyPromotionPreview.code}</span>
                  <span className="font-semibold text-indigo-700">(-{formatVnd(agencyPromotionPreview.discountAmount)})</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAgencyPromotion();
                    }}
                    className="ml-1 rounded p-0.5 text-slate-400 hover:bg-indigo-100 hover:text-red-600 transition"
                    title="Bỏ chọn mã"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              {platformPromotionPreview && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50/70 py-1 pl-2.5 pr-1.5 text-xs">
                  <Sparkles className="size-3.5 text-brand-teal" />
                  <span className="font-bold text-teal-900">{platformPromotionPreview.code}</span>
                  <span className="font-semibold text-teal-700">(-{formatVnd(platformPromotionPreview.discountAmount)})</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearPlatformPromotion();
                    }}
                    className="ml-1 rounded p-0.5 text-slate-400 hover:bg-teal-100 hover:text-red-600 transition"
                    title="Bỏ chọn mã"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Shopee Voucher Selection & Search Modal */}
        <ShopeePromotionModal
          open={voucherModalOpen}
          onClose={() => setVoucherModalOpen(false)}
          subtotal={subtotal}
          agencyPromotionCode={agencyPromotionCode}
          agencyPromotionPreview={agencyPromotionPreview}
          agencyPromotionError={agencyPromotionError}
          onApplyAgencyCode={async (code) => checkAgencyPromotion(code, subtotal)}
          onClearAgencyCode={clearAgencyPromotion}
          platformPromotionCode={platformPromotionCode}
          platformPromotionPreview={platformPromotionPreview}
          platformPromotionError={platformPromotionError}
          onApplyPlatformCode={async (code) => checkPlatformPromotion(code, subtotal)}
          onClearPlatformCode={clearPlatformPromotion}
          onApplyDirectCode={handleApplyDirectCode}
          availablePromos={availablePromos}
          myAgencyVouchers={myAgencyVouchers}
          myPlatformVouchers={myPlatformVouchers}
          isPreviewing={isPreviewingPromotion}
        />

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
