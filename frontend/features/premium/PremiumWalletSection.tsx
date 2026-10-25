'use client';
import { selectUser } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { usePremiumVouchersQuery } from './api';
import { VoucherList } from './PremiumPage';
import { Retry } from './ui';
export function PremiumWalletSection() {
  const user = useAppSelector(selectUser);
  const query = usePremiumVouchersQuery(user?.id ?? '', {
    skip: !user || user.role !== 'TRAVELER',
  });
  if (!user || user.role !== 'TRAVELER') return null;
  return (
    <section className="border-t border-amber-200 pt-6">
      <h2 className="text-xl font-bold text-slate-900">Voucher Premium</h2>
      {query.isError ? (
        <Retry onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <p role="status">Đang tải voucher Premium…</p>
      ) : (
        <VoucherList vouchers={query.currentData ?? []} />
      )}
    </section>
  );
}
