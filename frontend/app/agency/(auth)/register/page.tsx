import { Suspense } from 'react';
import { PartnerAccountPage } from '@/features/agency-auth/PartnerAccountPage';

export const metadata = { title: 'Đăng ký Agency | Tripri Partner' };

export default function AgencyRegisterRoute() {
  return <Suspense fallback={<p role="status" className="p-6">Đang tải…</p>}><PartnerAccountPage mode="register" /></Suspense>;
}
