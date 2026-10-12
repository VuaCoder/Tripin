'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

const authRoutes = new Set([
  '/login',
  '/register',
  '/register/traveler',
  '/register/guide',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
]);

const fullBleedRoutes = new Set([
  '/home',
]);

/**
 * The application-wide chrome. Header resolves the active role from Redux, so
 * the same navigation stays available to guests and adapts after sign-in.
 * Agency has an independent authentication domain, so its routes keep their
 * isolated shell and never expose Traveler authentication entry points.
 * The start / landing page ('/') and standalone auth flows ('/login', '/register', etc.)
 * have bespoke full-viewport layouts without the standard site header and footer.
 */
export function GlobalSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (
    pathname === '/' ||
    pathname.startsWith('/agency') ||
    authRoutes.has(pathname) ||
    pathname.startsWith('/register/')
  ) {
    return <>{children}</>;
  }

  return <AppShell fullBleed={fullBleedRoutes.has(pathname)}>{children}</AppShell>;
}
