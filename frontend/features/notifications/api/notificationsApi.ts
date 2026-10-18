import { baseApi } from '@/store/api/baseApi';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, string>;
}

interface Envelope<T> {
  data: T;
  meta: {
    page: number;
    totalPages: number;
    total: number;
  };
}

export const sharedNotificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query<Envelope<AppNotification[]>, number | void>({
      query: (page = 1) => ({ url: '/notifications', params: { page, limit: 20 } }),
      providesTags: ['Notification'],
    }),
    getUnreadCount: build.query<number, void>({
      query: () => '/notifications/unread-count',
      transformResponse: (response: { data: { unread: number } }) => response.data?.unread ?? 0,
      providesTags: ['Notification'],
    }),
    markNotificationAsRead: build.mutation<unknown, string>({
      query: (id) => ({ url: `/notifications/${encodeURIComponent(id)}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
    markAllNotificationsAsRead: build.mutation<unknown, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} = sharedNotificationsApi;
