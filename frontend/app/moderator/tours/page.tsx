'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ModerationTourListPage, TOUR_STATUS_LABELS, type ModerationTourStatus } from '@/features/moderation';

function ToursWithFilter() {
  const raw = useSearchParams().get('status');
  const initial = raw && raw in TOUR_STATUS_LABELS ? (raw as ModerationTourStatus) : 'ALL';
  return <ModerationTourListPage initialStatus={initial} />;
}

export default function ModeratorToursRoute() {
  return (
    <Suspense fallback={null}>
      <ToursWithFilter />
    </Suspense>
  );
}
