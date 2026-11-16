import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AirbnbTourCarousel } from '../components/AirbnbTourCarousel';
import type { TourListItem } from '../types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/wishlist/components/WishlistButton', () => ({ WishlistButton: () => null }));
const tours: TourListItem[] = Array.from({ length: 2 }, (_, i) => ({
  id: `tour-${i}`, title: `Tour ${i}`, destination: 'Hồ Chí Minh', durationDays: 1,
  basePrice: 100000, categoryIds: [], ratingAvg: 4.6, ratingCount: 2,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AirbnbTourCarousel', () => {
  it('hides view-all and navigation when all tours fit', () => {
    render(<AirbnbTourCarousel title="Tour trong thành phố" tours={tours} total={2} viewAllHref="/tours" />);
    expect(screen.getByRole('heading', { name: 'Tour trong thành phố' })).toBeDefined();
    expect(screen.queryByText('Xem tất cả')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xem thêm tour tiếp theo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xem các tour phía trước' })).toBeNull();
  });

  it('shows view-all when the API reports additional tours', () => {
    render(<AirbnbTourCarousel title="Tour trong thành phố" tours={tours} total={20} viewAllHref="/tours" />);
    expect(screen.getByText('Xem tất cả')).toBeDefined();
  });

  it('shows scroll controls only while the row overflows, including after resize', () => {
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(580);
    render(<AirbnbTourCarousel title="Tour trong thành phố" tours={tours} total={2} viewAllHref="/tours" />);
    expect(screen.getByRole('button', { name: 'Xem thêm tour tiếp theo' })).toHaveProperty('disabled', false);
    expect(screen.queryByText('Xem tất cả')).toBeNull();
    width.mockReturnValue(900);
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('button', { name: 'Xem thêm tour tiếp theo' })).toBeNull();
  });
});
