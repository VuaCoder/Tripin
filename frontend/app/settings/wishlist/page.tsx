'use client';

import { Suspense } from 'react';
import { WishlistPage, WishlistSkeleton } from '@/features/wishlist';
import { TravelerAccountShell } from '@/features/traveler-account/components';

export default function SettingsWishlistPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<WishlistSkeleton />}>
        <WishlistPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
