'use client';
import { baseApi } from '@/store/api/baseApi';

export type TeamRole = { id: string; name: string; systemRole: 'OWNER' | 'MANAGER' | 'STAFF' | 'ACCOUNTANT' | null; permissions: string[] };
export type PermissionOverride = { permission: string; effect: 'ALLOW' | 'DENY' };
export type TeamMember = { id: string; userId: string; isPrimaryOwner?: boolean; role: string; roleId: string; roleName: string; status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  createdAt?: string; updatedAt?: string;
  user: { fullName: string; email: string; phone?: string | null; avatarUrl?: string | null; emailVerifiedAt?: string | null }; permissions: string[]; overrides: PermissionOverride[]; tourScopes: TourScope[] };
export type TourScope = { tourId: string; allowedFields: string[] };
export type WorkTour = { id: string; title: string; summary: string | null; description: string | null; status: string; memberScopes: { allowedFields: string[] }[] };
export type WorkBooking = { id: string; bookingCode: string; tourTitle: string; departureDate: string; status: string; participants: number; contactName: string; contactPhone: string };
export type TeamInvitation = { id: string; email: string; role: string; roleId: string; status: string; expiresAt: string };
const unwrap = <T,>(response: { data: T }) => response.data;

export const agencyTeamApi = baseApi.injectEndpoints({ endpoints: build => ({
  teamMembers: build.query<TeamMember[], string>({ query: () => '/agency/members', transformResponse: unwrap<TeamMember[]> }),
  teamRoles: build.query<TeamRole[], string>({ query: () => '/agency/roles', transformResponse: unwrap<TeamRole[]> }),
  teamPermissions: build.query<string[], string>({ query: () => '/agency/permissions', transformResponse: unwrap<string[]> }),
  teamWorkTours: build.query<WorkTour[], string>({ query: () => '/agency/work/tours', transformResponse: unwrap<WorkTour[]> }),
  teamWorkBookings: build.query<WorkBooking[], { agencyId: string; page: number }>({ query: ({ page }) => `/agency/work/bookings?page=${page}`, transformResponse: unwrap<WorkBooking[]> }),
  saveMemberTourScopes: build.mutation<unknown, { id: string; scopes: TourScope[] }>({ query: ({ id, ...body }) => ({ url: `/agency/members/${id}/tour-scopes`, method: 'PUT', body }) }),
  saveScopedTourContent: build.mutation<unknown, { id: string; patch: Record<string, string> }>({ query: ({ id, patch }) => ({ url: `/agency/work/tours/${id}/content`, method: 'PATCH', body: patch }) }),
  teamInvitations: build.query<TeamInvitation[], string>({ query: () => '/agency/invitations', transformResponse: unwrap<TeamInvitation[]> }),
  saveTeamRole: build.mutation<TeamRole, { id?: string; name: string; permissions: string[] }>({
    query: ({ id, ...body }) => ({ url: '/agency/roles' + (id ? '/' + id : ''), method: id ? 'PATCH' : 'POST', body }), transformResponse: unwrap<TeamRole>,
  }),
  saveMemberAccess: build.mutation<unknown, { id: string; roleId: string; overrides: PermissionOverride[] }>({
    query: ({ id, ...body }) => ({ url: `/agency/members/${id}/access`, method: 'PUT', body }),
  }),
  changeTeamMember: build.mutation<unknown, { id: string; status?: TeamMember['status']; role?: 'OWNER' | 'MANAGER' | 'STAFF' | 'ACCOUNTANT' }>({
    query: ({ id, ...body }) => ({ url: `/agency/members/${id}`, method: 'PATCH', body }),
  }),
  inviteTeamMember: build.mutation<unknown, { email: string; roleId: string; role: 'MANAGER' | 'STAFF' | 'ACCOUNTANT' }>({
    query: body => ({ url: '/agency/invitations', method: 'POST', body }),
  }),
  revokeTeamInvitation: build.mutation<unknown, string>({ query: id => ({ url: `/agency/invitations/${id}/revoke`, method: 'POST' }) }),
  acceptTeamInvitation: build.mutation<unknown, string>({ query: token => ({ url: '/agency-invitations/accept', method: 'POST', body: { token } }) }),
}) });
export const { useTeamMembersQuery, useTeamRolesQuery, useTeamPermissionsQuery, useTeamInvitationsQuery, useSaveTeamRoleMutation,
  useSaveMemberAccessMutation, useChangeTeamMemberMutation, useInviteTeamMemberMutation, useRevokeTeamInvitationMutation, useAcceptTeamInvitationMutation,
  useTeamWorkToursQuery, useTeamWorkBookingsQuery, useSaveMemberTourScopesMutation, useSaveScopedTourContentMutation } = agencyTeamApi;
