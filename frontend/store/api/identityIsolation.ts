import type { Middleware } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';

type IdentityState = { auth: { user: { id: string } | null } };

/** Private query results must never survive an account switch or logout. */
export const identityIsolation: Middleware = ({ getState, dispatch }) => (next) => (action) => {
  const previousId = (getState() as IdentityState).auth.user?.id;
  const result = next(action);
  const nextId = (getState() as IdentityState).auth.user?.id;
  if (previousId !== nextId) dispatch(baseApi.util.resetApiState());
  return result;
};
