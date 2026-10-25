'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { useMyPremiumQuery, type PremiumStatus } from './api';

export function useOwnPremium(userId?: string) {
  const user = useAppSelector(selectUser);
  const eligible =
    !!user &&
    (!userId || userId === user.id) &&
    ['TRAVELER', 'TOUR_GUIDE'].includes(user.role);
  const query = useMyPremiumQuery(user ? `${user.id}:${user.role}` : '', {
    skip: !eligible,
    pollingInterval: 60_000,
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const endsAt = query.currentData?.endsAt;
    if (!endsAt) return;
    const delay = new Date(endsAt).getTime() - Date.now();
    if (delay <= 0) {
      if (now < new Date(endsAt).getTime()) setNow(Date.now());
      return;
    }
    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.min(delay + 1, 2_147_483_647),
    );
    return () => clearTimeout(timeout);
  }, [query.currentData?.endsAt, now]);
  const data = eligible && !query.isError ? query.currentData : undefined;
  return {
    ...query,
    premium: data
      ? {
          ...data,
          active:
            data.active &&
            !!data.endsAt &&
            new Date(data.endsAt).getTime() > now,
          expired:
            data.expired ||
            (data.active &&
              !!data.endsAt &&
              new Date(data.endsAt).getTime() <= now),
        }
      : undefined,
  };
}

export function PremiumFrame({
  active,
  children,
  className = '',
  rounded = false,
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  rounded?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 ${rounded ? 'rounded-2xl' : 'rounded-full'} ${active ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-white' : ''} ${className}`}
    >
      {children}
      {active && (
        <span
          role="img"
          aria-label="Thành viên Premium"
          title="Thành viên Premium"
          className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white bg-amber-500 text-amber-950"
        >
          <span
            className="material-symbols-outlined text-[12px] leading-none"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            workspace_premium
          </span>
        </span>
      )}
    </span>
  );
}

export function PremiumAvatar({
  url,
  name,
  active,
  size = 'lg',
}: {
  url?: string | null;
  name: string;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const sizeClass =
    size === 'sm'
      ? 'size-8 text-xs'
      : size === 'md'
        ? 'size-16 text-lg'
        : 'size-24 text-2xl';
  return (
    <PremiumFrame active={active}>
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container font-bold text-white ${sizeClass}`}
      >
        {url && !failed ? (
          <img
            src={url}
            alt={`Ảnh đại diện của ${name}`}
            className="size-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <span aria-label={`Ảnh đại diện mặc định của ${name}`}>
            {name
              .trim()
              .split(/\s+/)
              .map((p) => p[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'U'}
          </span>
        )}
      </span>
    </PremiumFrame>
  );
}

export function PremiumStatusText({
  status,
  error,
  onRetry,
  loading,
  showInactive = false,
}: {
  status?: PremiumStatus;
  error?: boolean;
  onRetry?: () => void;
  loading?: boolean;
  showInactive?: boolean;
}) {
  if (error)
    return (
      <span className="block text-xs text-slate-600" role="status">
        Không tải được trạng thái Premium.{' '}
        <button
          type="button"
          onClick={onRetry}
          className="font-semibold text-primary underline underline-offset-2"
        >
          Thử lại
        </button>
      </span>
    );
  if (loading)
    return (
      <span className="block text-xs text-slate-500" role="status">
        Đang kiểm tra Premium…
      </span>
    );
  if (!status?.active)
    return showInactive ? (
      <span className="block text-sm text-slate-600">
        {status?.expired
          ? 'Premium đã hết hạn'
          : 'Chưa có Premium đang hiệu lực'}
      </span>
    ) : null;
  const date = status.endsAt
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(status.endsAt))
    : '';
  return (
    <span className="inline-flex flex-col text-left">
      <span className="text-sm font-bold text-amber-800">Premium</span>
      <span className="mt-0.5 text-xs font-normal text-slate-600">
        Hoạt động đến {date}
      </span>
    </span>
  );
}

export function OwnPremiumStatus({ userId }: { userId: string }) {
  const query = useOwnPremium(userId);
  return (
    <PremiumStatusText
      status={query.premium}
      error={query.isError}
      loading={query.isLoading}
      onRetry={() => void query.refetch()}
    />
  );
}

export function OwnPremiumIdentity({
  userId,
  url,
  name,
  size = 'lg',
  showStatus = true,
}: {
  userId: string;
  url?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}) {
  const query = useOwnPremium(userId);
  return (
    <span className="inline-flex items-center gap-4">
      <PremiumAvatar
        url={url}
        name={name}
        size={size}
        active={query.premium?.active}
      />
      {showStatus && (
        <PremiumStatusText
          status={query.premium}
          error={query.isError}
          loading={query.isLoading}
          onRetry={() => void query.refetch()}
        />
      )}
    </span>
  );
}
