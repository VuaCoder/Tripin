'use client';

import { AgencyCommissionSettings } from '@/features/agency/components/AgencyCommissionSettings';
import { Percent } from 'lucide-react';
import { AgencyPageTitle } from '@/features/agency/components/AgencyPageTitle';

export default function AgencyCommissionSettingsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <AgencyPageTitle icon={Percent}>Chiết khấu Hoa hồng</AgencyPageTitle>
      <AgencyCommissionSettings />
    </main>
  );
}
