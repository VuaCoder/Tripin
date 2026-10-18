'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { openCheckout } from '@/features/payment/utils/checkout';
import {
  useGetCurrentSubscriptionQuery,
  useGetMySubscriptionsQuery,
  useGetSubscriptionPlansQuery,
  useSubscribeToPlanMutation,
} from '../api/subscriptionsApi';
import type { GuideSubscription } from '../types/finance';
import {
  formatGuideDate,
  formatGuideMoney,
  subscriptionLabel,
} from '../utils/finance';

const card =
  'rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7';

function SubscriptionDetails({
  subscription,
}: {
  subscription: GuideSubscription;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900">{subscription.plan.name}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${subscription.status === 'ACTIVE' ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-700'}`}
        >
          {subscriptionLabel(subscription)}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-teal-800">
        {formatGuideMoney(subscription.price)} / {subscription.durationDays}{' '}
        ngày
      </p>
      <dl className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <dt>Ngày đăng ký</dt>
          <dd className="mt-1 text-slate-900">
            {formatGuideDate(subscription.createdAt)}
          </dd>
        </div>
        <div>
          <dt>Bắt đầu</dt>
          <dd className="mt-1 text-slate-900">
            {formatGuideDate(subscription.startsAt)}
          </dd>
        </div>
        <div>
          <dt>Kết thúc</dt>
          <dd className="mt-1 text-slate-900">
            {formatGuideDate(subscription.endsAt)}
          </dd>
        </div>
      </dl>
    </>
  );
}

/** Remount local checkout state on identity changes as well as clearing RTK Query's cache. */
export function GuideSubscriptionsPage() {
  const user = useAppSelector(selectUser);
  return <SubscriptionsContent key={user?.id ?? 'guest'} />;
}

