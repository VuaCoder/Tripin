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
  const [historyPage, setHistoryPage] = useState(1);
  const history = usePremiumHistoryQuery(
    { userId: user?.id ?? '', page: historyPage },
    { skip: !eligible },
  );
  const vouchers = usePremiumVouchersQuery(user?.id ?? '', {
    skip: !eligible || role !== 'TRAVELER',
  });
  const [subscribe, subscriptionState] = usePremiumSubscribeMutation();
  const [mutate, mutationState] = usePremiumMutationMutation();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refundId, setRefundId] = useState('');
  const [reason, setReason] = useState('');

  const showStatus =
    eligible &&
    (status.isLoading ||
      status.isError ||
      status.premium?.active ||
      status.premium?.expired);

  const showHistory =
    eligible &&
    (history.isLoading ||
      history.isError ||
      !!history.currentData?.items.length ||
      historyPage > 1);

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
      {/* 1. Header & Identity Section */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50/60 via-white to-emerald-50/40 p-6 shadow-xs sm:p-8 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-amber-100/70 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-900 shadow-2xs">
              <Crown className="size-3.5 fill-amber-700 text-amber-800" />
              <span>Gói Hội Viên Tripri</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Premium
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              Nâng tầm hành trình với kho voucher giảm giá độc quyền, nhận diện huy hiệu vương miện vàng sang trọng và ưu tiên hỗ trợ đặc quyền 24/7.
            </p>
          </div>

          {/* User's Current Membership Card (shows real avatar + crown frame) */}
          {showStatus && (
            <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-amber-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-md">
              <PremiumAvatar
                url={user!.avatarUrl}
                name={user!.fullName}
                active={status.premium?.active}
                size="md"
              />
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Tài khoản của bạn
                </div>
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

        {/* 4 Core Value Props */}
        <div className="mt-8 grid grid-cols-2 gap-3 border-t border-slate-200/70 pt-6 sm:grid-cols-4 sm:gap-4">
          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-100/70 text-teal-800">
              <Ticket className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Voucher theo kỳ</div>
              <div className="text-[11px] text-slate-500">Giảm giá tour tuyển chọn</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-800">
              <Crown className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Viền vương miện</div>
              <div className="text-[11px] text-slate-500">Đặc quyền diện mạo VIP</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100/70 text-blue-800">
              <Headphones className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Hỗ trợ ưu tiên</div>
              <div className="text-[11px] text-slate-500">Tổng đài viên túc trực 24/7</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100/70 text-emerald-800">
              <RotateCcw className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Hoàn tiền 100%</div>
              <div className="text-[11px] text-slate-500">Trước khi kỳ bắt đầu</div>
            </div>
          </div>
        </div>
      </section>

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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 id="premium-plans" className="text-2xl font-bold tracking-tight text-slate-900">
            Chọn gói Premium
          </h2>
          <span className="text-xs text-slate-500">
            Thanh toán một lần qua PayOS / VietQR · Không tự động trừ tiền
          </span>
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
          <div className="grid gap-6 md:grid-cols-2">
            {plans.currentData.map((plan, index) => {
              const isBestValue = plan.durationDays >= 90 || index === 0;
              return (
                <article
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-3xl border p-7 transition-all duration-200 ${
                    isBestValue
                      ? 'border-amber-400/90 bg-gradient-to-b from-amber-50/40 via-white to-white shadow-md ring-1 ring-amber-400/30'
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
                    {/* Plan Title & Duration */}
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {plan.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        <Clock className="size-3" />
                        <span>{plan.durationDays} ngày</span>
                      </span>
                    </div>

                    {/* Price Display */}
                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="text-3xl font-black tracking-tight text-slate-900">
                        {premiumMoney(plan.price)}
                      </span>
                      <span className="text-sm font-medium text-slate-500">
                        / {plan.durationDays} ngày
                      </span>
                    </div>

                    {/* Benefits Checklist */}
                    <ul className="mt-6 space-y-3 text-sm text-slate-700">
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

                  {/* Plan CTA */}
                  <div className="mt-8 pt-5 border-t border-slate-100">
                    {eligible ? (
                      <button
                        className={`w-full cursor-pointer rounded-xl py-3 text-center text-sm font-bold shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 ${
                          isBestValue
                            ? 'bg-primary-container text-white hover:bg-opacity-95 hover:shadow-md'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                        disabled={subscriptionState.isLoading}
                        onClick={() => void buy(plan.id)}
                      >
                        {subscriptionState.isLoading ? 'Đang mở thanh toán…' : 'Đăng ký gói'}
                      </button>
                    ) : user ? (
                      <p className="text-center text-xs text-slate-500">
                        Gói dành cho tài khoản Traveler hoặc Guide.
                      </p>
                    ) : (
                      <Link
                        className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-3 text-center text-sm font-bold text-white shadow-xs transition-all hover:bg-slate-800 active:scale-[0.99]"
                        href="/login?next=/premium"
                      >
                        <span>Đăng nhập để đăng ký</span>
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* 3. Collapsible Terms & Conditions */}
        {!!plans.currentData?.length && (
          <details className="group mt-6 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5 transition hover:bg-slate-50">
            <summary className="w-fit cursor-pointer font-bold text-slate-800 hover:text-slate-900 focus:outline-none">
              Điều kiện sử dụng
            </summary>
            <ul className="mt-4 max-w-prose list-disc space-y-2.5 pl-5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <li>Thanh toán trước qua PayOS, không tự động gia hạn.</li>
              {role === 'TRAVELER' && (
                <li>
                  Voucher có hiệu lực trong kỳ Premium và không dùng chung với mã khác.
                </li>
              )}
              <li>
                Chỉ kỳ đã thanh toán nhưng chưa bắt đầu mới được yêu cầu hoàn toàn bộ, sau khi được duyệt.
              </li>
            </ul>
          </details>
        )}
      </section>

      {/* 4. History Section */}
      {showHistory && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Các kỳ Premium của bạn
            </h2>
            <span className="text-xs text-slate-500">Lịch sử đăng ký &amp; trạng thái</span>
          </div>

          {history.isError ? (
            <Retry onRetry={() => void history.refetch()} />
          ) : history.isLoading || (history.isFetching && !history.currentData) ? (
            <p role="status" className="py-4 text-slate-500">Đang tải lịch sử…</p>
          ) : !history.currentData?.items.length ? (
            <p className="py-4 text-sm text-slate-600">
              Bạn chưa đăng ký Premium.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.currentData.items.map((period) => (
                <article
                  key={period.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4.5"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900">{period.planName}</h3>
                    <p className="text-sm text-slate-600">
                      {premiumDate(period.startsAt)} → {premiumDate(period.endsAt)} ·{' '}
                      <span className="font-semibold text-slate-900">{premiumMoney(period.price)}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {period.revokedAt
                        ? 'Đã thu hồi kỳ'
                        : period.status === 'ACTIVE' &&
                            period.startsAt &&
                            new Date(period.startsAt) > new Date()
                          ? 'Đã thanh toán · Chờ kỳ bắt đầu'
                          : (labels[period.status] ?? period.status)}
                      {period.premiumRefund &&
                        ` · ${labels[period.premiumRefund.status] ?? period.premiumRefund.status}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {period.status === 'PENDING_PAYMENT' &&
                      period.planId &&
                      !period.revokedAt && (
                        <button
                          disabled={subscriptionState.isLoading}
                          className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition-colors"
                          onClick={() => void buy(period.planId!)}
                        >
                          Tiếp tục thanh toán
                        </button>
                      )}
                    {period.status === 'ACTIVE' &&
                      !period.revokedAt &&
                      !period.premiumRefund &&
                      period.startsAt &&
                      new Date(period.startsAt) > new Date() && (
                        <button
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => setRefundId(period.id)}
                        >
                          Yêu cầu hoàn tiền
                        </button>
                      )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {history.currentData && history.currentData.meta.totalPages > 1 && (
            <nav
              className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-medium text-slate-600"
              aria-label="Phân trang Premium"
            >
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                disabled={historyPage <= 1 || history.isFetching}
                onClick={() => setHistoryPage((p) => p - 1)}
              >
                Trang trước
              </button>
              <span>
                Trang {historyPage} / {history.currentData.meta.totalPages}
              </span>
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                disabled={
                  historyPage >= history.currentData.meta.totalPages ||
                  history.isFetching
                }
                onClick={() => setHistoryPage((p) => p + 1)}
              >
                Trang sau
              </button>
            </nav>
          )}

          {refundId && (
            <form
              className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5"
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
                />
              </label>
              <div className="flex gap-2.5">
                <button
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={mutationState.isLoading}
                >
                  Gửi yêu cầu
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => setRefundId('')}
                >
                  Đóng
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* 5. Vouchers Section */}
      {showVouchers && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Ví voucher Premium</h2>
            <span className="text-xs text-slate-500">Ưu đãi độc quyền của kỳ này</span>
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

      {/* 6. Guide editor */}
      {eligible && role === 'TOUR_GUIDE' && status.premium && (
        <GuidePremiumEditor
          userId={user!.id}
          active={!!status.premium?.active}
        />
      )}
    </main>
  );
}
