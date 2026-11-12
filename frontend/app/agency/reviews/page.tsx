'use client';

import { AgencyDenied, useAgencyPermission } from '@/features/agency/AgencyCommon';
import { AgencyReviewsPage } from '@/features/agency-reviews';

export default function AgencyReviewsRoute() {
  const allowed = useAgencyPermission('review:dispute');
  return allowed ? <AgencyReviewsPage /> : <AgencyDenied />;
}
