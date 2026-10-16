import { Suspense } from 'react';
import { AgencyBookingsPage } from '@/features/agency/AgencyBookingsPage';

export default function Page() {
  return <Suspense fallback={<p role="status" className="p-6">Đang tải booking…</p>}><AgencyBookingsPage /></Suspense>;
}
