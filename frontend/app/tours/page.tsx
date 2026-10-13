import { Suspense } from 'react';
import { TourListPage } from '@/features/tours';

export default function ToursPage() {
  return (
    <Suspense fallback={null}>
      <TourListPage />
    </Suspense>
  );
}
