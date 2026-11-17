'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { baseApi } from '@/store/api/baseApi';
import { useLogoutMutation } from '../api/authApi';
import { clearCredentials } from '../store/authSlice';

export function useLogout(customRedirect?: string) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [logoutMutation] = useLogoutMutation();

  return useCallback(async (redirectOverride?: string) => {
    dispatch(clearCredentials());
    dispatch(baseApi.util.resetApiState());
    const request = logoutMutation();
    const target = redirectOverride ?? customRedirect ?? '/login';
    router.replace(target);
    try {
      await request.unwrap();
    } catch {}
  }, [dispatch, router, logoutMutation, customRedirect]);
}
