import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingDto } from '../types';

const mockUseGetBookingByIdQuery = vi.fn();
const mockCancelBooking = vi.fn();
const mockCheckoutBooking = vi.fn();

const mockCompleteBooking = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'b-1' }),
  usePathname: () => '/traveler/bookings',
}));

vi.mock('../api/bookingApi', () => ({
  useGetBookingByIdQuery: (id: string) => mockUseGetBookingByIdQuery(id),
  useCancelBookingMutation: () => [mockCancelBooking, { isLoading: false }],
  useCompleteBookingMutation: () => [mockCompleteBooking, { isLoading: false }],
}));

vi.mock('@/features/payment', () => ({
  useCheckoutBookingMutation: () => [mockCheckoutBooking, { isLoading: false }],
}));

vi.mock('@/features/e-ticket', () => ({
  useGetETicketByBookingIdQuery: () => ({ data: undefined, isLoading: false }),
  ETicketModal: () => null,
}));

vi.mock('@/features/review/api/reviewApi', () => ({
  useGetMyReviewsQuery: () => ({ data: { items: [] }, refetch: vi.fn() }),
}));

vi.mock('@/features/review/components', () => ({
  WriteReviewDialog: () => null,
}));

import { BookingDetailPage } from '../components/BookingDetailPage';

const mockBooking: BookingDto = {
  id: 'b-1',
  bookingCode: 'TRIP-9999',
  status: 'PENDING',
  tour: { id: 't-1', title: 'Tour Leo Núi Fansipan 2N1Đ' },
  departureId: 'd-1',
  departureDate: '2026-10-25T07:00:00.000Z',
  endDate: '2026-10-26T17:00:00.000Z',
  participants: 3,
  unitPrice: 2000000,
  subtotal: 6000000,
  discountAmount: 500000,
  promotion: { code: 'FANSIPAN500', scope: 'ORDER', discountAmount: 500000 },
  totalAmount: 5500000,
  contact: { fullName: 'Trần Thị B', phone: '0987654321' },
  notes: 'Đoàn có người ăn chay',
  isPaid: false,
  refundRequired: false,
  paymentExpiresAt: '2026-10-20T12:00:00.000Z',
  createdAt: '2026-10-20T11:45:00.000Z',
};

beforeEach(() => {
  mockUseGetBookingByIdQuery.mockReset();
  mockCancelBooking.mockReset();
  mockCheckoutBooking.mockReset();
});

afterEach(cleanup);

describe('BookingDetailPage', () => {
  it('displays loading state while fetching detail', () => {
    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
    });

    render(<BookingDetailPage bookingId="b-1" />);
    expect(screen.getByText('Đang tải thông tin chi tiết đặt chỗ...')).toBeTruthy();
  });

  it('displays 404 security protection when booking does not belong to user (IDOR prevention)', () => {
    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { status: 404 },
    });

    render(<BookingDetailPage bookingId="b-unknown" />);
    expect(screen.getByText('Không tìm thấy đặt chỗ')).toBeTruthy();
    expect(
      screen.getByText('Đặt chỗ này không tồn tại hoặc bạn không có quyền truy cập vào thông tin này.'),
    ).toBeTruthy();
  });

  it('renders all details: tour title, participants, dates, contact, discount, and total price', () => {
    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: false,
      data: mockBooking,
    });

    render(<BookingDetailPage bookingId="b-1" />);

    expect(screen.getByText('Tour Leo Núi Fansipan 2N1Đ')).toBeTruthy();
    expect(screen.getByText(/TRIP-9999/)).toBeTruthy();
    expect(screen.getByText('Trần Thị B')).toBeTruthy();
    expect(screen.getByText('0987654321')).toBeTruthy();
    expect(screen.getByText('"Đoàn có người ăn chay"')).toBeTruthy();
    expect(screen.getAllByText(/3 khách/).length).toBeGreaterThan(0);
    expect(screen.getByText(/5\.500\.000/)).toBeTruthy();
  });

  it('triggers PayOS checkout when clicking "Thanh toán ngay qua PayOS"', async () => {
    mockCheckoutBooking.mockReturnValue({
      unwrap: () => Promise.resolve({ checkoutUrl: 'https://payos.vn/checkout/xyz' }),
    });

    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: false,
      data: mockBooking,
    });

    render(<BookingDetailPage bookingId="b-1" />);

    const payButton = screen.getByRole('button', { name: /Thanh toán ngay/i });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(mockCheckoutBooking).toHaveBeenCalledWith('b-1');
    });
  });

  it('renders "Hoàn thành chuyến đi" button when CONFIRMED and allows completing trip', async () => {
    mockCompleteBooking.mockReturnValue({
      unwrap: () => Promise.resolve({ ...mockBooking, status: 'COMPLETED' }),
    });

    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: false,
      data: { ...mockBooking, status: 'CONFIRMED', isPaid: true },
    });

    render(<BookingDetailPage bookingId="b-1" />);

    const completeButtons = screen.getAllByRole('button', { name: /Hoàn thành chuyến đi/i });
    expect(completeButtons.length).toBeGreaterThan(0);
    fireEvent.click(completeButtons[0]);

    // Complete modal opens
    const dialog = screen.getByRole('dialog', { name: 'Xác nhận hoàn thành chuyến đi' });
    expect(dialog).toBeTruthy();
    const confirmButton = within(dialog).getByRole('button', { name: /Xác nhận hoàn thành/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockCompleteBooking).toHaveBeenCalledWith('b-1');
    });
  });

  it('renders "Đánh giá tour" button when COMPLETED', () => {
    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: false,
      data: { ...mockBooking, status: 'COMPLETED', isPaid: true },
    });

    render(<BookingDetailPage bookingId="b-1" />);

    const reviewButtons = screen.getAllByRole('button', { name: /Đánh giá/i });
    expect(reviewButtons.length).toBeGreaterThan(0);
  });
});
