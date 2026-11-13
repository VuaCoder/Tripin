'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { refreshSession } from '@/store/api/baseApi';
import { clearCredentials, restoreCredentials, setCredentials } from '../store/authSlice';
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

    const synchronize = async () => {
      const identityAtStart = store.getState().auth.user?.id;
      const tokenAtStart = store.getState().auth.accessToken;
      const session = await refreshSession();
      if (!active) return;
      const currentId = store.getState().auth.user?.id;
      if (currentId !== identityAtStart || store.getState().auth.accessToken !== tokenAtStart) return;
      if (session) {
        dispatch(setCredentials(session));
      } else {
        if (!identityAtStart) {
          dispatch(clearCredentials());
        }
      }
    };

    // Only refresh on mount if token is absent or expiring soon (prevents concurrent refresh race across tabs/reloads)
    const currentToken = store.getState().auth.accessToken;
    if (!currentToken || isTokenExpiringSoon(currentToken, 120)) {
      void synchronize();
    }

    const refreshStaff = () => {
      const state = store.getState().auth;
      const role = state.user?.role;
      if (role !== 'MODERATOR' && role !== 'SUPER_ADMIN') return;

      // If token has more than 120s left, do NOT refresh on focus/timer
      if (!isTokenExpiringSoon(state.accessToken, 120)) {
        return;
      }
      void synchronize();
    };

    // Keep tabs in sync: when another tab rotates the token, update this tab immediately without re-refreshing
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object' && parsed.accessToken && parsed.user) {
            dispatch(restoreCredentials(parsed));
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', refreshStaff);
    const timer = window.setInterval(refreshStaff, 60_000);

    return () => {
      active = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', refreshStaff);
      window.clearInterval(timer);
    };
  }, [dispatch]);

  return null;
};
