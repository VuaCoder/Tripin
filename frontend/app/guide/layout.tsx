'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';

export default function GuideLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowedRoles={['TOUR_GUIDE']}>{children}</RoleGuard>;
}
