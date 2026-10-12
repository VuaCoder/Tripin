'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { LoadingState } from '@/components/shared';
import { BookingDetailPage } from '@/features/booking';

export default function TravelerBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const bookingId = typeof params?.id === 'string' ? params.id : '';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Suspense fallback={<LoadingState label="Đang tải chi tiết đặt chỗ..." />}>
        <BookingDetailPage bookingId={bookingId} />
      </Suspense>
    </div>
  );
}
