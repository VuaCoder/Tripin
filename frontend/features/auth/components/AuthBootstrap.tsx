'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { refreshSession } from '@/store/api/baseApi';
import { clearCredentials, setCredentials } from '../store/authSlice';
import { store } from '@/store';

export const AuthBootstrap = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let active = true;

    const synchronize = async () => {
      const identityAtStart = store.getState().auth.user?.id;
      const session = await refreshSession();
      if (!active) return;
      const currentId = store.getState().auth.user?.id;
      if (currentId !== identityAtStart && currentId !== session?.user.id) return;
      if (session) dispatch(setCredentials(session));
      // A transient refresh outage must not log an already authenticated staff member out.
      // Protected API requests still clear revoked credentials through baseQueryWithReauth.
      else if (!identityAtStart) dispatch(clearCredentials());
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
