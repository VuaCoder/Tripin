'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Ticket,
  Check,
  Copy,
} from 'lucide-react';
import {
  useGetHotPromotionsQuery,
  useGetMyVouchersQuery,
  useCollectVoucherMutation,
  type PromotionDto,
} from '@/features/traveler-account/api/voucherWalletApi';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/features/auth';
import { formatVnd } from '../utils/format';

export function HotVouchersSection() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { data: response, isLoading: isLoadingHot } = useGetHotPromotionsQuery();
  const { data: myVouchersData, isLoading: isLoadingMine } = useGetMyVouchersQuery(undefined, {
    skip: !isAuthenticated,
  });
  const [collectVoucher] = useCollectVoucherMutation();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [collectedMap, setCollectedMap] = useState<Record<string, boolean>>({});
  const [flyingVoucherId, setFlyingVoucherId] = useState<string | null>(null);

  const allVouchers = response?.data || [];

  // Map of voucher IDs that the user has already collected in their wallet
  const myVouchers = Array.isArray(myVouchersData)
    ? myVouchersData
    : (myVouchersData?.data ?? []);

  const collectedPromoIds = useMemo(() => {
    const set = new Set<string>();
    myVouchers.forEach((v) => {
      if (v.promotionId) set.add(v.promotionId);
      if (v.promotion?.id) set.add(v.promotion.id);
    });
    return set;
  }, [myVouchers]);

  // Only display vouchers that have NOT been collected yet
  const uncollectedVouchers = useMemo(() => {
    return allVouchers.filter(
      (voucher) => !collectedPromoIds.has(voucher.id) && !collectedMap[voucher.id],
    );
  }, [allVouchers, collectedPromoIds, collectedMap]);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  const handleCollect = async (voucherId: string, code?: string) => {
    if (!isAuthenticated) {
      if (code) handleCopyCode(code);
      return;
    }

    // Trigger the floating + 🎟️ animation right at the clicked button
    setFlyingVoucherId(voucherId);

    try {
      await collectVoucher({ promotionId: voucherId }).unwrap();
    } catch {
      // Continue gracefully even if network hiccup
    }

    // Allow user to delight in the + 🎟️ floating effect and confirmation before voucher transitions to wallet
    setTimeout(() => {
      setCollectedMap((prev) => ({ ...prev, [voucherId]: true }));
      setFlyingVoucherId(null);
    }, 750);
  };

  if (isLoadingHot || (isAuthenticated && isLoadingMine)) {
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

  // Hide the section completely when no uncollected vouchers remain
  if (uncollectedVouchers.length === 0) {
    return null;
  }

  const count = uncollectedVouchers.length;

  // Responsive Grid class depending on how many uncollected vouchers exist
  // Left-aligned grid naturally matching the page layout
  const gridLayoutClass =
    count === 1
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-md sm:max-w-none'
      : count === 2
        ? 'grid grid-cols-1 md:grid-cols-2 gap-5'
        : count === 3
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
          : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5';

  return (
    <section className="mb-14">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Mã ưu đãi đang áp dụng
        </h2>
        <Link
          href="/settings/vouchers"
          className="text-xs sm:text-sm font-semibold text-primary-container hover:underline whitespace-nowrap"
        >
          Ví voucher của tôi
        </Link>
      </div>

      {/* Vouchers Layout */}
      <div className={gridLayoutClass}>
        {uncollectedVouchers.map((voucher) => (
          <TicketCard
            key={voucher.id}
            voucher={voucher}
            isCopied={copiedCode === voucher.code}
            isCollecting={flyingVoucherId === voucher.id}
            onCopyCode={() => voucher.code && handleCopyCode(voucher.code)}
            onCollect={() => handleCollect(voucher.id, voucher.code)}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>
    </section>
  );
}

interface TicketCardProps {
  voucher: PromotionDto;
  isCopied: boolean;
  isCollecting: boolean;
  onCopyCode: () => void;
  onCollect: () => void;
  isAuthenticated: boolean;
}

function TicketCard({
  voucher,
  isCopied,
  isCollecting,
  onCopyCode,
  onCollect,
  isAuthenticated,
}: TicketCardProps) {
  const isPremium =
    (voucher as any).scope === 'PREMIUM' ||
    Boolean(voucher.description?.includes('[PREMIUM]')) ||
    voucher.title?.toLowerCase().includes('premium');

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
    <div className="relative group select-none">
      {/* ================= TICKET MAIN BODY ================= */}
      <div
        className={`relative flex rounded-2xl transition-all duration-200 overflow-hidden shadow-2xs hover:shadow-md ${
          isPremium
            ? 'bg-gradient-to-r from-amber-50/60 to-yellow-50/40 border border-amber-300 hover:border-amber-400'
            : 'bg-white border border-slate-200/90'
        }`}
      >
        {/* Left Column: Discount Highlight Ticket Stub */}
        <div
          className={`w-[110px] sm:w-[125px] shrink-0 flex flex-col justify-between p-3.5 relative select-none ${
            isPremium
              ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 text-slate-950 font-sans shadow-inner'
              : 'bg-slate-900 text-white'
          }`}
        >
          <span
            className={`text-[10px] font-black tracking-wider uppercase ${
              isPremium
                ? 'text-amber-950 bg-amber-300/80 px-1.5 py-0.5 rounded-md inline-block w-fit'
                : 'text-teal-300'
            }`}
          >
            {isPremium ? '★ PREMIUM' : voucher.scope === 'PLATFORM' ? 'Toàn sàn' : 'Đối tác'}
          </span>

          <div className="my-auto py-2">
            <div
              className={`text-lg sm:text-xl font-black tracking-tight leading-tight ${
                isPremium ? 'text-slate-950 drop-shadow-2xs' : 'text-white'
              }`}
            >
              {discountLabel}
            </div>
            {voucher.maxDiscountAmount && (
              <div
                className={`text-[10px] mt-1 line-clamp-1 font-medium ${
                  isPremium ? 'text-amber-950/90' : 'text-slate-300'
                }`}
              >
                Tối đa {Math.round(voucher.maxDiscountAmount / 1000)}k
              </div>
            )}
          </div>

          <span
            className={`text-[10px] font-semibold tracking-wide ${
              isPremium ? 'text-amber-950/80' : 'text-slate-400'
            }`}
          >
            {isPremium ? 'Đặc quyền VIP' : 'Tripri Voucher'}
          </span>
        </div>

        {/* Dashed Perforation Line */}
        <div
          className={`w-px border-r border-dashed my-2 shrink-0 ${
            isPremium ? 'border-amber-300' : 'border-slate-200'
          }`}
        />

        {/* Right Column: Voucher Information & Action Button */}
        <div
          className={`flex-1 min-w-0 p-3.5 sm:p-4 flex flex-col justify-between ${
            isPremium ? 'bg-amber-50/20' : 'bg-white'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {isPremium ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-900 border border-amber-300/80">
                  <span>👑</span>
                  <span>Khách hàng Premium</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200/60">
                  <span>Toàn sàn</span>
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
              {voucher.title}
            </h3>
            <div className="mt-1 space-y-0.5 text-xs text-slate-500">
              <p className="line-clamp-1 font-medium text-slate-600">{minOrderText}</p>
              <p className="text-[11px] text-slate-400">Hạn dùng đến {endDateText}</p>
            </div>
          </div>

          {/* Footer with Code & Action */}
          <div
            className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 relative ${
              isPremium ? 'border-amber-200/60' : 'border-slate-100'
            }`}
          >
            {/* Promo Code with Copy */}
            <div className="min-w-0 flex items-center gap-1.5">
              <span
                className={`inline-block font-mono text-xs font-bold px-2 py-0.5 rounded-lg border truncate max-w-[110px] sm:max-w-[130px] ${
                  isPremium
                    ? 'bg-amber-100/80 text-amber-950 border-amber-300'
                    : 'text-slate-800 bg-slate-100 border-slate-200'
                }`}
              >
                {voucher.code || 'TRIPRI'}
              </span>
              <button
                type="button"
                onClick={onCopyCode}
                title="Sao chép mã"
                aria-label={`Sao chép mã ${voucher.code}`}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isPremium
                    ? 'text-amber-700 hover:text-amber-950 hover:bg-amber-100'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isCopied ? (
                  <Check className={`size-3.5 ${isPremium ? 'text-amber-600' : 'text-teal-600'}`} />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>

            {/* Floating + 🎟️ Ticket Animation when user clicks save */}
            {isCollecting && (
              <div
                aria-hidden="true"
                className={`absolute -top-7 right-2 pointer-events-none z-30 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black shadow-lg animate-float-ticket ${
                  isPremium ? 'bg-amber-500 text-slate-950' : 'bg-primary-container text-white'
                }`}
              >
                <span>+</span>
                <Ticket className={`size-3.5 ${isPremium ? 'fill-slate-950 stroke-amber-700' : 'fill-white stroke-teal-700'}`} />
              </div>
            )}

            {/* Collect Button */}
            <button
              type="button"
              disabled={isCollecting}
              onClick={onCollect}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer shadow-2xs ${
                isCollecting
                  ? isPremium
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 scale-95'
                    : 'bg-teal-50 text-teal-800 border border-teal-200 scale-95'
                  : isPremium
                    ? 'bg-gradient-to-r from-amber-500 via-amber-500 to-yellow-500 text-slate-950 font-black hover:brightness-105 active:scale-95 shadow-amber-500/20'
                    : 'bg-primary-container text-white hover:bg-opacity-95 active:scale-95'
              }`}
            >
              {isCollecting ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="size-3" />
                  <span>Đã lưu!</span>
                </span>
              ) : isAuthenticated ? (
                'Lưu mã'
              ) : (
                'Lấy mã'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

