'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { TravelerAccountNav } from './TravelerAccountNav';

export function TravelerAccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6 pb-10">
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-28">
          <TravelerAccountNav />
        </aside>
        <section className="min-w-0 rounded-3xl border border-surface-container bg-white p-5 shadow-[0_12px_35px_rgba(0,99,110,0.06)] sm:p-7 lg:p-8">
          <div key={pathname} className="animate-slide-up-fade min-w-0">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
