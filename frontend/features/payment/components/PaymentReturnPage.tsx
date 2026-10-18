'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RoleGuard, selectUser } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import {
  useGetMySubscriptionsQuery,
  useGetCurrentSubscriptionQuery,
} from '@/features/guide/api/subscriptionsApi';
import {
  formatGuideDate,
  formatGuideMoney,
  subscriptionLabel,
} from '@/features/guide/utils/finance';
import {
  useCheckoutBookingMutation,
  useGetPaymentQuery,
} from '../api/paymentApi';
import { openCheckout } from '../utils/checkout';

/** Both gateway callbacks read server state. The callback path/query never establishes a result. */
export function PaymentReturnPage({
  cancelled = false,
}: {
  cancelled?: boolean;
}) {
  const user = useAppSelector(selectUser);
  return (
    <RoleGuard allowedRoles={['TRAVELER', 'TOUR_GUIDE']}>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Suspense
          fallback={<LoadingState label="Đang kiểm tra thanh toán..." />}
        >
          <PaymentReturnContent key={user?.id} cancelled={cancelled} />
        </Suspense>
      </div>
    </RoleGuard>
  );
}

export function PaymentReturnContent({
  cancelled = false,
}: {
  cancelled?: boolean;
}) {
  const params = useSearchParams();
  const paymentId = params.get('paymentId') ?? '';
  return (
    <PaymentResult
      key={paymentId}
      paymentId={paymentId}
      cancelled={cancelled}
    />
  );
}

