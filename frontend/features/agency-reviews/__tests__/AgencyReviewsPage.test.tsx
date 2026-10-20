import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgencyReview, ReviewDispute } from '../types';

const mockReviews = vi.fn();
const mockDisputes = vi.fn();
const mockDispute = vi.fn();

vi.mock('../api/agencyReviewsApi', () => ({
  useGetAgencyReviewsQuery: (...a: unknown[]) => mockReviews(...a),
  useGetMyReviewDisputesQuery: (...a: unknown[]) => mockDisputes(...a),
  useDisputeReviewMutation: () => [mockDispute, { isLoading: false }],
}));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => ({ id: 'a1' }) }));
vi.mock('@/features/auth', () => ({ selectUser: () => null }));
vi.mock('@/features/review/components', () => ({ RatingStars: () => <span data-testid="stars" /> }));

import { AgencyReviewsPage } from '../components/AgencyReviewsPage';

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };
const q = (over: Record<string, unknown>) => ({
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  ...over,
});
const unwrapOk = () => ({ unwrap: () => Promise.resolve({}) });
const unwrapFail = (code: string) => ({ unwrap: () => Promise.reject({ data: { error: { code, message: 'x' } } }) });

const review = (over: Partial<AgencyReview> = {}): AgencyReview => ({
  id: 'v1',
  rating: 1,
  comment: 'Hướng dẫn viên thô lỗ với khách.',
  tourId: 't1',
  author: { name: 'Lê V.' },
  createdAt: '2026-10-10T00:00:00.000Z',
  ...over,
});

const dispute = (over: Partial<ReviewDispute> = {}): ReviewDispute => ({
  id: 'r1',
  targetType: 'REVIEW',
  targetId: 'v1',
  category: 'INAPPROPRIATE_CONTENT',
  description: 'Đánh giá sai sự thật về đoàn của chúng tôi.',
  status: 'OPEN',
  createdAt: '2026-10-10T00:00:00.000Z',
  ...over,
});

const allow = (reviews: AgencyReview[] = [review()], disputes: ReviewDispute[] = []) => {
  mockReviews.mockReturnValue(q({ data: { items: reviews, meta: { ...META, total: reviews.length } } }));
  mockDisputes.mockReturnValue(q({ data: { items: disputes, meta: { ...META, total: disputes.length } } }));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgencyReviewsPage', () => {
  it('reads the reviews of its own agency and offers to dispute one', () => {
    allow();
    render(<AgencyReviewsPage />);

    expect(mockReviews).toHaveBeenCalledWith({ agencyId: 'a1', page: 1, limit: 10 }, { skip: false });
    expect(screen.getByText('Hướng dẫn viên thô lỗ với khách.')).toBeTruthy();
    expect(screen.getByText('Lê V.')).toBeTruthy();
    expect(screen.getByText('Phản ánh đánh giá')).toBeTruthy();
  });

  it('sends a dispute with the category and the description the backend expects', async () => {
    allow();
    mockDispute.mockReturnValue(unwrapOk());
    render(<AgencyReviewsPage />);
    fireEvent.click(screen.getByText('Phản ánh đánh giá'));
    fireEvent.change(screen.getByLabelText('Mô tả chi tiết'), { target: { value: 'Đánh giá sai sự thật về đoàn của chúng tôi.' } });
    fireEvent.click(screen.getByText('Gửi báo cáo'));

    await waitFor(() =>
      expect(mockDispute).toHaveBeenCalledWith({
        reviewId: 'v1',
        category: 'SERVICE_QUALITY',
        description: 'Đánh giá sai sự thật về đoàn của chúng tôi.',
      }),
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã gửi phản ánh'));
  });

  it('blocks a too-short description without calling the backend', () => {
    allow();
    render(<AgencyReviewsPage />);
    fireEvent.click(screen.getByText('Phản ánh đánh giá'));
    fireEvent.change(screen.getByLabelText('Mô tả chi tiết'), { target: { value: 'Sai' } });
    fireEvent.click(screen.getByText('Gửi báo cáo'));

    expect(mockDispute).not.toHaveBeenCalled();
    expect(screen.getByText(/ít nhất 10 ký tự/)).toBeTruthy();
  });

  it('keeps the dialog open and maps the duplicate error', async () => {
    allow();
    mockDispute.mockReturnValue(unwrapFail('REPORT_ALREADY_OPEN'));
    render(<AgencyReviewsPage />);
    fireEvent.click(screen.getByText('Phản ánh đánh giá'));
    fireEvent.change(screen.getByLabelText('Mô tả chi tiết'), { target: { value: 'Đánh giá sai sự thật về đoàn của chúng tôi.' } });
    fireEvent.click(screen.getByText('Gửi báo cáo'));

    await waitFor(() => expect(screen.getAllByRole('alert')[0].textContent).toContain('đang chờ xử lý'));
    expect(screen.getByLabelText('Mô tả chi tiết')).toBeTruthy(); // the dialog is still open
  });

  it('shows the disputes it filed with the moderator decision', () => {
    allow([review()], [
      dispute({ status: 'RESOLVED', resolution: { decision: 'RESOLVED', note: 'Đã ẩn đánh giá.', resolvedAt: '2026-10-12T00:00:00.000Z' } }),
    ]);
    render(<AgencyReviewsPage />);

    expect(screen.getByText('Đã giải quyết')).toBeTruthy();
    expect(screen.getByText('Đã ẩn đánh giá.')).toBeTruthy();
    expect(screen.getByText('Đánh giá sai sự thật về đoàn của chúng tôi.')).toBeTruthy();
  });

  it('says so when there is nothing to show yet', () => {
    allow([], []);
    render(<AgencyReviewsPage />);

    expect(screen.getByText('Chưa có đánh giá nào')).toBeTruthy();
    expect(screen.getByText('Bạn chưa gửi phản ánh nào.')).toBeTruthy();
  });
});
