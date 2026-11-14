'use client';
import { ageUnitPrice, calculateGuestPrice, guestTotal, type GuestCounts } from '@travel-platform/constants';
import { usePremiumVouchersQuery } from '@/features/premium/api';
import { readSearchGuests } from '@/features/tours/utils/searchContext';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, AntSelect, Checkbox } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorCode, getApiErrorMessage, selectUser } from '@/features/auth';
import { formatDepartureDate, formatVnd } from '@/lib/travel-format';
import { useGetTourQuery } from '@/features/tours';
import { useAppSelector } from '@/store/hooks';
import { useCreateBookingMutation, useGetAvailablePromotionsQuery, useLazyPreviewPromotionQuery, useGetMyVouchersQuery } from '../api/bookingApi';
import { useCheckoutBookingMutation } from '@/features/payment/api/paymentApi';
import type { PromotionPreview } from '../types';
import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  X,
} from 'lucide-react';
import { ShopeePromotionModal } from './ShopeePromotionModal';

const PHONE_PATTERN = /^\+?[0-9 ().-]{6,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROMOTION_CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;
const MAX_PARTICIPANTS = 50;

function retryKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().replace(/-/g, '');
  return `retry${Date.now()}`;
}

function formatPillDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatCompactPrice(price: number): string {
  if (price >= 1_000_000) {
    const tr = price / 1_000_000;
    return `${tr % 1 === 0 ? tr : tr.toFixed(1).replace('.', ',')}tr`;
  }
  if (price >= 1_000) {
    return `${Math.round(price / 1000)}k`;
  }
  return formatVnd(price);
}

