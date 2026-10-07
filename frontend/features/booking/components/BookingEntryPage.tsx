'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, FormField, Input } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorMessage, selectUser } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { formatDepartureDate, formatVnd, useGetCartQuery, useRemoveCartItemMutation, type CartItem } from '@/features/cart';
import { useCreateBookingMutation } from '../api/bookingApi';
import type { Booking } from '../types';

/** Same rule the backend applies to the contact phone. */
const PHONE_PATTERN = /^\+?[0-9 ().-]{6,20}$/;
const MAX_PARTICIPANTS = 50;

/** Idempotency key accepted by `POST /bookings` (`^[A-Za-z0-9_-]{8,64}$`). */
function retryKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().replace(/-/g, '');
  return `retry${Date.now()}`;
}

/**
 * Booking entry reached from the cart. The cart passes `tourId`/`departureId`/`participants` (and the cart line id);
 * this page confirms the contact details and calls the existing `POST /bookings`, which re-prices and reserves seats
 * server-side. The cart line is removed once the booking exists. Payment is the next step (P3).
 */
export function BookingEntryPage() {
  const params = useSearchParams();
  const user = useAppSelector(selectUser);
  const tourId = params.get('tourId') ?? '';
  const departureId = params.get('departureId') ?? '';
  const cartItemId = params.get('cartItemId');
  const participantsParam = Number(params.get('participants'));

  const { data: cart, isLoading } = useGetCartQuery();
  const [createBooking, { isLoading: isSubmitting }] = useCreateBookingMutation();
  const [removeCartItem] = useRemoveCartItemMutation();

  const item: CartItem | undefined = useMemo(() => {
    if (!cart) return undefined;
    return cart.items.find((candidate) =>
      cartItemId ? candidate.id === cartItemId : candidate.tourId === tourId && candidate.departureId === departureId,
    );
  }, [cart, cartItemId, departureId, tourId]);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [notes, setNotes] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const [participants, setParticipants] = useState(
    Number.isFinite(participantsParam) && participantsParam > 0 ? participantsParam : item?.participants ?? 1,
  );
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; general?: string }>({});
  const [booking, setBooking] = useState<Booking | null>(null);
  // One key per visit: a retry after a lost response returns the booking the first attempt created instead of a second one.
  const clientRequestId = useRef(retryKey());
  // The URL may not carry a head-count (deep link): adopt the cart line's value once it resolves.
  const syncedParticipants = useRef(false);

  useEffect(() => {
    if (syncedParticipants.current || !item) return;
    syncedParticipants.current = true;
    if (!(Number.isFinite(participantsParam) && participantsParam > 0)) setParticipants(item.participants);
  }, [item, participantsParam]);

  // Only the cart line that actually matches the booked tour+departure may be removed after success.
  const bookedItemId = item && item.tourId === tourId && item.departureId === departureId ? item.id : undefined;

  if (!tourId || !departureId) {
    return (
      <ErrorState
        title="Thiếu thông tin đặt chỗ"
        message="Hãy chọn một tour trong giỏ hàng rồi bấm “Đặt chỗ”."
        actionLabel="Về giỏ hàng"
        onAction={() => window.location.assign('/traveler/cart')}
      />
    );
  }

  if (isLoading) return <LoadingState label="Đang chuẩn bị bước đặt chỗ..." />;

  if (booking) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-emerald-600" aria-hidden="true">check_circle</span>
          <h1 className="text-xl font-extrabold text-slate-900">Đặt chỗ đã được tạo</h1>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Mã đặt chỗ của bạn là <strong className="text-slate-900">{booking.bookingCode}</strong>.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Tour</dt>
            <dd className="font-semibold text-slate-800">{booking.tour.title}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Ngày khởi hành</dt>
            <dd className="font-semibold text-slate-800">{formatDepartureDate(booking.departureDate)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Số khách</dt>
            <dd className="font-semibold text-slate-800">{booking.participants}</dd>
          </div>
          {booking.discountAmount > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Giảm giá</dt>
              <dd className="font-semibold text-emerald-700">-{formatVnd(booking.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-2">
            <dt className="font-semibold text-slate-700">Tổng tiền</dt>
            <dd className="text-lg font-extrabold text-primary-container">{formatVnd(booking.totalAmount)}</dd>
          </div>
        </dl>
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Đặt chỗ đang chờ thanh toán. Bước thanh toán sẽ được hoàn thiện ở giai đoạn tiếp theo.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/traveler/cart"
            className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Về giỏ hàng
          </Link>
          <Link
            href="/traveler"
            className="inline-flex items-center rounded-xl bg-primary-container px-4 py-2 text-sm font-semibold text-white hover:bg-primary"
          >
            Về trang tổng quan
          </Link>
        </div>
      </div>
    );
  }

  const title = item?.tour?.title ?? 'Tour đã chọn';
  const unitPrice = item?.unitPrice ?? item?.departure?.price;
  const previewTotal = unitPrice != null ? unitPrice * participants : undefined;
  const maxParticipants = Math.min(MAX_PARTICIPANTS, item?.departure?.remaining ?? MAX_PARTICIPANTS);
  const unavailable = Boolean(item && !item.available);

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

    try {
      const created = await createBooking({
        tourId,
        departureId,
        participants,
        contact: { fullName: fullName.trim(), phone: phone.trim() },
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(promotionCode.trim() ? { promotionCode: promotionCode.trim().toUpperCase() } : {}),
        clientRequestId: clientRequestId.current,
      }).unwrap();
      setBooking(created);
      if (bookedItemId) {
        // The line has become a booking: drop it from the cart (best effort; the booking is already created).
        await removeCartItem(bookedItemId).unwrap().catch(() => undefined);
      }
    } catch (error) {
      setErrors({ general: getApiErrorMessage(error, 'Không tạo được đặt chỗ. Vui lòng thử lại.') });
    }
  };

  return (
    <div className="grid gap-6 pb-12 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6" noValidate>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Hoàn tất thông tin đặt chỗ</h1>
          <p className="mt-1 text-sm text-slate-500">Thông tin liên hệ dùng để xác nhận chuyến đi của bạn.</p>
        </div>

        {unavailable && (
          <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Tour này không còn đặt được. Hãy quay lại giỏ hàng để chọn tour khác.
          </p>
        )}

        <FormField label="Họ và tên" htmlFor="booking-fullName" required error={errors.fullName}>
          <Input
            id="booking-fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Văn A"
            invalid={Boolean(errors.fullName)}
            autoComplete="name"
          />
        </FormField>

        <FormField label="Số điện thoại" htmlFor="booking-phone" required error={errors.phone}>
          <Input
            id="booking-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0901234567"
            inputMode="tel"
            invalid={Boolean(errors.phone)}
            autoComplete="tel"
          />
        </FormField>

        <FormField label="Số khách" htmlFor="booking-participants" hint={`Tối đa ${maxParticipants} khách cho ngày khởi hành này.`}>
          <Input
            id="booking-participants"
            type="number"
            min={1}
            max={maxParticipants}
            value={participants}
            onChange={(event) => setParticipants(Number(event.target.value))}
          />
        </FormField>

        <FormField label="Mã giảm giá" htmlFor="booking-promotion" hint="Không bắt buộc — mã được kiểm tra khi bạn xác nhận.">
          <Input
            id="booking-promotion"
            value={promotionCode}
            onChange={(event) => setPromotionCode(event.target.value.toUpperCase())}
            placeholder="VD: SAVE10"
            maxLength={30}
            autoComplete="off"
          />
        </FormField>

        <FormField label="Ghi chú" htmlFor="booking-notes" hint="Không bắt buộc">
          <textarea
            id="booking-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Yêu cầu đặc biệt cho chuyến đi..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
          />
        </FormField>

        {errors.general && (
          <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {errors.general}
          </p>
        )}

        <Button type="submit" className="w-full" loading={isSubmitting} disabled={unavailable}>
          Xác nhận đặt chỗ
        </Button>
      </form>

      <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-base font-bold text-slate-900">Chuyến đi của bạn</h2>
        <p className="mt-2 text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-xs text-slate-500">Khởi hành: {formatDepartureDate(item?.departure?.date)}</p>
        {unitPrice != null && <p className="mt-1 text-xs text-slate-500">{formatVnd(unitPrice)} / khách</p>}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-sm font-semibold text-slate-700">Tạm tính ({participants} khách)</span>
          <span className="text-lg font-extrabold text-primary-container" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {previewTotal != null ? formatVnd(previewTotal) : '—'}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Giá cuối cùng và mã giảm giá được backend tính lại khi bạn xác nhận.
        </p>
      </aside>
    </div>
  );
}
