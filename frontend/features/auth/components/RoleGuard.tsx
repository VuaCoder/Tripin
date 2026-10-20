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
  loginPath?: string;
}

export const RoleGuard = ({ allowedRoles, children, loginPath = '/login' }: RoleGuardProps) => {
  const router = useRouter();
  const status = useAppSelector(selectAuthStatus);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);

  useEffect(() => {
    if (status === 'idle') return;
    if (!isAuthenticated) {
      router.replace(loginPath);
      return;
    }
    if (role && !allowedRoles.includes(role)) {
      router.replace(homeForRole(role));
    }
  }, [status, isAuthenticated, role, allowedRoles, loginPath, router]);

  if (status === 'idle') {
    return (
      <div className="w-full min-h-[60vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse" role="status" aria-label="Đang chuẩn bị dữ liệu...">
        <div className="h-8 w-48 rounded-lg bg-slate-200/80 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
        </div>
        <div className="h-64 rounded-2xl bg-slate-100 w-full" />
        <span className="sr-only">Đang kiểm tra quyền truy cập...</span>
      </div>
    );
  }

  if (!isAuthenticated || (role && !allowedRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
};

