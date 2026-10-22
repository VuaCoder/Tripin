'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Ticket,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Flame,
  ArrowRight,
  Info,
  Calendar,
  Users,
} from 'lucide-react';
import type { UserVoucherItem } from '../api/voucherWalletApi';

interface VoucherCardProps {
  voucher: UserVoucherItem;
}

export function VoucherCard({ voucher }: VoucherCardProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const promo = voucher.promotion;
  if (!promo) return null;

  const now = new Date();
  const endsAt = new Date(promo.endsAt);
  const startsAt = new Date(promo.startsAt);
  const remainingHours = (endsAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  const isExpired = remainingHours <= 0 || !promo.isActive;
  const isUsed = voucher.isUsed;
  const isUrgent = !isExpired && !isUsed && remainingHours <= 3;
  const isExpiringSoon = !isExpired && !isUsed && remainingHours <= 48 && remainingHours > 3;

  const handleCopy = () => {
    if (!promo.code) return;
    navigator.clipboard.writeText(promo.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDiscount =
    promo.discountType === 'PERCENT'
      ? `${promo.discountValue}%`
      : `${(promo.discountValue / 1000).toLocaleString('vi-VN')}K`;

  const formattedMinOrder =
    promo.minOrderAmount > 0
      ? `Đơn tối thiểu ${promo.minOrderAmount.toLocaleString('vi-VN')} ₫`
      : 'Không giới hạn đơn tối thiểu';

  const formattedMaxDiscount =
    promo.discountType === 'PERCENT' && promo.maxDiscountAmount
      ? `Tối đa ${promo.maxDiscountAmount.toLocaleString('vi-VN')} ₫`
      : null;

  const formattedExpiry = endsAt.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div
      className={`group relative flex flex-col sm:flex-row overflow-hidden rounded-2xl border transition-all duration-200 ${
        isUsed || isExpired
          ? 'border-slate-200/80 bg-slate-50/70 opacity-75'
          : isUrgent
            ? 'border-amber-300 bg-white shadow-xs hover:border-amber-400 hover:shadow-md'
            : isExpiringSoon
              ? 'border-orange-200 bg-white shadow-xs hover:border-orange-300 hover:shadow-md'
              : 'border-slate-200/90 bg-white shadow-xs hover:border-brand-teal/80 hover:shadow-md'
      }`}
    >
      {/* Cạnh trái: Badge giảm giá & Cuống vé */}
      <div
        className={`flex sm:flex-col items-center justify-between sm:justify-center p-4 sm:p-5 sm:w-36 shrink-0 border-b sm:border-b-0 sm:border-r border-dashed ${
          isUsed || isExpired
            ? 'border-slate-200 bg-slate-100/70 text-slate-500'
            : isUrgent
              ? 'border-amber-200 bg-amber-50/60 text-amber-700'
              : isExpiringSoon
                ? 'border-orange-200 bg-orange-50/50 text-orange-700'
                : 'border-teal-100 bg-teal-50/60 text-brand-teal'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:flex-col sm:items-center text-center">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
            {promo.discountType === 'PERCENT' ? 'Giảm' : 'Ưu đãi'}
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {formattedDiscount}
          </span>
        </div>

        <div className="mt-0 sm:mt-3">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              promo.scope === 'PLATFORM'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-teal-100 text-teal-800'
            }`}
          >
            {promo.scope === 'PLATFORM' ? 'Toàn sàn' : 'Đại lý'}
          </span>
        </div>
      </div>

      {/* Phần thân: Thông tin chi tiết */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between">
        <div>
          {/* Header & Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {promo.title}
            </h3>

            {isUsed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                <Check className="size-3.5" /> Đã sử dụng
              </span>
            )}

            {isExpired && !isUsed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                <Clock className="size-3.5" /> Hết hạn
              </span>
            )}

            {isUrgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 animate-pulse">
                <Flame className="size-3.5 text-amber-600" /> Sắp hết hạn: còn{' '}
                {Math.max(1, Math.round(remainingHours))} giờ!
              </span>
            )}

            {isExpiringSoon && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">
                <Clock className="size-3.5 text-orange-600" /> Còn {Math.round(remainingHours)} giờ
              </span>
            )}
          </div>

          {/* Điều kiện tóm tắt */}
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            {formattedMinOrder}
            {formattedMaxDiscount && ` • ${formattedMaxDiscount}`}
          </p>

          {/* Mã voucher & nút sao chép */}
          {promo.code && (
            <div className="flex items-center gap-2 mb-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-1.5 text-xs font-mono font-bold tracking-wider text-slate-800">
                <Ticket className="size-3.5 text-brand-teal" />
                <span>{promo.code}</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                disabled={isUsed || isExpired}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer disabled:opacity-40"
                title="Sao chép mã"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-teal-600" />
                    <span className="text-teal-600 font-semibold">Đã chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Thanh chân voucher: Hạn dùng, xem điều kiện, nút dùng ngay */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" /> HSD: {formattedExpiry}
            </span>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-slate-500 hover:text-brand-teal flex items-center gap-0.5 font-medium cursor-pointer"
            >
              Điều kiện
              {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>

          {!isUsed && !isExpired && (
            <Link
              href="/tours"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-container px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition-all hover:bg-primary hover:shadow-xs cursor-pointer"
            >
              <span>Dùng ngay</span>
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>

        {/* Chi tiết điều kiện mở rộng */}
        {showDetails && (
          <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-xs text-slate-600 space-y-1.5">
            {promo.description && <p className="text-slate-700 font-medium">{promo.description}</p>}
            <ul className="list-disc list-inside space-y-1 text-slate-500">
              <li>{formattedMinOrder}</li>
              {formattedMaxDiscount && <li>{formattedMaxDiscount}</li>}
              {promo.firstBookingOnly && <li>Chỉ áp dụng cho lần đầu đặt tour trên hệ thống.</li>}
              {promo.minParticipants && (
                <li>Áp dụng cho đoàn từ {promo.minParticipants} khách trở lên.</li>
              )}
              {promo.daysInAdvance && (
                <li>Cần đặt trước ngày khởi hành tối thiểu {promo.daysInAdvance} ngày.</li>
              )}
              <li>Mỗi tài khoản được dùng tối đa {promo.usageLimitPerUser} lần.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
