import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const wishlist = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../hooks', () => ({ useTourWishlist: () => wishlist.current }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/tours',
}));

vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
      createElement('a', { href, className }, children as never),
  };
});

import { WishlistButton } from '../components/WishlistButton';

const setState = (state: Record<string, unknown>) => {
  wishlist.current = { status: 'ready', isSaved: false, pending: false, error: null, toggle: vi.fn(), retry: vi.fn(), ...state };
  return wishlist.current;
};

afterEach(cleanup);

describe('WishlistButton', () => {
  it('saves an unsaved tour', () => {
    const state = setState({});
    render(<WishlistButton tourId="t1" />);

    fireEvent.click(screen.getByRole('button', { name: /Lưu tour/ }));
    expect(state.toggle).toHaveBeenCalled();
  });

  it('shows the saved state as pressed', () => {
    setState({ isSaved: true });
    render(<WishlistButton tourId="t1" />);

    expect(screen.getByRole('button', { name: 'Bỏ lưu tour' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Đã lưu')).toBeNull();
    expect(screen.queryByText('Xem danh sách yêu thích')).toBeNull();
  });

  it('opens login prompt modal for guests', () => {
    setState({ status: 'guest' });
    render(<WishlistButton tourId="t1" />);

    expect(screen.getByRole('button', { name: /Lưu tour/ })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Lưu tour/ }));
    expect(screen.getByText('Yêu cầu đăng nhập')).toBeDefined();
  });

  it('triggers onGuestClick callback when provided for guest', () => {
    setState({ status: 'guest' });
    const onGuestClick = vi.fn();
    render(<WishlistButton tourId="t1" onGuestClick={onGuestClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Lưu tour/ }));
    expect(onGuestClick).toHaveBeenCalled();
  });

  it('triggers toggle and remove when un-saving a saved tour', () => {
    const state = setState({ isSaved: true });
    render(<WishlistButton tourId="t1" tourTitle="Tour Đà Lạt" />);

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ lưu tour' }));
    expect(state.toggle).toHaveBeenCalled();
  });

  it('renders nothing for non-travelers', () => {
    setState({ status: 'not-traveler' });
    const { container } = render(<WishlistButton tourId="t1" />);

    expect(container.firstChild).toBeNull();
  });

  it('shows the toggle error', () => {
    setState({ error: 'Wishlist is full' });
    render(<WishlistButton tourId="t1" />);

    expect(screen.getByRole('alert').textContent).toMatch(/full/);
  });

  it('renders pill variant with label text for saved and unsaved states', () => {
    setState({ isSaved: false });
    const { rerender } = render(<WishlistButton tourId="t1" variant="pill" />);
    expect(screen.getByText('Lưu')).toBeDefined();

    setState({ isSaved: true });
    rerender(<WishlistButton tourId="t1" variant="pill" />);
    expect(screen.getByText('Đã lưu')).toBeDefined();
  });

  it('renders circle variant as an icon-only button without label text', () => {
    setState({ isSaved: false });
    const { rerender } = render(<WishlistButton tourId="t1" variant="circle" />);
    expect(screen.getByRole('button', { name: /Lưu tour/ })).toBeDefined();
    expect(screen.queryByText('Lưu')).toBeNull();

    setState({ isSaved: true });
    rerender(<WishlistButton tourId="t1" variant="circle" />);
    expect(screen.getByRole('button', { name: 'Bỏ lưu tour' })).toBeDefined();
    expect(screen.queryByText('Đã lưu')).toBeNull();
  });
});
