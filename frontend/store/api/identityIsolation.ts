import type { Middleware } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';
import { setLocalNotificationScope } from '@/features/agency/localNotifications';
import { selectActiveAgency } from '@/features/auth/store/authSlice';

type IdentityState = { auth: { agencyEpoch?: number; user: { id: string; role?: string; permissions?: readonly string[] } | null } };

/** Private query results must never survive an account switch or logout. */
export const identityIsolation: Middleware = ({ getState, dispatch }) => (next) => (action) => {
  const previousId = (getState() as IdentityState).auth.user?.id;
  const previousAgencyEpoch = (getState() as IdentityState).auth.agencyEpoch;
  const previousRole = (getState() as IdentityState).auth.user?.role;
  const previousPermissions = [...((getState() as IdentityState).auth.user?.permissions ?? [])].sort().join('|');
  const result = next(action);
  const nextId = (getState() as IdentityState).auth.user?.id;
  const nextRole = (getState() as IdentityState).auth.user?.role;
  const nextPermissions = [...((getState() as IdentityState).auth.user?.permissions ?? [])].sort().join('|');
  setLocalNotificationScope(nextId ?? null, selectActiveAgency(getState() as import('@/store').RootState)?.agencyId ?? null);
  if (previousId !== nextId || previousRole !== nextRole || previousPermissions !== nextPermissions || previousAgencyEpoch !== (getState() as IdentityState).auth.agencyEpoch) dispatch(baseApi.util.resetApiState());
  return result;
};
