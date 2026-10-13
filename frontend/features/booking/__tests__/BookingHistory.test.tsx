import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingDto } from '../types';

const mockUseGetMyBookingsQuery = vi.fn();
const mockCancelBooking = vi.fn();
const mockCheckoutBooking = vi.fn();

const mockCompleteBooking = vi.fn();

vi.mock('../api/bookingApi', () => ({
  useGetMyBookingsQuery: (args: unknown) => mockUseGetMyBookingsQuery(args),
  useCancelBookingMutation: () => [mockCancelBooking, { isLoading: false }],
  useCompleteBookingMutation: () => [mockCompleteBooking, { isLoading: false }],
}));

vi.mock('@/features/payment', () => ({
  useCheckoutBookingMutation: () => [mockCheckoutBooking, { isLoading: false }],
}));

vi.mock('@/features/review/api/reviewApi', () => ({
  useGetMyReviewsQuery: () => ({ data: { items: [] }, refetch: vi.fn() }),
}));

vi.mock('@/features/review/components', () => ({
  WriteReviewDialog: () => null,
}));

import { BookingHistoryPage } from '../components/BookingHistoryPage';

const mockBookingPending: BookingDto = {
  id: 'b-1',
  bookingCode: 'TRIP-1001',
  status: 'PENDING',
  tour: { id: 't-1', title: 'Tour Khám Phá Hạ Long 2N1Đ' },
  departureId: 'd-1',
  departureDate: '2026-11-20T08:00:00.000Z',
  endDate: '2026-11-21T18:00:00.000Z',
  participants: 2,
  unitPrice: 1500000,
  subtotal: 3000000,
  discountAmount: 200000,
  totalAmount: 2800000,
  contact: { fullName: 'Nguyen Van A', phone: '0901234567' },
  isPaid: false,
  refundRequired: false,
  paymentExpiresAt: '2026-11-20T08:15:00.000Z',
  createdAt: '2026-11-20T08:00:00.000Z',
};

const mockBookingConfirmed: BookingDto = {
  id: 'b-2',
  bookingCode: 'TRIP-1002',
  status: 'CONFIRMED',
  tour: { id: 't-2', title: 'Tour Đà Nẵng - Hội An 3N2Đ' },
  departureId: 'd-2',
  departureDate: '2026-12-01T08:00:00.000Z',
  endDate: '2026-12-03T18:00:00.000Z',
  participants: 1,
  unitPrice: 3500000,
  subtotal: 3500000,
  discountAmount: 0,
  totalAmount: 3500000,
  contact: { fullName: 'Nguyen Van A', phone: '0901234567' },
  isPaid: true,
  refundRequired: false,
  confirmedAt: '2026-11-15T09:00:00.000Z',
  createdAt: '2026-11-15T08:50:00.000Z',
};

beforeEach(() => {
  mockUseGetMyBookingsQuery.mockReset();
  mockCancelBooking.mockReset();
  mockCheckoutBooking.mockReset();
});

afterEach(cleanup);

describe('BookingHistoryPage', () => {
  it('displays loading state while fetching bookings', () => {
    mockUseGetMyBookingsQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
    });

    render(<BookingHistoryPage />);
    expect(screen.getByText('Đang tải danh sách đặt chỗ của bạn...')).toBeTruthy();
  });

  it('displays error state and allows refetch', () => {
    const refetch = vi.fn();
    mockUseGetMyBookingsQuery.mockReturnValue({
      isLoading: false,
      isError: true,
      refetch,
    });

    render(<BookingHistoryPage />);
    expect(screen.getByText('Không thể tải danh sách đặt chỗ')).toBeTruthy();

    fireEvent.click(screen.getByText('Tải lại'));
    expect(refetch).toHaveBeenCalled();
  });

  it('displays empty state when traveler has no bookings', () => {
    mockUseGetMyBookingsQuery.mockReturnValue({
      isLoading: false,
      data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    });

    render(<BookingHistoryPage />);
    expect(screen.getByText('Bạn chưa có đặt chỗ nào')).toBeTruthy();
  });

  it('renders booking cards with correct information and status badges', () => {
    mockUseGetMyBookingsQuery.mockReturnValue({
      isLoading: false,
      data: {
        items: [mockBookingPending, mockBookingConfirmed],
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    });

    render(<BookingHistoryPage />);

    // Check tour titles
    expect(screen.getByText('Tour Khám Phá Hạ Long 2N1Đ')).toBeTruthy();
    expect(screen.getByText('Tour Đà Nẵng - Hội An 3N2Đ')).toBeTruthy();

    // Check booking codes
    expect(screen.getByText('TRIP-1001')).toBeTruthy();
    expect(screen.getByText('TRIP-1002')).toBeTruthy();

    // Check status badges
    expect(screen.getAllByText('Chờ thanh toán').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đã xác nhận').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đã thanh toán').length).toBeGreaterThan(0);
  });

  it('allows canceling a booking via CancelBookingModal', async () => {
    mockCancelBooking.mockReturnValue({
      unwrap: () => Promise.resolve({ ...mockBookingPending, status: 'CANCELLED' }),
    });

    mockUseGetMyBookingsQuery.mockReturnValue({
      isLoading: false,
      data: {
        items: [mockBookingPending],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });

    render(<BookingHistoryPage />);

    // Click "Hủy đặt chỗ" on the card
    fireEvent.click(screen.getByText('Hủy đặt chỗ'));

    // Modal should appear
    expect(screen.getByText('Xác nhận hủy đặt chỗ')).toBeTruthy();

    // Click "Xác nhận hủy"
    fireEvent.click(screen.getByText('Xác nhận hủy'));

    await waitFor(() => {
      expect(mockCancelBooking).toHaveBeenCalledWith({
        id: 'b-1',
        reason: undefined,
      });
    });
  });

  it('allows filtering by status tab', () => {
    mockUseGetMyBookingsQuery.mockReturnValue({
      isLoading: false,
      data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    });

    render(<BookingHistoryPage />);

    // Click tab "Chờ thanh toán"
    fireEvent.click(screen.getByText('Chờ thanh toán'));

    expect(mockUseGetMyBookingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING' }),
    );
  });
});
