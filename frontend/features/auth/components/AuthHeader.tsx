'use client';

import React from 'react';
import Link from 'next/link';

export const AuthHeader: React.FC = () => {
  return (
    <header className="w-full px-6 py-4 flex items-center justify-between z-20">
      <div className="flex items-center gap-3">
        {/* Mobile / Header Mini Logo Link */}
        <Link 
          href="/" 
          aria-label="Tripri Trang chủ" 
          className="flex items-center gap-2 group focus:outline-none"
        >
          <span className="font-extrabold text-xl tracking-tight text-brand-tealDark group-hover:text-brand-teal transition-colors">
            Tripri
          </span>
        </Link>
      </div>

      {/* Quick Help & Language Switcher */}
      <div className="flex items-center gap-4 text-sm font-medium">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 border border-slate-200/80 shadow-sm text-slate-700">
          <svg className="w-4 h-4 text-brand-teal" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" x2="22" y1="12" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className="font-semibold text-xs">VIE (Tiếng Việt)</span>
        </div>

        <Link 
          href="/support" 
          className="hidden sm:inline-flex text-slate-600 hover:text-brand-teal transition-colors font-medium"
        >
          Hỗ trợ 24/7
        </Link>
      </div>
    </header>
  );
};
