import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const useCart = vi.hoisted(() => vi.fn());
vi.mock('../hooks', () => ({ useCart }));

const updateCartItem = vi.hoisted(() => vi.fn());
const removeCartItem = vi.hoisted(() => vi.fn());
vi.mock('../api/cartApi', () => ({
  useUpdateCartItemMutation: () => [updateCartItem, { isLoading: false }],
  useRemoveCartItemMutation: () => [removeCartItem, { isLoading: false }],
}));

// The picker has its own test; here only its open/closed wiring matters.
vi.mock('../components/AddTourPanel', async () => {
  const { createElement } = await import('react');
  return {
    AddTourPanel: ({ open }: { open: boolean }) => (open ? createElement('div', { 'data-testid': 'add-panel-open' }) : null),
  };
});

import { CartPage } from '../components/CartPage';
import type { CartItem } from '../types';

const item: CartItem = {
  id: 'c1',
  tourId: 't1',
  departureId: 'd1',
  participants: 2,
  addedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  available: true,
  tour: {
    id: 't1',
    title: 'Ha Long Bay 2D1N',
    destination: 'Quảng Ninh',
    durationDays: 2,
    basePrice: 1_000_000,
    categoryIds: [],
    ratingAvg: 4.8,
    ratingCount: 12,
  },
  departure: { id: 'd1', date: '2026-12-01T00:00:00.000Z', price: 1_000_000, remaining: 5 },
  unitPrice: 1_000_000,
  subtotal: 2_000_000,
};

const totals = { itemCount: 1, participantCount: 2, availableCount: 1, unavailableCount: 0, subtotal: 2_000_000, currency: 'VND' as const };

const cartState = (overrides: Record<string, unknown> = {}) => ({
  items: [],
  availableItems: [],
  unavailableItems: [],
  totals: { itemCount: 0, participantCount: 0, availableCount: 0, unavailableCount: 0, subtotal: 0, currency: 'VND' as const },
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  push.mockReset();
  updateCartItem.mockReset();
  removeCartItem.mockReset();
  useCart.mockReset();
  updateCartItem.mockReturnValue({ unwrap: () => Promise.resolve(item) });
  removeCartItem.mockReturnValue({ unwrap: () => Promise.resolve() });
});

afterEach(cleanup);

describe('CartPage', () => {
  it('shows the loading state while the cart is fetched', () => {
    useCart.mockReturnValue(cartState({ isLoading: true }));
    render(<CartPage />);
    expect(screen.getByText('Đang tải giỏ hàng...')).toBeTruthy();
  });

  it('shows the error state and retries', () => {
    const refetch = vi.fn();
    useCart.mockReturnValue(cartState({ isError: true, refetch }));
    render(<CartPage />);

    expect(screen.getByText('Không tải được giỏ hàng')).toBeTruthy();
    fireEvent.click(screen.getByText('Thử lại'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows the empty state and opens the add-tour picker from it', () => {
    useCart.mockReturnValue(cartState());
    render(<CartPage />);

    expect(screen.getByText('Giỏ hàng đang trống')).toBeTruthy();
    expect(screen.queryByTestId('add-panel-open')).toBeNull();

    fireEvent.click(screen.getByText('Thêm tour vào giỏ'));
    expect(screen.getByTestId('add-panel-open')).toBeTruthy();
  });

  it('renders the lines with backend totals and continues to booking', () => {
    useCart.mockReturnValue(cartState({ items: [item], availableItems: [item], totals }));
    render(<CartPage />);

    expect(screen.getByText('Ha Long Bay 2D1N')).toBeTruthy();
    expect(screen.getByTestId('cart-total-subtotal').textContent).toMatch(/2\.000\.000/);

    fireEvent.click(screen.getByText('Đặt chỗ'));
    expect(push).toHaveBeenCalledWith('/traveler/bookings/new?tourId=t1&departureId=d1&participants=2&cartItemId=c1');
  });

  it('updates the head-count and removes a line through the API', async () => {
    useCart.mockReturnValue(cartState({ items: [item], availableItems: [item], totals }));
    render(<CartPage />);

    fireEvent.click(screen.getByLabelText('Tăng số khách'));
    await waitFor(() => expect(updateCartItem).toHaveBeenCalledWith({ id: 'c1', participants: 3 }));

    fireEvent.click(screen.getByLabelText('Xóa khỏi giỏ hàng'));
    await waitFor(() => expect(removeCartItem).toHaveBeenCalledWith('c1'));
  });

  it('surfaces a failed mutation without losing the list', async () => {
    removeCartItem.mockReturnValue({ unwrap: () => Promise.reject({ data: { error: { message: 'Không xóa được tour khỏi giỏ.' } } }) });
    useCart.mockReturnValue(cartState({ items: [item], availableItems: [item], totals }));
    render(<CartPage />);

    fireEvent.click(screen.getByLabelText('Xóa khỏi giỏ hàng'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Không xóa được tour khỏi giỏ/));
    expect(screen.getByText('Ha Long Bay 2D1N')).toBeTruthy();
  });
});
