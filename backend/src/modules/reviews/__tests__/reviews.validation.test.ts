import { describe, expect, it } from 'vitest';
import { createReviewBody } from '../reviews.validation';

const body = { bookingId: '00000000-0000-4000-8000-000000000001', rating: 5 };
describe('optional review feedback', () => {
  it('accepts omitted, empty and short feedback while keeping a required rating', () => {
    expect(createReviewBody.parse(body).comment).toBe('');
    for (const comment of ['', '   ', 'Hay lắm']) expect(createReviewBody.parse({ ...body, comment }).comment).toBe(comment.trim());
    expect(createReviewBody.safeParse({ bookingId: body.bookingId }).success).toBe(false);
    expect(createReviewBody.safeParse({ ...body, rating: 0 }).success).toBe(false);
  });
  it('keeps the maximum length and rejects invalid feedback types', () => {
    expect(createReviewBody.safeParse({ ...body, comment: 'a'.repeat(2001) }).success).toBe(false);
    expect(createReviewBody.safeParse({ ...body, comment: null }).success).toBe(false);
  });
});
