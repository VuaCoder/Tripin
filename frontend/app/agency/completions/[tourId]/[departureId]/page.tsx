'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AgencyLoading } from '@/features/agency/AgencyCommon';
export default function Page() {
  const { tourId, departureId } = useParams<{ tourId: string; departureId: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/agency/completions?tourId=${encodeURIComponent(tourId)}&departureId=${encodeURIComponent(departureId)}`); }, [router, tourId, departureId]);
  return <AgencyLoading label="Đang mở báo cáo…" />;
}
