'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import AgencyProfileSettingsPage from './profile/page';
import AgencyCommissionSettingsPage from './commission/page';
import AgencyTeamSettingsPage from './team/page';

export default function AgencySettingsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  if (tabParam === 'commission') {
    return <AgencyCommissionSettingsPage />;
  }

  if (tabParam === 'team') {
    return <AgencyTeamSettingsPage />;
  }

  return <AgencyProfileSettingsPage />;
}
