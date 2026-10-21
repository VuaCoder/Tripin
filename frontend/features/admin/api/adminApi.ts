import { baseApi } from '@/store/api/baseApi';
import type { DashboardArgs } from '../types';
import type { AccessInput, AdminUser, Category, CategoryInput, Commission, Dashboard, Envelope, ListPromotionsArgs, Page, Policy, PolicyInput, PolicyKey, Promotion, CreatePromotionInput, UpdatePromotionInput, UsersArgs } from '../types';

const page = <T>(response: Envelope<T[]>): Page<T> => {
  if (!response.meta) throw new Error('Missing pagination metadata');
  return { items: response.data, meta: response.meta };
};
const adminPromotions = { type: 'Promotion' as const, id: 'ADMIN_LIST' };
const users = { type: 'User' as const, id: 'ADMIN_LIST' };
const categories = { type: 'Category' as const, id: 'LIST' };
const policies = { type: 'Policy' as const, id: 'LIST' };
const commission = { type: 'Commission' as const, id: 'PLATFORM' };

/** Mutations invalidate only after a confirmed success. No optimistic configuration writes. */
export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAdminDashboard: build.query<Dashboard, DashboardArgs | void>({
      query: (params) => ({ url: '/admin/dashboard', params: params || {} }), transformResponse: (r: Envelope<Dashboard>) => r.data,
    }),
    getAdminPromotions: build.query<Page<Promotion>, ListPromotionsArgs>({
      query: (params) => ({ url: '/admin/promotions', params }), transformResponse: page<Promotion>,
      providesTags: [adminPromotions],
    }),
    getAdminPromotion: build.query<Promotion, string>({
      query: (id) => `/admin/promotions/${id}`, transformResponse: (r: Envelope<Promotion>) => r.data,
      providesTags: (_r, _e, id) => [{ type: 'Promotion', id: `ADMIN_${id}` }],
    }),
    createAdminPromotion: build.mutation<Promotion, CreatePromotionInput>({
      query: (body) => ({ url: '/admin/promotions', method: 'POST', body }),
      transformResponse: (r: Envelope<Promotion>) => r.data,
      invalidatesTags: (_r, e) => e ? [] : [adminPromotions],
    }),
    updateAdminPromotion: build.mutation<Promotion, UpdatePromotionInput>({
      query: ({ id, patch }) => ({ url: `/admin/promotions/${id}`, method: 'PATCH', body: patch }),
      transformResponse: (r: Envelope<Promotion>) => r.data,
      invalidatesTags: (_r, e, { id }) => e ? [] : [adminPromotions, { type: 'Promotion', id: `ADMIN_${id}` }],
    }),
    generateAdminBatch: build.mutation<{ count: number; codes: string[] }, { id: string; count: number; prefix?: string }>({
      query: ({ id, count, prefix }) => ({ url: `/admin/promotions/${id}/generate-batch`, method: 'POST', body: { count, prefix } }),
      transformResponse: (r: Envelope<{ count: number; codes: string[] }>) => r.data,
      invalidatesTags: (_r, e) => e ? [] : [adminPromotions],
    }),
    getAdminBatch: build.query<Page<import('@/features/agency-promotions/types').PromotionCodeInstance>, { id: string; page?: number; limit?: number }>({
      query: ({ id, page = 1, limit = 20 }) => ({ url: `/admin/promotions/${id}/batch`, params: { page, limit } }),
      transformResponse: page<import('@/features/agency-promotions/types').PromotionCodeInstance>,
    }),
    getAdminUsers: build.query<Page<AdminUser>, UsersArgs>({
      query: (params) => ({ url: '/admin/users', params }), transformResponse: page<AdminUser>, providesTags: [users],
    }),
    assignAdminAccess: build.mutation<AdminUser, AccessInput>({
      query: ({ id, ...body }) => ({ url: `/admin/users/${id}/access`, method: 'PATCH', body }),
      transformResponse: (r: Envelope<AdminUser>) => r.data,
      invalidatesTags: (_r, e) => e ? [] : [users],
    }),
    getAdminCategories: build.query<Category[], void>({
      query: () => '/admin/categories', transformResponse: (r: Envelope<Category[]>) => r.data, providesTags: [categories],
    }),
    createAdminCategory: build.mutation<Category, CategoryInput>({
      query: (body) => ({ url: '/admin/categories', method: 'POST', body }),
      transformResponse: (r: Envelope<Category>) => r.data, invalidatesTags: (_r, e) => e ? [] : [categories],
    }),
    updateAdminCategory: build.mutation<Category, { id: string; patch: Partial<CategoryInput & { isActive: boolean }> }>({
      query: ({ id, patch }) => ({ url: `/admin/categories/${id}`, method: 'PATCH', body: patch }),
      transformResponse: (r: Envelope<Category>) => r.data, invalidatesTags: (_r, e) => e ? [] : [categories],
    }),
    deactivateAdminCategory: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, e) => e ? [] : [categories],
    }),
    getAdminCommission: build.query<Commission, void>({
      query: () => '/admin/settings/commission', transformResponse: (r: Envelope<Commission>) => r.data, providesTags: [commission],
    }),
    setAdminCommission: build.mutation<Commission, number>({
      query: (ratePercent) => ({ url: '/admin/settings/commission', method: 'PUT', body: { ratePercent } }),
      transformResponse: (r: Envelope<Commission>) => r.data, invalidatesTags: (_r, e) => e ? [] : [commission],
    }),
    getAdminPolicies: build.query<Policy[], void>({
      query: () => '/policies', transformResponse: (r: Envelope<Policy[]>) => r.data, providesTags: [policies],
    }),
    setAdminPolicy: build.mutation<Policy, { key: PolicyKey; body: PolicyInput }>({
      query: ({ key, body }) => ({ url: `/admin/policies/${key}`, method: 'PUT', body }),
      transformResponse: (r: Envelope<Policy>) => r.data, invalidatesTags: (_r, e) => e ? [] : [policies],
    }),
  }), overrideExisting: false,
});
export const {
  useGetAdminDashboardQuery, useGetAdminPromotionsQuery, useLazyGetAdminPromotionQuery,
  useCreateAdminPromotionMutation, useUpdateAdminPromotionMutation,
  useGenerateAdminBatchMutation, useGetAdminBatchQuery, useLazyGetAdminBatchQuery,
  useGetAdminUsersQuery, useAssignAdminAccessMutation, useGetAdminCategoriesQuery,
  useCreateAdminCategoryMutation, useUpdateAdminCategoryMutation, useDeactivateAdminCategoryMutation,
  useGetAdminCommissionQuery, useSetAdminCommissionMutation, useGetAdminPoliciesQuery, useSetAdminPolicyMutation,
} = adminApi;
