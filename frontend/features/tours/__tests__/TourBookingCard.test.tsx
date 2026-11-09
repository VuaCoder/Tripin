import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), authenticated: true }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }), useSearchParams: () => state.params }));
vi.mock('@/features/auth', () => ({ selectIsAuthenticated: 'authenticated', selectRole: 'role' }));
vi.mock('@/store/hooks', () => ({ useAppSelector: (selector: string) => selector === 'authenticated' ? state.authenticated : state.authenticated ? 'TRAVELER' : null }));
vi.mock('@/features/chat/StartConversationButton', () => ({ StartConversationButton: () => null }));
vi.mock('@/features/review', () => ({ formatVnd: (n: number) => `${n} đ` }));
import { TourBookingCard } from '../components/detail/TourBookingCard';

const tour = {
  id: 't1', title: 'Tour Huế', destination: 'Huế', durationDays: 2, basePrice: 1000000, ratingAvg: 0, ratingCount: 0,
  agePricing: { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 },
  departures: [
    { id: 'd1', date: '2099-01-13', price: 1000000, remaining: 24, isOpen: true },
    { id: 'd2', date: '2099-01-14', price: 1000000, remaining: 24, isOpen: true },
  ],
};
beforeEach(() => { state.params = new URLSearchParams('adults=2&children=1&infants=1&guests=4&departureFrom=2099-01-14'); state.authenticated = true; state.push.mockClear(); });
afterEach(cleanup);

describe('Booking search context', () => {
  it('keeps all age groups and the searched departure in the booking form URL', () => {
    render(<TourBookingCard tour={tour} />);
    expect(screen.getByLabelText('Người lớn').textContent).toBe('2');
    expect(screen.getByLabelText('Trẻ em').textContent).toBe('1');
    expect(screen.getByLabelText('Em bé').textContent).toBe('1');
    expect(screen.getByText('2500000 đ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu đặt tour' }));
    const destination = new URL(state.push.mock.calls[0][0], 'http://localhost');
    expect(Object.fromEntries(destination.searchParams)).toMatchObject({ tourId: 't1', departureId: 'd2', participants: '4', adults: '2', children: '1', infants: '1' });
  });
  it('returns guests to the exact booking selection after login', () => {
    state.authenticated = false;
    render(<TourBookingCard tour={tour} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập để đặt tour' }));
    const login = new URL(state.push.mock.calls[0][0], 'http://localhost');
    expect(login.pathname).toBe('/login');
    const next = new URL(login.searchParams.get('next')!, 'http://localhost');
    expect(next.pathname).toBe('/traveler/bookings/new');
    expect(Object.fromEntries(next.searchParams)).toMatchObject({ departureId: 'd2', participants: '4', adults: '2', children: '1', infants: '1' });
  });
  it('does not reset guests when changing the departure', () => {
    render(<TourBookingCard tour={tour} />);
    fireEvent.click(screen.getByRole('button', { name: /Khởi hành 13/ }));
    expect(screen.getByLabelText('Người lớn').textContent).toBe('2');
    expect(screen.getByLabelText('Em bé').textContent).toBe('1');
  });
  it('preserves a legacy guests URL instead of reverting to one guest', () => {
    state.params = new URLSearchParams('guests=3');
    render(<TourBookingCard tour={tour} />);
    expect(screen.getByLabelText('Người lớn').textContent).toBe('3');
  });
  it('keeps the selected group visible when the departure has too few seats', () => {
    render(<TourBookingCard tour={{ ...tour, departures: [{ ...tour.departures[1], remaining: 3 }] }} />);
    expect(screen.getByRole('alert').textContent).toContain('Chỉ còn 3 chỗ');
    expect(screen.getByRole('button', { name: 'Yêu cầu đặt tour' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Người lớn').textContent).toBe('2');
  });
  it('explains unavailable age pricing without discarding selected children', () => {
    render(<TourBookingCard tour={{ ...tour, agePricing: null }} />);
    expect(screen.getByLabelText('Trẻ em').textContent).toBe('1');
    expect(screen.getByRole('alert').textContent).toContain('chưa công bố giá');
    expect(screen.getByRole('button', { name: 'Yêu cầu đặt tour' }).hasAttribute('disabled')).toBe(true);
  });
});
