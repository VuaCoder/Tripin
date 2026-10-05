import { baseApi } from '@/store/api/baseApi';
import type { UserProfile } from '@/features/auth/types';
import type { UpdateProfileRequest } from '../types';

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<{ success: boolean; data: UserProfile }, void>({
      query: () => '/users/me',
      providesTags: ['User'],
    }),
    updateMe: builder.mutation<{ success: boolean; data: UserProfile }, UpdateProfileRequest>({
      query: (body) => ({
        url: '/users/me',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['User'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetMeQuery, useUpdateMeMutation } = profileApi;
