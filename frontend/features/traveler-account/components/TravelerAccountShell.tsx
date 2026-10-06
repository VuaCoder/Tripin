'use client';
import type { ReactNode } from 'react';
import { TravelerAccountNav } from './TravelerAccountNav';

export function TravelerAccountShell({ children }: { children: ReactNode }) {
  return (
    <div className="animate-fadeInScale space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-3xl border border-surface-container bg-gradient-to-br from-white via-surface-container-low/70 to-secondary-container/35 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border-[28px] border-white/45" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-container/15 bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">manage_accounts</span>
            Trung tâm tài khoản
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">Tài khoản của bạn</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Quản lý thông tin cá nhân và lớp bảo vệ đăng nhập cho hành trình của bạn.
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-28">
          <TravelerAccountNav />
        </aside>
        <section className="min-w-0 rounded-3xl border border-surface-container bg-white p-5 shadow-[0_12px_35px_rgba(0,99,110,0.06)] sm:p-7 lg:p-8">
          {children}
        </section>
      </div>
    </div>
  );
}
