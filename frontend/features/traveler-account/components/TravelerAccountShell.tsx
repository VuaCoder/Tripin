'use client';
import type { ReactNode } from 'react';
import { TravelerAccountNav } from './TravelerAccountNav';

export function TravelerAccountShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-canvas pt-8 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-headline-lg text-brand-ink mb-6">Tài khoản Traveler</h1>
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 shrink-0">
            <TravelerAccountNav />
          </aside>
          <main className="flex-1 bg-surface-containerLowest rounded-xl shadow-elevation1 border border-brand-border p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
