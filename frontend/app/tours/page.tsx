import { Suspense } from 'react';
import { LoadingState } from '@/components/shared';
import { TourListPage } from '@/features/tours';

export default function ToursPage() {
  return (
      <Suspense fallback={<LoadingState label="Đang chuẩn bị danh sách tour..." className="min-h-[52vh]" />}>
        <TourListPage />
      </Suspense>
  );
}
