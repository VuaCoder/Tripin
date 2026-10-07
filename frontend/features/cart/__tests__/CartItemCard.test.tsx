import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartItemCard } from '../components/CartItemCard';
import type { CartItem } from '../types';

afterEach(cleanup);

const baseItem: CartItem = {
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

describe('CartItemCard', () => {
  it('renders the tour, departure, live money and wires the actions', () => {
    const onUpdateParticipants = vi.fn();
    const onRemove = vi.fn();
    const onContinue = vi.fn();

    render(
      <CartItemCard
        item={baseItem}
        onUpdateParticipants={onUpdateParticipants}
        onRemove={onRemove}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByText('Ha Long Bay 2D1N')).toBeTruthy();
    expect(screen.getByText(/Quảng Ninh/)).toBeTruthy();
    expect(screen.getByText(/01\/12\/2026/)).toBeTruthy();
    expect(screen.getByText(/2\.000\.000/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Tăng số khách'));
    expect(onUpdateParticipants).toHaveBeenCalledWith('c1', 3);

    fireEvent.click(screen.getByLabelText('Xóa khỏi giỏ hàng'));
    expect(onRemove).toHaveBeenCalledWith('c1');

    fireEvent.click(screen.getByText('Đặt chỗ'));
    expect(onContinue).toHaveBeenCalledWith(baseItem);
  });

  it('flags a line whose departure is closed and blocks booking', () => {
    const onContinue = vi.fn();

    render(
      <CartItemCard
        item={{ ...baseItem, available: false, unavailableReason: 'DEPARTURE_UNAVAILABLE', unitPrice: undefined, subtotal: undefined }}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByRole('status').textContent).toMatch(/Ngày khởi hành đã đóng/);
    const bookButton = screen.getByText('Đặt chỗ').closest('button') as HTMLButtonElement;
    expect(bookButton.disabled).toBe(true);

    fireEvent.click(bookButton);
    expect(onContinue).not.toHaveBeenCalled();
    // The departure is closed: the head-count cannot be edited, only removed.
    expect(screen.queryByLabelText('Tăng số khách')).toBeNull();
  });

  it('lets a line with too few seats be reduced but not increased', () => {
    const onUpdateParticipants = vi.fn();

    render(
      <CartItemCard
        item={{
          ...baseItem,
          available: false,
          unavailableReason: 'NOT_ENOUGH_SEATS',
          participants: 4,
          unitPrice: undefined,
          subtotal: undefined,
          departure: { id: 'd1', date: '2026-12-01T00:00:00.000Z', price: 1_000_000, remaining: 2 },
        }}
        onUpdateParticipants={onUpdateParticipants}
      />,
    );

    expect(screen.getByRole('status').textContent).toMatch(/Không còn đủ chỗ/);
    expect(screen.getByRole('status').textContent).toMatch(/còn 2 chỗ/);
    expect((screen.getByLabelText('Tăng số khách') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Giảm số khách'));
    expect(onUpdateParticipants).toHaveBeenCalledWith('c1', 3);
  });
});
