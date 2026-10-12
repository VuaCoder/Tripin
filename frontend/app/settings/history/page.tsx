'use client';

import { Suspense } from 'react';
import { LoadingState } from '@/components/shared';
import { BookingHistoryPage } from '@/features/booking';
import { TravelerAccountShell } from '@/features/traveler-account/components';

export default function SettingsBookingHistoryPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<LoadingState label="Đang tải lịch sử đặt chỗ..." />}>
        <BookingHistoryPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
