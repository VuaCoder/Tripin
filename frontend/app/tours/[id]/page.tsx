'use client';
import { useParams } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/shared';
import { useGetTourDetailQuery } from '@/features/review';
import { TourDetailView } from '@/features/tours/components/detail/TourDetailView';
export default function TourDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tour, isLoading, error, refetch } = useGetTourDetailQuery(id, { skip: !id });
  if (isLoading) return <LoadingState label="Đang tải thông tin tour…" />;
  if (!tour || error) return <ErrorState title="Không tìm thấy tour" message="Tour không tồn tại hoặc đã ngừng hiển thị." actionLabel="Thử lại" onAction={() => void refetch()} />;
  return <TourDetailView tour={tour} />;
}
