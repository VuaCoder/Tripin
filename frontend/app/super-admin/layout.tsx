'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';
import { AppShell } from '@/components/layout';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN']}>
      <AppShell role="SUPER_ADMIN">{children}</AppShell>
    </RoleGuard>
  );
}
