'use client';

import { AgencyComplaintsPage } from '@/features/agency-complaints';
import { AgencyDenied, useAgencyPermission } from '@/features/agency/AgencyUi';

export default function AgencyComplaintsRoute() {
  const allowed = useAgencyPermission('complaint:respond');
  return allowed ? <AgencyComplaintsPage /> : <AgencyDenied />;
}
