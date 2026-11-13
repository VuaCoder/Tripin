import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RegisterPage } from '../components/RegisterPage';
const nav = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }), useSearchParams: () => nav.params }));
vi.mock('../components/AuthBackground', () => ({ AuthBackground: () => null }));
vi.mock('../components/BackButton', () => ({ BackButton: () => null }));
vi.mock('../components/AuthContainer', () => ({ AuthContainer: ({ onRegisterSuccess }: { onRegisterSuccess: (v: unknown) => void }) => <button onClick={() => onRegisterSuccess({ email: 'member@test.local' })}>Register</button> }));
beforeEach(() => { nav.params = new URLSearchParams(); nav.push.mockReset(); });
afterEach(cleanup);
it('keeps normal traveler registration outside Partner onboarding', () => {
  render(<RegisterPage />); fireEvent.click(screen.getByText('Register'));
  const url = new URL(nav.push.mock.calls[0][0], 'http://localhost');
  expect(url.pathname).toBe('/verify-otp'); expect(url.searchParams.get('purpose')).toBe('REGISTER'); expect(url.searchParams.get('next')).toBe('/home');
});
it('preserves an email invitation continuation through registration', () => {
  const next = '/agency/invitations/accept?token=' + 'a'.repeat(64);
  nav.params.set('next', next);
  render(<RegisterPage />); fireEvent.click(screen.getByText('Register'));
  const url = new URL(nav.push.mock.calls[0][0], 'http://localhost');
  expect(url.searchParams.get('next')).toBe(next);
});
it('rejects external next targets', () => {
  nav.params.set('next', '//attacker.test'); render(<RegisterPage />); fireEvent.click(screen.getByText('Register'));
  expect(new URL(nav.push.mock.calls[0][0], 'http://localhost').searchParams.get('next')).toBe('/home');
});
