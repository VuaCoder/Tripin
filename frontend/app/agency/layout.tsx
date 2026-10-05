'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';
import { AppShell } from '@/components/layout';

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['AGENCY']}>
      <AppShell role="AGENCY">{children}</AppShell>
    </RoleGuard>
  );
}
