import type { ReactNode } from 'react';
import type { AppRole } from './navigation-config';
import { Header } from './Header';
import { Footer } from './Footer';

export interface AppShellProps {
  children: ReactNode;
  role?: AppRole;
  footer?: boolean;
  className?: string;
  fullBleed?: boolean;
}

export function AppShell({
  children,
  role = 'PUBLIC',
  footer = true,
  className = '',
  fullBleed = false,
}: AppShellProps) {
  return (
    <div className={`flex min-h-screen flex-col bg-slate-50 text-slate-800 ${className}`}>
      <Header role={role} />
      <main
        className={
          fullBleed
            ? 'w-full flex-1'
            : 'mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8'
        }
      >
        {children}
      </main>
      {footer && <Footer />}
    </div>
  );
}
