'use client';

import { Suspense } from 'react';
import { TravelerAccountShell } from '@/features/traveler-account/components/TravelerAccountShell';
import { VoucherWalletPage } from '@/features/traveler-account/components/VoucherWalletPage';
import { VoucherSkeleton } from '@/features/traveler-account/components/VoucherSkeleton';

export default function SettingsVouchersPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<VoucherSkeleton />}>
        <VoucherWalletPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
