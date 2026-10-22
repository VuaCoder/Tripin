'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';

export default function ModeratorLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['MODERATOR', 'SUPER_ADMIN']}>
      {children}
    </RoleGuard>
  );
}
