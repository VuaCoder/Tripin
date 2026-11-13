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
import { usePremiumPeriodQuery } from '@/features/premium/api';
import { premiumDate } from '@/features/premium/ui';

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
    ? payment.premium
      ? '/premium'
      : '/guide/subscriptions'
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

  const theme = {
    PAID: {
      bgIcon: 'bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60',
      icon: 'check_circle',
      titleColor: 'text-slate-900',
      accentColor: 'text-emerald-700',
    },
    PENDING: {
      bgIcon: 'bg-amber-50 text-amber-600 ring-8 ring-amber-50/60',
      icon: 'hourglass_top',
      titleColor: 'text-slate-900',
      accentColor: 'text-amber-700',
    },
    CANCELLED: {
      bgIcon: 'bg-amber-50 text-amber-600 ring-8 ring-amber-50/60',
      icon: 'info',
      titleColor: 'text-slate-900',
      accentColor: 'text-slate-700',
    },
    EXPIRED: {
      bgIcon: 'bg-rose-50 text-rose-600 ring-8 ring-rose-50/60',
      icon: 'schedule',
      titleColor: 'text-slate-900',
      accentColor: 'text-rose-700',
    },
    FAILED: {
      bgIcon: 'bg-rose-50 text-rose-600 ring-8 ring-rose-50/60',
      icon: 'error',
      titleColor: 'text-slate-900',
      accentColor: 'text-rose-700',
    },
  }[payment.status as 'PAID' | 'PENDING' | 'CANCELLED' | 'EXPIRED' | 'FAILED'] ?? {
    bgIcon: 'bg-slate-50 text-slate-600 ring-8 ring-slate-50/60',
    icon: 'info',
    titleColor: 'text-slate-900',
    accentColor: 'text-slate-700',
  };

  return (
    <section
      className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9"
      aria-live="polite"
    >
      {/* Top Status Icon */}
      <div className="flex justify-center mb-5">
        <div className={`flex size-16 items-center justify-center rounded-full transition-transform ${theme.bgIcon}`}>
          <span className="material-symbols-outlined text-3xl font-medium" aria-hidden="true">
            {theme.icon}
          </span>
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="text-center space-y-2 mb-6">
        <h1 className={`text-2xl font-black tracking-tight sm:text-[26px] ${theme.titleColor}`}>
          {title}
        </h1>
        {paid ? (
          subscription ? (
            payment.premium ? (
              <PremiumActivation subscriptionId={payment.referenceId} />
            ) : (
              <SubscriptionActivation subscriptionId={payment.referenceId} />
            )
          ) : (
            <p className="text-sm font-medium leading-relaxed text-slate-600 max-w-sm mx-auto">
              Hệ thống đã xác nhận thanh toán thành công. Chi tiết chuyến đi và mã vé đã sẵn sàng bên dưới.
            </p>
          )
        ) : (
          <p className="text-sm font-medium leading-relaxed text-slate-600 max-w-md mx-auto">
            {pending
              ? cancelled
                ? 'Bạn đã quay lại từ cổng thanh toán. Giao dịch vẫn đang chờ thanh toán; chưa có xác nhận thành công.'
                : 'Hệ thống đang kiểm tra kết quả với cổng thanh toán. Chưa có xác nhận thành công.'
              : 'Bạn có thể kiểm tra lại hoặc mở lại thanh toán từ trang quản lý.'}{' '}
            {subscription &&
              'Gói chỉ được kích hoạt sau khi hệ thống xác nhận thanh toán.'}
          </p>
        )}
      </div>

      {/* Transaction Details Card */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-5 space-y-3.5 mb-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-3 border-b border-slate-200/60">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Mã giao dịch
          </span>
          <span className="font-mono text-xs font-bold text-slate-800 break-all select-all sm:text-right">
            {payment.id}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-600">Số tiền thanh toán</span>
          <span className="text-lg font-black text-teal-800 tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatGuideMoney(payment.amount)}
          </span>
        </div>

        {!paid && (
          <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-200/60 text-xs">
            <span className="font-medium text-slate-500">Hạn thanh toán</span>
            <span className="font-semibold text-slate-700">
              {formatGuideDate(payment.expiresAt)}
            </span>
          </div>
        )}
      </div>

      {retryError && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3.5 text-center text-sm font-semibold text-red-700">
          {retryError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-3">
        {!paid && (
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => {
              setPolling(true);
              void query.refetch();
            }}
            className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Kiểm tra lại
          </Button>
        )}

        {!paid && !subscription && (
          <Button
            loading={checkoutState.isLoading}
            onClick={() => void retryBooking()}
            className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold bg-primary-container text-white hover:bg-primary shadow-sm"
          >
            Thanh toán lại
          </Button>
        )}

        <Link
          href={destination}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-800 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-teal-900 active:scale-[0.98] w-full sm:w-auto"
        >
          {subscription
            ? paid
              ? payment.premium
                ? 'Xem Premium'
                : 'Xem gói dịch vụ'
              : payment.premium
                ? 'Quay lại Premium'
                : 'Quay lại gói dịch vụ / Thanh toán tiếp'
            : 'Chi tiết chuyến đi'}
        </Link>

        {paid && !subscription && (
          <Link
            href={`${destination}/ticket`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] w-full sm:w-auto"
          >
            Xem vé điện tử (E-ticket)
          </Link>
        )}
      </div>

      {pending && !polling && (
        <p className="mt-4 text-center text-xs font-medium text-slate-500">
          Chưa xác định được kết quả. Bạn có thể bấm "Kiểm tra lại"; không cần tạo đăng ký mới để xác nhận giao dịch này.
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

function PremiumActivation({ subscriptionId }: { subscriptionId: string }) {
  const user = useAppSelector(selectUser);
  const [polling, setPolling] = useState(true);
  const history = usePremiumPeriodQuery(
    { userId: user?.id ?? '', id: subscriptionId },
    {
      skip: !user,
      pollingInterval: polling ? 2500 : 0,
      refetchOnMountOrArgChange: true,
    },
  );
  const period = history.currentData;
  useEffect(() => {
    const timeout = setTimeout(() => setPolling(false), 20_000);
    return () => clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if (
      period?.status === 'ACTIVE' ||
      period?.status === 'EXPIRED' ||
      period?.revokedAt ||
      history.isError
    )
      setPolling(false);
  }, [period?.status, period?.revokedAt, history.isError]);
  if (history.isError)
    return (
      <ErrorState
        title="Đã thanh toán, chưa tải được trạng thái Premium"
        onAction={() => void history.refetch()}
      />
    );
  if (period?.revokedAt)
    return (
      <p role="status" className="text-sm text-amber-800">
        Kỳ Premium đã được thu hồi hoặc đang chờ hoàn tiền. Xem chi tiết tại
        trang Premium.
      </p>
    );
  if (
    period?.status === 'EXPIRED' ||
    (period?.status === 'ACTIVE' &&
      period.endsAt &&
      new Date(period.endsAt) <= new Date())
  )
    return (
      <p role="status" className="text-sm text-slate-600">
        Kỳ Premium đã thanh toán và hiện đã hết hạn.
      </p>
    );
  if (period?.status === 'ACTIVE')
    return (
      <p role="status" className="text-sm text-teal-800">
        {period.startsAt && new Date(period.startsAt) > new Date()
          ? `Đã thanh toán. Kỳ Premium bắt đầu ${premiumDate(period.startsAt)}.`
          : `Premium đã được kích hoạt. Hoạt động đến ${premiumDate(period.endsAt)}.`}
      </p>
    );
  return (
    <div className="space-y-3">
      <p role="status" className="text-sm text-amber-800">
        Đã thanh toán. Đang đồng bộ quyền lợi Premium.
      </p>
      <button
        className="text-sm font-semibold text-teal-800 underline"
        onClick={() => void history.refetch()}
      >
        Kiểm tra lại trạng thái Premium
      </button>
    </div>
  );
}
