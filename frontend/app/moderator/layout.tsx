'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';
import { AppShell } from '@/components/layout';

export default function ModeratorLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['MODERATOR']}>
      <AppShell role="MODERATOR">{children}</AppShell>
    </RoleGuard>
  );
}
