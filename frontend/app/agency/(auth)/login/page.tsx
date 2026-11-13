import { PartnerAccountPage } from '@/features/agency-auth/PartnerAccountPage';
import { Suspense } from 'react';

export const metadata = { title: 'Đăng nhập Agency | Tripri Partner' };

interface PageProps {
  searchParams?: { registered?: string; email?: string };
}

export default function AgencyLoginRoute({ searchParams }: PageProps) {
  return <Suspense fallback={<p role="status" className="p-6">Đang tải…</p>}><PartnerAccountPage registered={searchParams?.registered === 'true'} initialEmail={searchParams?.email ?? ''} /></Suspense>;
}
