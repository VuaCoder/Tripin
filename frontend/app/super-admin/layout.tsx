'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN']}>
      {children}
    </RoleGuard>
  );
}
