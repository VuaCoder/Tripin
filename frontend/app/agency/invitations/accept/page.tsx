import { Suspense } from 'react';
import { AgencyInvitationAcceptPage } from '@/features/agency/AgencyInvitationAcceptPage';
export default function AcceptAgencyInvitationRoute() {
  return <Suspense fallback={<p role="status" className="p-6">Đang mở lời mời…</p>}><AgencyInvitationAcceptPage /></Suspense>;
}
