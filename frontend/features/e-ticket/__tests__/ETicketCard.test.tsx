import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ETicketDto } from '../types';
import { ETicketCard } from '../components/ETicketCard';

const mockTicket: ETicketDto = {
  id: 'etk-uuid-001',
  code: 'ETK-ABC123XYZ4567890',
  status: 'VALID',
  booking: {
    id: 'b-001',
    code: 'TRP-BK1001',
    status: 'CONFIRMED',
    isPaid: true,
    totalAmount: 3500000,
    contactPhone: '0912345678',
    endDate: '2026-11-20T10:00:00.000Z',
  },
  tour: {
    id: 't-001',
    title: 'Khám Phá Vịnh Hạ Long 3N2Đ',
    destination: 'Quảng Ninh',
    durationDays: 3,
  },
  departureDate: '2026-11-17T08:00:00.000Z',
  participants: 2,
  holderName: 'Nguyễn Văn Minh',
  issuedAt: '2026-11-01T14:30:00.000Z',
};

afterEach(cleanup);

describe('ETicketCard', () => {
  it('renders tour information, traveler details, and ticket code', () => {
    render(<ETicketCard ticket={mockTicket} />);

    expect(screen.getByText('Khám Phá Vịnh Hạ Long 3N2Đ')).toBeTruthy();
    expect(screen.getByText('Quảng Ninh')).toBeTruthy();
    expect(screen.getByText('Nguyễn Văn Minh')).toBeTruthy();
    expect(screen.getByText(/0912345678/)).toBeTruthy();
    expect(screen.getByText('ETK-ABC123XYZ4567890')).toBeTruthy();
    expect(screen.getByText(/3\.500\.000/)).toBeTruthy();
    expect(screen.getByText(/TRP-BK1001/)).toBeTruthy();
    expect(screen.getByText('VÉ HỢP LỆ · SẴN SÀNG')).toBeTruthy();
  });

  it('triggers window.print when clicking "In vé / Lưu PDF"', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<ETicketCard ticket={mockTicket} />);

    const printButton = screen.getByRole('button', { name: /In vé \/ Lưu PDF/i });
    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('renders CANCELLED status badge when ticket is cancelled', () => {
    const cancelledTicket: ETicketDto = {
      ...mockTicket,
      status: 'CANCELLED',
    };
    render(<ETicketCard ticket={cancelledTicket} />);

    expect(screen.getByText('ĐÃ HỦY · KHÔNG CÒN HIỆU LỰC')).toBeTruthy();
  });

  it('renders USED status badge when trip is completed', () => {
    const usedTicket: ETicketDto = {
      ...mockTicket,
      status: 'USED',
    };
    render(<ETicketCard ticket={usedTicket} />);

    expect(screen.getByText('ĐÃ HOÀN TẤT · ĐÃ SỬ DỤNG')).toBeTruthy();
  });
});
