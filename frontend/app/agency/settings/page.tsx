'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import AgencyProfileSettingsPage from './profile/page';
import AgencyCommissionSettingsPage from './commission/page';

export default function AgencySettingsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  if (tabParam === 'commission') {
    return <AgencyCommissionSettingsPage />;
  }

  return <AgencyProfileSettingsPage />;
}
