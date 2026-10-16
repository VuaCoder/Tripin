'use client';

import React from 'react';
import Link from 'next/link';
import { AgencyCommissionSettings } from '@/features/agency/components/AgencyCommissionSettings';
import { Building2, Percent, ShieldCheck } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';

export default function AgencyCommissionSettingsPage() {
  const user = useAppSelector(selectUser);
  const isVerified = user?.agencyProfile?.verificationStatus === 'VERIFIED';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Chiết khấu Hoa hồng
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Chính sách phân chia doanh thu và công cụ mô phỏng hoa hồng nền tảng
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            isVerified 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <ShieldCheck size={14} className={isVerified ? 'text-emerald-600' : 'text-amber-600'} />
            {isVerified ? 'Đối tác chính thức' : 'Hồ sơ đang xét duyệt'}
          </span>
        </div>
      </div>

      {/* Two-Function Tab Controller */}
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
            className="inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all bg-white text-teal-800 shadow-sm shadow-slate-900/5 cursor-pointer"
          >
            <Percent size={18} className="text-teal-600" />
            <span>Chiết khấu Hoa hồng</span>
          </Link>
        </div>
      </div>

      {/* Commission Settings Content */}
      <div className="pt-2">
        <AgencyCommissionSettings />
      </div>
    </main>
  );
}
