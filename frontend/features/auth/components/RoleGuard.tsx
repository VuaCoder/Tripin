'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { selectAuthStatus, selectIsAuthenticated, selectRole } from '../store/authSlice';
import type { UserRole } from '../types';
import { homeForRole } from '../utils/roles';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: ReactNode;
}

export const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const router = useRouter();
  const status = useAppSelector(selectAuthStatus);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);

  useEffect(() => {
    if (status === 'idle') return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (role && !allowedRoles.includes(role)) {
      router.replace(homeForRole(role));
    }
  }, [status, isAuthenticated, role, allowedRoles, router]);

  if (status === 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-desk-travel">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-teal" />
      </div>
    );
  }

  if (!isAuthenticated || (role && !allowedRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
};
