'use client';

import { ModeratorQualityDashboardPage } from '@/features/complaints';
import { ModerationDenied, useModerationPermission } from '@/features/moderation/components/ModerationUi';

export default function ModeratorComplaintsRoute() {
  const allowed = useModerationPermission('dispute:resolve');
  return allowed ? <ModeratorQualityDashboardPage /> : <ModerationDenied />;
}
