'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Ticket,
  TicketCheck,
  Check,
  Copy,
  ArrowRight,
  Sparkles,
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

  // If all vouchers are already collected by the authenticated user
  if (uncollectedVouchers.length === 0) {
    if (isAuthenticated && allVouchers.length > 0) {
      return (
        <section className="mb-14 rounded-3xl border border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-white to-emerald-50/40 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-800">
              <TicketCheck className="size-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Bạn đã thu thập toàn bộ voucher ưu đãi hiện có!
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Các mã giảm giá đã nằm sẵn trong Ví voucher, tự động gợi ý áp dụng khi bạn đặt tour.
              </p>
            </div>
          </div>
          <Link
            href="/settings/vouchers"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-container px-4.5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-opacity-95 active:scale-[0.99] transition-all shrink-0 shadow-xs"
          >
            <span>Xem Ví voucher</span>
            <ArrowRight className="size-4" />
          </Link>
        </section>
      );
    }
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
      {/* Semicircular ticket punch-hole cutouts at the perforation divider */}
      <span
        aria-hidden="true"
        className="absolute -top-2.5 left-[110px] sm:left-[120px] -translate-x-1/2 size-5 rounded-full bg-white border border-slate-200/80 z-20 pointer-events-none shadow-2xs"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-2.5 left-[110px] sm:left-[120px] -translate-x-1/2 size-5 rounded-full bg-white border border-slate-200/80 z-20 pointer-events-none shadow-2xs"
      />

      {/* ================= TICKET MAIN BODY ================= */}
      <div className="relative flex rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden">
        {/* Left Column: Discount Highlight Ticket Stub */}
        <div className="w-[110px] sm:w-[120px] shrink-0 bg-slate-900 text-white flex flex-col justify-between p-3.5 relative select-none">
          <span className="text-[10px] font-bold tracking-wider uppercase text-teal-300">
            {voucher.scope === 'PLATFORM' ? 'Toàn sàn' : 'Đối tác'}
          </span>

          <div className="my-auto py-2">
            <div className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight">
              {discountLabel}
            </div>
            {voucher.maxDiscountAmount && (
              <div className="text-[10px] text-slate-300 mt-1 line-clamp-1">
                Tối đa {Math.round(voucher.maxDiscountAmount / 1000)}k
              </div>
            )}
          </div>

          <span className="text-[10px] text-slate-400 font-medium">Tripri Voucher</span>
        </div>

        {/* Dashed Perforation Line */}
        <div className="w-px border-r border-dashed border-slate-200 my-2 shrink-0" />

        {/* Right Column: Voucher Information & Action Button */}
        <div className="flex-1 min-w-0 p-3.5 sm:p-4 flex flex-col justify-between bg-white">
          <div>
            <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
              {voucher.title}
            </h3>
            <div className="mt-1 space-y-0.5 text-xs text-slate-500">
              <p className="line-clamp-1 font-medium text-slate-600">{minOrderText}</p>
              <p className="text-[11px] text-slate-400">Hạn dùng đến {endDateText}</p>
            </div>
          </div>

          {/* Footer with Code & Action */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 relative">
            {/* Promo Code with Copy */}
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="inline-block font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 truncate max-w-[110px] sm:max-w-[130px]">
                {voucher.code || 'TRIPRI'}
              </span>
              <button
                type="button"
                onClick={onCopyCode}
                title="Sao chép mã"
                aria-label={`Sao chép mã ${voucher.code}`}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isCopied ? (
                  <Check className="size-3.5 text-teal-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>

            {/* Floating + 🎟️ Ticket Animation when user clicks save */}
            {isCollecting && (
              <div
                aria-hidden="true"
                className="absolute -top-7 right-2 pointer-events-none z-30 flex items-center gap-1 rounded-full bg-primary-container text-white px-2.5 py-1 text-xs font-black shadow-lg animate-float-ticket"
              >
                <span>+</span>
                <Ticket className="size-3.5 fill-white stroke-teal-700" />
              </div>
            )}

            {/* Collect Button */}
            <button
              type="button"
              disabled={isCollecting}
              onClick={onCollect}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer shadow-2xs ${
                isCollecting
                  ? 'bg-teal-50 text-teal-800 border border-teal-200 scale-95'
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

