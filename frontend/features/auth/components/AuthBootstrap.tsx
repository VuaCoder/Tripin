'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { baseApi, refreshSessionChecked, verifyStoredSessionChecked } from '@/store/api/baseApi';
import { beginSessionRestore, sessionRestoreUnavailable, clearCredentials, restoreCredentials, setCredentials } from '../store/authSlice';
import { store } from '@/store';

const STORAGE_KEY = 'tripri_auth_session';

function isTokenExpiringSoon(token: string | null | undefined, minRemainingSec = 120): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp || typeof payload.exp !== 'number') return true;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp - nowSeconds <= minRemainingSec;
  } catch {
    return true;
  }
}

export const AuthBootstrap = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let active = true;

    // Immediately restore from persistent or session storage if memory store is empty
    if (!store.getState().auth.accessToken && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.accessToken && parsed.user) {
            dispatch(restoreCredentials(parsed));
          }
        }
      } catch {}
    }

    const synchronize = async (verifyStored = false, blocking = true) => {
      // A known signed-out session must not be bootstrapped back into checking
      // state by a remount or a queued retry/focus event during logout.
      if (store.getState().auth.status === 'unauthenticated') return;
      const identityAtStart = store.getState().auth.user?.id;
      const tokenAtStart = store.getState().auth.accessToken;
      const expectedStatus = blocking ? 'idle' : store.getState().auth.status;
      if (blocking) dispatch(beginSessionRestore());
      let session;
      try {
        session = verifyStored && tokenAtStart && !isTokenExpiringSoon(tokenAtStart, 120)
          ? await verifyStoredSessionChecked(tokenAtStart) : await refreshSessionChecked();
      } catch {
        // A temporary outage must not destroy the persisted session.
        if (blocking && active && store.getState().auth.status === expectedStatus && store.getState().auth.user?.id === identityAtStart && store.getState().auth.accessToken === tokenAtStart) dispatch(sessionRestoreUnavailable());
        return;
      }
      if (!active) return;
      const currentId = store.getState().auth.user?.id;
      if (store.getState().auth.status !== expectedStatus) return;
      if (currentId !== identityAtStart || store.getState().auth.accessToken !== tokenAtStart) return;
      if (session) {
        dispatch(setCredentials(session));
      } else {
        dispatch(clearCredentials());
        dispatch(baseApi.util.resetApiState());
      }
    };

    // Fresh tokens are verified through /users/me; only expired/missing tokens rotate the refresh cookie.
    void synchronize(true);

    const refreshCurrentSession = () => {
      const state = store.getState().auth;
      if (!state.user) return;

      // If token has more than 120s left, do NOT refresh on focus/timer
      if (!state.bootstrapError && !isTokenExpiringSoon(state.accessToken, 120)) {
        return;
      }
      void synchronize(true, state.status !== 'authenticated');
    };

    // Revalidate storage updates before trusting cached identity or permissions.
    const handleStorage = (e: StorageEvent) => {
      if (e.storageArea === localStorage && e.key === STORAGE_KEY && !e.newValue && !sessionStorage.getItem(STORAGE_KEY)) {
        dispatch(clearCredentials());
        dispatch(baseApi.util.resetApiState());
        return;
      }
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object' && parsed.accessToken && parsed.user) {
            dispatch(restoreCredentials(parsed));
            void synchronize(true);
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);
    const retry = () => { void synchronize(true); };
    window.addEventListener('tripri:retry-session', retry);
    window.addEventListener('focus', refreshCurrentSession);
    const timer = window.setInterval(refreshCurrentSession, 60_000);

    return () => {
      active = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tripri:retry-session', retry);
      window.removeEventListener('focus', refreshCurrentSession);
      window.clearInterval(timer);
    };
  }, [dispatch]);

  return null;
};
