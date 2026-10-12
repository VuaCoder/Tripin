'use client';

import { Suspense } from 'react';
import { LoadingState } from '@/components/shared';
import { WishlistPage } from '@/features/wishlist';
import { TravelerAccountShell } from '@/features/traveler-account/components';

export default function SettingsWishlistPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<LoadingState label="Đang tải danh sách yêu thích..." />}>
        <WishlistPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
