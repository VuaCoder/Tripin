'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { ForbiddenPage } from '@/components/shared/ForbiddenPage';
import { AccessCheckLoader } from './AccessCheckLoader';
import { selectAuthStatus, selectIsAuthenticated, selectRole } from '../store/authSlice';
import type { UserRole } from '../types';
import { homeForRole } from '../utils/roles';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  loadingFallback?: ReactNode;
  loginPath?: string;
  showForbidden?: boolean;
}

export const RoleGuard = ({
  allowedRoles,
  children,
  loadingFallback,
  loginPath = '/login',
  showForbidden = false,
}: RoleGuardProps) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const status = useAppSelector(selectAuthStatus);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || status === 'idle') return;
    if (!isAuthenticated) {
      router.replace(loginPath);
      return;
    }
    if (!showForbidden && role && !allowedRoles.includes(role)) {
      router.replace(homeForRole(role));
    }
  }, [mounted, status, isAuthenticated, role, allowedRoles, loginPath, showForbidden, router]);

  if (!mounted || status === 'idle') {
    return <>{loadingFallback ?? <AccessCheckLoader />}</>;
  }

  if (isAuthenticated && role && !allowedRoles.includes(role)) {
    if (showForbidden) {
      return <ForbiddenPage role={role} allowedRoles={allowedRoles} />;
    }
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

