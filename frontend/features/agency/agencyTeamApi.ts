'use client';

import { baseApi } from '@/store/api/baseApi';

export type AgencyMemberRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'ACCOUNTANT';
export type AgencyMemberStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export interface AgencyMember {
  id: string;
  userId: string;
  role: AgencyMemberRole;
  status: AgencyMemberStatus;
  joinedAt?: string;
  createdAt?: string;
  /** Present only when the backend enriches the member row with its user profile. */
  user?: { fullName?: string; email?: string; avatarUrl?: string | null };
}

export interface AgencyInvitationInput {
  email: string;
  role: Exclude<AgencyMemberRole, 'OWNER'>;
}

export interface AgencyMemberUpdate {
  role?: AgencyMemberRole;
  status?: AgencyMemberStatus;
}

export const agencyTeamApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    agencyMembers: build.query<AgencyMember[], void>({
      query: () => '/agency/members',
      transformResponse: (response: { data: AgencyMember[] }) => response.data,
      providesTags: ['AgencyMember'],
    }),
    inviteAgencyMember: build.mutation<unknown, AgencyInvitationInput>({
      query: (body) => ({ url: '/agency/invitations', method: 'POST', body }),
      invalidatesTags: ['AgencyMember'],
    }),
    updateAgencyMember: build.mutation<unknown, { id: string } & AgencyMemberUpdate>({
      query: ({ id, ...body }) => ({ url: `/agency/members/${encodeURIComponent(id)}`, method: 'PATCH', body }),
      invalidatesTags: ['AgencyMember'],
    }),
    revokeAgencyInvitation: build.mutation<unknown, string>({
      query: (invitationId) => ({ url: `/agency/invitations/${encodeURIComponent(invitationId)}/revoke`, method: 'POST' }),
      invalidatesTags: ['AgencyMember'],
    }),
  }),
});

export const {
  useAgencyMembersQuery,
  useInviteAgencyMemberMutation,
  useUpdateAgencyMemberMutation,
  useRevokeAgencyInvitationMutation,
} = agencyTeamApi;
