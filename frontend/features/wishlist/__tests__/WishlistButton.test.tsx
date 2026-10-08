import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const wishlist = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../hooks', () => ({ useTourWishlist: () => wishlist.current }));

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

    expect(screen.getByRole('button', { name: /Đã lưu/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('sends guests to the login page', () => {
    setState({ status: 'guest' });
    render(<WishlistButton tourId="t1" />);

    expect(screen.getByRole('link').getAttribute('href')).toBe('/login');
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
});
