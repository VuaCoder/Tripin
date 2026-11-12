import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { RootState } from '..';
import { clearCredentials, selectActiveAgency, setAgencyMemberships, setCredentials } from '@/features/auth/store/authSlice';
import type { AgencyMembership, SessionData } from '@/features/auth/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const isAgencyRequest = (args: FetchArgs | string) => {
  const url = typeof args === 'string' ? args : args.url;
  return /^\/?agency(?:\/|$)/.test(url);
};

type RetryableArgs = string | (FetchArgs & { _retried?: boolean });

const isObjectArgs = (args: unknown): args is FetchArgs & { _retried?: boolean } =>
  typeof args === 'object' && args !== null;

const hasRetried = (args: unknown): boolean => isObjectArgs(args) && args._retried === true;

const stripRetryFlag = (args: unknown): FetchArgs | string => {
  if (!isObjectArgs(args)) return args as string;
  const clean = { ...args };
  delete clean._retried;
  return clean;
};

const markRetried = (args: FetchArgs | string): RetryableArgs => {
  if (typeof args === 'object') return { ...args, _retried: true };
  return args;
};

async function requestRefresh(): Promise<SessionData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; data?: SessionData };
    if (!body?.success || !body.data?.accessToken || !body.data.user) return null;
    return body.data;
  } catch {
    return null;
  }
}

let refreshPromise: Promise<SessionData | null> | null = null;

export function refreshSession(): Promise<SessionData | null> {
  if (!refreshPromise) {
    refreshPromise = requestRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

const AUTH_EXEMPT_PATHS = [
  '/auth/agency/login',
  '/auth/agency/google',
  '/auth/agency/register',
  '/auth/agency/verify-otp',
  '/auth/agency/resend-otp',
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/resend-otp',
  '/auth/google',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
  '/auth/logout',
];

const isAuthExempt = (args: FetchArgs | string): boolean => {
  const url = typeof args === 'string' ? args : args.url;
  return typeof url === 'string' && AUTH_EXEMPT_PATHS.some((path) => url.includes(path));
};

export const baseQueryWithReauth: BaseQueryFn<FetchArgs | string, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const agencyRequest = isAgencyRequest(args);
  const requestUserId = (api.getState() as RootState).auth.user?.id;
  let requestAgencyEpoch = (api.getState() as RootState).auth.agencyEpoch;
  let requestRole = (api.getState() as RootState).auth.user?.role;
  const identityChanged = () => {
    const user = (api.getState() as RootState).auth.user;
    return user?.id !== requestUserId || user?.role !== requestRole ||
      (api.getState() as RootState).auth.agencyEpoch !== requestAgencyEpoch;
  };
  const superseded = { error: { status: 'CUSTOM_ERROR' as const, error: 'Account changed during request' } };
  const cleanArgs = stripRetryFlag(args);
  const scopedArgs = () => {
    const request = typeof cleanArgs === 'string' ? { url: cleanArgs } : { ...cleanArgs };
    const headers = new Headers(request.headers as HeadersInit | undefined);
    // Tenant headers are owned by the authenticated state, never arbitrary callers.
    headers.delete('X-Agency-Id');
    if (agencyRequest) {
      const agency = selectActiveAgency(api.getState() as RootState);
      if (agency) headers.set('X-Agency-Id', agency.agencyId);
    }
    return { ...request, headers };
  };
  if (agencyRequest && !selectActiveAgency(api.getState() as RootState)) {
    return { error: { status: 403, data: { error: { code: 'AGENCY_SELECTION_REQUIRED', message: 'Select an active agency first' } } } };
  }
  let result = await rawBaseQuery(scopedArgs(), api, extraOptions);
  if (identityChanged()) return superseded;

  if (result.error?.status === 401 && !hasRetried(args) && !isAuthExempt(cleanArgs)) {
    const errorCode = (result.error.data as { error?: { code?: string } } | undefined)?.error?.code;
    const sessionExpired = errorCode === 'TOKEN_INVALID' || errorCode === 'UNAUTHENTICATED';

    if (sessionExpired) {
      const session = await refreshSession();
      // A refresh started by A must neither restore A nor clear B after an
      // account switch/logout while the request was in flight.
      if (identityChanged()) return superseded;

      if (session && (!requestUserId || session.user.id === requestUserId)) {
        requestRole = session.user.role;
        api.dispatch(setCredentials(session));
        if (agencyRequest && identityChanged()) return superseded;
        if (!agencyRequest) requestAgencyEpoch = (api.getState() as RootState).auth.agencyEpoch;
        result = await rawBaseQuery(scopedArgs(), api, extraOptions);
        if (requestUserId && identityChanged()) return superseded;
      } else {
        api.dispatch(clearCredentials());
        api.dispatch(baseApi.util.resetApiState());
        if (typeof window !== 'undefined') {
          const loginPath = window.location.pathname.startsWith('/agency') ? '/agency/login' : '/login';
          if (window.location.pathname !== loginPath) window.location.href = loginPath;
        }
      }
    }
  }

  // A permission-level 403 is not proof of revocation. Re-read memberships,
  // preserving personal access and removing only memberships absent on the server.
  if (agencyRequest && result.error?.status === 403 && !identityChanged()) {
    try {
      const memberships = await rawBaseQuery('/users/me/agencies', api, extraOptions);
      if (!identityChanged() && Array.isArray((memberships.data as { data?: unknown })?.data)) {
        api.dispatch(setAgencyMemberships({ userId: requestUserId!, agencies: (memberships.data as { data: AgencyMembership[] }).data }));
      }
    } catch { /* Keep the original permission error if synchronization is unavailable. */ }
    if (identityChanged()) return superseded;
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Category',
    'Policy',
    'Commission',
    'Auth',
    'User',
    'Tour',
    'Review',
    'Cart',
    'Wishlist',
    'Payment',
    'Booking',
    'ETicket',
    'Notification',
    'Promotion',
    'Complaint',
    'Moderation',
    'Report',
    'SupportTicket',
    'Category',
    'Policy',
    'Commission',
    'Subscription',
    'Earning',
    'AiChat',
    'AgencyMember',
  ],
  endpoints: () => ({}),
});
