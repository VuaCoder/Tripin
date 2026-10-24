'use client';

import { Suspense, useState } from 'react';
import { AlertCircle, Flag } from 'lucide-react';
import { LoadingState } from '@/components/shared';
import { MyComplaintsPage } from '@/features/complaints';
import { MyReportsPage } from '@/features/report';
import { TravelerAccountShell } from '@/features/traveler-account/components';

export default function SettingsReportsPage() {
  const [tab, setTab] = useState<'COMPLAINTS' | 'REPORTS'>('COMPLAINTS');

  return (
    <TravelerAccountShell>
      <div className="space-y-6">
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTab('COMPLAINTS')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              tab === 'COMPLAINTS'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertCircle className="size-4" />
            <span>Khiếu nại dịch vụ tour</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('REPORTS')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              tab === 'REPORTS'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Flag className="size-4" />
            <span>Báo cáo vi phạm sàn</span>
          </button>
        </div>

        <Suspense fallback={<LoadingState label="Đang tải dữ liệu..." />}>
          {tab === 'COMPLAINTS' ? <MyComplaintsPage /> : <MyReportsPage />}
        </Suspense>
      </div>
    </TravelerAccountShell>
  );
}
