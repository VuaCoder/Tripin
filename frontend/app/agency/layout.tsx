'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RoleGuard } from '@/features/auth';

export default function AgencyLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = ['/agency/login', '/agency/register', '/agency/verify-otp'].includes(pathname);

  if (isAuthRoute) return <>{children}</>;

  return <RoleGuard allowedRoles={['AGENCY']} loginPath="/agency/login">{children}</RoleGuard>;
}
