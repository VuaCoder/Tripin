import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { RootState } from '..';
import { clearCredentials, setCredentials } from '@/features/auth/store/authSlice';
import type { SessionData } from '@/features/auth/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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
  const cleanArgs = stripRetryFlag(args);
  let result = await rawBaseQuery(cleanArgs, api, extraOptions);

  if (result.error?.status === 401 && !hasRetried(args) && !isAuthExempt(cleanArgs)) {
    const errorCode = (result.error.data as { error?: { code?: string } } | undefined)?.error?.code;
    const sessionExpired = errorCode === 'TOKEN_INVALID' || errorCode === 'UNAUTHENTICATED';

    if (sessionExpired) {
      const session = await refreshSession();

      if (session) {
        api.dispatch(setCredentials(session));
        result = await rawBaseQuery(markRetried(cleanArgs), api, extraOptions);
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

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Auth', 'User'],
  endpoints: () => ({}),
});
