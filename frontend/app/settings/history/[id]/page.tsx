'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { LoadingState } from '@/components/shared/LoadingState';
import { BookingDetailPage } from '@/features/booking/components/BookingDetailPage';
import { TravelerAccountShell } from '@/features/traveler-account/components/TravelerAccountShell';

export default function SettingsBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const bookingId = typeof params?.id === 'string' ? params.id : '';

  return (
    <TravelerAccountShell>
      <Suspense fallback={<LoadingState label="Đang tải chi tiết đặt chỗ..." />}>
        <BookingDetailPage bookingId={bookingId} />
      </Suspense>
    </TravelerAccountShell>
  );
}
