'use client';

import { useState, useMemo } from 'react';
import {
  Ticket,
  Search,
  Check,
  X,
  Building2,
  Sparkles,
  Tag,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input, Button } from '@/components/ui';
import {
  handlePromotionCodeChange,
  handlePromotionCodeKeyDown,
} from '@/features/promotions/codeHelper';
import type { AppliedPromotionPreview, AvailablePromotionsDto } from '../api/bookingApi';
import type { UserVoucherDto } from '@/features/traveler-account/api/voucherWalletApi';
import type { AgencyPromotion } from '@/features/agency-promotions/types';

const formatVnd = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

export interface BookingVoucherModalProps {
  open: boolean;
  onClose: () => void;
  subtotal: number;
  // Agency promotion
  agencyPromotionCode: string;
  agencyPromotionPreview: AppliedPromotionPreview | null;
  agencyPromotionError: string | null;
  onApplyAgencyCode: (code: string) => Promise<boolean>;
  onClearAgencyCode: () => void;
  // Platform promotion
  platformPromotionCode: string;
  platformPromotionPreview: AppliedPromotionPreview | null;
  platformPromotionError: string | null;
  onApplyPlatformCode: (code: string) => Promise<boolean>;
  onClearPlatformCode: () => void;
  // Direct apply helper (checks and applies to whichever slot is valid)
  onApplyDirectCode: (code: string) => Promise<{ success: boolean; message?: string }>;
  // Available promos & wallet vouchers
  availablePromos?: AvailablePromotionsDto;
  myAgencyVouchers: UserVoucherDto[];
  myPlatformVouchers: UserVoucherDto[];
  isPreviewing: boolean;
}

type TabType = 'all' | 'agency' | 'platform';

