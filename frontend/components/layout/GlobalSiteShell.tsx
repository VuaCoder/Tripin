'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

const fullBleedRoutes = new Set([
  '/',
  '/home',
  '/login',
  '/register',
  '/register/traveler',
  '/register/guide',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
]);

/**
 * The application-wide chrome. Header resolves the active role from Redux, so
 * the same navigation stays available to guests and adapts after sign-in.
 * Agency has an independent authentication domain, so its routes keep their
 * isolated shell and never expose Traveler authentication entry points.
 */
export function GlobalSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith('/agency')) {
    return <>{children}</>;
  }

  return <AppShell fullBleed={fullBleedRoutes.has(pathname)}>{children}</AppShell>;
}
