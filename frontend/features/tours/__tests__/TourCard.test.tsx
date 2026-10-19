import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/store/hooks', () => ({ useAppSelector: () => false }));
vi.mock('@/features/wishlist/hooks/useTourWishlist', () => ({ useTourWishlist: () => ({ status: 'guest', isSaved: false, pending: false }) }));
vi.mock('@/components/shared', () => ({ GuestLoginPromptModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div role="dialog">Login</div> : null }));
import { TourCard } from '../components/TourCard';

afterEach(cleanup);
describe('Guest tour discovery', () => {
  it('offers a public detail link while requiring login to save a tour', () => {
    render(<TourCard tour={{ id: 'tour-1', title: 'Tour công khai', destination: 'Huế', durationDays: 2, basePrice: 1000000, categoryIds: [], ratingAvg: 0, ratingCount: 0 }} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/tours/tour-1');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tour yêu thích' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
