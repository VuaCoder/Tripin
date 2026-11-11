import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => false }));
vi.mock('@/features/wishlist/hooks/useTourWishlist', () => ({ useTourWishlist: () => ({ status: 'guest', isSaved: false, pending: false }) }));
vi.mock('@/components/shared', () => ({ GuestLoginPromptModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div role="dialog">Login</div> : null }));
import { TourCard } from '../components/TourCard';

afterEach(cleanup);

const baseTour = {
  id: 'tour-1',
  title: 'Tour công khai',
  destination: 'Huế',
  durationDays: 2,
  basePrice: 1000000,
  categoryIds: [],
  ratingAvg: 0,
  ratingCount: 0,
};

describe('Guest tour discovery', () => {
  it('offers a public detail link while requiring login to save a tour', () => {
    const { container } = render(<TourCard tour={baseTour} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/tours/tour-1');
    expect(screen.queryByRole('dialog')).toBeNull();

    const heartButtons = screen.getAllByRole('button', { name: 'Lưu tour yêu thích' });
    expect(heartButtons).toHaveLength(1);
    const mediaBox = container.querySelector('.aspect-\\[16\\/10\\]');
    expect(mediaBox?.contains(heartButtons[0])).toBe(true);

    fireEvent.click(heartButtons[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('places the wishlist heart button outside the image on the right content header in list view', () => {
    const { container } = render(<TourCard tour={baseTour} view="list" />);

    const heartButtons = screen.getAllByRole('button', { name: 'Lưu tour yêu thích' });
    expect(heartButtons).toHaveLength(1);

    const mediaBox = container.querySelector('.aspect-\\[16\\/10\\]');
    expect(mediaBox?.contains(heartButtons[0])).toBe(false);
    expect(heartButtons[0].className).not.toContain('rounded-full');

    fireEvent.click(heartButtons[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
