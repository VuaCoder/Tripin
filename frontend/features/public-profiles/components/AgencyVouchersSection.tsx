'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  TicketPercent,
  Sparkles,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Building2,
} from 'lucide-react';
import { useGetAgencyPromotionsQuery } from '../api';
import {
  useGetMyVouchersQuery,
  useCollectVoucherMutation,
  type PromotionDto,
} from '@/features/traveler-account/api/voucherWalletApi';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectRole } from '@/features/auth';

interface AgencyVouchersSectionProps {
  agencyId: string;
  agencyName: string;
}

export function AgencyVouchersSection({ agencyId, agencyName }: AgencyVouchersSectionProps) {
  const { data: promotions, isLoading } = useGetAgencyPromotionsQuery(agencyId);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);
  const isTraveler = isAuthenticated && role === 'TRAVELER';

  const { data: myVouchersData } = useGetMyVouchersQuery(undefined, { skip: !isTraveler });
  const [collectVoucher, { isLoading: isCollecting }] = useCollectVoucherMutation();

  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const collectedPromotionIds = new Set(
    (myVouchersData?.data ?? []).filter((v) => !v.isUsed).map((v) => v.promotionId),
  );

  const handleCollect = async (promotionId: string) => {
    try {
      setCollectingId(promotionId);
      await collectVoucher({ promotionId }).unwrap();
      setToastMessage('Đã lưu voucher vào ví thành công!');
      setTimeout(() => setToastMessage(null), 3500);
    } catch {
      setToastMessage('Không thể lưu voucher. Vui lòng thử lại sau.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setCollectingId(null);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const activePromos = (promotions ?? []).filter(
    (p) => p.codeType !== 'UNIQUE_BATCH',
  );

  return (
    <section aria-labelledby="agency-vouchers-heading" className="mt-10 border-t border-slate-200 pt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-100">
              <Sparkles className="size-4" />
            </div>
            <h2 id="agency-vouchers-heading" className="text-xl sm:text-2xl font-bold text-slate-900">
              Ưu đãi độc quyền từ nhà cung cấp
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Lưu voucher của {agencyName} vào ví để tự động nhận giảm giá khi đặt các tour du lịch của đơn vị này.
          </p>
        </div>

        {isTraveler && (
          <Link
            href="/settings/vouchers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
          >
            <TicketPercent className="size-3.5" />
            <span>Xem ví voucher của bạn &rarr;</span>
          </Link>
        )}
      </div>

      {toastMessage && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-teal-800 flex items-center gap-2 shadow-2xs animate-fade-in">
          <CheckCircle2 className="size-4 text-teal-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : activePromos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 sm:p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 shadow-2xs mb-2.5">
            <TicketPercent className="size-6" />
          </div>
          <p className="font-semibold text-slate-700 text-sm">Chưa có mã ưu đãi nào đang mở</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Nhà cung cấp hiện chưa có chương trình ưu đãi mới. Hãy quay lại sau hoặc tham khảo các tour du lịch bên dưới.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activePromos.map((promo) => {
            const isCollected = collectedPromotionIds.has(promo.id);
            const isCollectable = promo.applyType === 'COLLECTABLE';
            const endsAtFormatted = new Date(promo.endsAt).toLocaleDateString('vi-VN');

            return (
              <div
                key={promo.id}
                className="relative flex flex-col justify-between rounded-2xl border border-teal-100 bg-gradient-to-br from-white via-slate-50/40 to-teal-50/30 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/80 px-2.5 py-0.5 text-[11px] font-bold text-teal-800 mb-2">
                      <Building2 className="size-3" />
                      <span>{isCollectable ? 'Voucher đối tác' : promo.applyType === 'AUTO_APPLY' ? 'Ưu đãi tự động' : 'Mã ưu đãi'}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">{promo.title}</h3>
                    {promo.description && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{promo.description}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-lg sm:text-xl font-extrabold text-teal-700">
                      {promo.discountType === 'PERCENT'
                        ? `${promo.discountValue}%`
                        : `${(promo.discountValue / 1000).toLocaleString('vi-VN')}k ₫`}
                    </span>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {promo.discountType === 'PERCENT' && promo.maxDiscountAmount
                        ? `Tối đa ${(promo.maxDiscountAmount / 1000).toLocaleString('vi-VN')}k ₫`
                        : 'Giảm trực tiếp'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-600">
                  <div className="space-y-0.5">
                    <p className="font-medium text-slate-700">
                      Đơn tối thiểu: {promo.minOrderAmount ? `${promo.minOrderAmount.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock className="size-3 text-slate-400" />
                      <span>HSD: {endsAtFormatted}</span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div>
                    {isCollectable ? (
                      isCollected ? (
                        <div className="inline-flex items-center gap-1 rounded-xl bg-teal-50 border border-teal-200/80 px-3 py-1.5 text-xs font-bold text-teal-800">
                          <CheckCircle2 className="size-3.5 text-teal-600" />
                          <span>Đã lưu vào ví</span>
                        </div>
                      ) : !isAuthenticated ? (
                        <Link
                          href="/login"
                          className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 transition"
                        >
                          <span>+ Lưu vào ví</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCollect(promo.id)}
                          disabled={collectingId === promo.id || isCollecting}
                          className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 transition cursor-pointer disabled:opacity-50"
                        >
                          <span>{collectingId === promo.id ? 'Đang lưu…' : '+ Lưu vào ví'}</span>
                        </button>
                      )
                    ) : promo.applyType === 'AUTO_APPLY' ? (
                      <div className="inline-flex items-center gap-1 rounded-xl bg-teal-50 border border-teal-200/80 px-2.5 py-1 text-xs font-semibold text-teal-800">
                        <Sparkles className="size-3.5 text-teal-600" />
                        <span>Tự động áp dụng</span>
                      </div>
                    ) : promo.applyType === 'CODE' && promo.codeType === 'SHARED' && promo.code ? (
                      <button
                        type="button"
                        onClick={() => handleCopy(promo.code!)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        {copiedCode === promo.code ? (
                          <>
                            <Check className="size-3.5 text-teal-600" />
                            <span className="text-teal-700 font-bold">Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5 text-slate-500" />
                            <span>Mã: <strong className="text-slate-900">{promo.code}</strong></span>
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
