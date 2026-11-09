'use client';

import { Suspense } from 'react';
import {
  TravelerAccountShell,
  VoucherWalletPage,
  VoucherSkeleton,
} from '@/features/traveler-account/components';

export default function SettingsVouchersPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<VoucherSkeleton />}>
        <VoucherWalletPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
