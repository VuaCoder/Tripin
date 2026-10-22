'use client';

import { AgencyComplaintsTicketPage } from '@/features/complaints';
import { AgencyDenied, useAgencyPermission } from '@/features/agency/AgencyUi';

export default function AgencyComplaintsRoute() {
  const allowed = useAgencyPermission('complaint:respond');
  return allowed ? <AgencyComplaintsTicketPage /> : <AgencyDenied />;
}
