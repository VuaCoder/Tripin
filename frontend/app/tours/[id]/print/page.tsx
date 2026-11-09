'use client';

import { useParams } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/shared';
import { useGetTourDetailQuery } from '@/features/review';
import { TourPrintView } from '@/features/tours/components/detail/TourPrintView';

export default function TourPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tour, isLoading, error, refetch } = useGetTourDetailQuery(id, { skip: !id });
  if (isLoading) return <LoadingState label="Đang tải chương trình tour…" />;
  if (!tour || error) return <ErrorState title="Không tìm thấy tour" message="Tour không tồn tại hoặc đã ngừng hiển thị." actionLabel="Thử lại" onAction={() => void refetch()} />;
  return <TourPrintView tour={tour} />;
}
