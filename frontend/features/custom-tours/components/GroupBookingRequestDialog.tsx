'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CUSTOM_TOUR_POLICY, guestTotal, type AgePricing, type GuestCounts } from '@travel-platform/constants';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { TourGuestSelector } from '@/features/tours/components/detail/TourGuestSelector';
import { useCreateCustomTourMutation } from '../api';

const dayLabel = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export interface GroupBookingRequestDialogProps {
  tourId: string;
  open: boolean;
  onClose: () => void;
  /** The counts already selected on the tour page; the dialog only enforces the 2-person floor. */
  defaultGuests: GuestCounts;
  /** The date already selected on the tour page (YYYY-MM-DD), if any. */
  defaultStartDate?: string;
  /** Reference prices only: the agency still quotes the group in its offer. */
  unitPrice: number;
  pricing?: AgePricing | null;
}

export function GroupBookingRequestDialog({
  tourId,
  open,
  onClose,
  defaultGuests,
  defaultStartDate,
  unitPrice,
  pricing,
}: GroupBookingRequestDialogProps) {
  const router = useRouter();
  const [guests, setGuests] = useState<GuestCounts>(defaultGuests);
  const [startDate, setStartDate] = useState(defaultStartDate ?? '');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ guests?: string; startDate?: string; notes?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [createRequest, { isLoading }] = useCreateCustomTourMutation();
  const count = guestTotal(guests);

  useEffect(() => {
    if (!open) return;
    setGuests(defaultGuests);
    setStartDate(defaultStartDate ?? '');
    setNotes('');
    setFieldErrors({});
    setServerError(null);
  }, [open, defaultGuests, defaultStartDate]);

  const handleSubmit = async () => {
    setServerError(null);

    const errors: typeof fieldErrors = {};
    if (count < CUSTOM_TOUR_POLICY.MIN_PARTICIPANTS || count > CUSTOM_TOUR_POLICY.MAX_PARTICIPANTS) {
      errors.guests = `Đoàn phải từ ${CUSTOM_TOUR_POLICY.MIN_PARTICIPANTS} đến ${CUSTOM_TOUR_POLICY.MAX_PARTICIPANTS} người.`;
    }
    if (startDate && new Date(startDate).getTime() <= Date.now()) {
      errors.startDate = 'Ngày khởi hành phải ở tương lai.';
    }
    if (notes.length > CUSTOM_TOUR_POLICY.MAX_NOTES) {
      errors.notes = `Ghi chú tối đa ${CUSTOM_TOUR_POLICY.MAX_NOTES} ký tự.`;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const created = await createRequest({
        sourceTourId: tourId,
        participants: count,
        guestCounts: guests,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
      }).unwrap();
      onClose();
      router.push(
        created.conversationId
          ? `/conversations/${created.conversationId}?request=${created.id}`
          : '/traveler/custom-tours',
      );
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Không gửi được yêu cầu. Vui lòng thử lại.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yêu cầu booking đoàn"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isLoading} aria-busy={isLoading || undefined}>
            Gửi yêu cầu
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Đại lý sẽ nhận yêu cầu, tư vấn lịch trình và gửi thỏa thuận cho đoàn của bạn.
        </p>

        <FormField
          label="Ngày khởi hành dự kiến"
          htmlFor="group-booking-start-date"
          error={fieldErrors.startDate}
          hint={
            startDate
              ? `Đã chọn ${dayLabel.format(new Date(startDate))}. Để trống nếu muốn đại lý tư vấn ngày.`
              : 'Để trống nếu bạn muốn đại lý tư vấn ngày.'
          }
        >
          <Input
            id="group-booking-start-date"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setFieldErrors((prev) => ({ ...prev, startDate: undefined }));
            }}
            invalid={Boolean(fieldErrors.startDate)}
          />
        </FormField>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-slate-700">
            Số người <span className="text-red-600" aria-hidden="true">*</span>
          </p>
          <TourGuestSelector
            value={guests}
            onChange={(next) => {
              setGuests(next);
              setFieldErrors((prev) => ({ ...prev, guests: undefined }));
            }}
            max={CUSTOM_TOUR_POLICY.MAX_PARTICIPANTS}
            unitPrice={unitPrice}
            pricing={pricing}
          />
          <p className="text-xs text-slate-500">
            Tổng {count} người. Giá cuối cùng do đại lý chốt trong thỏa thuận.
          </p>
          {fieldErrors.guests && <p role="alert" className="text-xs font-medium text-red-600">{fieldErrors.guests}</p>}
        </div>

        <FormField
          label="Ghi chú"
          htmlFor="group-booking-notes"
          error={fieldErrors.notes}
          hint={`${notes.length}/${CUSTOM_TOUR_POLICY.MAX_NOTES} ký tự. Ngày đi mong muốn, yêu cầu riêng…`}
        >
          <textarea
            id="group-booking-notes"
            rows={4}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setFieldErrors((prev) => ({ ...prev, notes: undefined }));
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
          />
        </FormField>

        {serverError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}
