'use client';

import { Suspense } from 'react';
import { BookingHistoryPage } from '@/features/booking/components/BookingHistoryPage';
import { BookingHistorySkeleton } from '@/features/booking/components/BookingHistorySkeleton';
import { TravelerAccountShell } from '@/features/traveler-account/components/TravelerAccountShell';

export default function SettingsBookingHistoryPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<BookingHistorySkeleton />}>
        <BookingHistoryPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
