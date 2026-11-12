'use client';

import React from 'react';
import Link from 'next/link';
import { AgencyTeamPage } from '@/features/agency/components/AgencyTeamPage';
import { Building2, Percent, Users } from 'lucide-react';

export default function AgencyTeamSettingsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Three Independent Settings Tabs */}
      <div className="flex items-center justify-start">
        <div className="inline-flex rounded-2xl bg-slate-100/90 p-1.5 border border-slate-200/70 shadow-xs">
          <Link
            href="/agency/settings/profile"
            className="inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <Building2 size={18} className="text-slate-400" />
            <span>Hồ sơ Doanh nghiệp</span>
          </Link>

          <Link
            href="/agency/settings/commission"
            className="inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <Percent size={18} className="text-slate-400" />
            <span>Chiết khấu Hoa hồng</span>
          </Link>

          <Link
            href="/agency/settings/team"
            className="inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all bg-white text-teal-800 shadow-sm shadow-slate-900/5 cursor-pointer"
          >
            <Users size={18} className="text-teal-600" />
            <span>Bảng thành viên</span>
          </Link>
        </div>
      </div>

      {/* Team Content */}
      <div className="pt-2">
        <AgencyTeamPage />
      </div>
    </main>
  );
}
