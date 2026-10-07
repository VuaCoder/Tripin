import {
  REVIEW_COMMENT_MAX,
  REVIEW_COMMENT_MIN,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  type ReviewableBooking,
} from '../types';

export interface ReviewFormValues {
  bookingId: string;
  rating: number;
  comment: string;
}

export interface ReviewFormErrors {
  bookingId?: string;
  rating?: string;
  comment?: string;
  general?: string;
}

/**
 * Mirrors `createReviewBody` from the backend (`reviews.validation.ts`): a whole rating from 1 to 5 and a
 * trimmed comment of 10..2000 characters. The backend validates again — this only avoids a round trip.
 */
export function validateReviewForm(
  values: ReviewFormValues,
  eligibleBookings: ReviewableBooking[] = [],
): ReviewFormErrors {
  const errors: ReviewFormErrors = {};

  if (!values.bookingId) {
    errors.bookingId = 'Vui lòng chọn đặt chỗ bạn muốn đánh giá.';
  } else if (eligibleBookings.length > 0 && !eligibleBookings.some((booking) => booking.id === values.bookingId)) {
    errors.bookingId = 'Đặt chỗ này không thể đánh giá.';
  }

  if (!Number.isInteger(values.rating) || values.rating < REVIEW_RATING_MIN || values.rating > REVIEW_RATING_MAX) {
    errors.rating = `Vui lòng chọn từ ${REVIEW_RATING_MIN} đến ${REVIEW_RATING_MAX} sao.`;
  }

  const comment = values.comment.trim();
  if (comment.length < REVIEW_COMMENT_MIN) {
    errors.comment = `Vui lòng viết ít nhất ${REVIEW_COMMENT_MIN} ký tự.`;
  } else if (comment.length > REVIEW_COMMENT_MAX) {
    errors.comment = `Nội dung tối đa ${REVIEW_COMMENT_MAX} ký tự.`;
  }

  return errors;
}

export const hasReviewFormErrors = (errors: ReviewFormErrors): boolean => Object.keys(errors).length > 0;
