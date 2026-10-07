import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createReview = vi.hoisted(() => vi.fn());
const mutationState = vi.hoisted(() => ({ isLoading: false }));

vi.mock('../api/reviewApi', () => ({
  useCreateReviewMutation: () => [createReview, mutationState],
}));

import { WriteReviewDialog } from '../components/WriteReviewDialog';
import type { MyReview, ReviewableBooking } from '../types';

const BOOKING: ReviewableBooking = {
  id: 'b1',
  bookingCode: 'TRP12345678',
  status: 'COMPLETED',
  tour: { id: 't1', title: 'Ha Long Bay 2N1Đ' },
  departureDate: '2026-01-01T00:00:00.000Z',
  participants: 2,
};

const SECOND_BOOKING: ReviewableBooking = { ...BOOKING, id: 'b2', bookingCode: 'TRP99999999' };

const CREATED: MyReview = {
  id: 'r1',
  bookingId: 'b1',
  tourId: 't1',
  tourTitle: 'Ha Long Bay 2N1Đ',
  rating: 5,
  comment: 'Chuyến đi rất tuyệt vời!',
  status: 'VISIBLE',
  createdAt: '2026-02-01T00:00:00.000Z',
};

const VALID_COMMENT = 'Chuyến đi rất tuyệt vời, hướng dẫn viên thân thiện.';

const renderDialog = (overrides: Partial<Parameters<typeof WriteReviewDialog>[0]> = {}) => {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const onDuplicate = vi.fn();
  render(
    <WriteReviewDialog
      open
      onClose={onClose}
      tourTitle="Ha Long Bay 2N1Đ"
      eligibleBookings={[BOOKING]}
      onCreated={onCreated}
      onDuplicate={onDuplicate}
      {...overrides}
    />,
  );
  return { onClose, onCreated, onDuplicate };
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }));
const typeComment = (value: string) => fireEvent.change(screen.getByLabelText(/Cảm nhận của bạn/), { target: { value } });
const chooseRating = (stars: number) => fireEvent.click(screen.getByLabelText(`${stars} sao`));

beforeEach(() => {
  mutationState.isLoading = false;
  createReview.mockReset();
  createReview.mockReturnValue({ unwrap: () => Promise.resolve(CREATED) });
});

afterEach(cleanup);

describe('WriteReviewDialog', () => {
  it('shows the booking being reviewed and the rating picker', () => {
    renderDialog();

    expect(screen.getByText('TRP12345678')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: /Điểm đánh giá/ })).toBeTruthy();
    expect(screen.queryByLabelText(/Đặt chỗ bạn muốn đánh giá/)).toBeNull();
  });

  it('refuses to submit without a rating or a long enough comment', () => {
    renderDialog();

    submit();
    expect(createReview).not.toHaveBeenCalled();
    expect(screen.getByText('Vui lòng chọn từ 1 đến 5 sao.')).toBeTruthy();
    expect(screen.getByText('Vui lòng viết ít nhất 10 ký tự.')).toBeTruthy();

    chooseRating(4);
    typeComment('quá ngắn');
    submit();
    expect(createReview).not.toHaveBeenCalled();
    expect(screen.getByText('Vui lòng viết ít nhất 10 ký tự.')).toBeTruthy();
  });

  it('posts the trimmed comment with the chosen rating and reports the created review', async () => {
    const { onCreated } = renderDialog();

    chooseRating(5);
    typeComment(`  ${VALID_COMMENT}  `);
    submit();

    await waitFor(() => expect(createReview).toHaveBeenCalledTimes(1));
    expect(createReview).toHaveBeenCalledWith({ bookingId: 'b1', rating: 5, comment: VALID_COMMENT });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED));
  });

  it('lets the traveler pick which eligible booking to review', async () => {
    renderDialog({ eligibleBookings: [BOOKING, SECOND_BOOKING] });

    fireEvent.change(screen.getByLabelText(/Đặt chỗ bạn muốn đánh giá/), { target: { value: 'b2' } });
    chooseRating(5);
    typeComment(VALID_COMMENT);
    submit();

    await waitFor(() => expect(createReview).toHaveBeenCalledWith({ bookingId: 'b2', rating: 5, comment: VALID_COMMENT }));
  });

  it('explains a duplicate review, keeps the text and re-reads the eligibility', async () => {
    createReview.mockReturnValue({
      unwrap: () => Promise.reject({ data: { error: { code: 'REVIEW_EXISTS', message: 'You already reviewed this booking' } } }),
    });
    const { onCreated, onDuplicate } = renderDialog();

    chooseRating(5);
    typeComment(VALID_COMMENT);
    submit();

    await waitFor(() => expect(screen.getByText('Bạn đã đánh giá đặt chỗ này rồi.')).toBeTruthy());
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Cảm nhận của bạn/) as HTMLTextAreaElement).value).toBe(VALID_COMMENT);
  });

  it('explains a booking that is not completed yet', async () => {
    createReview.mockReturnValue({
      unwrap: () => Promise.reject({ data: { error: { code: 'BOOKING_NOT_COMPLETED', message: 'Not completed' } } }),
    });
    renderDialog();

    chooseRating(5);
    typeComment(VALID_COMMENT);
    submit();

    await waitFor(() => expect(screen.getByText('Chỉ có thể đánh giá sau khi chuyến đi kết thúc.')).toBeTruthy());
  });

  it('disables the form while the review is being sent', () => {
    mutationState.isLoading = true;
    renderDialog();

    const submitButton = screen.getByRole('button', { name: /Đang gửi/ }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    expect((screen.getByLabelText(/Cảm nhận của bạn/) as HTMLTextAreaElement).disabled).toBe(true);
  });
});
