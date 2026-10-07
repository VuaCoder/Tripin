import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addCartItem = vi.hoisted(() => vi.fn());
vi.mock('../api/cartApi', () => ({ useAddCartItemMutation: () => [addCartItem, { isLoading: false }] }));

// `next/link` needs the app-router context; a plain anchor is enough for this unit.
vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ href, children }: { href: string; children: unknown }) => createElement('a', { href }, children as never),
  };
});

import { AddToCartButton } from '../components/AddToCartButton';

beforeEach(() => {
  addCartItem.mockReset();
});

afterEach(cleanup);

describe('AddToCartButton', () => {
  it('adds the tour with the chosen departure and head-count', async () => {
    addCartItem.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'c1' }) });
    const onAdded = vi.fn();

    render(<AddToCartButton tourId="t1" departureId="d1" participants={3} onAdded={onAdded} />);
    fireEvent.click(screen.getByText('Thêm vào giỏ'));

    expect(addCartItem).toHaveBeenCalledWith({ tourId: 't1', departureId: 'd1', participants: 3 });
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Đã thêm vào giỏ/));
    expect(onAdded).toHaveBeenCalled();
  });

  it('shows the backend error when the departure cannot be booked', async () => {
    addCartItem.mockReturnValue({ unwrap: () => Promise.reject({ data: { error: { message: 'This departure is closed or sold out' } } }) });

    render(<AddToCartButton tourId="t1" departureId="d1" participants={1} />);
    fireEvent.click(screen.getByText('Thêm vào giỏ'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/closed or sold out/));
  });
});
