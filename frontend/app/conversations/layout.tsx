'use client';
import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';
export default function ConversationLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowedRoles={['TRAVELER', 'TOUR_GUIDE']}>{children}</RoleGuard>;
}
