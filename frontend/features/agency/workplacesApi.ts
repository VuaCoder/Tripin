'use client';
import { baseApi } from '@/store/api/baseApi';
export type WorkplaceApplication = { id: string; companyName: string | null; address: string | null; licenseNumber: string | null;
  taxId: string | null; businessLicenseUrl: string | null; description: string | null; website: string | null;
  verificationStatus: string; verificationNote: string | null };
export type ApplicationDraft = { companyName: string; address?: string; licenseNumber?: string; taxId?: string; businessLicenseUrl?: string; description?: string; website?: string };
export type JoinRequest = { id: string; agencyId: string; status: string; createdAt: string; agency: { companyName: string | null }; user?: { fullName: string; email: string } };
export type JoinCode = { id: string; expiresAt: string; code?: string };
export type PersonalInvitation = { id: string; agency: { id: string; companyName: string | null }; roleName: string; createdAt: string; expiresAt: string };
export type PersonalInvitations = { items: PersonalInvitation[]; page: number; pageSize: number; total: number };
const data = <T,>(response: { data: T }) => response.data;
export const workplacesApi = baseApi.injectEndpoints({ endpoints: b => ({
  createWorkplace: b.mutation<WorkplaceApplication, ApplicationDraft & { requestId: string }>({ query: body => ({ url: '/agencies', method: 'POST', body }), transformResponse: data<WorkplaceApplication> }),
  workplaceApplication: b.query<WorkplaceApplication, string>({ query: () => '/agency/application', transformResponse: data<WorkplaceApplication>, providesTags: (_result, _error, agencyId) => [{ type: 'AgencyApplication', id: agencyId }] }),
  saveWorkplaceApplication: b.mutation<WorkplaceApplication, { draft: ApplicationDraft; submit: boolean }>({ query: ({ draft, submit }) => ({ url: '/agency/application' + (submit ? '/submit' : ''), method: submit ? 'POST' : 'PUT', body: draft }), transformResponse: data<WorkplaceApplication>, invalidatesTags: result => result ? [{ type: 'AgencyApplication', id: result.id }] : [] }),
  myJoinRequests: b.query<JoinRequest[], number>({ query: page => `/users/me/agency-join-requests?page=${page}`, transformResponse: data<JoinRequest[]> }),
  myAgencyInvitations: b.query<PersonalInvitations, number>({ query: page => `/users/me/agency-invitations?page=${page}`, transformResponse: data<PersonalInvitations> }),
  acceptPersonalInvitation: b.mutation<{ invitationId: string; agencyId: string; memberId: string }, string>({ query: id => ({ url: `/agency-invitations/${id}/accept`, method: 'POST', body: {} }), transformResponse: data<{ invitationId: string; agencyId: string; memberId: string }> }),
  joinWorkplace: b.mutation<JoinRequest, string>({ query: code => ({ url: '/agency-join-requests', method: 'POST', body: { code } }), transformResponse: data<JoinRequest> }),
  cancelJoinRequest: b.mutation<unknown, string>({ query: id => ({ url: `/agency-join-requests/${id}/cancel`, method: 'POST', body: {} }) }),
  currentJoinCode: b.query<JoinCode | null, string>({ query: () => '/agency/join-codes/current', transformResponse: data<JoinCode | null> }),
  rotateJoinCode: b.mutation<JoinCode, void>({ query: () => ({ url: '/agency/join-codes', method: 'POST', body: {} }), transformResponse: data<JoinCode> }),
  revokeJoinCode: b.mutation<unknown, string>({ query: id => ({ url: `/agency/join-codes/${id}/revoke`, method: 'POST', body: {} }) }),
  teamJoinRequests: b.query<JoinRequest[], { agencyId: string; page: number }>({ query: ({ page }) => `/agency/join-requests?page=${page}`, transformResponse: data<JoinRequest[]> }),
  reviewJoinRequest: b.mutation<unknown, { id: string; roleId?: string }>({ query: ({ id, roleId }) => ({ url: `/agency/join-requests/${id}/${roleId ? 'approve' : 'reject'}`, method: 'POST', body: roleId ? { roleId } : {} }) }),
}) });
export const { useCreateWorkplaceMutation, useWorkplaceApplicationQuery, useSaveWorkplaceApplicationMutation, useMyJoinRequestsQuery,
  useMyAgencyInvitationsQuery, useAcceptPersonalInvitationMutation,
  useJoinWorkplaceMutation, useCancelJoinRequestMutation, useCurrentJoinCodeQuery, useRotateJoinCodeMutation,
  useRevokeJoinCodeMutation, useTeamJoinRequestsQuery, useReviewJoinRequestMutation } = workplacesApi;
export function workplaceError(error: unknown) {
  return (error as { data?: { error?: { message?: string } } })?.data?.error?.message ?? 'Không thể thực hiện. Hãy kiểm tra kết nối và thử lại.';
}
