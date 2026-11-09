import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }), useSearchParams: () => state.params }));
vi.mock('../components/AuthBackground', () => ({ AuthBackground: () => null }));
vi.mock('../components/BackButton', () => ({ BackButton: () => null }));
vi.mock('../components/AuthContainer', () => ({ AuthContainer: ({ onLoginSuccess }: any) => <>
  <button onClick={() => onLoginSuccess({ twoFactorRequired: false, user: { role: 'TRAVELER' } })}>Login</button>
  <button onClick={() => onLoginSuccess({ twoFactorRequired: true, email: 'qa@example.com' })}>Login 2FA</button>
</> }));
import { LoginPage } from '../components/LoginPage';

const booking = '/traveler/bookings/new?tourId=t1&departureId=d1&participants=4&adults=2&children=1&infants=1';
beforeEach(() => { state.push.mockClear(); state.params = new URLSearchParams({ next: booking }); });
afterEach(cleanup);
describe('Resume booking after authentication', () => {
  it('navigates to the selected booking instead of home', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(state.push).toHaveBeenCalledWith(booking);
  });
  it('carries the exact selection through the email OTP challenge', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Login 2FA' }));
    const next = new URL(state.push.mock.calls[0][0], 'http://localhost');
    expect(next.pathname).toBe('/verify-otp');
    expect(next.searchParams.get('purpose')).toBe('LOGIN_2FA');
    expect(next.searchParams.get('next')).toBe(booking);
  });
});
