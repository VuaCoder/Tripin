'use client';

import { Suspense } from 'react';
import { WishlistPage } from '@/features/wishlist/components/WishlistPage';
import { WishlistSkeleton } from '@/features/wishlist/components/WishlistSkeleton';
import { TravelerAccountShell } from '@/features/traveler-account/components/TravelerAccountShell';

export default function SettingsWishlistPage() {
  return (
    <TravelerAccountShell>
      <Suspense fallback={<WishlistSkeleton />}>
        <WishlistPage />
      </Suspense>
    </TravelerAccountShell>
  );
}
