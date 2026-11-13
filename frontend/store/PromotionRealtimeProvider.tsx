'use client';

import { useEffect, type ReactNode } from 'react';
import { io } from 'socket.io-client';
import { baseApi } from './api/baseApi';
import { useAppDispatch } from './hooks';

export function PromotionRealtimeProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const origin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').origin;
    const socket = io(`${origin}/public`, {
      path: '/socket.io',
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    const refreshPromotions = () => dispatch(baseApi.util.invalidateTags(['Promotion']));
    socket.on('connect', refreshPromotions);
    socket.on('promotion:updated', refreshPromotions);
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [dispatch]);

  return children;
}
