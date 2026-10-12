'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { LoadingState } from '@/components/shared';
import { BookingDetailPage } from '@/features/booking';
import { TravelerAccountShell } from '@/features/traveler-account/components';

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
