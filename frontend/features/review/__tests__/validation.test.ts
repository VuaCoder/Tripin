import { describe, expect, it } from 'vitest';
import { REVIEW_COMMENT_MAX, REVIEW_COMMENT_MIN, type ReviewableBooking } from '../types';
import { hasReviewFormErrors, validateReviewForm } from '../utils/validation';

const BOOKING: ReviewableBooking = {
  id: 'b1',
  bookingCode: 'TRP12345678',
  status: 'COMPLETED',
  tour: { id: 't1', title: 'Ha Long Bay 2N1Đ' },
  departureDate: '2026-01-01T00:00:00.000Z',
  participants: 2,
};

const OTHER_BOOKING: ReviewableBooking = { ...BOOKING, id: 'b2' };

const VALID = { bookingId: 'b1', rating: 5, comment: 'Chuyến đi rất tuyệt vời!' };

describe('validateReviewForm (mirrors the backend createReviewBody)', () => {
  it('accepts a complete review', () => {
    expect(hasReviewFormErrors(validateReviewForm(VALID, [BOOKING]))).toBe(false);
  });

  it('requires the booking being reviewed', () => {
    const errors = validateReviewForm({ ...VALID, bookingId: '' }, [BOOKING]);
    expect(errors.bookingId).toBeTruthy();
  });

  it('rejects a booking that is not eligible', () => {
    const errors = validateReviewForm({ ...VALID, bookingId: OTHER_BOOKING.id }, [BOOKING]);
    expect(errors.bookingId).toBeTruthy();
  });

  it('accepts the whole rating range and rejects everything else', () => {
    expect(validateReviewForm({ ...VALID, rating: 1 }, [BOOKING]).rating).toBeUndefined();
    expect(validateReviewForm({ ...VALID, rating: 5 }, [BOOKING]).rating).toBeUndefined();
    for (const rating of [0, 6, 2.5, Number.NaN]) {
      expect(validateReviewForm({ ...VALID, rating }, [BOOKING]).rating, `rating=${rating}`).toBeTruthy();
    }
  });

  it('measures the comment after trimming', () => {
    expect(validateReviewForm({ ...VALID, comment: '' }, [BOOKING]).comment).toBeTruthy();
    expect(validateReviewForm({ ...VALID, comment: '   ' }, [BOOKING]).comment).toBeTruthy();
    expect(validateReviewForm({ ...VALID, comment: 'a'.repeat(REVIEW_COMMENT_MIN - 1) }, [BOOKING]).comment).toBeTruthy();
    expect(validateReviewForm({ ...VALID, comment: `  ${'a'.repeat(REVIEW_COMMENT_MIN)}  ` }, [BOOKING]).comment).toBeUndefined();
  });

  it('rejects a comment longer than the backend maximum', () => {
    expect(validateReviewForm({ ...VALID, comment: 'a'.repeat(REVIEW_COMMENT_MAX) }, [BOOKING]).comment).toBeUndefined();
    expect(validateReviewForm({ ...VALID, comment: 'a'.repeat(REVIEW_COMMENT_MAX + 1) }, [BOOKING]).comment).toBeTruthy();
  });
});