export function BookingVoucherModal({
  open,
  onClose,
  subtotal,
  agencyPromotionCode,
  agencyPromotionPreview,
  agencyPromotionError,
  onApplyAgencyCode,
  onClearAgencyCode,
  platformPromotionCode,
  platformPromotionPreview,
  platformPromotionError,
  onApplyPlatformCode,
  onClearPlatformCode,
  onApplyDirectCode,
  availablePromos,
  myAgencyVouchers,
  myPlatformVouchers,
  isPreviewing,
}: BookingVoucherModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchInput, setSearchInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [inputSuccess, setInputSuccess] = useState<string | null>(null);
  const [isApplyingCode, setIsApplyingCode] = useState(false);

  // Handle direct code apply from the top search bar
  const handleApplyInput = async () => {
    const code = searchInput.trim();
    if (!code) {
      setInputError('Vui lòng nhập mã voucher.');
      return;
    }
    setInputError(null);
    setInputSuccess(null);
    setIsApplyingCode(true);

    try {
      const res = await onApplyDirectCode(code);
      if (res.success) {
        setInputSuccess(res.message || `Đã áp dụng mã ${code} thành công!`);
        setSearchInput('');
      } else {
        setInputError(res.message || 'Mã ưu đãi không hợp lệ hoặc không áp dụng được cho đơn này.');
      }
    } catch {
      setInputError('Không thể kiểm tra mã ưu đãi lúc này.');
    } finally {
      setIsApplyingCode(false);
    }
  };

  // Search filter query
  const normalizedSearch = searchInput.trim().toUpperCase();

  // Filter vouchers based on search term
  const filteredMyAgencyVouchers = useMemo(() => {
    if (!normalizedSearch) return myAgencyVouchers;
    return myAgencyVouchers.filter((v) => {
      const code = v.promotion?.code?.toUpperCase() || '';
      const title = v.promotion?.title?.toUpperCase() || '';
      return code.includes(normalizedSearch) || title.includes(normalizedSearch);
    });
  }, [myAgencyVouchers, normalizedSearch]);

  const filteredTourAgencyPromos = useMemo(() => {
    const list = availablePromos?.agency || [];
    if (!normalizedSearch) return list;
    return list.filter((p) => {
      const code = p.code?.toUpperCase() || '';
      const title = p.title?.toUpperCase() || '';
      return code.includes(normalizedSearch) || title.includes(normalizedSearch);
    });
  }, [availablePromos?.agency, normalizedSearch]);

  const filteredMyPlatformVouchers = useMemo(() => {
    if (!normalizedSearch) return myPlatformVouchers;
    return myPlatformVouchers.filter((v) => {
      const code = v.promotion?.code?.toUpperCase() || '';
      const title = v.promotion?.title?.toUpperCase() || '';
      return code.includes(normalizedSearch) || title.includes(normalizedSearch);
    });
  }, [myPlatformVouchers, normalizedSearch]);

  const filteredPlatformPromos = useMemo(() => {
    const list = availablePromos?.platform || [];
    if (!normalizedSearch) return list;
    return list.filter((p) => {
      const code = p.code?.toUpperCase() || '';
      const title = p.title?.toUpperCase() || '';
      return code.includes(normalizedSearch) || title.includes(normalizedSearch);
    });
  }, [availablePromos?.platform, normalizedSearch]);

  const totalAgencyCount = myAgencyVouchers.length + (availablePromos?.agency?.length || 0);
  const totalPlatformCount = myPlatformVouchers.length + (availablePromos?.platform?.length || 0);
  const totalDiscount = (agencyPromotionPreview?.discountAmount || 0) + (platformPromotionPreview?.discountAmount || 0);
  const selectedCount = (agencyPromotionPreview ? 1 : 0) + (platformPromotionPreview ? 1 : 0);

  // Helper to toggle agency code
  const handleToggleAgencyCode = async (code: string) => {
    if (agencyPromotionPreview?.code === code || agencyPromotionCode === code) {
      onClearAgencyCode();
    } else {
      await onApplyAgencyCode(code);
    }
  };

  // Helper to toggle platform code
  const handleTogglePlatformCode = async (code: string) => {
    if (platformPromotionPreview?.code === code || platformPromotionCode === code) {
      onClearPlatformCode();
    } else {
      await onApplyPlatformCode(code);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chọn Tripin Voucher"
      className="max-w-2xl"
      contentClassName="p-0 overflow-hidden flex flex-col max-h-[85vh]"
      footer={
        <div className="flex w-full items-center justify-between border-t border-slate-100 bg-white px-5 py-3.5">
          <div className="text-left">
            <p className="text-xs text-slate-500">
              Đã chọn: <span className="font-bold text-slate-900">{selectedCount} voucher</span>
            </p>
            <p className="text-sm font-bold text-brand-teal">
              Tiết kiệm: {formatVnd(totalDiscount)}
            </p>
          </div>

          <Button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-primary-container px-6 py-2.5 font-bold text-white shadow-md shadow-primary-container/20 hover:bg-primary"
          >
            Đồng ý
          </Button>
        </div>
      }
    >
      {/* ================= TOP: SEARCH / ENTER PROMO CODE ================= */}
      <div className="border-b border-slate-100 bg-slate-50/70 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              id="booking-voucher-search-input"
              value={searchInput}
              onChange={(e) => {
                handlePromotionCodeChange(e, setSearchInput);
                setInputError(null);
                setInputSuccess(null);
              }}
              onKeyDown={(e) => {
                handlePromotionCodeKeyDown(e, setSearchInput);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleApplyInput();
                }
              }}
              placeholder="Nhập mã voucher (VD: SUMMER2026, MEOMEO)..."
              maxLength={30}
              className="h-10 pl-10 pr-4 text-xs font-semibold placeholder:text-slate-400 uppercase"
              autoComplete="off"
            />
          </div>
          <Button
            type="button"
            disabled={!searchInput.trim() || isApplyingCode || isPreviewing}
            loading={isApplyingCode}
            onClick={() => void handleApplyInput()}
            className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Áp dụng
          </Button>
        </div>

        {/* Feedback messages under input */}
        {inputSuccess && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            {inputSuccess}
          </p>
        )}
        {(inputError || agencyPromotionError || platformPromotionError) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <AlertCircle className="size-3.5 text-red-500 shrink-0" />
            {inputError || agencyPromotionError || platformPromotionError}
          </p>
        )}
      </div>

      {/* ================= TABS ================= */}
      <div className="flex border-b border-slate-200 bg-white px-4 text-xs font-bold text-slate-600">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-1.5 border-b-2 py-3 px-3 transition-colors cursor-pointer ${
            activeTab === 'all'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Tất cả</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 font-semibold">
            {totalAgencyCount + totalPlatformCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('agency')}
          className={`flex items-center gap-1.5 border-b-2 py-3 px-3 transition-colors cursor-pointer ${
            activeTab === 'agency'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="size-3.5 text-indigo-600" />
          <span>Nhà cung cấp</span>
          <span className="rounded-full bg-indigo-50 px-1.5 py-0.2 text-[10px] text-indigo-700 font-semibold">
            {totalAgencyCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('platform')}
          className={`flex items-center gap-1.5 border-b-2 py-3 px-3 transition-colors cursor-pointer ${
            activeTab === 'platform'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sparkles className="size-3.5 text-brand-teal" />
          <span>Tripin Platform</span>
          <span className="rounded-full bg-teal-50 px-1.5 py-0.2 text-[10px] text-teal-800 font-semibold">
            {totalPlatformCount}
          </span>
        </button>
      </div>

      {/* ================= VOUCHER LIST (SCROLLABLE SHOPEE TICKET STREAM) ================= */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 1. KHUYẾN MÃI NHÀ CUNG CẤP */}
        {(activeTab === 'all' || activeTab === 'agency') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 className="size-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Mã từ Nhà cung cấp
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Tối đa 1 voucher</span>
            </div>

            {/* Voucher đối tác trong ví */}
            {filteredMyAgencyVouchers.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Ticket className="size-3 text-indigo-600" />
                  Voucher đối tác trong ví của bạn:
                </p>
                <div className="space-y-2.5">
                  {filteredMyAgencyVouchers.map((v) => {
                    const promo = v.promotion;
                    if (!promo) return null;
                    const code = promo.code || '';
                    const isSelected = agencyPromotionPreview?.code === code || agencyPromotionCode === code;
                    const isEligible = subtotal >= (promo.minOrderAmount || 0);

                    return (
                      <ShopeeTicketCard
                        key={v.id}
                        scope="AGENCY"
                        title={promo.title}
                        code={code}
                        discountType={promo.discountType}
                        discountValue={promo.discountValue}
                        minOrderAmount={promo.minOrderAmount || 0}
                        endsAt={promo.endsAt}
                        badgeLabel="Trong ví"
                        subtotal={subtotal}
                        isSelected={isSelected}
                        isEligible={isEligible}
                        onToggle={() => {
                          if (code && isEligible) void handleToggleAgencyCode(code);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mã khả dụng của tour này */}
            {filteredTourAgencyPromos.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-medium text-slate-500">Mã khả dụng của tour này:</p>
                <div className="space-y-2.5">
                  {filteredTourAgencyPromos.map((p) => {
                    const code = p.code || '';
                    const isSelected = agencyPromotionPreview?.code === code || agencyPromotionCode === code;
                    const isEligible = subtotal >= (p.minOrderAmount || 0);

                    return (
                      <ShopeeTicketCard
                        key={p.id}
                        scope="AGENCY"
                        title={p.title}
                        code={code}
                        discountType={p.discountType}
                        discountValue={p.discountValue}
                        minOrderAmount={p.minOrderAmount || 0}
                        endsAt={p.endsAt}
                        subtotal={subtotal}
                        isSelected={isSelected}
                        isEligible={isEligible}
                        onToggle={() => {
                          if (code && isEligible) void handleToggleAgencyCode(code);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {filteredMyAgencyVouchers.length === 0 && filteredTourAgencyPromos.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
                Không tìm thấy voucher nhà cung cấp phù hợp.
              </div>
            )}
          </div>
        )}

        {/* 2. KHUYẾN MÃI TOÀN SÀN TRIPIN */}
        {(activeTab === 'all' || activeTab === 'platform') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-brand-teal" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Mã từ Nền tảng Tripin
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Tối đa 1 voucher</span>
            </div>

            {/* Voucher toàn sàn trong ví */}
            {filteredMyPlatformVouchers.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Ticket className="size-3 text-brand-teal" />
                  Voucher toàn sàn trong ví của bạn:
                </p>
                <div className="space-y-2.5">
                  {filteredMyPlatformVouchers.map((v) => {
                    const promo = v.promotion;
                    if (!promo) return null;
                    const code = promo.code || '';
                    const isSelected = platformPromotionPreview?.code === code || platformPromotionCode === code;
                    const isEligible = subtotal >= (promo.minOrderAmount || 0);

                    return (
                      <ShopeeTicketCard
                        key={v.id}
                        scope="PLATFORM"
                        title={promo.title}
                        code={code}
                        discountType={promo.discountType}
                        discountValue={promo.discountValue}
                        minOrderAmount={promo.minOrderAmount || 0}
                        endsAt={promo.endsAt}
                        badgeLabel="Trong ví"
                        subtotal={subtotal}
                        isSelected={isSelected}
                        isEligible={isEligible}
                        onToggle={() => {
                          if (code && isEligible) void handleTogglePlatformCode(code);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mã khả dụng toàn sàn */}
            {filteredPlatformPromos.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-medium text-slate-500">Mã khả dụng của toàn sàn:</p>
                <div className="space-y-2.5">
                  {filteredPlatformPromos.map((p) => {
                    const code = p.code || '';
                    const isSelected = platformPromotionPreview?.code === code || platformPromotionCode === code;
                    const isEligible = subtotal >= (p.minOrderAmount || 0);

                    return (
                      <ShopeeTicketCard
                        key={p.id}
                        scope="PLATFORM"
                        title={p.title}
                        code={code}
                        discountType={p.discountType}
                        discountValue={p.discountValue}
                        minOrderAmount={p.minOrderAmount || 0}
                        endsAt={p.endsAt}
                        subtotal={subtotal}
                        isSelected={isSelected}
                        isEligible={isEligible}
                        onToggle={() => {
                          if (code && isEligible) void handleTogglePlatformCode(code);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {filteredMyPlatformVouchers.length === 0 && filteredPlatformPromos.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
                Không tìm thấy voucher nền tảng phù hợp.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Shopee-style Ticket Component with authentic coupon notches and responsive design */
function ShopeeTicketCard({
  scope,
  title,
  code,
  discountType,
  discountValue,
  minOrderAmount,
  endsAt,
  badgeLabel,
  subtotal,
  isSelected,
  isEligible,
  onToggle,
}: {
  scope: 'AGENCY' | 'PLATFORM';
  title: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minOrderAmount: number;
  endsAt: string;
  badgeLabel?: string;
  subtotal: number;
  isSelected: boolean;
  isEligible: boolean;
  onToggle: () => void;
}) {
  const isPercent = discountType === 'PERCENT';
  const discountDisplay = isPercent ? `${discountValue}%` : formatVnd(discountValue);
  const isAgency = scope === 'AGENCY';

  return (
    <div
      onClick={isEligible ? onToggle : undefined}
      className={`group relative flex overflow-hidden rounded-2xl border transition-all ${
        !isEligible
          ? 'border-slate-200 bg-slate-50/70 opacity-60 cursor-not-allowed'
          : isSelected
          ? isAgency
            ? 'border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500/80 shadow-xs cursor-pointer'
            : 'border-brand-teal bg-teal-50/20 ring-1 ring-brand-teal/80 shadow-xs cursor-pointer'
          : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs cursor-pointer'
      }`}
    >
      {/* LEFT NOTCH COUPON BLOCK */}
      <div
        className={`relative flex w-28 shrink-0 flex-col items-center justify-center p-3 text-center text-white ${
          isAgency
            ? 'bg-gradient-to-br from-indigo-600 to-indigo-800'
            : 'bg-gradient-to-br from-teal-600 to-teal-800'
        }`}
      >
        {/* Semi-circular notch cutouts */}
        <div className="absolute -top-2 -right-2 size-4 rounded-full bg-white shadow-inner" />
        <div className="absolute -bottom-2 -right-2 size-4 rounded-full bg-white shadow-inner" />

        {/* Dashed vertical separator simulation */}
        <div className="absolute top-2 bottom-2 right-0 border-r border-dashed border-white/40" />

        <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Giảm</span>
        <span className="font-extrabold text-sm sm:text-base leading-tight mt-0.5">{discountDisplay}</span>

        {badgeLabel && (
          <span className="mt-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            {badgeLabel}
          </span>
        )}
      </div>

      {/* MIDDLE DETAILS */}
      <div className="flex flex-1 min-w-0 flex-col justify-center p-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 rounded px-1.5 py-0.5">
            {code}
          </span>
          <span className="text-xs font-bold text-slate-800 truncate">{title}</span>
        </div>

        <p className="mt-1 text-[11px] text-slate-500">
          Đơn tối thiểu: <span className="font-semibold text-slate-700">{formatVnd(minOrderAmount)}</span>
        </p>

        {!isEligible ? (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700">
            <Info className="size-3" />
            Cần thêm {formatVnd(minOrderAmount - subtotal)} để dùng mã này
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] text-slate-400">
            Hạn dùng: {new Date(endsAt).toLocaleDateString('vi-VN')}
          </p>
        )}
      </div>

      {/* RIGHT RADIO / SELECTION BUTTON */}
      <div className="flex shrink-0 items-center justify-center pr-3.5 sm:pr-4">
        <div
          className={`size-5 rounded-full transition-all flex items-center justify-center ${
            !isEligible
              ? 'border-2 border-slate-200 bg-slate-100'
              : isSelected
              ? isAgency
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-brand-teal text-white shadow-xs'
              : 'border-2 border-slate-300 group-hover:border-slate-400'
          }`}
        >
          {isSelected && <Check className="size-3 stroke-[3]" />}
        </div>
      </div>
    </div>
  );
}

export { BookingVoucherModal as ShopeePromotionModal };
