import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingDto } from '@/features/booking';
import type { ETicketDto } from '../types';

const mockUseGetETicketByBookingIdQuery = vi.fn();
const mockUseGetETicketByIdQuery = vi.fn();
const mockUseGetBookingByIdQuery = vi.fn();

vi.mock('../api/eTicketApi', () => ({
  useGetETicketByBookingIdQuery: (id: string, opts?: any) => mockUseGetETicketByBookingIdQuery(id, opts),
  useGetETicketByIdQuery: (id: string, opts?: any) => mockUseGetETicketByIdQuery(id, opts),
}));

vi.mock('@/features/booking', () => ({
  useGetBookingByIdQuery: (id: string, opts?: any) => mockUseGetBookingByIdQuery(id, opts),
}));

vi.mock('@/features/payment', () => ({
  useCheckoutBookingMutation: () => [vi.fn(), { isLoading: false }],
}));

import { ETicketView } from '../components/ETicketView';

const mockTicket: ETicketDto = {
  id: 'etk-001',
  code: 'ETK-1111222233334444',
  status: 'VALID',
  booking: {
    id: 'b-001',
    code: 'TRP-BK1001',
    status: 'CONFIRMED',
    isPaid: true,
    totalAmount: 2000000,
    contactPhone: '0901234567',
  },
  tour: {
    id: 't-001',
    title: 'Tour Sapa 2N1Đ',
    destination: 'Lào Cai',
  },
  departureDate: '2026-12-01T08:00:00.000Z',
  participants: 1,
  holderName: 'Lê Văn C',
  issuedAt: '2026-11-15T10:00:00.000Z',
};

const mockPendingBooking: BookingDto = {
  id: 'b-002',
  bookingCode: 'TRP-BK1002',
  status: 'PENDING',
  tour: { id: 't-002', title: 'Tour Nha Trang 3N2Đ' },
  departureId: 'd-002',
  departureDate: '2026-12-05T08:00:00.000Z',
  endDate: '2026-12-07T18:00:00.000Z',
  participants: 2,
  unitPrice: 1500000,
  subtotal: 3000000,
  discountAmount: 0,
  totalAmount: 3000000,
  contact: { fullName: 'Phạm Thị D', phone: '0933333333' },
  isPaid: false,
  refundRequired: false,
  createdAt: '2026-11-16T10:00:00.000Z',
};

beforeEach(() => {
  mockUseGetETicketByBookingIdQuery.mockReset();
  mockUseGetETicketByIdQuery.mockReset();
  mockUseGetBookingByIdQuery.mockReset();
});

afterEach(cleanup);

describe('ETicketView', () => {
  it('renders loading state while ticket is loading', () => {
    mockUseGetETicketByBookingIdQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
    });
    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
    });
    mockUseGetETicketByIdQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
    });

    render(<ETicketView bookingId="b-001" />);
    expect(screen.getByText('Đang kiểm tra thông tin vé điện tử...')).toBeTruthy();
  });

  it('renders ETicketCard when valid ticket is returned', () => {
    mockUseGetETicketByBookingIdQuery.mockReturnValue({
      isLoading: false,
      data: mockTicket,
    });
    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
    });
    mockUseGetETicketByIdQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
    });

    render(<ETicketView bookingId="b-001" />);
    expect(screen.getByText('Tour Sapa 2N1Đ')).toBeTruthy();
    expect(screen.getByText('Lê Văn C')).toBeTruthy();
    expect(screen.getByText('ETK-1111222233334444')).toBeTruthy();
  });

  it('renders ETicketNotEligible when booking is unpaid / PENDING', () => {
    mockUseGetETicketByBookingIdQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
    });
    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: false,
      data: mockPendingBooking,
    });
    mockUseGetETicketByIdQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
    });

    render(<ETicketView bookingId="b-002" />);
    expect(screen.getByText('Chưa đủ điều kiện phát hành vé')).toBeTruthy();
    expect(screen.getByText('Đơn đặt chỗ chưa được thanh toán')).toBeTruthy();
    expect(screen.getByText(/Thanh toán ngay để nhận vé/)).toBeTruthy();
  });

  it('renders 404 security protection when ticket not found or foreign ticket', () => {
    mockUseGetETicketByBookingIdQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
    });
    mockUseGetBookingByIdQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
    });
    mockUseGetETicketByIdQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
    });

    render(<ETicketView bookingId="unknown-booking" />);
    expect(screen.getByText('Không tìm thấy vé điện tử')).toBeTruthy();
    expect(
      screen.getByText(/Vé điện tử này không tồn tại trong hệ thống, chưa được phát hành, hoặc bạn không có quyền truy cập/),
    ).toBeTruthy();
  });
});
