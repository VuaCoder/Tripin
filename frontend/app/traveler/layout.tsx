'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';
import { AppShell } from '@/components/layout';

export default function TravelerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['TRAVELER']}>
      <AppShell role="TRAVELER">{children}</AppShell>
    </RoleGuard>
  );
}
