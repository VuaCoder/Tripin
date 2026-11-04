import type { Middleware } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';

type IdentityState = { auth: { user: { id: string; role?: string } | null } };

/** Private query results must never survive an account switch or logout. */
export const identityIsolation: Middleware = ({ getState, dispatch }) => (next) => (action) => {
  const previousId = (getState() as IdentityState).auth.user?.id;
  const previousRole = (getState() as IdentityState).auth.user?.role;
  const result = next(action);
  const nextId = (getState() as IdentityState).auth.user?.id;
  const nextRole = (getState() as IdentityState).auth.user?.role;
  if (previousId !== nextId || previousRole !== nextRole) dispatch(baseApi.util.resetApiState());
  return result;
};