function PaymentResult({
  paymentId,
  cancelled,
}: {
  paymentId: string;
  cancelled: boolean;
}) {
  const [polling, setPolling] = useState(true);
  const [status, setStatus] = useState<string>();
  const [retryError, setRetryError] = useState<string | null>(null);
  const mounted = useRef(true);
  const retrying = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!polling) return;
    const timeout = setTimeout(() => setPolling(false), 20_000);
    return () => clearTimeout(timeout);
  }, [polling]);
  const query = useGetPaymentQuery(paymentId, {
    skip: !paymentId,
    refetchOnMountOrArgChange: true,
    pollingInterval: polling && (!status || status === 'PENDING') ? 2500 : 0,
  });
  const payment = query.currentData;
  useEffect(() => {
    setStatus(query.isError ? 'ERROR' : payment?.status);
  }, [payment?.status, query.isError]);
  const [checkoutBooking, checkoutState] = useCheckoutBookingMutation();

  if (!paymentId)
    return (
      <EmptyState
        title="Thiếu thông tin giao dịch"
        description="Không tìm thấy mã thanh toán hợp lệ trên đường dẫn."
      />
    );
  if (query.isError)
    return (
      <ErrorState
        title="Không thể tải thông tin thanh toán"
        message="Giao dịch không khả dụng hoặc bạn không có quyền xem. Không thể xác nhận kết quả thanh toán lúc này."
        onAction={() => void query.refetch()}
      />
    );
  if (!payment) return <LoadingState label="Đang đối chiếu thanh toán..." />;

  const subscription = payment.purpose === 'SUBSCRIPTION';
  const destination = subscription
    ? '/guide/subscriptions'
    : `/settings/history/${payment.referenceId}`;
  const paid = payment.status === 'PAID';
  const pending = payment.status === 'PENDING';
  const title = {
    PAID: 'Thanh toán thành công',
    PENDING: 'Thanh toán chưa được xác nhận',
    CANCELLED: 'Giao dịch đã bị hủy',
    EXPIRED: 'Phiên thanh toán đã hết hạn',
    FAILED: 'Thanh toán thất bại',
  }[payment.status];

  const retryBooking = async () => {
    if (subscription || paid || retrying.current) return;
    retrying.current = true;
    setRetryError(null);
    try {
      const result = await checkoutBooking(payment.referenceId).unwrap();
      if (mounted.current) openCheckout(result.checkoutUrl);
    } catch (error) {
      if (mounted.current)
        setRetryError(
          getApiErrorMessage(
            error,
            'Không thể mở lại thanh toán. Vui lòng thử lại.',
          ),
        );
    } finally {
      retrying.current = false;
    }
  };

  return (
    <section
      className="w-full max-w-xl space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8"
      aria-live="polite"
    >
      <div
        className={`mx-auto flex size-14 items-center justify-center rounded-full ${paid ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}
      >
        <span className="material-symbols-outlined text-3xl" aria-hidden="true">
          {paid ? 'check_circle' : pending ? 'hourglass_top' : 'info'}
        </span>
      </div>
      <h1 className="text-center text-2xl font-extrabold text-slate-900">
        {title}
      </h1>
      {paid ? (
        subscription ? (
          <SubscriptionActivation subscriptionId={payment.referenceId} />
        ) : (
          <p className="text-sm text-slate-600">
            Hệ thống đã xác nhận thanh toán. Xem chi tiết chuyến đi và vé điện
            tử bên dưới.
          </p>
        )
      ) : (
        <p className="text-sm text-slate-600">
          {pending
            ? cancelled
              ? 'Bạn đã quay lại từ cổng thanh toán. Giao dịch vẫn đang chờ thanh toán; chưa có xác nhận thành công.'
              : 'Hệ thống đang kiểm tra kết quả với cổng thanh toán. Chưa có xác nhận thành công.'
            : 'Bạn có thể kiểm tra lại hoặc mở lại thanh toán từ trang quản lý.'}{' '}
          {subscription &&
            'Gói chỉ được kích hoạt sau khi hệ thống xác nhận thanh toán.'}
        </p>
      )}
      <dl className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
        <div>
          <dt className="text-slate-500">Mã giao dịch</dt>
          <dd className="mt-1 break-all font-mono text-xs">{payment.id}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Số tiền</dt>
          <dd className="font-bold text-teal-800">
            {formatGuideMoney(payment.amount)}
          </dd>
        </div>
        {!paid && (
          <div>
            <dt>Hạn thanh toán</dt>
            <dd>{formatGuideDate(payment.expiresAt)}</dd>
          </div>
        )}
      </dl>
      {retryError && (
        <p role="alert" className="text-sm text-red-700">
          {retryError}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {!paid && (
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => {
              setPolling(true);
              void query.refetch();
            }}
          >
            Kiểm tra lại
          </Button>
        )}
        {!paid && !subscription && (
          <Button
            loading={checkoutState.isLoading}
            onClick={() => void retryBooking()}
          >
            Thanh toán lại
          </Button>
        )}
        <Link
          href={destination}
          className="inline-flex min-h-10 items-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
        >
          {subscription
            ? paid
              ? 'Xem gói dịch vụ'
              : 'Quay lại gói dịch vụ / Thanh toán tiếp'
            : 'Chi tiết chuyến đi'}
        </Link>
        {paid && !subscription && (
          <Link
            href={`${destination}/ticket`}
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold"
          >
            Xem vé điện tử (E-ticket)
          </Link>
        )}
      </div>
      {pending && !polling && (
        <p className="text-xs text-slate-500">
          Chưa xác định được kết quả. Bạn có thể kiểm tra lại; không cần tạo
          đăng ký mới để xác nhận giao dịch này.
        </p>
      )}
    </section>
  );
}

function SubscriptionActivation({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  const [page, setPage] = useState(1);
  const [polling, setPolling] = useState(true);
  const [activated, setActivated] = useState(false);
  const history = useGetMySubscriptionsQuery(
    { page, limit: 100 },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: polling && !activated ? 2500 : 0,
    },
  );
  const current = useGetCurrentSubscriptionQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const subscription = history.currentData?.items.find(
    (item) => item.id === subscriptionId,
  );
  const confirmed = !history.isError && subscription?.status === 'ACTIVE';
  useEffect(() => {
    setActivated(confirmed);
  }, [confirmed]);
  useEffect(() => {
    if (history.isError) setPolling(false);
  }, [history.isError]);
  useEffect(() => {
    const timeout = setTimeout(() => setPolling(false), 20_000);
    return () => clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if (
      !history.isError &&
      history.currentData &&
      !subscription &&
      page < history.currentData.meta.totalPages &&
      polling
    )
      setPage(page + 1);
  }, [history.currentData, history.isError, subscription, page, polling]);

  return (
    <div className="space-y-3 text-sm">
      {history.isError ? (
        <ErrorState
          title="Đã thanh toán, chưa thể tải trạng thái gói"
          onAction={() => {
            void history.refetch();
            void current.refetch();
          }}
        />
      ) : confirmed ? (
        <p role="status" className="font-semibold text-teal-800">
          {subscription.plan.name}: {subscriptionLabel(subscription)}. Bắt đầu{' '}
          {formatGuideDate(subscription.startsAt)}, kết thúc{' '}
          {formatGuideDate(subscription.endsAt)}.
        </p>
      ) : subscription?.status === 'EXPIRED' ? (
        <p>Gói đã thanh toán và hiện đã hết hạn.</p>
      ) : (
        <>
          <p role="status" className="text-amber-800">
            Đã thanh toán. Chưa xác nhận được gói đã kích hoạt; hệ thống có thể
            đang đồng bộ.
          </p>
          <Button
            variant="outline"
            disabled={history.isFetching}
            onClick={() => {
              void history.refetch();
              void current.refetch();
            }}
          >
            Kiểm tra trạng thái gói
          </Button>
        </>
      )}
    </div>
  );
}
