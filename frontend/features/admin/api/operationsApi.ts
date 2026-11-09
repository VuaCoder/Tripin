import { baseApi } from '@/store/api/baseApi';
import type { AdminUser, Envelope, Policy, PolicyKey } from '../types';

export interface PolicyVersion { id: string; key: string; versionNumber: number; effectiveFrom: string; reason: string; value: { title: string; content: string; params: Record<string, number | string | boolean> }; createdAt: string }
export const operationsApi = baseApi.injectEndpoints({ endpoints: (build) => ({
  inviteStaff: build.mutation<AdminUser, { email: string; fullName: string }>({ query: (body) => ({ url: '/admin/staff/invite', method: 'POST', body }), transformResponse: (r: Envelope<AdminUser>) => r.data, invalidatesTags: ['User'] }),
  reinviteStaff: build.mutation<unknown, string>({ query: (id) => ({ url: `/admin/staff/${id}/reinvite`, method: 'POST', body: {} }) }),
  disableStaff: build.mutation<AdminUser, { id: string; reason: string }>({ query: ({ id, ...body }) => ({ url: `/admin/staff/${id}/disable`, method: 'POST', body }), transformResponse: (r: Envelope<AdminUser>) => r.data, invalidatesTags: ['User'] }),
  unbanUser: build.mutation<AdminUser, { id: string; reason: string }>({ query: ({ id, ...body }) => ({ url: `/moderation/users/${id}/unban`, method: 'POST', body }), transformResponse: (r: Envelope<AdminUser>) => r.data, invalidatesTags: ['User', 'Moderation'] }),
  activateStaff: build.mutation<{ activated: boolean }, { token: string; password: string }>({ query: (body) => ({ url: '/auth/staff/activate', method: 'POST', body }) }),
  policyHistory: build.query<PolicyVersion[], PolicyKey>({ query: (key) => `/admin/policies/${key}/history`, transformResponse: (r: Envelope<PolicyVersion[]>) => r.data, providesTags: ['Policy'] }),
  rollbackPolicy: build.mutation<Policy, { key: PolicyKey; versionId: string; expectedVersion: number; reason: string }>({ query: ({ key, ...body }) => ({ url: `/admin/policies/${key}/rollback`, method: 'POST', body }), transformResponse: (r: Envelope<Policy>) => r.data, invalidatesTags: ['Policy'] }),
  acceptPolicy: build.mutation<unknown, string>({ query: (policyVersionId) => ({ url: '/policies/accept', method: 'POST', body: { policyVersionId } }) }),
}) });
export const { useInviteStaffMutation, useReinviteStaffMutation, useDisableStaffMutation, useUnbanUserMutation, useActivateStaffMutation, usePolicyHistoryQuery, useRollbackPolicyMutation, useAcceptPolicyMutation } = operationsApi;
