'use client';

import { Suspense } from 'react';
import { LoadingState } from '@/components/shared';
import { MyReportsPage } from '@/features/report';
import { TravelerAccountShell } from '@/features/traveler-account/components';

export default function SettingsReportsPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<LoadingState label="Đang tải báo cáo..." />}>
        <MyReportsPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
