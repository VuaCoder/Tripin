import { PERMISSIONS as P, type Permission } from '@travel-platform/constants';
import type { AgencyMemberRole } from '../../generated/prisma/client';

export const AGENCY_PERMISSIONS = {
  CONTEXT_VIEW: 'agency:context-view',
  TEAM_VIEW: 'agency:team-view',
  TEAM_INVITE: 'agency:team-invite',
  TEAM_MANAGE: 'agency:team-manage',
  FINANCE_VIEW: 'agency:finance-view',
  FINANCE_MANAGE: 'agency:finance-manage',
} as const;
export type AgencyPermission = Permission | (typeof AGENCY_PERMISSIONS)[keyof typeof AGENCY_PERMISSIONS];
const tour: Permission[] = [P.TOUR_CREATE, P.TOUR_UPDATE_OWN, P.TOUR_DELETE_OWN, P.TOUR_IMPORT,
  P.TOUR_SET_AVAILABILITY, P.TOUR_CONFIGURE_ITINERARY, P.TOUR_ASSIGN_GUIDE];
const operations: Permission[] = [P.AGENCY_BOOKINGS_VIEW, P.AGENCY_EXPORT_CUSTOMERS, P.COMPLAINT_RESPOND, P.REVIEW_DISPUTE];
const customTours: Permission[] = [P.CUSTOM_TOUR_VIEW, P.CUSTOM_TOUR_RESPOND];
const manager: AgencyPermission[] = [...tour, ...operations, ...customTours, P.PROMOTION_AGENCY_MANAGE,
  P.PREMIUM_CONTRIBUTE, P.AGENCY_DASHBOARD_VIEW, AGENCY_PERMISSIONS.FINANCE_VIEW,
  AGENCY_PERMISSIONS.TEAM_VIEW, AGENCY_PERMISSIONS.TEAM_INVITE];
export const AGENCY_ROLE_PERMISSIONS: Record<AgencyMemberRole, readonly AgencyPermission[]> = {
  OWNER: [AGENCY_PERMISSIONS.CONTEXT_VIEW, ...manager, AGENCY_PERMISSIONS.TEAM_MANAGE, AGENCY_PERMISSIONS.FINANCE_MANAGE],
  MANAGER: [AGENCY_PERMISSIONS.CONTEXT_VIEW, ...manager],
  STAFF: [AGENCY_PERMISSIONS.CONTEXT_VIEW, P.TOUR_UPDATE_OWN, P.TOUR_CONFIGURE_ITINERARY, ...operations, ...customTours],
  ACCOUNTANT: [AGENCY_PERMISSIONS.CONTEXT_VIEW, P.AGENCY_BOOKINGS_VIEW, P.AGENCY_DASHBOARD_VIEW, AGENCY_PERMISSIONS.FINANCE_VIEW],
};

export interface AgencyContext {
  agencyId: string;
  actorUserId: string;
  memberId: string;
  memberRole: AgencyMemberRole;
  permissions: readonly AgencyPermission[];
}
