import { baseApi } from '@/store/api/baseApi';
import type { UserProfile } from '@/features/auth/types';
import type { UpdateProfileRequest } from '../types';
import type { AvatarUploadSignature } from '../types';

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
    createAvatarUploadSignature: builder.mutation<{ success: boolean; data: AvatarUploadSignature }, void>({
      query: () => ({
        url: '/users/me/avatar/upload-signature',
        method: 'POST',
        body: {},
      }),
    }),
    completeAvatarUpload: builder.mutation<{ success: boolean; data: UserProfile }, { publicId: string }>({
      query: (body) => ({
        url: '/users/me/avatar/complete',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),
    removeAvatar: builder.mutation<{ success: boolean; data: UserProfile }, void>({
      query: () => ({ url: '/users/me/avatar', method: 'DELETE' }),
      invalidatesTags: ['User'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMeQuery,
  useUpdateMeMutation,
  useCreateAvatarUploadSignatureMutation,
  useCompleteAvatarUploadMutation,
  useRemoveAvatarMutation,
} = profileApi;
