'use client';

import { TravelerAccountShell } from '@/features/traveler-account/components/TravelerAccountShell';

export default function SettingsLoading() {
  return (
    <TravelerAccountShell>
      <div className="space-y-6 animate-pulse" role="status" aria-label="Đang tải dữ liệu...">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="size-12 rounded-2xl bg-slate-200" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded-lg bg-slate-200" />
            <div className="h-3.5 w-64 rounded bg-slate-100" />
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="relative overflow-hidden h-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-slate-100/60 before:to-transparent"
            />
          ))}
        </div>
      </div>
    </TravelerAccountShell>
  );
}

