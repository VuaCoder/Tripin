'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { refreshSession } from '@/store/api/baseApi';
import { clearCredentials, setCredentials } from '../store/authSlice';
import { store } from '@/store';

const STORAGE_KEY = 'tripri_auth_session';

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
            dispatch(setCredentials(parsed));
          }
        }
      } catch {}
    }

    const synchronize = async () => {
      const identityAtStart = store.getState().auth.user?.id;
      const session = await refreshSession();
      if (!active) return;
      const currentId = store.getState().auth.user?.id;
      if (currentId !== identityAtStart && currentId !== session?.user.id) return;
      if (session) {
        dispatch(setCredentials(session));
      } else {
        const localRaw =
          typeof window !== 'undefined'
            ? localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
            : null;
        if (!localRaw && !identityAtStart) {
          dispatch(clearCredentials());
        }
      }
    };
    void synchronize();

    const refreshStaff = () => {
      const role = store.getState().auth.user?.role;
      if (role === 'MODERATOR' || role === 'SUPER_ADMIN') void synchronize();
    };
    window.addEventListener('focus', refreshStaff);
    const timer = window.setInterval(refreshStaff, 60_000);

    return () => {
      active = false;
      window.removeEventListener('focus', refreshStaff);
      window.clearInterval(timer);
    };
  }, [dispatch]);

  return null;
};
