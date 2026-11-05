import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getActiveNavigationHref,
  navigationByRole,
} from '@/components/layout/navigation-config';
const mocks = vi.hoisted(() => ({
  role: 'TOUR_GUIDE',
  authenticated: true,
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('@/store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      auth: {
        status: mocks.authenticated ? 'authenticated' : 'unauthenticated',
        accessToken: mocks.authenticated ? 'token' : null,
        user: mocks.authenticated ? { role: mocks.role } : null,
      },
    }),
}));
import GuideLayout from '@/app/guide/layout';
afterEach(() => {
  cleanup();
  mocks.replace.mockClear();
  mocks.authenticated = true;
  mocks.role = 'TOUR_GUIDE';
});
describe('Guide finance entry points', () => {
  it('lets a Guide mount the private pages', () => {
    render(
      <GuideLayout>
        <p>Private finance</p>
      </GuideLayout>,
    );
    expect(screen.getByText('Private finance')).toBeTruthy();
  });
  it('redirects a guest before mounting private content', () => {
    mocks.authenticated = false;
    render(
      <GuideLayout>
        <p>Private finance</p>
      </GuideLayout>,
    );
    expect(screen.queryByText('Private finance')).toBeNull();
    expect(mocks.replace).toHaveBeenCalledWith('/login');
  });
  it('redirects a Traveler before mounting private content', () => {
    mocks.role = 'TRAVELER';
    render(
      <GuideLayout>
        <p>Private finance</p>
      </GuideLayout>,
    );
    expect(screen.queryByText('Private finance')).toBeNull();
    expect(mocks.replace).toHaveBeenCalledWith('/home');
  });
  it('provides both links and marks only the most specific route active for desktop/mobile', () => {
    const items = navigationByRole.TOUR_GUIDE;
    expect(items.map((item) => item.href)).toContain('/guide/earnings');
    expect(items.map((item) => item.href)).toContain('/premium');
    expect(getActiveNavigationHref('/guide/earnings', items)).toBe(
      '/guide/earnings',
    );
    expect(getActiveNavigationHref('/premium', items)).toBe(
      '/premium',
    );
    expect(getActiveNavigationHref('/guide', items)).toBe('/guide');
  });
});
