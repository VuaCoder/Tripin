'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGetHotPromotionsQuery, useCollectVoucherMutation } from '@/features/traveler-account/api/voucherWalletApi';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/features/auth';
import { formatVnd } from '../utils/format';

export function HotVouchersSection() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { data: response, isLoading } = useGetHotPromotionsQuery();
  const [collectVoucher] = useCollectVoucherMutation();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [collectedMap, setCollectedMap] = useState<Record<string, boolean>>({});

  const vouchers = response?.data || [];

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      // Fallback
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  const handleCollect = async (voucherId: string, code?: string) => {
    if (!isAuthenticated) {
      if (code) handleCopyCode(code);
      return;
    }
    try {
      await collectVoucher({ promotionId: voucherId }).unwrap();
      setCollectedMap((prev) => ({ ...prev, [voucherId]: true }));
    } catch {
      if (code) handleCopyCode(code);
    }
  };

  if (isLoading) {
    return (
      <section className="mb-14">
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (vouchers.length === 0) {
    return null;
  }

  return (
    <section className="mb-14">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Mã ưu đãi đang áp dụng
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Lưu mã và nhập tại bước thanh toán để nhận giảm giá trực tiếp
          </p>
        </div>
        <Link
          href="/settings/vouchers"
          className="text-xs sm:text-sm font-semibold text-primary-container hover:underline whitespace-nowrap"
        >
          Ví voucher của tôi
        </Link>
      </div>

      {/* Vouchers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {vouchers.map((voucher) => {
          const isCopied = copiedCode === voucher.code;
          const isCollected = Boolean(collectedMap[voucher.id]);

          const discountLabel =
            voucher.discountType === 'PERCENT'
              ? `GIẢM ${voucher.discountValue}%`
              : `GIẢM ${
                  voucher.discountValue >= 1000
                    ? `${Math.round(voucher.discountValue / 1000)}K`
                    : formatVnd(voucher.discountValue)
                }`;

          const minOrderText =
            voucher.minOrderAmount && voucher.minOrderAmount > 0
              ? `Đơn từ ${formatVnd(voucher.minOrderAmount)}`
              : 'Mọi giá trị đơn đặt';

          const endDateText = new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }).format(new Date(voucher.endsAt));

          return (
            <div
              key={voucher.id}
              className="relative flex rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow duration-200 overflow-hidden"
            >
              {/* Left Column: Discount Highlight Ticket Stub */}
              <div className="w-[105px] sm:w-[115px] shrink-0 bg-slate-900 text-white flex flex-col justify-between p-3 relative select-none">
                <span className="text-[10px] font-medium tracking-wider uppercase text-slate-300">
                  {voucher.scope === 'PLATFORM' ? 'Toàn sàn' : 'Đối tác'}
                </span>

                <div className="my-auto py-2">
                  <div className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight">
                    {discountLabel}
                  </div>
                  {voucher.maxDiscountAmount && (
                    <div className="text-[10px] text-slate-300 mt-1 line-clamp-1">
                      Tối đa {Math.round(voucher.maxDiscountAmount / 1000)}k
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400">Tripri Voucher</span>

                {/* Vertical Cutout Notches */}
                <div className="absolute -top-2 -right-2 size-4 rounded-full bg-[#f8fafc] border border-slate-200/90 z-10" />
                <div className="absolute -bottom-2 -right-2 size-4 rounded-full bg-[#f8fafc] border border-slate-200/90 z-10" />
              </div>

              {/* Dashed Separator Line */}
              <div className="w-px border-r border-dashed border-slate-200 my-2 shrink-0" />

              {/* Right Column: Voucher Information & Action Button */}
              <div className="flex-1 min-w-0 p-3.5 flex flex-col justify-between bg-white">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">
                    {voucher.title}
                  </h3>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <p className="line-clamp-1">{minOrderText}</p>
                    <p className="text-[11px] text-slate-400">Hạn dùng đến {endDateText}</p>
                  </div>
                </div>

                {/* Footer with Code & Action */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[120px]">
                      {voucher.code || 'TRIPRI'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (voucher.code) handleCopyCode(voucher.code);
                      if (voucher.id) handleCollect(voucher.id, voucher.code);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                      isCopied || isCollected
                        ? 'bg-teal-50 text-teal-800 border border-teal-200'
                        : 'bg-primary-container text-white hover:bg-teal-800'
                    }`}
                  >
                    {isCopied ? 'Đã sao chép' : isCollected ? 'Đã lưu ví' : 'Lấy mã'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

