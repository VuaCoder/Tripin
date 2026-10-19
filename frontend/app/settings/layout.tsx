'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['TRAVELER']}>
      <div className="w-full">
        {children}
      </div>
    </RoleGuard>
  );
}
