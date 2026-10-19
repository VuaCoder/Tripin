import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => null }));
vi.mock('@/features/wishlist', () => ({ WishlistButton: () => <button>Yêu thích</button> }));
vi.mock('@/features/chat/StartConversationButton', () => ({ StartConversationButton: () => null }));
vi.mock('@/features/review', () => ({ RatingStars: () => null, TourReviewsSection: () => <div>Đánh giá</div>, formatVnd: (value: number) => `${value} đ` }));
import { TourDetailView } from '../components/detail/TourDetailView';
const tour = { id: 't1', title: 'Tour Ninh Bình 3 ngày', destination: 'Ninh Bình', durationDays: 3, basePrice: 1000000, ratingAvg: 0, ratingCount: 0,
  inclusions: ['Xe đưa đón'], exclusions: ['Chi phí cá nhân'],
  itinerary: [{ day: 1, title: 'Tham quan Tràng An', description: 'Đi thuyền qua các hang động.', activities: ['Đón khách tại Hà Nội'] }, { day: 2, title: 'Khám phá Tam Cốc', description: 'Tham quan làng quê.', activities: [] }],
  childPricingPolicy: 'Trẻ em ngủ chung với người lớn.', cancellationPolicy: 'Xác nhận phí hủy trước khi đặt.', travelNotes: 'Mang giày đi bộ.', requiredDocuments: 'Giấy tờ tùy thân còn hiệu lực.',
  agePricing: { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 },
  departures: [{ id: 'd1', date: '2099-11-01', price: 1000000, remaining: 5, isOpen: true }],
};
afterEach(cleanup);
describe('Tour detail content', () => {
  it('links guests to the public agency and guide profiles', () => {
    render(<TourDetailView tour={{ ...tour, agency: { id: 'a1', name: 'Agency An' }, guide: { id: 'g1', fullName: 'Guide An' } }} />);
    expect(screen.getByRole('link', { name: 'Agency An' }).getAttribute('href')).toBe('/agencies/a1');
    expect(screen.getByRole('link', { name: 'Hướng dẫn viên: Guide An' }).getAttribute('href')).toBe('/tour-guides/g1');
    expect(screen.getByText('Đánh giá')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng nhập để đặt tour' })).toBeTruthy();
  });
  it('renders independent itinerary, price and guidance sections from backend data', () => {
    render(<TourDetailView tour={tour} />);
    expect(screen.getByText('Đi thuyền qua các hang động.')).toBeTruthy();
    expect(screen.queryByText('Xe đưa đón')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Điều kiện đổi, hủy tour' })).toBeNull();
    expect(screen.queryByText('Thêm vào giỏ hàng')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Chính sách giá' }));
    expect(screen.getByText('Xe đưa đón')).toBeTruthy();
    expect(screen.getByText('50% giá tour')).toBeTruthy();
    expect(screen.queryByText('Đi thuyền qua các hang động.')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Giấy tờ tùy thân' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Hướng dẫn' }));
    expect(screen.getByRole('heading', { name: 'Điều kiện đổi, hủy tour' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Giấy tờ tùy thân' })).toBeTruthy();
    expect(screen.queryByText('Xe đưa đón')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Lịch trình' }));
    expect(screen.getByText('Đi thuyền qua các hang động.')).toBeTruthy();
    expect(screen.queryByText('Bảo hiểm')).toBeNull();
  });
  it('recalculates total when children are selected', () => {
    render(<TourDetailView tour={tour} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tăng trẻ em' }));
    expect(screen.getByText('1500000 đ')).toBeTruthy();
    expect(screen.getByLabelText('Trẻ em').textContent).toBe('1');
  });
  it('shows unpublished fields honestly for legacy tours', () => {
    render(<TourDetailView tour={{ ...tour, agePricing: null, itinerary: [], childPricingPolicy: '', cancellationPolicy: '', requiredDocuments: '' }} />);
    expect(screen.getByText('Đơn vị tổ chức đang cập nhật lịch trình chi tiết.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Chính sách giá' }));
    expect(screen.getByText(/Chính sách giá trẻ em chưa được công bố/)).toBeTruthy();
  });
});
