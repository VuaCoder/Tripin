'use client';

import { TravelerAccountShell } from '@/features/traveler-account/components';
import { MyCustomToursPage } from '@/features/custom-tours';

export default function TravelerCustomToursPage() {
  return (
    <TravelerAccountShell>
      <MyCustomToursPage />
    </TravelerAccountShell>
  );
}