export function SubscriptionsContent() {
  const [page, setPage] = useState(1);
  const plans = useGetSubscriptionPlansQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const current = useGetCurrentSubscriptionQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const history = useGetMySubscriptionsQuery(
    { page, limit: 10 },
    { refetchOnMountOrArgChange: true },
  );
  const [subscribe, { isLoading: isSubscribing }] =
    useSubscribeToPlanMutation();
  const [selection, setSelection] = useState<{
    id: string;
    name: string;
    price: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = () => {
    void plans.refetch();
    void current.refetch();
    void history.refetch();
  };
  const checkout = async () => {
    if (!selection || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const result = await subscribe(selection.id).unwrap();
      if (!mounted.current) return;
      openCheckout(result.checkout.checkoutUrl);
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        getApiErrorMessage(
          cause,
          'Không thể tạo phiên thanh toán. Vui lòng thử lại.',
        ),
      );
      // The backend may have created the pending row before a gateway failure.
      void current.refetch();
      void history.refetch();
    } finally {
      inFlight.current = false;
      if (mounted.current) setSelection(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Gói dịch vụ
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chọn gói phù hợp và theo dõi đăng ký của bạn.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={
            plans.isFetching || current.isFetching || history.isFetching
          }
        >
          Làm mới
        </Button>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <section className={card} aria-labelledby="current-plan-heading">
        <h2 id="current-plan-heading" className="mb-4 text-lg font-bold">
          Gói đang có hiệu lực
        </h2>
        {current.isError ? (
          <ErrorState
            title="Không thể tải gói hiện tại"
            onAction={() => void current.refetch()}
          />
        ) : !current.currentData ? (
          <LoadingState label="Đang tải gói hiện tại..." />
        ) : current.currentData.active && current.currentData.subscription ? (
          <SubscriptionDetails
            subscription={current.currentData.subscription}
          />
        ) : (
          <EmptyState
            title="Bạn chưa có gói đang có hiệu lực"
            description="Chọn gói bên dưới hoặc xem kỳ gia hạn sắp có hiệu lực trong lịch sử."
          />
        )}
      </section>

      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="mb-4 text-lg font-bold">
          Các gói dịch vụ
        </h2>
        {plans.isError ? (
          <ErrorState
            title="Không thể tải các gói dịch vụ"
            onAction={() => void plans.refetch()}
          />
        ) : !plans.currentData ? (
          <LoadingState label="Đang tải các gói dịch vụ..." />
        ) : !plans.currentData.length ? (
          <EmptyState
            title="Chưa có gói dịch vụ được mở bán"
            description="Vui lòng quay lại sau."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.currentData.map((plan) => (
              <article key={plan.id} className={`${card} flex flex-col`}>
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-3 text-2xl font-extrabold text-teal-800">
                  {formatGuideMoney(plan.price)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Thời hạn {plan.durationDays} ngày
                </p>
                {plan.description && (
                  <p className="mt-4 text-sm text-slate-600">
                    {plan.description}
                  </p>
                )}
                <ul className="my-5 flex-1 space-y-2 text-sm text-slate-700">
                  {plan.benefits.map((benefit, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-teal-600" aria-hidden="true">
                        ✓
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
                <Button
                  disabled={isSubscribing}
                  onClick={() =>
                    setSelection({
                      id: plan.id,
                      name: plan.name,
                      price: plan.price,
                    })
                  }
                >
                  {current.currentData?.active
                    ? 'Đăng ký thêm / Gia hạn'
                    : 'Đăng ký gói'}
                  <span className="sr-only"> {plan.name}</span>
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={card} aria-labelledby="subscription-history-heading">
        <h2
          id="subscription-history-heading"
          className="mb-4 text-lg font-bold"
        >
          Lịch sử đăng ký
        </h2>
        {history.isError ? (
          <ErrorState
            title="Không thể tải lịch sử đăng ký"
            onAction={() => void history.refetch()}
          />
        ) : !history.currentData ? (
          <LoadingState label="Đang tải lịch sử đăng ký..." />
        ) : !history.currentData.items.length ? (
          <EmptyState
            title="Chưa có lịch sử đăng ký"
            description="Các gói bạn đăng ký sẽ xuất hiện tại đây."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {history.currentData.items.map((subscription) => (
                <article key={subscription.id} className="py-5 first:pt-0">
                  <SubscriptionDetails subscription={subscription} />
                  {subscription.status === 'PENDING_PAYMENT' && (
                    <Button
                      className="mt-4"
                      variant="outline"
                      disabled={isSubscribing}
                      onClick={() =>
                        setSelection({
                          id: subscription.plan.id,
                          name: subscription.plan.name,
                          price: subscription.price,
                        })
                      }
                    >
                      Tiếp tục thanh toán
                      <span className="sr-only"> {subscription.plan.name}</span>
                    </Button>
                  )}
                </article>
              ))}
            </div>
            <Pagination
              currentPage={history.currentData.meta.page}
              totalPages={history.currentData.meta.totalPages}
              totalItems={history.currentData.meta.total}
              onPageChange={setPage}
              disabled={history.isFetching}
              showInfo
              itemLabel="đăng ký"
            />
          </>
        )}
      </section>
      <Modal
        open={Boolean(selection)}
        title="Xác nhận đăng ký gói"
        onClose={() => {
          if (!inFlight.current) setSelection(null);
        }}
        closeOnBackdrop={!isSubscribing}
      >
        <p className="text-sm text-slate-600">
          Bạn chọn <strong>{selection?.name}</strong> với giá{' '}
          {selection && formatGuideMoney(selection.price)}. Giá và trạng thái
          cuối cùng được xác nhận bởi hệ thống.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Bạn sẽ chuyển đến PayOS để thanh toán. Gói chỉ được kích hoạt sau khi
          hệ thống xác nhận thanh toán; kỳ gia hạn nối tiếp kỳ đã mua.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={isSubscribing}
            onClick={() => setSelection(null)}
          >
            Quay lại
          </Button>
          <Button loading={isSubscribing} onClick={() => void checkout()}>
            Tiếp tục đến PayOS
          </Button>
        </div>
      </Modal>
    </div>
  );
}
