'use client';

import { Suspense } from 'react';
import { LoadingState } from '@/components/shared';
import { BookingEntryPage } from '@/features/booking';

/** Booking handoff from either a cart line or a selected tour departure. `useSearchParams` needs a Suspense boundary during prerender. */
export default function TravelerBookingEntryPage() {
  return (
    <Suspense fallback={<LoadingState label="Đang chuẩn bị bước đặt chỗ..." />}>
      <BookingEntryPage />
    </Suspense>
  );
}
