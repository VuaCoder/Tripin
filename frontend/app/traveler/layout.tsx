'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';
import { TravelerAccountShell } from '@/features/traveler-account/components';

export default function TravelerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['TRAVELER']}>
      <TravelerAccountShell>{children}</TravelerAccountShell>
    </RoleGuard>
  );
}
