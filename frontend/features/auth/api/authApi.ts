import { baseApi } from '@/store/api/baseApi';
import type {
  AuthApiResponse,
  ForgotPasswordRequest,
  GoogleAuthPayload,
  LoginRequest,
  LoginResultData,
  RegisterRequest,
  RegisterResultData,
  ResendOtpRequest,
  ResetPasswordRequest,
  SessionData,
  VerifyOtpRequest,
} from '../types';

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResultData, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (response: AuthApiResponse<LoginResultData>) => response.data,
      invalidatesTags: ['Auth'],
    }),
    register: build.mutation<RegisterResultData, RegisterRequest>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      transformResponse: (response: AuthApiResponse<RegisterResultData>) => response.data,
    }),
    verifyOtp: build.mutation<SessionData, VerifyOtpRequest>({
      query: (body) => ({ url: '/auth/verify-otp', method: 'POST', body }),
      transformResponse: (response: AuthApiResponse<SessionData>) => response.data,
      invalidatesTags: ['Auth'],
    }),
    resendOtp: build.mutation<{ message?: string }, ResendOtpRequest>({
      query: (body) => ({ url: '/auth/resend-otp', method: 'POST', body }),
      transformResponse: (response: AuthApiResponse<{ message?: string }>) => response.data,
    }),
    loginWithGoogle: build.mutation<SessionData, GoogleAuthPayload>({
      query: (body) => ({ url: '/auth/google', method: 'POST', body }),
      transformResponse: (response: AuthApiResponse<SessionData>) => response.data,
      invalidatesTags: ['Auth'],
    }),
    forgotPassword: build.mutation<{ message?: string }, ForgotPasswordRequest>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
      transformResponse: (response: AuthApiResponse<{ message?: string }>) => response.data,
    }),
    resetPassword: build.mutation<void, ResetPasswordRequest>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
    refresh: build.mutation<SessionData, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
      transformResponse: (response: AuthApiResponse<SessionData>) => response.data,
      invalidatesTags: ['Auth'],
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Auth', 'User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useVerifyOtpMutation,
  useResendOtpMutation,
  useLoginWithGoogleMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useRefreshMutation,
  useLogoutMutation,
} = authApi;
