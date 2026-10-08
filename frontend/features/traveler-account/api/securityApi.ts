import { baseApi } from '@/store/api/baseApi';
import type { UserProfile } from '@/features/auth/types';
import type { SecuritySettings, SetTwoFactorRequest } from '../types';

export const securityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSecuritySettings: builder.query<{ success: boolean; data: SecuritySettings }, void>({
      query: () => '/auth/security',
      providesTags: ['Auth'],
    }),
    setTwoFactor: builder.mutation<{ success: boolean; data: UserProfile }, SetTwoFactorRequest>({
      query: (body) => ({
        url: '/auth/two-factor',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Auth', 'User'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetSecuritySettingsQuery, useSetTwoFactorMutation } = securityApi;
