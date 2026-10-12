'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['TRAVELER']}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </div>
    </RoleGuard>
  );
}
