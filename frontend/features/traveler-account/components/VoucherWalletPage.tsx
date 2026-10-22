'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  TicketPercent,
  Compass,
} from 'lucide-react';
import { useGetMyVouchersQuery } from '../api/voucherWalletApi';
import { VoucherCard } from './VoucherCard';

type FilterTab = 'active' | 'used' | 'expired';

export function VoucherWalletPage() {
  const { data: vouchersData, isLoading } = useGetMyVouchersQuery();

  const [activeTab, setActiveTab] = useState<FilterTab>('active');

  const vouchers = vouchersData?.data ?? [];

  // Filter vouchers by tab
  const categorized = useMemo(() => {
    const now = new Date();
    const active: typeof vouchers = [];
    const used: typeof vouchers = [];
    const expired: typeof vouchers = [];

    for (const v of vouchers) {
      if (!v.promotion) continue;
      const isExpired = new Date(v.promotion.endsAt) <= now || !v.promotion.isActive;

      if (v.isUsed) {
        used.push(v);
      } else if (isExpired) {
        expired.push(v);
      } else {
        active.push(v);
      }
    }

    return { active, used, expired };
  }, [vouchers]);

  const currentList = categorized[activeTab];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-brand-teal border border-teal-100/80">
              <TicketPercent className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Ví voucher & Ưu đãi</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Quản lý mã giảm giá và voucher thu thập được áp dụng cho các chuyến đi của bạn
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs lọc trạng thái voucher */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`relative pb-3 px-4 text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'active'
              ? 'text-brand-teal border-b-2 border-brand-teal'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Khả dụng</span>
          <span className="ml-1.5 rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-800 font-extrabold">
            {categorized.active.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('used')}
          className={`relative pb-3 px-4 text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'used'
              ? 'text-brand-teal border-b-2 border-brand-teal'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Đã sử dụng</span>
          <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-semibold">
            {categorized.used.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expired')}
          className={`relative pb-3 px-4 text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'expired'
              ? 'text-brand-teal border-b-2 border-brand-teal'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Hết hạn</span>
          <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-semibold">
            {categorized.expired.length}
          </span>
        </button>
      </div>

      {/* Danh sách Voucher */}
      {isLoading ? (
        <div className="space-y-4 pt-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-slate-200 bg-slate-100/60 animate-pulse"
            />
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 sm:p-12 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 shadow-2xs mb-3">
            <TicketPercent className="size-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            {activeTab === 'active'
              ? 'Chưa có voucher khả dụng nào'
              : activeTab === 'used'
                ? 'Chưa có voucher nào đã sử dụng'
                : 'Không có voucher hết hạn'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-4">
            {activeTab === 'active'
              ? 'Thu thập các chương trình ưu đãi và mã giảm giá khi khám phá các chuyến đi.'
              : 'Lịch sử voucher của bạn sẽ xuất hiện tại đây sau khi áp dụng vào đơn đặt tour.'}
          </p>
          {activeTab === 'active' && (
            <Link
              href="/tours"
              className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-primary transition cursor-pointer"
            >
              <Compass className="size-4" />
              <span>Khám phá các tour du lịch</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {currentList.map((voucher) => (
            <VoucherCard key={voucher.id} voucher={voucher} />
          ))}
        </div>
      )}

      {/* Kết thúc danh sách voucher */}
    </div>
  );
}
