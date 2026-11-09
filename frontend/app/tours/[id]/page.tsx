'use client';

import { useLayoutEffect } from 'react';
import { useParams } from 'next/navigation';
import { ErrorState } from '@/components/shared';
import { TourDetailSkeleton } from '@/features/tours/components/detail/TourDetailSkeleton';
import { useGetTourDetailQuery } from '@/features/review';
import { TourDetailView } from '@/features/tours/components/detail/TourDetailView';

export default function TourDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tour, isLoading, error, refetch } = useGetTourDetailQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [id]);

  if (isLoading || (tour && tour.id !== id)) return <TourDetailSkeleton />;
  if (!tour || error) {
    return (
      <ErrorState
        title="Không tìm thấy tour"
        message="Tour không tồn tại hoặc đã ngừng hiển thị."
        actionLabel="Thử lại"
        onAction={() => void refetch()}
      />
    );
  }

  return <TourDetailView tour={tour} />;
}
