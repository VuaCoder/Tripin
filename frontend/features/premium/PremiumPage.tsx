'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Crown,
  Check,
  ShieldCheck,
  Ticket,
  Headphones,
  RotateCcw,
  Clock,
  ArrowRight,
  ChevronDown,
  CreditCard,
} from 'lucide-react';
import { selectUser } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { openCheckout } from '@/features/payment/utils/checkout';
import { PremiumVoucherCard } from '@/features/traveler-account/components/VoucherCard';
import {
  PremiumAvatar,
  PremiumStatusText,
  useOwnPremium,
} from './PremiumIdentity';
import {
  usePremiumPlansQuery,
  usePremiumSubscribeMutation,
  usePremiumVouchersQuery,
  type PremiumVoucher,
} from './api';
import { GuidePremiumEditor } from './GuidePremiumEditor';
import {
  premiumInput,
  premiumMoney,
  Retry,
} from './ui';

export function VoucherList({ vouchers }: { vouchers: PremiumVoucher[] }) {
  return (
    <div className="space-y-4">
      {!vouchers.length && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
          Chưa có voucher Premium được cấp. Voucher của kỳ gia hạn sẽ xuất hiện khi kỳ bắt đầu.
        </div>
      )}
      {vouchers.map((voucher) => (
        <PremiumVoucherCard key={voucher.id} voucher={voucher} />
      ))}
    </div>
  );
}

export function PremiumPage() {
  const user = useAppSelector(selectUser);
  return <PremiumContent key={user?.id ?? 'guest'} />;
}

