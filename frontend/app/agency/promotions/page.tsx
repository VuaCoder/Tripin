'use client';

import { AgencyPromotionsPage } from '@/features/agency-promotions';
import { AgencyDenied, useAgencyPermission } from '@/features/agency/AgencyUi';

export default function AgencyPromotionsRoute() {
  const allowed = useAgencyPermission('promotion:agency-manage');
  return allowed ? <AgencyPromotionsPage /> : <AgencyDenied />;
}
