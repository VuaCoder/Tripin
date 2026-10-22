import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ profile: vi.fn(), reviews: vi.fn(), retry: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'public-id' }) }));
vi.mock('../api', () => ({ useGetPublicProfileQuery: mocks.profile, useGetProfileReviewsQuery: mocks.reviews }));
vi.mock('../components/AgencyVouchersSection', () => ({
  AgencyVouchersSection: () => <div data-testid="agency-vouchers">Voucher nhà cung cấp</div>,
}));
vi.mock('../components/AgencyToursSection', () => ({
  AgencyToursSection: () => <div data-testid="agency-tours">Tour nhà cung cấp</div>,
}));
vi.mock('@/components/shared', () => ({
  LoadingState: ({ label }: { label: string }) => <p>{label}</p>,
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
  ErrorState: ({ title, onAction }: { title: string; onAction: () => void }) => <div>{title}<button onClick={onAction}>Thử lại</button></div>,
}));
import { PublicProfilePage, safeWebsite } from '../PublicProfilePage';
const profile = { id: 'public-id', fullName: 'Nguyễn An', companyName: 'Du lịch An', verified: true, description: 'Khám phá miền Trung', bio: 'Đồng hành cùng bạn', languages: ['Tiếng Việt'], specialties: ['Văn hóa'], experienceYears: 0 };
const review = { id: 'r1', tourId: 't1', rating: 5, comment: 'Một chuyến đi đáng nhớ', author: { name: 'Nguyễn A.' }, createdAt: '2026-01-01' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile.mockReturnValue({ currentData: profile, refetch: mocks.retry });
  mocks.reviews.mockReturnValue({ currentData: { items: [review], meta: { total: 11, totalPages: 2 } }, refetch: mocks.retry });
});
afterEach(cleanup);
describe('Public profiles without a session', () => {
  it('renders agency information and masked public reviews without a login gate', () => {
    render(<PublicProfilePage kind="agency" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Du lịch An');
    expect(screen.getByText('Đối tác đã xác minh')).toBeTruthy();
    expect(screen.getByText(review.comment)).toBeTruthy();
    expect(screen.getByText('Nguyễn A.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem tour được đánh giá' }).getAttribute('href')).toBe('/tours/t1');
    expect(mocks.reviews).toHaveBeenLastCalledWith({ kind: 'agency', id: 'public-id', page: 1, sort: 'newest' });
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(mocks.reviews).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rating_asc' } });
    expect(mocks.reviews).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: 'rating_asc' }));
  });
  it('renders guide information and explains that reviews rate the trip', () => {
    render(<PublicProfilePage kind="guide" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Nguyễn An');
    expect(screen.getByText('0 năm')).toBeTruthy();
    expect(screen.getByText('Tiếng Việt')).toBeTruthy();
    expect(screen.getByText(/Điểm đánh giá dành cho toàn bộ trải nghiệm tour/)).toBeTruthy();
    expect(mocks.reviews).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'guide' }));
  });
  it('handles loading and missing profiles without loading their reviews', () => {
    mocks.profile.mockReturnValue({ isLoading: true });
    const view = render(<PublicProfilePage kind="agency" />);
    expect(screen.getByText('Đang tải hồ sơ…')).toBeTruthy();
    expect(mocks.reviews).not.toHaveBeenCalled();
    mocks.profile.mockReturnValue({ error: { status: 404 }, refetch: mocks.retry });
    view.rerender(<PublicProfilePage kind="agency" />);
    expect(screen.getByText('Không tìm thấy hồ sơ')).toBeTruthy();
  });
  it('handles empty reviews and retryable errors', () => {
    mocks.reviews.mockReturnValue({ currentData: { items: [] } });
    const view = render(<PublicProfilePage kind="guide" />);
    expect(screen.getByText('Chưa có đánh giá công khai')).toBeTruthy();
    mocks.reviews.mockReturnValue({ isError: true, refetch: mocks.retry });
    view.rerender(<PublicProfilePage kind="guide" />);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(mocks.retry).toHaveBeenCalled();
  });
  it('only links to HTTP websites', () => {
    expect(safeWebsite('javascript:alert(1)')).toBeUndefined();
    expect(safeWebsite('invalid')).toBeUndefined();
    expect(safeWebsite('https://example.com')).toBe('https://example.com/');
  });
});
