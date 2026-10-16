'use client';

import type { ReactNode } from 'react';
import type { AppRole } from './navigation-config';
import { Header } from './Header';
import { Footer } from './Footer';
import { useAppSelector } from '@/store/hooks';
import { selectUser, selectIsAuthenticated } from '@/features/auth';
import sidebarStyles from '@/features/agency/components/AgencySidebar.module.css';

export interface AppShellProps {
  children: ReactNode;
  role?: AppRole;
  header?: boolean;
  footer?: boolean;
  className?: string;
  fullBleed?: boolean;
}

export function AppShell({
  children,
  role,
  header = true,
  footer = true,
  className = '',
  fullBleed = false,
}: AppShellProps) {
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const effectiveRole: AppRole = role || (isAuthenticated && user?.role ? (user.role as AppRole) : 'PUBLIC');
  const isAgency = effectiveRole === 'AGENCY';

  return (
    <div className={`flex min-h-screen flex-col bg-slate-50 text-slate-800 ${isAgency ? sidebarStyles.shell : ''} ${className}`}>
      {header && <Header role={role} />}
      <main
        className={`${isAgency ? sidebarStyles.body : ''} ${
          fullBleed
            ? 'w-full flex-1'
            : 'mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8'
        }`}
      >
        {children}
      </main>
      {footer && <Footer />}
    </div>
  );
}
