'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { baseApi } from '@/store/api/baseApi';
import { useLogoutMutation } from '../api/authApi';
import { clearCredentials } from '../store/authSlice';

export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [logoutMutation] = useLogoutMutation();

  return useCallback(async () => {
    try {
      await logoutMutation().unwrap();
    } catch {}

    dispatch(clearCredentials());
    dispatch(baseApi.util.resetApiState());
    router.push('/login');
  }, [dispatch, router, logoutMutation]);
}
