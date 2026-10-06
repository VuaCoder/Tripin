'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';
import { AppShell } from '@/components/layout';

export default function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['TOUR_GUIDE']}>
      <AppShell role="TOUR_GUIDE">{children}</AppShell>
    </RoleGuard>
  );
}
