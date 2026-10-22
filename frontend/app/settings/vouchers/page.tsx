'use client';

import { Suspense } from 'react';
import { LoadingState } from '@/components/shared';
import {
  TravelerAccountShell,
  VoucherWalletPage,
} from '@/features/traveler-account/components';

export default function SettingsVouchersPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<LoadingState label="Đang tải ví voucher..." />}>
        <VoucherWalletPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
