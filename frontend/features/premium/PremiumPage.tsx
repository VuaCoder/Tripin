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
  return (
    <div className="divide-y divide-slate-200">
      {!vouchers.length && (
        <p className="py-5 text-sm text-slate-600">
          Chưa có voucher Premium được cấp. Voucher của kỳ gia hạn sẽ xuất hiện
          khi kỳ bắt đầu.
        </p>
      )}
      {vouchers.map((v) => (
        <article
          key={v.id}
          className="flex flex-wrap items-center justify-between gap-3 py-5"
        >
          <div>
            <h3 className="font-semibold text-slate-900">{v.terms.title}</h3>
            <p className="mt-1 text-sm text-slate-600">
              Giảm{' '}
              {v.terms.discountType === 'PERCENT'
                ? `${v.terms.discountValue}%${v.terms.maxDiscountAmount ? `, tối đa ${premiumMoney(v.terms.maxDiscountAmount)}` : ''}`
                : premiumMoney(v.terms.discountValue)}{' '}
              · Đơn từ {premiumMoney(v.terms.minOrderAmount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Hạn dùng {premiumDate(v.endsAt)}
            </p>
          </div>
          <span className="text-sm font-semibold text-amber-800">
            {v.bookingId
              ? 'Đã dùng / đang giữ cho booking'
              : new Date(v.endsAt) <= new Date()
                ? 'Đã hết hạn'
                : v.heldAt
                  ? 'Đang xử lý đặt tour'
                  : 'Sẵn sàng sử dụng'}
          </span>
          {!v.heldAt && new Date(v.endsAt) > new Date() && (
            <Link
              className="text-sm font-semibold text-teal-800 underline"
              href={`/tours/${v.terms.tourIds[0]}`}
            >
              Xem tour áp dụng
            </Link>
          )}
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
  const vouchers = usePremiumVouchersQuery(user?.id ?? '', {
    skip: !eligible || role !== 'TRAVELER',
  });
  const [subscribe, subscriptionState] = usePremiumSubscribeMutation();
  const [mutate, mutationState] = usePremiumMutationMutation();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refundId, setRefundId] = useState('');
  const [reason, setReason] = useState('');
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
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <header className="grid gap-7 border-b border-slate-200 pb-8 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Premium
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
            {role === 'TOUR_GUIDE'
              ? 'Giới thiệu chuyên môn rõ ràng hơn, nổi bật trước Agency và theo dõi công việc của bạn.'
              : 'Thêm ưu đãi cho mỗi hành trình với bộ voucher dành riêng cho hội viên.'}
          </p>
        </div>
        {eligible && (
          <div className="flex items-center gap-4">
            <PremiumAvatar
              url={user!.avatarUrl}
              name={user!.fullName}
              active={status.premium?.active}
              size="md"
            />
            <PremiumStatusText
              status={status.premium}
              error={status.isError}
              loading={status.isLoading}
              showInactive
              onRetry={() => void status.refetch()}
            />
          </div>
        )}
      </header>
      {!eligible && (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="premium-audience" className="text-sm font-semibold">
            Khám phá quyền lợi
          </label>
          <select
            id="premium-audience"
            className={premiumInput + ' max-w-xs'}
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="TRAVELER">Khách du lịch</option>
            <option value="TOUR_GUIDE">Hướng dẫn viên</option>
          </select>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-teal-800">
          {message}
        </p>
      )}
      <section aria-labelledby="premium-plans">
        <h2 id="premium-plans" className="text-xl font-bold text-slate-900">
          Chọn thời gian đồng hành
        </h2>
        {plans.isError ? (
          <Retry onRetry={() => void plans.refetch()} />
        ) : plans.isLoading ? (
          <p role="status" className="mt-4 text-slate-600">
            Đang tải Premium…
          </p>
        ) : !plans.currentData?.length ? (
          <p className="mt-4 text-sm text-slate-600">
            Premium chưa mở bán cho nhóm này. Các quyền lợi đã mua vẫn được giữ
            theo kỳ của bạn.
          </p>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {plans.currentData.map((plan) => (
              <article
                key={plan.id}
                className="rounded-xl border border-amber-300 bg-amber-50/40 p-6"
              >
                <h3 className="text-lg font-bold text-slate-900">
                  {plan.name}
                </h3>
                <p className="mt-3 text-2xl font-extrabold text-slate-900">
                  {premiumMoney(plan.price)}{' '}
                  <span className="text-sm font-normal text-slate-600">
                    / {plan.durationDays} ngày
                  </span>
                </p>
                {plan.description && (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {plan.description}
                  </p>
                )}
                <ul className="my-5 list-disc space-y-2 pl-5 text-sm text-slate-700">
                  {plan.benefits.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                  {plan.vouchers?.map((v, i) => (
                    <li key={i}>
                      {v.quantity} voucher {v.title} ·{' '}
                      {v.discountType === 'PERCENT'
                        ? `${v.discountValue}%, tối đa ${premiumMoney(v.maxDiscountAmount ?? 0)}`
                        : premiumMoney(v.discountValue)}{' '}
                      · Đơn từ {premiumMoney(v.minOrderAmount)}
                    </li>
                  ))}
                </ul>
                {eligible ? (
                  <button
                    className={premiumButton}
                    disabled={subscriptionState.isLoading}
                    onClick={() => void buy(plan.id)}
                  >
                    {subscriptionState.isLoading
                      ? 'Đang mở thanh toán…'
                      : status.premium?.active
                        ? 'Gia hạn Premium'
                        : 'Đăng ký Premium'}
                  </button>
                ) : user ? (
                  <p className="text-sm text-slate-600">
                    Gói dành cho tài khoản Traveler hoặc Guide.
                  </p>
                ) : (
                  <Link className={premiumButton} href="/login?next=/premium">
                    Đăng nhập để đăng ký
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
        <p className="mt-5 max-w-prose text-xs leading-6 text-slate-600">
          Thanh toán trả trước qua PayOS; gia hạn chủ động. Voucher được cấp khi
          kỳ bắt đầu, hết hạn cuối kỳ và không cộng với mã khác. Chỉ kỳ đã thanh
          toán nhưng chưa bắt đầu mới được yêu cầu hoàn toàn bộ; admin duyệt và
          chuyển tiền thủ công.
        </p>
      </section>
      {eligible && (
        <section>
          <h2 className="text-xl font-bold text-slate-900">
            Các kỳ Premium của bạn
          </h2>
          {history.isError ? (
            <Retry onRetry={() => void history.refetch()} />
          ) : history.isLoading ||
            (history.isFetching && !history.currentData) ? (
            <p role="status">Đang tải lịch sử…</p>
          ) : !history.currentData?.items.length ? (
            <p className="mt-4 text-sm text-slate-600">
              Bạn chưa đăng ký Premium.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-200">
              {history.currentData.items.map((period) => (
                <article
                  key={period.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div>
                    <h3 className="font-semibold">{period.planName}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {premiumDate(period.startsAt)} →{' '}
                      {premiumDate(period.endsAt)} ·{' '}
                      {premiumMoney(period.price)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
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
                  {period.status === 'PENDING_PAYMENT' &&
                    period.planId &&
                    !period.revokedAt && (
                      <button
                        disabled={subscriptionState.isLoading}
                        className="text-sm font-semibold text-teal-800 underline"
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
                        className="text-sm font-semibold text-teal-800 underline"
                        onClick={() => setRefundId(period.id)}
                      >
                        Yêu cầu hoàn tiền
                      </button>
                    )}
                </article>
              ))}
            </div>
          )}
          {history.currentData && history.currentData.meta.totalPages > 1 && (
            <nav
              className="mt-4 flex items-center gap-4 text-sm"
              aria-label="Phân trang Premium"
            >
              <button
                className={premiumButton}
                disabled={historyPage <= 1 || history.isFetching}
                onClick={() => setHistoryPage((p) => p - 1)}
              >
                Trang trước
              </button>
              <span>
                Trang {historyPage} / {history.currentData.meta.totalPages}
              </span>
              <button
                className={premiumButton}
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
              className="mt-5 space-y-3 rounded-xl bg-slate-50 p-5"
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
              <label className="block space-y-2 text-sm font-semibold">
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
              <div className="flex gap-3">
                <button
                  className={premiumButton}
                  disabled={mutationState.isLoading}
                >
                  Gửi yêu cầu
                </button>
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => setRefundId('')}
                >
                  Đóng
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      {eligible && role === 'TRAVELER' && (
        <section>
          <h2 className="text-xl font-bold">Ví voucher Premium</h2>
          <p className="mt-2 text-xs text-slate-600">
            Hiển thị tối đa 500 voucher gần nhất, ưu tiên kỳ đang hiệu lực.
          </p>
          {vouchers.isError ? (
            <Retry onRetry={() => void vouchers.refetch()} />
          ) : vouchers.isLoading ? (
            <p role="status">Đang tải voucher…</p>
          ) : (
            <VoucherList vouchers={vouchers.currentData ?? []} />
          )}
        </section>
      )}
      {eligible && role === 'TOUR_GUIDE' && status.premium && (
        <GuidePremiumEditor
          userId={user!.id}
          active={!!status.premium?.active}
        />
      )}
    </main>
  );
}
