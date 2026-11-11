'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AuthBackground, BackButton } from '@/features/auth';

interface AgencyAuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  backHref?: string;
  onBack?: () => void;
  wide?: boolean;
}

export function AgencyAuthShell({ eyebrow, title, description, children, backHref = '/', onBack, wide = false }: AgencyAuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-desk-travel px-4 py-8 text-slate-800 selection:bg-brand-teal selection:text-white sm:px-6 lg:py-12">
      <AuthBackground />
      <BackButton fallbackUrl={backHref} onClick={onBack} />

      <main className={`relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>
        <section className="grid w-full overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_28px_80px_-24px_rgba(0,63,70,0.38)] backdrop-blur-xl lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#003f46] via-[#00636e] to-[#087e8b] p-10 text-white lg:flex lg:flex-col lg:items-center lg:justify-center lg:text-center">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/10 bg-white/5" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-amber-300/10 blur-2xl" />
            <div className="relative flex flex-col items-center gap-4">
              <Link href="/" className="inline-flex items-center justify-center" aria-label="Tripri home">
                <img
                  src="/images/tripri-logo.png"
                  alt="Tripri"
                  className="h-14 w-auto object-contain brightness-0 invert"
                />
              </Link>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-100">Cổng đối tác du lịch</p>
              <p className="max-w-[240px] text-sm leading-relaxed text-cyan-50/85">
                Đồng hành cùng Tripri phát triển thương hiệu lữ hành.
              </p>
            </div>
          </aside>

          <div className={`flex flex-col justify-center ${wide ? 'p-5 sm:p-8 lg:p-10' : 'p-6 sm:p-10 lg:p-12'}`}>
            <div className="mb-7 lg:hidden">
              <Link href="/" className="inline-flex items-center gap-2 text-brand-teal" aria-label="Tripri home">
                <img
                  src="/images/tripri-logo.png"
                  alt="Tripri"
                  className="h-9 w-auto object-contain"
                />
              </Link>
            </div>
            <header className="mb-7">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-tealLight">{eyebrow}</p>
              <h1 className="font-jakarta text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
            </header>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
