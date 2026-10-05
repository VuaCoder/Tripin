'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { refreshSession } from '@/store/api/baseApi';
import { clearCredentials, setCredentials } from '../store/authSlice';

export const AuthBootstrap = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let active = true;

    refreshSession().then((session) => {
      if (!active) return;
      if (session) dispatch(setCredentials(session));
      else dispatch(clearCredentials());
    });

    return () => {
      active = false;
    };
  }, [dispatch]);

  return null;
};
