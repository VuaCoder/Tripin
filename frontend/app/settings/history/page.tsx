'use client';

import { Suspense } from 'react';
import { BookingHistoryPage, BookingHistorySkeleton } from '@/features/booking';
import { TravelerAccountShell } from '@/features/traveler-account/components';

export default function SettingsBookingHistoryPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<BookingHistorySkeleton />}>
        <BookingHistoryPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