function PremiumContent() {
  const user = useAppSelector(selectUser);
  const eligible = !!user && ['TRAVELER', 'TOUR_GUIDE'].includes(user.role);
  const [audience, setAudience] = useState('TRAVELER');
  const role = eligible ? user!.role : audience;
  const plans = usePremiumPlansQuery(role);
  const status = useOwnPremium(user?.id);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const vouchers = usePremiumVouchersQuery(user?.id ?? '', {
    skip: !eligible || role !== 'TRAVELER',
  });
  const [subscribe, subscriptionState] = usePremiumSubscribeMutation();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const effectiveSelectedPlanId =
    selectedPlanId || plans.currentData?.[0]?.id || '';
  const selectedPlan =
    plans.currentData?.find((p) => p.id === effectiveSelectedPlanId) ??
    plans.currentData?.[0];

  const showStatus =
    eligible &&
    (status.isLoading ||
      status.isError ||
      status.premium?.active ||
      status.premium?.expired);

  const showVouchers =
    eligible &&
    role === 'TRAVELER' &&
    (vouchers.isLoading || vouchers.isError || !!vouchers.currentData?.length);

  const buy = async (id: string) => {
    if (!eligible) return;
    setError('');
    try {
      const result = await subscribe(id).unwrap();
      openCheckout(result.checkout.checkoutUrl);
    } catch (e) {
      setError(
        getApiErrorMessage(e, 'Không thể mở thanh toán. Vui lòng thử lại.'),
      );
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      {/* 1. Header & Identity Section - Clean title, no border box */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Premium
        </h1>

        {/* User's Current Membership Status */}
        {showStatus && (
          <div className="flex shrink-0 items-center gap-3">
            <PremiumAvatar
              url={user!.avatarUrl}
              name={user!.fullName}
              active={status.premium?.active}
              size="md"
            />
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-slate-900">
                {user!.fullName || 'Thành viên'}
              </div>
              <PremiumStatusText
                status={status.premium}
                error={status.isError}
                loading={status.isLoading}
                showInactive
                onRetry={() => void status.refetch()}
              />
            </div>
          </div>
        )}
      </div>

      {/* Role audience switcher for guests */}
      {!eligible && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label htmlFor="premium-audience" className="text-sm font-bold text-slate-800">
            Khám phá quyền lợi
          </label>
          <select
            id="premium-audience"
            className={premiumInput + ' max-w-xs cursor-pointer font-medium'}
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="TRAVELER">Khách du lịch</option>
            <option value="TOUR_GUIDE">Hướng dẫn viên</option>
          </select>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-800"
        >
          {message}
        </p>
      )}

      {/* 2. Choose Plan Section */}
      <section aria-labelledby="premium-plans" className="space-y-6">
        <div>
          <h2 id="premium-plans" className="text-2xl font-bold tracking-tight text-slate-900">
            Chọn gói Premium
          </h2>
        </div>

        {plans.isError ? (
          <Retry onRetry={() => void plans.refetch()} />
        ) : plans.isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-slate-500">
            <span className="animate-pulse">Đang tải Premium…</span>
          </div>
        ) : !plans.currentData?.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Chưa có gói Premium dành cho nhóm này.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {plans.currentData.map((plan, index) => {
                const isSelected = effectiveSelectedPlanId === plan.id;
                const isBestValue = plan.durationDays >= 90 || index === 0;
                return (
                  <article
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`relative flex cursor-pointer flex-col justify-between rounded-3xl border p-7 transition-all duration-200 select-none ${
                      isSelected
                        ? 'border-primary-container bg-gradient-to-b from-teal-50/40 via-white to-white shadow-md ring-2 ring-primary-container'
                        : isBestValue
                          ? 'border-amber-300 bg-gradient-to-b from-amber-50/20 via-white to-white shadow-xs hover:border-amber-400 hover:shadow-sm'
                          : 'border-slate-200 bg-white shadow-xs hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    {isBestValue && (
                      <div className="absolute -top-3.5 right-6 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-xs">
                        <Sparkles className="size-3" />
                        <span>Được chọn nhiều nhất</span>
                      </div>
                    )}

                    <div>
                      {/* Selection radio indicator & Plan Title & Duration */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                              isSelected
                                ? 'border-primary-container bg-primary-container text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="size-3 stroke-[3]" />}
                          </span>
                          <h3 className="text-xl font-bold text-slate-900">
                            {plan.name}
                          </h3>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          <Clock className="size-3" />
                          <span>{plan.durationDays} ngày</span>
                        </span>
                      </div>

                      {/* Price Display */}
                      <div className="mt-4 flex items-baseline gap-1.5 pl-8">
                        <span className="text-3xl font-black tracking-tight text-slate-900">
                          {premiumMoney(plan.price)}
                        </span>
                        <span className="text-sm font-medium text-slate-500">
                          / {plan.durationDays} ngày
                        </span>
                      </div>

                      {/* Benefits Checklist */}
                      <ul className="mt-6 space-y-3 pl-8 text-sm text-slate-700">
                        {Array.from(new Set(plan.benefits)).map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <Check className="size-3 stroke-[2.5]" />
                            </span>
                            <span className="leading-relaxed">{benefit}</span>
                          </li>
                        ))}

                        {!plan.benefits.length &&
                          plan.vouchers?.map((v, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <Check className="size-3 stroke-[2.5]" />
                              </span>
                              <span className="leading-relaxed">
                                {v.quantity} voucher · Giảm{' '}
                                {v.discountType === 'PERCENT'
                                  ? `${v.discountValue}%${
                                      v.maxDiscountAmount
                                        ? `, tối đa ${premiumMoney(v.maxDiscountAmount)}`
                                        : ''
                                    }`
                                  : premiumMoney(v.discountValue)}{' '}
                                · Đơn từ {premiumMoney(v.minOrderAmount)}
                              </span>
                            </li>
                          ))}

                        <li className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                            <Crown className="size-3 stroke-[2.5]" />
                          </span>
                          <span className="leading-relaxed">
                            Viền avatar hoàng gia kèm biểu tượng vương miện vàng
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800">
                            <ShieldCheck className="size-3 stroke-[2.5]" />
                          </span>
                          <span className="leading-relaxed">
                            Ưu tiên hàng chờ và xử lý sự cố bởi đội ngũ kiểm duyệt sàn
                          </span>
                        </li>
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Shared Registration Action Bar */}
            <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Gói đang chọn
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {selectedPlan ? (
                    <>
                      {selectedPlan.name} ·{' '}
                      <span className="text-primary-container">
                        {premiumMoney(selectedPlan.price)}
                      </span>
                      <span className="text-xs font-normal text-slate-500">
                        {' '}
                        / {selectedPlan.durationDays} ngày
                      </span>
                    </>
                  ) : (
                    'Vui lòng chọn một gói Premium ở trên'
                  )}
                </div>
              </div>

              {eligible ? (
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-xl bg-primary-container px-8 py-3.5 text-center text-sm font-bold text-white shadow-xs transition-all hover:bg-opacity-95 active:scale-[0.99] disabled:opacity-50 sm:w-auto"
                  disabled={!effectiveSelectedPlanId || subscriptionState.isLoading}
                  onClick={() => effectiveSelectedPlanId && void buy(effectiveSelectedPlanId)}
                >
                  {subscriptionState.isLoading ? 'Đang mở thanh toán…' : 'Đăng ký gói'}
                </button>
              ) : user ? (
                <p className="text-xs text-slate-500">
                  Gói dành cho tài khoản Traveler hoặc Guide.
                </p>
              ) : (
                <Link
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-6 py-3.5 text-center text-sm font-bold text-white shadow-xs transition-all hover:bg-slate-800 active:scale-[0.99] sm:w-auto"
                  href="/login?next=/premium"
                >
                  <span>Đăng nhập để đăng ký</span>
                  <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 3. Vouchers Section */}
      {showVouchers && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Ví voucher Premium</h2>
          </div>
          {vouchers.isError ? (
            <Retry onRetry={() => void vouchers.refetch()} />
          ) : vouchers.isLoading ? (
            <p role="status" className="py-4 text-slate-500">Đang tải voucher…</p>
          ) : (
            <VoucherList vouchers={vouchers.currentData ?? []} />
          )}
        </section>
      )}

      {/* 4. Guide editor */}
      {eligible && role === 'TOUR_GUIDE' && status.premium && (
        <GuidePremiumEditor
          userId={user!.id}
          active={!!status.premium?.active}
        />
      )}
    </main>
  );
}
