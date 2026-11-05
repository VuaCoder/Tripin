'use client';

import { useState } from 'react';
import Link from 'next/link';
import { selectUser } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { openCheckout } from '@/features/payment/utils/checkout';
import {
  PremiumAvatar,
  PremiumStatusText,
  useOwnPremium,
} from './PremiumIdentity';
import {
  usePremiumHistoryQuery,
  usePremiumPlansQuery,
  usePremiumSubscribeMutation,
  usePremiumMutationMutation,
  usePremiumVouchersQuery,
  type PremiumVoucher,
} from './api';
import { GuidePremiumEditor } from './GuidePremiumEditor';
import {
  premiumInput,
  premiumButton,
  premiumMoney,
  premiumDate,
  Retry,
} from './ui';

const labels: Record<string, string> = {
  ACTIVE: 'Đã thanh toán',
  PENDING_PAYMENT: 'Chờ thanh toán',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
  REQUESTED: 'Chờ duyệt hoàn',
  APPROVED: 'Chờ chuyển tiền hoàn',
  COMPLETED: 'Đã hoàn tiền',
  REJECTED: 'Từ chối hoàn',
};

export function VoucherList({ vouchers }: { vouchers: PremiumVoucher[] }) {
  if (!vouchers.length) {
    return (
      <p className="py-5 text-sm text-slate-500">
        Chưa có voucher Premium được cấp.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {vouchers.map((v) => (
        <article
          key={v.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <h4 className="font-bold text-slate-900 text-sm">{v.terms.title}</h4>
            <p className="mt-1 text-xs text-slate-600">
              Giảm{' '}
              {v.terms.discountType === 'PERCENT'
                ? `${v.terms.discountValue}%${v.terms.maxDiscountAmount ? `, tối đa ${premiumMoney(v.terms.maxDiscountAmount)}` : ''}`
                : premiumMoney(v.terms.discountValue)}{' '}
              · Đơn từ {premiumMoney(v.terms.minOrderAmount)}
            </p>
          </div>
        </article>
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
  const [historyPage, setHistoryPage] = useState(1);
  const history = usePremiumHistoryQuery(
    { userId: user?.id ?? '', page: historyPage },
    { skip: !eligible },
  );
  // Keep voucher query active for profile sync
  usePremiumVouchersQuery(user?.id ?? '', {
    skip: !eligible || role !== 'TRAVELER',
  });

  const [subscribe, subscriptionState] = usePremiumSubscribeMutation();
  const [mutate, mutationState] = usePremiumMutationMutation();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refundId, setRefundId] = useState('');
  const [reason, setReason] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const activePlanId =
    selectedPlanId && plans.currentData?.some((p) => p.id === selectedPlanId)
      ? selectedPlanId
      : plans.currentData?.find((p) => p.durationDays >= 90)?.id ||
        plans.currentData?.[0]?.id ||
        null;
  const selectedPlan = plans.currentData?.find((p) => p.id === activePlanId);

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

  // Only consider items that have an upcoming refundable period
  const futureRefundablePeriods = (history.currentData?.items ?? []).filter(
    (p) =>
      p.status === 'ACTIVE' &&
      !p.revokedAt &&
      !p.premiumRefund &&
      p.startsAt &&
      new Date(p.startsAt) > new Date(),
  );

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-12 sm:px-6">
      {/* 1. HEADER: TIÊU ĐỀ & MÔ TẢ GIÁ TRỊ THỰC TẾ */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/10 via-amber-400/25 to-amber-500/10 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-amber-900 shadow-2xs mb-3 backdrop-blur-xs">
            <span
              className="material-symbols-outlined text-[15px] text-amber-600"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              hotel_class
            </span>
            <span>TripRi Privilege Club · Hội Viên Đặc Quyền</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Mở Rộng Đặc Quyền, Nâng Tầm Mọi Chuyến Đi
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            {role === 'TOUR_GUIDE'
              ? 'Khẳng định chuyên môn và độ tin cậy với huy hiệu xác minh uy tín, gia tăng cơ hội kết nối với các công ty lữ hành hàng đầu và tối ưu thu nhập bền vững.'
              : 'Tận hưởng quyền ưu tiên giữ chỗ cao nhất, nhận trọn bộ voucher giảm giá độc quyền cho mọi hành trình cùng sự đồng hành và hỗ trợ chuyên biệt 24/7.'}
          </p>
        </div>

        {eligible && (status.premium?.active || status.isError) && (
          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs shrink-0">
            {status.premium?.active && (
              <PremiumAvatar
                url={user!.avatarUrl}
                name={user!.fullName}
                active={true}
                size="md"
              />
            )}
            <div className="text-xs">
              {status.premium?.active && (
                <span className="font-bold text-slate-900 block truncate max-w-[140px]">{user!.fullName}</span>
              )}
              <PremiumStatusText
                status={status.premium}
                error={status.isError}
                loading={status.isLoading}
                onRetry={() => void status.refetch()}
              />
            </div>
          </div>
        )}
      </header>

      {/* Role Switcher if guest */}
      {!eligible && (
        <div className="flex items-center gap-3">
          <label htmlFor="premium-audience" className="text-xs font-bold text-slate-700">
            Khám phá quyền lợi:
          </label>
          <select
            id="premium-audience"
            className={premiumInput + ' max-w-xs text-xs'}
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="TRAVELER">Khách du lịch (Traveler)</option>
            <option value="TOUR_GUIDE">Hướng dẫn viên (Tour Guide)</option>
          </select>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-800"
        >
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-xl bg-teal-50 p-4 text-xs font-semibold text-teal-800">
          {message}
        </div>
      )}

      {/* 2. PRICING PLANS: NGƯỜI DÙNG CHỌN GÓI & THANH TOÁN */}
      <section aria-labelledby="premium-plans" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h2 id="premium-plans" className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Chọn thời gian đồng hành
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Nhấp chọn gói phù hợp với kế hoạch du lịch hoặc công việc của bạn
            </p>
          </div>
        </div>

        {plans.isError ? (
          <Retry onRetry={() => void plans.refetch()} />
        ) : plans.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-72 rounded-3xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : !plans.currentData?.length ? (
          <p className="text-sm text-slate-500 py-6">
            Gói hội viên đang được chuẩn bị cho nhóm đối tượng này.
          </p>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 items-stretch">
              {plans.currentData.map((plan) => {
                const isSelected = plan.id === activePlanId;
                const isPopular = plan.durationDays >= 90;
                const cleanTitle = plan.name.replace(/^\[DEV Premium\]\s*/i, '');
                const cleanDesc = plan.description
                  ?.replace(/gói mẫu cho môi trường dev[.,]?/gi, '')
                  ?.replace(/giá minh họa[.,]?/gi, '')
                  ?.replace(/thanh toán sử dụng payos đang được cấu hình[.,]?/gi, '')
                  ?.trim();

                return (
                  <article
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`flex flex-col justify-between rounded-3xl p-7 transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-2 border-amber-500 bg-amber-50/30 ring-4 ring-amber-400/20 shadow-lg scale-[1.01]'
                        : isPopular
                          ? 'border-2 border-amber-300 bg-amber-50/10 hover:border-amber-400 hover:shadow-md'
                          : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 right-6 rounded-full bg-amber-500 px-3 py-0.5 text-[11px] font-bold text-slate-950 uppercase tracking-wider shadow-2xs">
                        Tiết kiệm nhất
                      </span>
                    )}

                    <div>
                      {/* Selection header with radio checkmark */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex size-5 items-center justify-center rounded-full transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 shadow-xs'
                                : 'border-2 border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && (
                              <span className="material-symbols-outlined text-[14px] font-black">
                                check
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${
                              isSelected ? 'text-amber-700' : 'text-slate-400'
                            }`}
                          >
                            {isSelected ? 'Đang chọn' : 'Nhấp để chọn'}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-xl font-extrabold text-slate-900">
                        {cleanTitle}
                      </h3>

                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold text-slate-900">
                          {premiumMoney(plan.price)}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          / {plan.durationDays} ngày
                        </span>
                      </div>

                      {cleanDesc && (
                        <p className="mt-3 text-xs leading-5 text-slate-600">
                          {cleanDesc}
                        </p>
                      )}

                      <ul className="my-5 space-y-2.5 text-xs text-slate-700">
                        {plan.benefits.map((b) => {
                          const cleanB = b
                            .replace(/tour demo/gi, 'mọi tour tuyển chọn')
                            .replace(/^\[DEV Premium\]\s*/i, '');
                          return (
                            <li key={b} className="flex items-start gap-2">
                              <span className="material-symbols-outlined text-[16px] text-teal-600 shrink-0">
                                check
                              </span>
                              <span>{cleanB}</span>
                            </li>
                          );
                        })}
                        {plan.vouchers?.map((v, i) => {
                          const cleanVTitle = v.title.replace(/^\[DEV Premium\]\s*/i, '');
                          return (
                            <li key={i} className="flex items-start gap-2">
                              <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0">
                                confirmation_number
                              </span>
                              <span>
                                {v.quantity} voucher {cleanVTitle} ·{' '}
                                {v.discountType === 'PERCENT'
                                  ? `${v.discountValue}%, tối đa ${premiumMoney(v.maxDiscountAmount ?? 0)}`
                                  : premiumMoney(v.discountValue)}{' '}
                                · Đơn từ {premiumMoney(v.minOrderAmount)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="mt-4 pt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlanId(plan.id);
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <span className="material-symbols-outlined text-[15px]">check_circle</span>
                            <span>Đã chọn gói này</span>
                          </>
                        ) : (
                          <span>Chọn gói này</span>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Bottom Checkout Action Panel for the Selected Plan */}
            {selectedPlan && (
              <div className="mt-8 rounded-3xl border border-amber-300/80 bg-gradient-to-r from-amber-50/90 via-amber-100/50 to-amber-50/90 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 animate-fadeIn">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-800 flex items-center justify-center sm:justify-start gap-1">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">stars</span>
                    Gói hội viên đang được chọn
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                    {selectedPlan.name.replace(/^\[DEV Premium\]\s*/i, '')}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">
                    Trọn gói <strong className="text-slate-900 font-bold">{premiumMoney(selectedPlan.price)}</strong> · Hiệu lực trọn vẹn {selectedPlan.durationDays} ngày
                  </p>
                </div>

                <div className="w-full sm:w-auto shrink-0 flex flex-col items-center sm:items-end gap-2">
                  {eligible ? (
                    <button
                      type="button"
                      aria-label={status.premium?.active ? 'Gia hạn Premium' : 'Đăng ký Premium'}
                      className="w-full sm:w-auto py-3.5 px-8 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      disabled={subscriptionState.isLoading}
                      onClick={() => void buy(selectedPlan.id)}
                    >
                      {subscriptionState.isLoading ? (
                        'Đang mở cổng thanh toán…'
                      ) : status.premium?.active ? (
                        <>
                          <span>Gia hạn Premium</span>
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
                        </>
                      ) : (
                        <>
                          <span>Đăng ký Premium</span>
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
                        </>
                      )}
                    </button>
                  ) : user ? (
                    <p className="text-center text-xs text-slate-500 py-2">
                      Gói dành cho tài khoản Traveler hoặc Guide.
                    </p>
                  ) : (
                    <Link
                      className="w-full sm:w-auto py-3.5 px-8 rounded-2xl font-black text-sm sm:text-base text-center bg-teal-700 hover:bg-teal-800 text-white block shadow-md hover:shadow-lg transition-all"
                      href="/login?next=/premium"
                    >
                      Đăng nhập để đăng ký
                    </Link>
                  )}
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-teal-600">verified_user</span>
                    Thanh toán bảo mật qua cổng PayOS chính thức
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 3. FUTURE REFUND SUPPORT (Only rendered when there is an active future period waiting to start) */}
      {futureRefundablePeriods.length > 0 && (
        <section className="pt-4 border-t border-slate-200">
          <div className="space-y-3">
            {futureRefundablePeriods.map((period) => (
              <div key={period.id} className="flex items-center justify-between text-xs py-2">
                <span>{period.planName} · Chờ kỳ bắt đầu ({premiumDate(period.startsAt)})</span>
                <button
                  type="button"
                  className="font-bold text-red-600 underline"
                  onClick={() => setRefundId(period.id)}
                >
                  Yêu cầu hoàn tiền
                </button>
              </div>
            ))}
          </div>

          {refundId && (
            <form
              className="mt-4 space-y-3 rounded-2xl bg-slate-50 border border-slate-200 p-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                try {
                  await mutate({
                    url: `/premium/subscriptions/${refundId}/refunds`,
                    body: { reason },
                  }).unwrap();
                  setRefundId('');
                  setReason('');
                  setMessage('Đã gửi yêu cầu hoàn tiền.');
                } catch (e) {
                  setError(getApiErrorMessage(e, 'Không gửi được yêu cầu.'));
                }
              }}
            >
              <label className="block space-y-2 text-xs font-bold text-slate-800">
                Lý do hoàn tiền
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  className={premiumInput}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập lý do hoàn tiền..."
                />
              </label>
              <div className="flex gap-3 pt-1">
                <button className={premiumButton} disabled={mutationState.isLoading}>
                  Gửi yêu cầu
                </button>
                <button
                  type="button"
                  className="text-xs underline px-3"
                  onClick={() => setRefundId('')}
                >
                  Đóng
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* 4. TOUR GUIDE PROFILE EDITOR */}
      {eligible && role === 'TOUR_GUIDE' && status.premium && (
        <GuidePremiumEditor
          userId={user!.id}
          active={!!status.premium?.active}
        />
      )}
    </main>
  );
}
