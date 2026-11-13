'use client';

import { baseApi } from '@/store/api/baseApi';

/**
 * Agency member invitation — acceptance flow that lives OUTSIDE the /agency
 * shell (the app/agency layout gate requires an ACTIVE agency member, which an
 * invitee is not yet). All endpoints are mounted under the backend
 * `agencyInvitationAcceptanceRouter` at `/agency-invitations`.
 *
 * Endpoint readiness (parallel backend task t_499ea7f7):
 *  - POST /agency-invitations/accept              -> present (agency.action accept)
 *  - GET  /agency-invitations/invitations/:token  -> being added by the backend
 *    task under the same router. The validate query below targets that contract;
 *    tests mock `fetch`, so the frontend is ready before the route lands.
 *
 * The GET validate endpoint is intentionally public (returns only invitation
 * metadata, no PII beyond the invitee email); the POST accept requires a
 * session so `baseApi` attaches the live access token.
 */

export type AgencyInvitationStatus = 'PENDING' | 'INVALID' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';
export type AgencyInvitationRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'ACCOUNTANT';

export interface AgencyInvitationInfo {
  status: AgencyInvitationStatus;
  email?: string;
  role?: AgencyInvitationRole;
  expiresAt?: string;
  agencyName?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export const agencyInvitationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    validateAgencyInvitation: build.query<AgencyInvitationInfo, string>({
      query: (token) => `/agency-invitations/invitations/${encodeURIComponent(token)}`,
      transformResponse: (response: ApiEnvelope<AgencyInvitationInfo>) => {
        if (!response?.success || !response.data) {
          return { status: 'INVALID' };
        }
        return response.data;
      },
    }),
    acceptAgencyInvitation: build.mutation<AgencyInvitationInfo, string>({
      query: (token) => ({ url: '/agency-invitations/accept', method: 'POST', body: { token } }),
      transformResponse: (response: ApiEnvelope<AgencyInvitationInfo>) => response.data,
    }),
  }),
});

export const {
  useValidateAgencyInvitationQuery,
  useAcceptAgencyInvitationMutation,
} = agencyInvitationApi;
