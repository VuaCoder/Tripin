'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowedRoles={['AGENCY']}>{children}</RoleGuard>;
}