function formatReturnDate(iso?: string, durationDays?: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = typeof durationDays === 'number' && !Number.isNaN(durationDays) ? Math.max(1, durationDays) : 1;
  const returnDate = new Date(d.getTime() + Math.max(0, days - 1) * 86400000);
  if (Number.isNaN(returnDate.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(returnDate);
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

interface PassengerItem {
  fullName: string;
  gender: string;
  birthYear: string;
  idCard: string;
  nationality: string;
  pickupPoint: string;
  specialNotes: string;
}

export function BookingEntryPage() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useAppSelector(selectUser);
  const premiumVouchers = usePremiumVouchersQuery(user?.id ?? '', { skip: !user || user.role !== 'TRAVELER' });
  const [premiumVoucherId, setPremiumVoucherId] = useState('');
  const tourId = params.get('tourId') ?? '';
  const initialDepartureId = params.get('departureId') ?? '';
  const [selectedDepartureId, setSelectedDepartureId] = useState(initialDepartureId);

  // 3-step wizard: 1 - Chọn dịch vụ, 2 - Thông tin khách, 3 - Thanh toán
  const initialStepParam = Number(params.get('step'));
  const [step, setStep] = useState<number>(initialStepParam >= 1 && initialStepParam <= 3 ? initialStepParam : 1);

  const { data: tour, isLoading: isTourLoading, isError: isTourError, refetch: refetchTour } = useGetTourQuery(tourId, {
    skip: !tourId,
    refetchOnMountOrArgChange: 30,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const { data: availablePromos } = useGetAvailablePromotionsQuery({ tourId }, { skip: !tourId });
  const { data: myVouchers } = useGetMyVouchersQuery(undefined, { skip: !user });
  const [createBooking, { isLoading: isSubmitting }] = useCreateBookingMutation();
  const [checkoutBooking, { isLoading: isPaying }] = useCheckoutBookingMutation();
  const [isCheckingBooking, setIsCheckingBooking] = useState(false);
  const submissionInFlight = useRef(false);
  const [previewPromotion, { isFetching: isPreviewingPromotion }] = useLazyPreviewPromotionQuery();

  // Active departure
  const effectiveDepartureId = selectedDepartureId || initialDepartureId;
  const departure = useMemo(
    () => tour?.departures.find((d) => d.id === effectiveDepartureId),
    [effectiveDepartureId, tour],
  );

  const availableDepartures = useMemo(() => {
    if (!tour?.departures) return [];
    return tour.departures.filter(
      (d) => d.isOpen && d.remaining > 0 && new Date(d.date).getTime() > Date.now(),
    );
  }, [tour?.departures]);

  const departureAvailable = Boolean(
    departure && departure.isOpen && departure.remaining > 0 && new Date(departure.date).getTime() > Date.now(),
  );

  // Step 1: Guest counts
  const [guests, setGuests] = useState<GuestCounts>(() => {
    const parsed = readSearchGuests(params);
    const p = Number(params.get('participants'));
    if (parsed.adults === 1 && parsed.children === 0 && parsed.infants === 0 && Number.isInteger(p) && p > 1) {
      return { adults: p, children: 0, infants: 0 };
    }
    return parsed;
  });

  const participants = guestTotal(guests);
  const maxParticipants = departure ? Math.min(MAX_PARTICIPANTS, departure.remaining) : MAX_PARTICIPANTS;

  // Step 2: Contact information - User MUST manually fill, NOT auto-filled
  const [fullName, setFullName] = useState(() => (initialStepParam === 3 ? (user?.fullName ?? '') : ''));
  const [contactGender, setContactGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [phone, setPhone] = useState(() => (initialStepParam === 3 ? (user?.phone ?? '') : ''));
  const [email, setEmail] = useState(() => (initialStepParam === 3 ? (user?.email ?? '') : ''));
  const [country, setCountry] = useState('Việt Nam');

  // Step 2: Passengers roster (optional per user request)
  const [passengers, setPassengers] = useState<PassengerItem[]>(() =>
    Array.from({ length: Math.max(1, participants) }, () => ({
      fullName: '',
      gender: 'Nam',
      birthYear: '',
      idCard: '',
      nationality: 'Việt Nam',
      pickupPoint: '',
      specialNotes: '',
    })),
  );

  // Sync passenger roster size with participants count
  useEffect(() => {
    setPassengers((prev) => {
      if (prev.length === participants) return prev;
      if (prev.length < participants) {
        const added = Array.from({ length: participants - prev.length }, () => ({
          fullName: '',
          gender: 'Nam',
          birthYear: '',
          idCard: '',
          nationality: 'Việt Nam',
          pickupPoint: '',
          specialNotes: '',
        }));
        return [...prev, ...added];
      }
      return prev.slice(0, participants);
    });
  }, [participants]);

  // Step 3: VAT Invoice & Agreement
  const [needVatInvoice, setNeedVatInvoice] = useState(false);
  const [vatCompany, setVatCompany] = useState('');
  const [vatTaxId, setVatTaxId] = useState('');
  const [vatAddress, setVatAddress] = useState('');
  const [vatEmail, setVatEmail] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(() => initialStepParam === 3);

  const [notes, setNotes] = useState('');

  // Separated promotions state
  const [agencyPromotionCode, setAgencyPromotionCode] = useState('');
  const [agencyPromotionPreview, setAgencyPromotionPreview] = useState<PromotionPreview | null>(null);
  const [agencyPromotionError, setAgencyPromotionError] = useState<string | null>(null);

  const [platformPromotionCode, setPlatformPromotionCode] = useState('');
  const [platformPromotionPreview, setPlatformPromotionPreview] = useState<PromotionPreview | null>(null);
  const [platformPromotionError, setPlatformPromotionError] = useState<string | null>(null);

  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; email?: string; general?: string }>({});
  const [alertModal, setAlertModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
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

  const checkPlatformPromotion = async (
    codeToUse?: string,
    currentSubtotal?: number,
    agencyDiscountAmount = agencyPromotionPreview?.discountAmount ?? 0,
  ): Promise<PromotionPreview | boolean> => {
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

  if (!tourId || !effectiveDepartureId) {
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
  const departureDate = departure.date;

  const childPrice = ageUnitPrice(unitPrice, tour.agePricing, 'child') ?? unitPrice;
  const infantPrice = ageUnitPrice(unitPrice, tour.agePricing, 'infant') ?? 0;

  // Step 1 -> Step 2 validation
  const handleNextToStep2 = () => {
    setErrors({});
    if (participants < 1) {
      setErrors({ general: 'Vui lòng chọn ít nhất 1 hành khách người lớn.' });
      return;
    }
    if (participants > maxParticipants) {
      setErrors({ general: `Số chỗ trống hiện tại chỉ còn ${maxParticipants} chỗ.` });
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2 -> Step 3 validation: Priority Họ tên -> SĐT -> Email with Alert Modal & Red Highlight
  const handleNextToStep3 = () => {
    const next: typeof errors = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      next.fullName = 'Vui lòng nhập họ và tên';
      setErrors(next);
      setAlertModal({ open: true, message: 'Vui lòng nhập họ tên liên hệ.' });
      return;
    }

    if (!phone.trim() || !PHONE_PATTERN.test(phone.trim())) {
      next.phone = 'Vui lòng nhập số điện thoại';
      setErrors(next);
      setAlertModal({ open: true, message: 'Vui lòng nhập số điện thoại liên hệ.' });
      return;
    }

    if (!email.trim() || !EMAIL_PATTERN.test(email.trim())) {
      next.email = 'Vui lòng nhập email';
      setErrors(next);
      setAlertModal({ open: true, message: 'Vui lòng nhập email liên hệ.' });
      return;
    }

    setErrors({});
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitBooking = async () => {
    setPendingBookingId(null);
    const next: typeof errors = {};
    if (fullName.trim().length < 2) next.fullName = 'Vui lòng nhập họ tên (ít nhất 2 ký tự).';
    if (!PHONE_PATTERN.test(phone.trim())) next.phone = 'Số điện thoại không hợp lệ.';
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) next.email = 'Email không hợp lệ.';
    if (!Number.isInteger(participants) || participants < 1 || participants > maxParticipants) {
      next.general = `Số khách phải từ 1 đến ${maxParticipants}.`;
    }
    if (!agreedToTerms) {
      next.general = 'Vui lòng đọc và đồng ý với điều khoản dịch vụ để tiếp tục.';
    }
    if (needVatInvoice) {
      if (!vatCompany.trim()) {
        next.general = 'Vui lòng nhập tên công ty / tổ chức nhận hóa đơn GTGT.';
      } else if (!vatTaxId.trim()) {
        next.general = 'Vui lòng nhập mã số thuế nhận hóa đơn GTGT.';
      } else if (!vatEmail.trim() || !EMAIL_PATTERN.test(vatEmail.trim())) {
        next.general = 'Vui lòng nhập email nhận hóa đơn GTGT hợp lệ.';
      } else if (!vatAddress.trim()) {
        next.general = 'Vui lòng nhập địa chỉ công ty nhận hóa đơn GTGT.';
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    let latestUnitPrice: number | undefined;
    let latestAgePricing = tour.agePricing;
    try {
      const refreshedTour = await refetchTour().unwrap();
      latestAgePricing = refreshedTour.agePricing;
      const latestDeparture = refreshedTour.departures.find((d) => d.id === effectiveDepartureId);
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

    // Passenger details are sent as structured booking data; notes remain for general requests and VAT.
    const filledPassengers = passengers.filter((p) => p.fullName.trim());
    const roster = filledPassengers.map((p) => {
      const idx = passengers.indexOf(p);
      return {
        fullName: p.fullName.trim(),
        ...(p.birthYear.trim() ? { birthYear: Number(p.birthYear) } : {}),
        ageGroup: (idx < guests.adults ? 'ADULT' : idx < guests.adults + guests.children ? 'CHILD' : 'INFANT') as 'ADULT' | 'CHILD' | 'INFANT',
        phone: phone.trim(),
        ...(p.pickupPoint.trim() ? { pickupPoint: p.pickupPoint.trim() } : {}),
        ...(p.specialNotes.trim() ? { specialNotes: p.specialNotes.trim() } : {}),
      };
    });
    const vatSummary = needVatInvoice && vatCompany.trim()
      ? `VAT: ${vatCompany.trim()} - MST:${vatTaxId.trim()}${vatEmail.trim() ? ` - Email:${vatEmail.trim()}` : ''}`
      : '';
    const combinedNotes = [notes.trim(), vatSummary].filter(Boolean).join(' | ').slice(0, 500);

    try {
      const created = await createBooking({
        tourId,
        departureId: effectiveDepartureId,
        participants,
        ...(roster.length ? { passengers: roster } : {}),
        ...(tour.agePricing ? { guestCounts: guests } : {}),
        contact: { fullName: fullName.trim(), phone: phone.trim() },
        ...(combinedNotes ? { notes: combinedNotes } : {}),
        ...(premiumVoucherId ? { premiumVoucherId } : {}),
        ...(checkedAgency ? { agencyPromotionCode: checkedAgency.code } : {}),
        ...(checkedPlatform ? { platformPromotionCode: checkedPlatform.code } : {}),
        clientRequestId: clientRequestId.current,
      }).unwrap();

      // Initiate 100% PayOS payment directly
      try {
        const checkoutRes = await checkoutBooking(created.id).unwrap();
        if (checkoutRes?.checkoutUrl) {
          window.location.href = checkoutRes.checkoutUrl;
          return;
        }
      } catch {
        // Fallback to booking history page if immediate checkout redirect fails
      }
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
    if (step === 1) {
      handleNextToStep2();
      return;
    }
    if (step === 2) {
      handleNextToStep3();
      return;
    }
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Đặt tour</h1>
      </div>

      {/* 3-Step Wizard Stepper - FULL WIDTH spanning equal to columns below, no click to go back */}
      <div className="mb-8 w-full">
        <div className="relative flex w-full items-center justify-between">
          {/* Background Connecting Bar */}
          <div className="absolute left-6 right-6 top-5 -z-0 h-0.5 bg-slate-200" />
          <div
            className="absolute left-6 top-5 -z-0 h-0.5 bg-brand-teal transition-all duration-300"
            style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : 'calc(100% - 3rem)' }}
          />

          {/* Step 1 Indicator */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`flex size-10 items-center justify-center rounded-full text-sm font-bold transition-all shadow-xs ${
                step === 1
                  ? 'bg-brand-teal text-white ring-4 ring-teal-500/20'
                  : step > 1
                  ? 'bg-brand-teal text-white'
                  : 'border-2 border-slate-300 bg-white text-slate-500'
              }`}
            >
              {step > 1 ? <Check className="size-5" /> : '1'}
            </div>
            <span
              className={`mt-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                step === 1 ? 'font-bold text-brand-teal' : step > 1 ? 'text-slate-800' : 'text-slate-400'
              }`}
            >
              Chọn dịch vụ
            </span>
          </div>

          {/* Step 2 Indicator */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`flex size-10 items-center justify-center rounded-full text-sm font-bold transition-all shadow-xs ${
                step === 2
                  ? 'bg-brand-teal text-white ring-4 ring-teal-500/20'
                  : step > 2
                  ? 'bg-brand-teal text-white'
                  : 'border-2 border-slate-300 bg-white text-slate-500'
              }`}
            >
              {step > 2 ? <Check className="size-5" /> : '2'}
            </div>
            <span
              className={`mt-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                step === 2 ? 'font-bold text-brand-teal' : step > 2 ? 'text-slate-800' : 'text-slate-400'
              }`}
            >
              Thông tin khách
            </span>
          </div>

          {/* Step 3 Indicator */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`flex size-10 items-center justify-center rounded-full text-sm font-bold transition-all shadow-xs ${
                step === 3
                  ? 'bg-brand-teal text-white ring-4 ring-teal-500/20'
                  : 'border-2 border-slate-300 bg-white text-slate-500'
              }`}
            >
              3
            </div>
            <span
              className={`mt-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                step === 3 ? 'font-bold text-brand-teal' : 'text-slate-400'
              }`}
            >
              Thanh toán
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-column Grid */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left Column: Form & Steps */}
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* ======================= STEP 1: CHỌN DỊCH VỤ ======================= */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Card 1: Chọn ngày khởi hành */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex size-7 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                    1
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Chọn ngày khởi hành</h2>
                </div>

                {availableDepartures.length === 0 ? (
                  <p className="text-sm text-slate-500">Hiện không có lịch khởi hành khả dụng cho tour này.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {availableDepartures.map((d) => {
                      const isSelected = d.id === effectiveDepartureId;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setSelectedDepartureId(d.id);
                            clearAllPromotions();
                          }}
                          className={`flex flex-col items-center justify-center rounded-xl px-4 py-3 min-w-[100px] border transition-all text-center cursor-pointer ${
                            isSelected
                              ? 'border-brand-teal bg-brand-teal text-white shadow-md ring-2 ring-brand-teal/30 font-bold'
                              : 'border-slate-200 bg-white text-slate-800 hover:border-brand-teal/60 hover:bg-slate-50/80'
                          }`}
                        >
                          <span className={`text-sm ${isSelected ? 'text-white font-bold' : 'font-semibold text-slate-900'}`}>
                            {formatPillDate(d.date)}
                          </span>
                          <span className={`text-xs mt-0.5 ${isSelected ? 'text-teal-100' : 'text-brand-teal font-medium'}`}>
                            {formatCompactPrice(d.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Card 2: Số lượng hành khách */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex size-7 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                    2
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Số lượng hành khách</h2>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Người lớn */}
                  <div className="py-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm sm:text-base">Người lớn</div>
                      <div className="text-xs text-slate-500">Từ 12 tuổi trở lên</div>
                      <div className="text-xs sm:text-sm font-semibold text-brand-teal mt-0.5">
                        {formatVnd(unitPrice)} / người
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={guests.adults <= 1}
                        onClick={() => {
                          setGuests((prev) => ({ ...prev, adults: Math.max(1, prev.adults - 1) }));
                          clearAllPromotions();
                        }}
                        className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-6 text-center font-bold text-slate-900 text-base">{guests.adults}</span>
                      <button
                        type="button"
                        disabled={participants >= maxParticipants}
                        onClick={() => {
                          setGuests((prev) => ({ ...prev, adults: prev.adults + 1 }));
                          clearAllPromotions();
                        }}
                        className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Trẻ em */}
                  {tour.agePricing && (
                    <div className="py-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm sm:text-base">Trẻ em</div>
                        <div className="text-xs text-slate-500">Từ 2–11 tuổi</div>
                        <div className="text-xs sm:text-sm font-semibold text-brand-teal mt-0.5">
                          {formatVnd(childPrice)} / trẻ
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={guests.children <= 0}
                          onClick={() => {
                            setGuests((prev) => ({ ...prev, children: Math.max(0, prev.children - 1) }));
                            clearAllPromotions();
                          }}
                          className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-900 text-base">{guests.children}</span>
                        <button
                          type="button"
                          disabled={participants >= maxParticipants}
                          onClick={() => {
                            setGuests((prev) => ({ ...prev, children: prev.children + 1 }));
                            clearAllPromotions();
                          }}
                          className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Em bé */}
                  {tour.agePricing && (
                    <div className="py-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm sm:text-base">Em bé</div>
                        <div className="text-xs text-slate-500">Dưới 2 tuổi</div>
                        <div className="text-xs sm:text-sm font-semibold text-brand-teal mt-0.5">
                          {formatVnd(infantPrice)} / bé
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={guests.infants <= 0}
                          onClick={() => {
                            setGuests((prev) => ({ ...prev, infants: Math.max(0, prev.infants - 1) }));
                            clearAllPromotions();
                          }}
                          className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-900 text-base">{guests.infants}</span>
                        <button
                          type="button"
                          disabled={participants >= maxParticipants}
                          onClick={() => {
                            setGuests((prev) => ({ ...prev, infants: prev.infants + 1 }));
                            clearAllPromotions();
                          }}
                          className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================= STEP 2: THÔNG TIN KHÁCH ======================= */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Card 1: Thông tin liên hệ - 2-cột layout theo thiết kế ảnh 2 */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                      1
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Thông tin liên hệ</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-xs sm:text-sm font-bold text-brand-teal hover:underline cursor-pointer"
                  >
                    Chỉnh sửa
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Row 1, Col 1: Họ và tên */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      HỌ VÀ TÊN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                      }}
                      placeholder="VD: Nguyễn Văn A"
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${
                        errors.fullName
                          ? 'border-red-500 bg-red-50/20 text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                          : 'border-slate-200 bg-white text-slate-900 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal'
                      }`}
                    />
                    {errors.fullName && <p className="mt-1 text-xs text-red-500 font-medium">{errors.fullName}</p>}
                  </div>

                  {/* Row 1, Col 2: Giới tính */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      GIỚI TÍNH
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setContactGender('Nam')}
                        className={`flex-1 rounded-xl py-2.5 px-3 text-sm font-semibold border transition text-center cursor-pointer ${
                          contactGender === 'Nam'
                            ? 'border-brand-teal bg-teal-50/60 text-brand-teal ring-1 ring-brand-teal font-bold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Nam
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactGender('Nữ')}
                        className={`flex-1 rounded-xl py-2.5 px-3 text-sm font-semibold border transition text-center cursor-pointer ${
                          contactGender === 'Nữ'
                            ? 'border-brand-teal bg-teal-50/60 text-brand-teal ring-1 ring-brand-teal font-bold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Nữ
                      </button>
                    </div>
                  </div>

                  {/* Row 2, Col 1: Số điện thoại */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      SỐ ĐIỆN THOẠI <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                      }}
                      placeholder="VD: 0901234567 hoặc +84901234567"
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${
                        errors.phone
                          ? 'border-red-500 bg-red-50/20 text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                          : 'border-slate-200 bg-white text-slate-900 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal'
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-400">Nhập số VN (Viettel, Mobifone, Vinaphone...)</p>
                    {errors.phone && <p className="mt-0.5 text-xs text-red-500 font-medium">{errors.phone}</p>}
                  </div>

                  {/* Row 2, Col 2: Email */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      EMAIL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      placeholder="example@email.com"
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${
                        errors.email
                          ? 'border-red-500 bg-red-50/20 text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                          : 'border-slate-200 bg-white text-slate-900 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal'
                      }`}
                    />
                    {errors.email && <p className="mt-1 text-xs text-red-500 font-medium">{errors.email}</p>}
                  </div>

                  {/* Row 3: Quốc gia */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      QUỐC GIA
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Việt Nam"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Danh sách Hành khách - Dùng AntSelect chung */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex size-7 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                    2
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Hành khách ({participants})
                  </h2>
                </div>

                <div className="space-y-4">
                  {passengers.map((p, idx) => {
                    const isAdult = idx < guests.adults;
                    const isChild = !isAdult && idx < guests.adults + guests.children;
                    const typeLabel = isAdult ? 'Người lớn' : isChild ? 'Trẻ em' : 'Em bé';

                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3.5 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Hành khách {idx + 1}
                          </span>
                          <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                            {typeLabel}
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và tên</label>
                            <input
                              type="text"
                              value={p.fullName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassengers((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], fullName: val };
                                  return next;
                                });
                              }}
                              placeholder="VD: Nguyễn Văn A"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                            />
                          </div>

                          <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Giới tính</label>
                            <AntSelect
                              value={p.gender}
                              onChange={(val) => {
                                setPassengers((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], gender: String(val) };
                                  return next;
                                });
                              }}
                              options={[
                                { value: 'Nam', label: 'Nam' },
                                { value: 'Nữ', label: 'Nữ' },
                                { value: 'Khác', label: 'Khác' },
                              ]}
                              className="w-full"
                              size="middle"
                            />
                          </div>

                          <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Năm sinh</label>
                            <input
                              type="text"
                              value={p.birthYear}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassengers((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], birthYear: val };
                                  return next;
                                });
                              }}
                              placeholder="1990"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">CCCD / Hộ chiếu</label>
                            <input
                              type="text"
                              value={p.idCard}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassengers((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], idCard: val };
                                  return next;
                                });
                              }}
                              placeholder="Số CCCD hoặc hộ chiếu"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                            />
                          </div>

                          <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Quốc tịch</label>
                            <input
                              type="text"
                              value={p.nationality}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassengers((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], nationality: val };
                                  return next;
                                });
                              }}
                              placeholder="Nhập quốc tịch..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Điểm đón</label>
                            <input type="text" maxLength={300} value={p.pickupPoint} onChange={(e) => setPassengers((prev) => prev.map((item, i) => i === idx ? { ...item, pickupPoint: e.target.value } : item))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Ghi chú đặc biệt</label>
                            <input type="text" maxLength={500} value={p.specialNotes} onChange={(e) => setPassengers((prev) => prev.map((item, i) => i === idx ? { ...item, specialNotes: e.target.value } : item))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ======================= STEP 3: THANH TOÁN ======================= */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Card 1: Tóm tắt thông tin liên hệ - Cho phép Chỉnh sửa quay lại step 1 giữ nguyên data */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">Thông tin liên hệ</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-xs font-bold text-brand-teal hover:underline cursor-pointer"
                  >
                    Chỉnh sửa
                  </button>
                </div>

                <div className="flex flex-col space-y-2.5 text-xs sm:text-sm">
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Họ và tên:</span>
                    <span className="font-semibold text-slate-800">{fullName || 'Chưa nhập'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Giới tính:</span>
                    <span className="font-semibold text-slate-800">{contactGender}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Số điện thoại:</span>
                    <span className="font-semibold text-slate-800">{phone || 'Chưa nhập'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Email:</span>
                    <span className="font-semibold text-slate-800 truncate">{email || 'Chưa nhập'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quốc gia:</span>
                    <span className="font-semibold text-slate-800">{country}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Phương thức thanh toán (PayOS ONLY, gọn theo ảnh 3) */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Phương thức thanh toán</h2>
                </div>

                <div className="flex items-center gap-3.5 rounded-2xl border-2 border-brand-teal bg-teal-50/20 p-4 transition">
                  <div className="flex items-center justify-center">
                    <span className="flex size-5 items-center justify-center rounded-full border-2 border-brand-teal bg-white">
                      <span className="size-2.5 rounded-full bg-brand-teal" />
                    </span>
                  </div>

                  {/* PayOS Brand Icon Badge */}
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#001D4A] shadow-xs">
                    <div className="flex flex-col items-center justify-center leading-none">
                      <span className="text-[13px] font-black tracking-tight text-white">pay<span className="text-[#00D2D3]">OS</span></span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-sm sm:text-base">
                      Cổng thanh toán PayOS
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Quét mã VietQR chuyển khoản ngân hàng 24/7
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 3: Tripin Voucher */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition hover:border-slate-300">
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

                {/* Applied voucher chips */}
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
                          className="ml-1 rounded p-0.5 text-slate-400 hover:bg-amber-100 hover:text-red-600 transition cursor-pointer"
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
                          className="ml-1 rounded p-0.5 text-slate-400 hover:bg-indigo-100 hover:text-red-600 transition cursor-pointer"
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
                          className="ml-1 rounded p-0.5 text-slate-400 hover:bg-teal-100 hover:text-red-600 transition cursor-pointer"
                          title="Bỏ chọn mã"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 4: Hóa đơn GTGT (VAT) - Dùng Checkbox component chung */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <Checkbox
                  checked={needVatInvoice}
                  onChange={(checked) => setNeedVatInvoice(checked)}
                  label={<span className="text-sm font-bold text-slate-800">Xuất hóa đơn GTGT cho công ty / tổ chức</span>}
                />

                {needVatInvoice && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 pt-3 border-t border-slate-100">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Tên công ty / tổ chức <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={vatCompany}
                        onChange={(e) => setVatCompany(e.target.value)}
                        placeholder="Công ty Cổ phần..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Mã số thuế <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={vatTaxId}
                        onChange={(e) => setVatTaxId(e.target.value)}
                        placeholder="0101234567"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Email nhận hóa đơn <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={vatEmail}
                        onChange={(e) => setVatEmail(e.target.value)}
                        placeholder="ketoan@congty.com"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Địa chỉ công ty <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={vatAddress}
                        onChange={(e) => setVatAddress(e.target.value)}
                        placeholder="Địa chỉ xuất hóa đơn theo đăng ký kinh doanh..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Card 5: Điều khoản & Chính sách dịch vụ (Mẫu chuẩn Saigontourist) */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-brand-teal" />
                  <h2 className="text-base font-bold text-slate-900">Điều khoản &amp; Chính sách dịch vụ</h2>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-700 space-y-3 max-h-56 sm:max-h-64 overflow-y-auto leading-relaxed divide-y divide-slate-200/60">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900">1. Giá tour &amp; Quy định thanh toán</h4>
                    <p className="text-slate-600">
                      - Giá tour áp dụng theo chương trình đã chọn, tính bằng Việt Nam Đồng (VNĐ) trên mỗi hành khách.
                    </p>
                    <p className="text-slate-600">
                      - Quý khách thanh toán 100% giá trị đơn đặt chỗ trực tuyến qua cổng PayOS (VietQR / Ngân hàng điện tử) ngay khi xác nhận đơn.
                    </p>
                    <p className="text-slate-600">
                      - Đơn đặt chỗ chỉ chính thức có hiệu lực sau khi hệ thống ghi nhận giao dịch thanh toán thành công và cấp mã vé điện tử.
                    </p>
                  </div>

                  <div className="pt-2.5 space-y-1">
                    <h4 className="font-bold text-slate-900">2. Quy định hoàn hủy &amp; Thay đổi lịch trình</h4>
                    {tour.cancellationPolicy ? (
                      <p className="text-slate-600">{tour.cancellationPolicy}</p>
                    ) : (
                      <>
                        <p className="text-slate-600">
                          - Hủy sau khi thanh toán đến trước 15 ngày khởi hành: Phí hủy 10% tổng giá trị tour.
                        </p>
                        <p className="text-slate-600">
                          - Hủy từ 07 đến 14 ngày trước ngày khởi hành: Phí hủy 30% tổng giá trị tour.
                        </p>
                        <p className="text-slate-600">
                          - Hủy từ 03 đến 06 ngày trước ngày khởi hành: Phí hủy 50% tổng giá trị tour.
                        </p>
                        <p className="text-slate-600">
                          - Hủy dưới 03 ngày hoặc vắng mặt vào ngày khởi hành (No-show): Phí hủy 100% giá trị tour.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="pt-2.5 space-y-1">
                    <h4 className="font-bold text-slate-900">3. Giấy tờ tùy thân &amp; Hành lý</h4>
                    <p className="text-slate-600">
                      {tour.requiredDocuments ||
                        'Quý khách vui lòng mang theo CCCD gắn chip hoặc Hộ chiếu gốc còn hạn trên 6 tháng. Đối với trẻ em chưa có CCCD, cần mang theo giấy khai sinh bản chính hoặc trích lục sao y hợp lệ.'}
                    </p>
                  </div>

                  <div className="pt-2.5 space-y-1">
                    <h4 className="font-bold text-slate-900">4. Lưu ý chuyến đi &amp; Trường hợp bất khả kháng</h4>
                    <p className="text-slate-600">
                      {tour.travelNotes ||
                        'Lịch trình có thể linh hoạt điều chỉnh theo thời tiết và giờ mở cửa thực tế của điểm tham quan nhưng vẫn đảm bảo đủ các điểm đến trong hợp đồng. Đơn vị tổ chức được miễn trừ trách nhiệm trong trường hợp thiên tai, bão lũ hoặc chỉ đạo hành chính từ cơ quan nhà nước.'}
                    </p>
                  </div>
                </div>

                {/* Checkbox: nội dung điều khoản hiển thị màu xanh, không có link */}
                <Checkbox
                  checked={agreedToTerms}
                  onChange={(checked) => setAgreedToTerms(checked)}
                  label={
                    <span className="text-xs sm:text-sm text-slate-700 leading-normal">
                      Tôi đã đọc và đồng ý với{' '}
                      <span className="font-semibold text-brand-teal">nội dung điều khoản</span>{' '}
                      và chính sách dịch vụ của {tour.agency?.name || 'nhà cung cấp & Tripin'}.
                    </span>
                  }
                />
              </div>
            </div>
          )}

          {/* Shopee Voucher Modal */}
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

          {/* Errors display */}
          {errors.general && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {pendingBookingId && (
            <Link
              href={`/settings/history/${encodeURIComponent(pendingBookingId)}`}
              className="inline-block text-sm font-semibold text-primary underline"
            >
              Mở đơn đang chờ thanh toán
            </Link>
          )}
        </form>

        {/* Right Column: Tour Summary Preview Card */}
        <aside className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:sticky lg:top-24 flex flex-col justify-between h-fit">
          <div>
            {/* Tour Hero Card with Image Background & Title Overlay (No "Chuyến đi của bạn") */}
            <div className="relative h-44 sm:h-48 w-full overflow-hidden rounded-2xl bg-slate-900 shadow-sm">
              <img
                src={tour.coverImage || tour.images?.[0] || '/images/default-tour.png'}
                alt={title}
                className="h-full w-full object-cover opacity-90"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-4">
                <h3 className="text-sm sm:text-base font-extrabold text-white leading-snug drop-shadow-md line-clamp-2">
                  {title}
                </h3>
              </div>
            </div>

            {/* Tour Specs Breakdown - Clean, NO gray background */}
            <div className="mt-4 space-y-2 border-b border-slate-100 pb-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Mã tour:</span>
                <span className="font-semibold text-slate-900">{tour.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Hành trình:</span>
                <span className="font-semibold text-slate-900 text-right truncate max-w-[65%]">
                  {tour.durationDays > 1 ? `${tour.durationDays}N${tour.durationDays - 1}Đ` : '1 ngày'} · {tour.destination}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Thời gian:</span>
                <span className="font-semibold text-slate-900">
                  {tour.durationDays > 1 ? `${tour.durationDays} ngày ${tour.durationDays - 1} đêm` : '1 ngày'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Ngày đi:</span>
                <span className="font-semibold text-slate-900">{formatDepartureDate(departureDate)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Ngày về:</span>
                <span className="font-semibold text-slate-900">{formatReturnDate(departureDate, tour.durationDays)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Phương tiện:</span>
                <span className="font-semibold text-slate-900">{(tour as any).transportation || 'Xe du lịch'}</span>
              </div>
            </div>

            {/* Price Breakdown - No "Tạm tính (3 khách)" row */}
            <div className="mt-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Chi tiết giá</div>
              <dl className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between gap-2 text-slate-600">
                  <dt>Người lớn × {guests.adults}</dt>
                  <dd className="font-medium text-slate-800">{formatVnd(unitPrice * guests.adults)}</dd>
                </div>
                {guests.children > 0 && (
                  <div className="flex justify-between gap-2 text-slate-600">
                    <dt>Trẻ em × {guests.children}</dt>
                    <dd className="font-medium text-slate-800">{formatVnd(childPrice * guests.children)}</dd>
                  </div>
                )}
                {guests.infants > 0 && (
                  <div className="flex justify-between gap-2 text-slate-600">
                    <dt>Em bé × {guests.infants}</dt>
                    <dd className="font-medium text-slate-800">{formatVnd(infantPrice * guests.infants)}</dd>
                  </div>
                )}

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
              </dl>

              {/* Step 3: Thanh toán summary block */}
              {step === 3 ? (
                <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3 text-xs sm:text-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Thanh toán
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Hình thức:</span>
                    <span className="font-semibold text-slate-800">100%</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Phương thức:</span>
                    <span className="font-semibold text-slate-800">PayOS (VietQR)</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3 mt-2">
                    <span className="font-bold text-slate-900 text-sm">Cần thanh toán (100%):</span>
                    <span className="text-xl font-extrabold text-brand-teal shrink-0 whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatVnd(finalEstimate)}
                    </span>
                  </div>
                </div>
              ) : (
                /* Step 1 & 2: Tổng cộng */
                <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3 mt-3">
                  <span className="font-bold text-slate-900">Tổng cộng</span>
                  <span className="text-xl font-extrabold text-brand-teal shrink-0 whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatVnd(finalEstimate)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Button at bottom of sidebar (One-way progression, NO back buttons) */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            {step === 1 && (
              <Button
                type="button"
                onClick={handleNextToStep2}
                className="w-full bg-brand-teal hover:bg-teal-700 text-white font-bold py-3 text-sm shadow-sm"
              >
                Tiếp tục: Thông tin khách &gt;
              </Button>
            )}

            {step === 2 && (
              <Button
                type="button"
                onClick={handleNextToStep3}
                className="w-full bg-brand-teal hover:bg-teal-700 text-white font-bold py-3 text-sm shadow-sm"
              >
                Tiếp tục: Thanh toán &gt;
              </Button>
            )}

            {step === 3 && (
              <Button
                type="button"
                onClick={submitBooking}
                loading={isSubmitting || isCheckingBooking || isPaying}
                className="w-full bg-brand-teal hover:bg-teal-700 text-white font-bold py-3 text-sm shadow-md"
              >
                Xác nhận &amp; Thanh toán PayOS &gt;
              </Button>
            )}
          </div>
        </aside>
      </div>

      {/* Validation Alert Modal - Background blur, green button, click outside to close */}
      {alertModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40 transition-all"
          onClick={() => setAlertModal({ open: false, message: '' })}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-lg font-bold text-slate-900">Thông báo</h3>
              <button
                type="button"
                onClick={() => setAlertModal({ open: false, message: '' })}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {alertModal.message}
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setAlertModal({ open: false, message: '' })}
                className="rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700 transition cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
