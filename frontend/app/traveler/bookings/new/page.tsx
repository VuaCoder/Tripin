'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingState } from '@/components/shared';
import { BookingEntryPage } from '@/features/booking';
import { GroupBookingEntry } from '@/features/custom-tours';

/** An accepted group request takes over the screen; otherwise the regular departure flow runs. */
function BookingEntrySwitch() {
  const requestId = useSearchParams().get('customTourRequestId');
  return requestId ? <GroupBookingEntry requestId={requestId} /> : <BookingEntryPage />;
}

/** Booking handoff from a selected tour departure. `useSearchParams` needs a Suspense boundary during prerender. */
export default function TravelerBookingEntryPage() {
  return (
    <Suspense fallback={<LoadingState label="Đang chuẩn bị bước đặt chỗ..." />}>
      <BookingEntrySwitch />
    </Suspense>
  );
}
