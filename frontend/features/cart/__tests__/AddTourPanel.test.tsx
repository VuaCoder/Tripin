import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getTours = vi.hoisted(() => vi.fn());
const getTour = vi.hoisted(() => vi.fn());
vi.mock('@/features/tours', () => ({ useGetToursQuery: getTours, useGetTourQuery: getTour }));

// The button itself is covered by its own test; here we only assert which departures get one.
vi.mock('../components/AddToCartButton', async () => {
  const { createElement } = await import('react');
  return {
    AddToCartButton: ({ departureId, participants }: { departureId: string; participants: number }) =>
      createElement('button', { 'data-testid': `add-${departureId}`, 'data-participants': String(participants) }, 'Thêm'),
  };
});

import { AddTourPanel } from '../components/AddTourPanel';

const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

const tour = {
  id: 't1',
  title: 'Ha Long Bay 2D1N',
  destination: 'Quảng Ninh',
  durationDays: 2,
  basePrice: 1_000_000,
  categoryIds: [],
  ratingAvg: 4.8,
  ratingCount: 12,
};

const detail = {
  ...tour,
  departures: [
    { id: 'd1', date: future, capacity: 10, remaining: 5, price: 1_000_000, isOpen: true },
    { id: 'd2', date: future, capacity: 10, remaining: 0, price: 1_000_000, isOpen: true },
    { id: 'd3', date: past, capacity: 10, remaining: 5, price: 1_000_000, isOpen: true },
    { id: 'd4', date: future, capacity: 10, remaining: 5, price: 1_000_000, isOpen: false },
  ],
};

afterEach(cleanup);

describe('AddTourPanel', () => {
  it('renders nothing but the toggle while closed', () => {
    getTours.mockReturnValue({ data: [tour], isLoading: false, isError: false, refetch: vi.fn() });
    getTour.mockReturnValue({ data: detail, isLoading: false });

    render(<AddTourPanel open={false} onToggle={vi.fn()} />);

    expect(screen.queryByLabelText('Tour')).toBeNull();
  });

  it('lists only the bookable departures and clamps the head-count to the remaining seats', () => {
    getTours.mockReturnValue({ data: [tour], isLoading: false, isError: false, refetch: vi.fn() });
    getTour.mockReturnValue({ data: detail, isLoading: false });

    render(<AddTourPanel open onToggle={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Tour'), { target: { value: 't1' } });

    expect(screen.getByTestId('add-d1')).toBeTruthy();
    expect(screen.queryByTestId('add-d2')).toBeNull(); // sold out
    expect(screen.queryByTestId('add-d3')).toBeNull(); // in the past
    expect(screen.queryByTestId('add-d4')).toBeNull(); // closed
    expect(screen.getByTestId('add-d1').getAttribute('data-participants')).toBe('1');

    fireEvent.change(screen.getByLabelText('Số khách'), { target: { value: '9' } });
    expect(screen.getByTestId('add-d1').getAttribute('data-participants')).toBe('5');
  });

  it('tells the traveler when the selected tour has no bookable departure', () => {
    getTours.mockReturnValue({ data: [tour], isLoading: false, isError: false, refetch: vi.fn() });
    getTour.mockReturnValue({ data: { ...tour, departures: [] }, isLoading: false });

    render(<AddTourPanel open onToggle={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Tour'), { target: { value: 't1' } });

    expect(screen.getByText(/không có ngày khởi hành nào còn chỗ/)).toBeTruthy();
  });
});
