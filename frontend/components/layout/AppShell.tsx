'use client';

import type { ReactNode } from 'react';
import type { AppRole } from './navigation-config';
import { Header } from './Header';
import { Footer } from './Footer';
import { Container } from './Container';
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
      <main className={`flex-1 flex flex-col ${isAgency ? sidebarStyles.body : ''}`}>
        {fullBleed ? (
          children
        ) : (
          <Container className="flex-1 py-6 sm:py-8">
            {children}
          </Container>
        )}
      </main>
      {footer && <Footer />}
    </div>
  );
}
