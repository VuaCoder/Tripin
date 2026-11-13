'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';
import { WishlistToast } from '@/features/wishlist';

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
 * Agency operations and workplace onboarding own their shells. Account auth is
 * shared; tenant membership determines access inside an agency.
 * The start / landing page ('/') and standalone auth flows ('/login', '/register', etc.)
 * have bespoke full-viewport layouts without the standard site header and footer.
 */
export function GlobalSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (/^\/tours\/[^/]+\/print\/?$/.test(pathname)) return <>{children}</>;

  if (
    pathname === '/' ||
    pathname.startsWith('/agency') ||
    pathname.startsWith('/workplaces') ||
    pathname.startsWith('/moderator') ||
    pathname.startsWith('/application-status') ||
    authRoutes.has(pathname) ||
    pathname.startsWith('/register/')
  ) {
    return (
      <>
        {children}
        <WishlistToast />
      </>
    );
  }

  const isConversations = pathname.startsWith('/conversations');

  return (
    <AppShell
      fullBleed={fullBleedRoutes.has(pathname)}
      footer={!isConversations}
    >
      {children}
      <WishlistToast />
    </AppShell>
  );
}
