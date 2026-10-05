'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';

export default function TravelerLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowedRoles={['TRAVELER']}>{children}</RoleGuard>;
}
