'use client';

import { AgencyCustomToursPage } from '@/features/custom-tours';
import { AgencyDenied, useAgencyPermission } from '@/features/agency/AgencyCommon';

export default function AgencyCustomToursRoute() {
  const allowed = useAgencyPermission('custom-tour:view');
  return allowed ? <AgencyCustomToursPage /> : <AgencyDenied />;
}
