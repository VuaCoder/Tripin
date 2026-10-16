'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { baseApi, refreshSession } from '@/store/api/baseApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAccessToken, selectUser, setCredentials } from '@/features/auth/store/authSlice';

export interface AgencyNotification { id: string; type: string; title: string; body: string; isRead: boolean; createdAt: string; data?: Record<string, string> }
interface Envelope<T> { data: T; meta: { page: number; totalPages: number; total: number } }
export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    agencyNotifications: build.query<Envelope<AgencyNotification[]>, number>({
      query: (page) => ({ url: '/notifications', params: { page, limit: 20 } }),
      providesTags: ['Notification'],
    }),
    agencyUnread: build.query<number, void>({
      query: () => '/notifications/unread-count',
      transformResponse: (response: { data: { unread: number } }) => response.data.unread,
      providesTags: ['Notification'],
    }),
    readAgencyNotification: build.mutation<unknown, string>({
      query: (id) => ({ url: `/notifications/${encodeURIComponent(id)}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
    readAllAgencyNotifications: build.mutation<unknown, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notification'],
    }),
    deleteAgencyNotification: build.mutation<{ data: { deleted: true } }, string>({
      query: (id) => ({ url: `/notifications/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});
export const { useAgencyNotificationsQuery, useAgencyUnreadQuery, useReadAgencyNotificationMutation, useReadAllAgencyNotificationsMutation, useDeleteAgencyNotificationMutation } = notificationsApi;

/** One connection in the Agency shell; inbox queries share RTK's authenticated cache. */
export function useAgencyNotifications() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState('');
  const { data: count } = useAgencyUnreadQuery(undefined, { skip: !user?.id || !token, pollingInterval: 30000, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true });
  useEffect(() => {
    setConnected(false);
    setLatest('');
    if (!user?.id || !token) return;
    let disposed = false;
    let refreshing = false;
    const socket = io(new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').origin, { auth: { token }, withCredentials: true });
    const invalidate = () => dispatch(baseApi.util.invalidateTags(['Notification']));
    socket.on('connect', () => { setConnected(true); invalidate(); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('notification:new', (notification: AgencyNotification) => {
      if (!notification || typeof notification.id !== 'string' || typeof notification.title !== 'string') return;
      setLatest(notification.title);
      invalidate();
    });
    socket.on('connect_error', async (error) => {
      setConnected(false);
      if (!['TOKEN_INVALID', 'UNAUTHENTICATED'].includes(error.message) || refreshing) return;
      refreshing = true;
      const session = await refreshSession();
      if (!disposed && session?.user.id === user.id) dispatch(setCredentials(session));
      refreshing = false;
    });
    const reconnect = () => { if (document.visibilityState === 'visible') { invalidate(); if (!socket.connected) socket.connect(); } };
    document.addEventListener('visibilitychange', reconnect);
    return () => { disposed = true; document.removeEventListener('visibilitychange', reconnect); socket.removeAllListeners(); socket.disconnect(); };
  }, [dispatch, token, user?.id]);
  return { count, connected, latest };
}
