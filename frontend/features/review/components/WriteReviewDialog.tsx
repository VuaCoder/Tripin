'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, FormField, Modal, cn } from '@/components/ui';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth';
import { useCreateReviewMutation } from '../api/reviewApi';
import {
  REVIEW_COMMENT_MAX,
  REVIEW_COMMENT_MIN,
  type CreateReviewInput,
  type MyReview,
  type ReviewableBooking,
} from '../types';
import { formatDate } from '../utils/format';
import { hasReviewFormErrors, validateReviewForm, type ReviewFormErrors } from '../utils/validation';
import { RatingInput } from './RatingInput';

export interface WriteReviewDialogProps {
  open: boolean;
  onClose: () => void;
  tourTitle: string;
  /** COMPLETED bookings of this tour that have no review yet (at least one when the dialog opens). */
  eligibleBookings: ReviewableBooking[];
  onCreated: (review: MyReview) => void;
  /** The backend answered `REVIEW_EXISTS`: the pre-check was stale, re-read it. */
  onDuplicate?: () => void;
}

const FIELD_CLASS =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:bg-slate-50';

/**
 * "Write a review": one review per COMPLETED booking. The client mirrors the backend limits
 * (`createReviewBody`); the backend validates again and owns the eligibility rule.
 */
export function WriteReviewDialog({
  open,
  onClose,
  tourTitle,
  eligibleBookings,
  onCreated,
  onDuplicate,
}: WriteReviewDialogProps) {
  const [createReview, { isLoading }] = useCreateReviewMutation();
  const [bookingId, setBookingId] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<ReviewFormErrors>({});

  // Every opening starts clean, on the first eligible booking.
  useEffect(() => {
    if (!open) return;
    setBookingId(eligibleBookings[0]?.id ?? '');
    setRating(0);
    setComment('');
    setErrors({});
  }, [open, eligibleBookings]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const next = validateReviewForm({ bookingId, rating, comment }, eligibleBookings);
    setErrors(next);
    if (hasReviewFormErrors(next)) return;

    const body: CreateReviewInput = { bookingId, rating, comment: comment.trim() };
    try {
      const created = await createReview(body).unwrap();
      onCreated(created);
    } catch (error) {
      const code = getApiErrorCode(error);
      if (code === 'REVIEW_EXISTS') {
        setErrors({ general: 'Bạn đã đánh giá đặt chỗ này rồi.' });
        onDuplicate?.();
        return;
      }
      if (code === 'BOOKING_NOT_COMPLETED') {
        setErrors({ general: 'Chỉ có thể đánh giá sau khi chuyến đi kết thúc.' });
        return;
      }
      setErrors({ general: getApiErrorMessage(error, 'Không gửi được đánh giá. Vui lòng thử lại.') });
    }
  };

  const singleBooking = eligibleBookings.length === 1 ? eligibleBookings[0] : undefined;

  return (
    <Modal
      open={open}
      onClose={isLoading ? () => undefined : onClose}
      closeOnBackdrop={!isLoading}
      title="Viết đánh giá"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm text-slate-500">
          Chia sẻ cảm nhận của bạn về <strong className="font-semibold text-slate-700">{tourTitle}</strong>.
        </p>

        {eligibleBookings.length > 1 && (
          <FormField label="Đặt chỗ bạn muốn đánh giá" htmlFor="review-booking" required error={errors.bookingId}>
            <select
              id="review-booking"
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
              disabled={isLoading}
              aria-invalid={Boolean(errors.bookingId) || undefined}
              className={cn(FIELD_CLASS, errors.bookingId ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-brand-teal')}
            >
              {eligibleBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.bookingCode} · Khởi hành {formatDate(booking.departureDate)}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {singleBooking && (
          <p className="rounded-xl bg-surface-container-low px-3 py-2 text-xs text-slate-600">
            Đặt chỗ <strong className="font-semibold text-slate-800">{singleBooking.bookingCode}</strong> · Khởi hành{' '}
            {formatDate(singleBooking.departureDate)}
          </p>
        )}

        <div className="space-y-1.5">
          <p id="review-rating-label" className="block text-sm font-semibold text-slate-700">
            Điểm đánh giá
            <span className="ml-1 text-red-600" aria-hidden="true">
              *
            </span>
          </p>
          <RatingInput
            value={rating}
            onChange={setRating}
            labelledBy="review-rating-label"
            describedBy={errors.rating ? 'review-rating-error' : undefined}
            invalid={Boolean(errors.rating)}
            disabled={isLoading}
          />
          {errors.rating && (
            <p id="review-rating-error" role="alert" className="text-xs text-red-600">
              {errors.rating}
            </p>
          )}
        </div>

        <FormField
          label="Cảm nhận của bạn"
          htmlFor="review-comment"
          required
          error={errors.comment}
          hint={`Ít nhất ${REVIEW_COMMENT_MIN} ký tự, tối đa ${REVIEW_COMMENT_MAX}.`}
        >
          <textarea
            id="review-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={5}
            maxLength={REVIEW_COMMENT_MAX}
            disabled={isLoading}
            placeholder="Chuyến đi thế nào? Hướng dẫn viên, lịch trình, dịch vụ..."
            aria-invalid={Boolean(errors.comment) || undefined}
            className={cn(FIELD_CLASS, errors.comment ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-brand-teal')}
          />
          <p className="text-right text-xs text-slate-400">
            {comment.trim().length}/{REVIEW_COMMENT_MAX}
          </p>
        </FormField>

        {errors.general && (
          <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {errors.general}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button type="submit" loading={isLoading} loadingLabel="Đang gửi...">
            Gửi đánh giá
          </Button>
        </div>
      </form>
    </Modal>
  );
}
