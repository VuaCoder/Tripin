'use client';
import { selectUser } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { usePremiumVouchersQuery } from './api';
import { PremiumVoucherCard } from '@/features/traveler-account/components/VoucherCard';
import { Retry } from './ui';
export function PremiumWalletSection() {
  const user = useAppSelector(selectUser);
  const query = usePremiumVouchersQuery(user?.id ?? '', {
    skip: !user || user.role !== 'TRAVELER',
  });
  if (!user || user.role !== 'TRAVELER') return null;
  if (!query.isError && !query.isLoading && !query.currentData?.length) return null;
  return (
    <div className="space-y-4">
      {query.isError ? (
        <Retry onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <p role="status">Đang tải voucher Premium…</p>
      ) : (
        query.currentData?.map((voucher) => (
          <PremiumVoucherCard key={voucher.id} voucher={voucher} />
        ))
      )}
    </div>
  );
}
