import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  bookings: { data: { items: [] as Record<string, unknown>[] }, isLoading: false },
  tours: { data: { items: [] as Record<string, unknown>[] }, isLoading: false },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('../api/bookingApi', () => ({ useGetMyBookingsQuery: () => mocks.bookings }));
vi.mock('@/features/custom-tours/api', () => ({ useListCustomToursQuery: () => mocks.tours }));

import { IncompleteBookingBanner } from '../components/IncompleteBookingBanner';

beforeEach(() => {
  mocks.push.mockReset();
  mocks.bookings = { data: { items: [] }, isLoading: false };
  mocks.tours = { data: { items: [] }, isLoading: false };
});

afterEach(cleanup);

describe('IncompleteBookingBanner', () => {
  it('resumes an accepted group offer at the passenger form', () => {
    mocks.tours = {
      data: {
        items: [{
          id: 'ct1',
          status: 'ACCEPTED',
          nextStep: 'ENTER_PASSENGERS',
          participants: 3,
          sourceTour: { id: 't1', title: 'Tour đoàn Đà Nẵng', images: [] },
          offer: { departureDate: '2099-05-20T00:00:00.000Z' },
        }],
      },
      isLoading: false,
    };

    render(<IncompleteBookingBanner />);
    expect(screen.getByText('Hoàn tất đặt chỗ cho đoàn của bạn tại')).toBeTruthy();
    expect(screen.getByText('Tour đoàn Đà Nẵng')).toBeTruthy();

    fireEvent.click(screen.getByRole('complementary', { name: 'Tiếp tục hoàn tất đặt tour' }));
    expect(mocks.push).toHaveBeenCalledWith('/traveler/bookings/new?customTourRequestId=ct1');
  });

  it('prefers a pending payment over a group request and hides once the group request has its booking', () => {
    mocks.bookings = {
      data: { items: [{ id: 'b1', status: 'PENDING', isPaid: false, participants: 2, departureDate: '2026-12-01T00:00:00.000Z', tour: { title: 'Tour biển' } }] },
      isLoading: false,
    };
    mocks.tours = {
      data: { items: [{ id: 'ct1', participants: 3, currentBooking: { id: 'b2' } }] },
      isLoading: false,
    };

    render(<IncompleteBookingBanner />);
    fireEvent.click(screen.getByRole('complementary', { name: 'Tiếp tục hoàn tất đặt tour' }));
    expect(mocks.push).toHaveBeenCalledWith('/settings/history/b1');
  });

  it('renders nothing when both lists are empty', () => {
    const { container } = render(<IncompleteBookingBanner />);
    expect(container.firstChild).toBeNull();
  });
});
