'use client';
import { ageUnitPrice, calculateGuestPrice, guestTotal, type GuestCounts } from '@travel-platform/constants';
import { usePremiumVouchersQuery } from '@/features/premium/api';
import { TourGuestSelector } from '@/features/tours/components/detail/TourGuestSelector';
import { readSearchGuests } from '@/features/tours/utils/searchContext';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, FormField, Input } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorCode, getApiErrorMessage, selectUser } from '@/features/auth';
import { formatDepartureDate, formatVnd } from '@/lib/travel-format';
import { useGetTourQuery } from '@/features/tours';
import { useAppSelector } from '@/store/hooks';
import { useCreateBookingMutation, useGetAvailablePromotionsQuery, useLazyPreviewPromotionQuery, useGetMyVouchersQuery } from '../api/bookingApi';
import type { PromotionPreview } from '../types';
import { Building2, Calendar, CheckCircle2, ChevronRight, Sparkles, Tag, Ticket, TicketPercent, Users, X } from 'lucide-react';
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
    case 'PENDING_BOOKING_EXISTS':
      return 'Bạn đã có đơn chờ thanh toán cho tour và lịch khởi hành này. Vui lòng thanh toán hoặc hủy đơn đó trước khi đặt thêm.';
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
    case 'PROMOTION_CODE_USED':
      return 'Mã giảm giá này đã được sử dụng. Vui lòng chọn mã khác.';
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
  const premiumVouchers = usePremiumVouchersQuery(user?.id ?? '', { skip: !user || user.role !== 'TRAVELER' });
  const [premiumVoucherId, setPremiumVoucherId] = useState('');
  const tourId = params.get('tourId') ?? '';
  const departureId = params.get('departureId') ?? '';

  const { data: tour, isLoading: isTourLoading, isError: isTourError, refetch: refetchTour } = useGetTourQuery(tourId, {
    skip: !tourId,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const { data: availablePromos } = useGetAvailablePromotionsQuery({ tourId }, { skip: !tourId });
  const { data: myVouchers } = useGetMyVouchersQuery(undefined, { skip: !user });
  const [createBooking, { isLoading: isSubmitting }] = useCreateBookingMutation();
  const [isCheckingBooking, setIsCheckingBooking] = useState(false);
  const submissionInFlight = useRef(false);
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

  // Synchronize guest counts from params or fallback
  const [guests, setGuests] = useState<GuestCounts>(() => {
    const parsed = readSearchGuests(params);
    const p = Number(params.get('participants'));
    if (parsed.adults === 1 && parsed.children === 0 && parsed.infants === 0 && Number.isInteger(p) && p > 1) {
      return { adults: p, children: 0, infants: 0 };
    }
    return parsed;
  });

  const participants = guestTotal(guests);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; general?: string }>({});
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const clientRequestId = useRef(retryKey());

  const voucherList = useMemo(() => {
    if (!myVouchers) return [];
    if (Array.isArray(myVouchers)) return myVouchers;
    if (Array.isArray((myVouchers as any).data)) return (myVouchers as any).data;
    if (Array.isArray((myVouchers as any).items)) return (myVouchers as any).items;
    return [];
  }, [myVouchers]);

  const myAgencyVouchers = useMemo(() => {
    if (!voucherList.length) return [];
    const now = Date.now();
    return voucherList.filter((v: any) => {
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
  }, [voucherList, tour?.agency?.id, tour?.agencyId, tourId]);

  const myPlatformVouchers = useMemo(() => {
    if (!voucherList.length) return [];
    const now = Date.now();
    return voucherList.filter((v: any) => {
      if (v.isUsed || !v.promotion || !v.promotion.code) return false;
      const promo = v.promotion;
      if (!promo.isActive) return false;
      if (new Date(promo.endsAt).getTime() <= now) return false;
      if (promo.scope !== 'PLATFORM') return false;
      if (promo.targetTourIds?.length && !promo.targetTourIds.includes(tourId)) return false;
      return true;
    });
  }, [voucherList, tourId]);

  useEffect(() => {
    if (user?.fullName && !fullName) setFullName(user.fullName);
    if (user?.phone && !phone) setPhone(user.phone);
  }, [user, fullName, phone]);

  useEffect(() => {
    if (tour && !tour.agePricing && (guests.children > 0 || guests.infants > 0)) {
      setGuests((prev) => ({
        adults: prev.adults + prev.children + prev.infants,
        children: 0,
        infants: 0,
      }));
    }
  }, [tour, guests.children, guests.infants]);

  const handleSelectPremiumVoucher = (id: string) => {
    setPremiumVoucherId(id);
    clearAgencyPromotion();
    clearPlatformPromotion();
  };

  const handleClearPremiumVoucher = () => {
    setPremiumVoucherId('');
  };

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
    setPremiumVoucherId('');
  };

  const checkAgencyPromotion = async (codeToUse?: string, currentSubtotal?: number): Promise<PromotionPreview | boolean> => {
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
      return preview;
    } catch (error) {
      setAgencyPromotionPreview(null);
      setAgencyPromotionError(bookingErrorMessage(error, 'Không thể áp dụng mã ưu đãi của nhà cung cấp này.'));
      return false;
    }
  };

  const checkPlatformPromotion = async (codeToUse?: string, currentSubtotal?: number, agencyDiscountAmount = agencyPromotionPreview?.discountAmount ?? 0): Promise<PromotionPreview | boolean> => {
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
    const orderSubtotal = Math.max(0, (currentSubtotal ?? subtotal) - agencyDiscountAmount);
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
      return preview;
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
  let subtotal = 0;
  let pricingError = '';
  try {
    subtotal = calculateGuestPrice(unitPrice, participants, guests, tour.agePricing).subtotal;
  } catch {
    pricingError = 'Vui lòng kiểm tra số khách và chính sách độ tuổi của tour.';
  }

  const agencyDiscount = agencyPromotionPreview?.discountAmount ?? 0;
  const platformDiscount = platformPromotionPreview?.discountAmount ?? 0;
  const chosenPremium = premiumVouchers.currentData?.find(
    (v) =>
      v.id === premiumVoucherId &&
      !v.heldAt &&
      v.terms.tourIds.includes(tourId) &&
      new Date(v.endsAt) > new Date() &&
      subtotal >= v.terms.minOrderAmount,
  );
  const premiumDiscount = chosenPremium
    ? Math.min(
        subtotal,
        chosenPremium.terms.discountType === 'PERCENT'
          ? Math.min(
              Math.floor((subtotal * chosenPremium.terms.discountValue) / 100),
              chosenPremium.terms.maxDiscountAmount ?? subtotal,
            )
          : chosenPremium.terms.discountValue,
      )
    : 0;
  const totalDiscount = premiumVoucherId ? premiumDiscount : agencyDiscount + platformDiscount;
  const finalEstimate = Math.max(0, subtotal - totalDiscount);

  const maxParticipants = Math.min(MAX_PARTICIPANTS, departure.remaining);
  const departureDate = departure.date;

  const submitBooking = async () => {
    setPendingBookingId(null);
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
      if (
        !latestDeparture ||
        !latestDeparture.isOpen ||
        latestDeparture.remaining < 1 ||
        new Date(latestDeparture.date).getTime() <= Date.now()
      ) {
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
    if (pricingError) {
      setErrors({ general: pricingError });
      return;
    }
    let latestSubtotal = 0;
    try {
      latestSubtotal = calculateGuestPrice(latestUnitPrice, participants, guests, latestAgePricing).subtotal;
    } catch {
      setErrors({ general: 'Chính sách giá đã thay đổi. Vui lòng chọn lại hành khách.' });
      return;
    }

    if (
      premiumVoucherId &&
      (!chosenPremium || agencyPromotionCode.trim() || platformPromotionCode.trim())
    ) {
      setErrors({
        general: 'Voucher Premium không cộng với mã khác. Hãy xóa mã hoặc bỏ chọn voucher.',
      });
      return;
    }
    let checkedAgency: PromotionPreview | undefined;
    let checkedPlatform: PromotionPreview | undefined;
    if (!premiumVoucherId && agencyPromotionCode.trim()) {
      const result = await checkAgencyPromotion(agencyPromotionCode.trim(), latestSubtotal);
      if (!result || typeof result !== 'object') return;
      checkedAgency = result;
    }
    if (!premiumVoucherId && platformPromotionCode.trim()) {
      const result = await checkPlatformPromotion(
        platformPromotionCode.trim(),
        latestSubtotal,
        checkedAgency?.discountAmount ?? 0,
      );
      if (!result || typeof result !== 'object') return;
      checkedPlatform = result;
    }

    try {
      const created = await createBooking({
        tourId,
        departureId,
        participants,
        ...(tour.agePricing ? { guestCounts: guests } : {}),
        contact: { fullName: fullName.trim(), phone: phone.trim() },
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(premiumVoucherId ? { premiumVoucherId } : {}),
        ...(checkedAgency ? { agencyPromotionCode: checkedAgency.code } : {}),
        ...(checkedPlatform ? { platformPromotionCode: checkedPlatform.code } : {}),
        clientRequestId: clientRequestId.current,
      }).unwrap();
      router.replace(`/settings/history/${created.id}`);
    } catch (error) {
      if (getApiErrorCode(error) === 'PENDING_BOOKING_EXISTS') {
        const details = (error as { data?: { error?: { details?: { bookingId?: string } } } })?.data?.error?.details;
        if (details?.bookingId) setPendingBookingId(details.bookingId);
      }
      setErrors({ general: bookingErrorMessage(error, 'Không tạo được đặt chỗ. Vui lòng thử lại.') });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setIsCheckingBooking(true);
    try {
      await submitBooking();
    } finally {
      submissionInFlight.current = false;
      setIsCheckingBooking(false);
    }
  };

  return (
    <div className="grid gap-6 pb-12 lg:grid-cols-[minmax(0,1fr)_360px]">
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

        {/* Số lượng khách theo nhóm tuổi */}
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Số lượng hành khách</h2>
              <p className="text-xs text-slate-500">Mỗi hành khách, kể cả em bé, được tính một chỗ ngồi</p>
            </div>
            <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              Tổng {participants} / {maxParticipants} chỗ
            </span>
          </div>
          <TourGuestSelector
            value={guests}
            onChange={(next) => {
              setGuests(next);
              clearAllPromotions();
            }}
            max={maxParticipants}
            unitPrice={unitPrice}
            pricing={tour.agePricing}
          />
        </div>

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
                  {(agencyPromotionPreview || platformPromotionPreview || chosenPremium) && (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                      Đã áp dụng {(chosenPremium ? 1 : 0) + (agencyPromotionPreview ? 1 : 0) + (platformPromotionPreview ? 1 : 0)} voucher
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
              <span>{agencyPromotionPreview || platformPromotionPreview || chosenPremium ? 'Thay đổi' : 'Chọn hoặc nhập mã'}</span>
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>

          {/* Applied voucher chips with direct remove button */}
          {(agencyPromotionPreview || platformPromotionPreview || chosenPremium) && (
            <div className="mt-3.5 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {chosenPremium && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 py-1 pl-2.5 pr-1.5 text-xs">
                  <Sparkles className="size-3.5 text-amber-600" />
                  <span className="font-bold text-amber-900">{chosenPremium.terms.title}</span>
                  <span className="font-semibold text-amber-700">(-{formatVnd(premiumDiscount)})</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPremiumVoucherId('');
                    }}
                    className="ml-1 rounded p-0.5 text-slate-400 hover:bg-amber-100 hover:text-red-600 transition"
                    title="Bỏ chọn voucher Premium"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

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
          tourId={tourId}
          agencyPromotionCode={agencyPromotionCode}
          agencyPromotionPreview={agencyPromotionPreview}
          agencyPromotionError={agencyPromotionError}
          onApplyAgencyCode={async (code) => Boolean(await checkAgencyPromotion(code, subtotal))}
          onClearAgencyCode={clearAgencyPromotion}
          platformPromotionCode={platformPromotionCode}
          platformPromotionPreview={platformPromotionPreview}
          platformPromotionError={platformPromotionError}
          onApplyPlatformCode={async (code) => Boolean(await checkPlatformPromotion(code, subtotal))}
          onClearPlatformCode={clearPlatformPromotion}
          premiumVouchers={premiumVouchers.currentData}
          premiumVoucherId={premiumVoucherId}
          onSelectPremiumVoucher={handleSelectPremiumVoucher}
          onClearPremiumVoucher={handleClearPremiumVoucher}
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
        {pendingBookingId && <Link href={`/settings/history/${encodeURIComponent(pendingBookingId)}`} className="inline-block text-sm font-semibold text-primary underline">Mở đơn đang chờ thanh toán</Link>}
        <Button type="submit" className="w-full" loading={isSubmitting || isCheckingBooking}>Xác nhận đặt chỗ</Button>
      </form>

      {/* Right Sidebar: Preview Card */}
      <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-base font-bold text-slate-900 mb-3.5">Chuyến đi của bạn</h2>

        {/* Tour thumbnail & title preview */}
        <div className="flex gap-3 pb-3 border-b border-slate-100">
          <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100">
            <img
              src={tour.coverImage || tour.images?.[0] || '/images/default-tour.png'}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <span className="inline-block rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 w-fit mb-1">
              {tour.durationDays > 1 ? `${tour.durationDays}N${tour.durationDays - 1}Đ` : 'Trong ngày'} · {tour.destination}
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2" title={title}>
              {title}
            </h3>
          </div>
        </div>

        {/* Departure info */}
        <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50/80 p-3 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-slate-400" />
              <span>Khởi hành:</span>
            </span>
            <span className="font-semibold text-slate-900">{formatDepartureDate(departureDate)}</span>
          </div>
          {unitPrice != null && (
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <Tag className="size-3.5 text-slate-400" />
                <span>Giá tiêu chuẩn:</span>
              </span>
              <span className="font-semibold text-slate-900">{formatVnd(unitPrice)} / khách</span>
            </div>
          )}
        </div>

        {/* Passenger and Pricing Breakdown */}
        <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs sm:text-sm">
          <div className="flex justify-between gap-2 text-slate-600">
            <dt>Người lớn × {guests.adults}</dt>
            <dd className="font-medium text-slate-800">{formatVnd(unitPrice * guests.adults)}</dd>
          </div>
          {guests.children > 0 && (
            <div className="flex justify-between gap-2 text-slate-600">
              <dt>Trẻ em × {guests.children}</dt>
              <dd className="font-medium text-slate-800">
                {formatVnd((ageUnitPrice(unitPrice, tour.agePricing, 'child') ?? unitPrice) * guests.children)}
              </dd>
            </div>
          )}
          {guests.infants > 0 && (
            <div className="flex justify-between gap-2 text-slate-600">
              <dt>Em bé × {guests.infants}</dt>
              <dd className="font-medium text-slate-800">
                {formatVnd((ageUnitPrice(unitPrice, tour.agePricing, 'infant') ?? 0) * guests.infants)}
              </dd>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-dashed border-slate-100 pt-2 text-slate-600">
            <dt>Tạm tính ({participants} khách)</dt>
            <dd className="font-semibold text-slate-800">{formatVnd(subtotal)}</dd>
          </div>

          {/* Applied Vouchers */}
          {chosenPremium && (
            <div className="flex items-center justify-between gap-2 text-amber-700">
              <dt className="flex items-center gap-1.5 min-w-0 max-w-[65%]">
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">Premium</span>
                <span className="truncate font-medium text-amber-950" title={chosenPremium.terms.title}>
                  {chosenPremium.terms.title}
                </span>
              </dt>
              <dd className="shrink-0 font-bold whitespace-nowrap text-amber-600">
                -{formatVnd(premiumDiscount)}
              </dd>
            </div>
          )}

          {agencyPromotionPreview && (
            <div className="flex items-center justify-between gap-2 text-indigo-700">
              <dt className="flex items-center gap-1.5 min-w-0 max-w-[65%]">
                <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">Đại lý</span>
                <span className="truncate font-medium text-indigo-950" title={agencyPromotionPreview.code}>
                  {agencyPromotionPreview.code}
                </span>
              </dt>
              <dd className="shrink-0 font-bold whitespace-nowrap text-indigo-600">
                -{formatVnd(agencyPromotionPreview.discountAmount)}
              </dd>
            </div>
          )}

          {platformPromotionPreview && (
            <div className="flex items-center justify-between gap-2 text-teal-700">
              <dt className="flex items-center gap-1.5 min-w-0 max-w-[65%]">
                <span className="shrink-0 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">Sàn Tripin</span>
                <span className="truncate font-medium text-teal-950" title={platformPromotionPreview.code}>
                  {platformPromotionPreview.code}
                </span>
              </dt>
              <dd className="shrink-0 font-bold whitespace-nowrap text-teal-600">
                -{formatVnd(platformPromotionPreview.discountAmount)}
              </dd>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <dt className="font-bold text-slate-900">Tổng dự kiến</dt>
            <dd className="text-xl font-extrabold text-teal-700 shrink-0 whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatVnd(finalEstimate)}
            </dd>
          </div>
        </dl>

        <p className="mt-3.5 text-[11px] leading-relaxed text-slate-400">
          Giá, mã giảm giá và số chỗ được backend kiểm tra lại khi bạn xác nhận đặt chỗ.
        </p>
      </aside>
    </div>
  );
}
