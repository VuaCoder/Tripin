import { PERMISSIONS as P, type Permission } from '@travel-platform/constants';
import type { AgencyMemberRole } from '../../generated/prisma/client';

export const AGENCY_PERMISSIONS = {
  CONTEXT_VIEW: 'agency:context-view',
  TEAM_VIEW: 'agency:team-view',
  TEAM_INVITE: 'agency:team-invite',
  TEAM_MANAGE: 'agency:team-manage',
  PERMISSIONS_MANAGE: 'agency:permissions-manage',
  TOUR_VIEW: 'agency:tour-view',
  TOUR_CONTENT_UPDATE: 'agency:tour-content-update',
  BOOKING_MONITOR: 'agency:booking-monitor',
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
  OWNER: [AGENCY_PERMISSIONS.CONTEXT_VIEW, AGENCY_PERMISSIONS.TOUR_VIEW, AGENCY_PERMISSIONS.TOUR_CONTENT_UPDATE, AGENCY_PERMISSIONS.BOOKING_MONITOR, ...manager, AGENCY_PERMISSIONS.TEAM_MANAGE, AGENCY_PERMISSIONS.PERMISSIONS_MANAGE, AGENCY_PERMISSIONS.FINANCE_MANAGE],
  MANAGER: [AGENCY_PERMISSIONS.CONTEXT_VIEW, AGENCY_PERMISSIONS.TOUR_VIEW, AGENCY_PERMISSIONS.TOUR_CONTENT_UPDATE, AGENCY_PERMISSIONS.BOOKING_MONITOR,
    ...tour.filter(p => p !== P.TOUR_DELETE_OWN && p !== P.TOUR_IMPORT), ...operations, ...customTours,
    P.PROMOTION_AGENCY_MANAGE, P.AGENCY_DASHBOARD_VIEW],
  // Content editing / customer monitoring require a scoped API, not the broad update/read grants.
  STAFF: [AGENCY_PERMISSIONS.CONTEXT_VIEW, AGENCY_PERMISSIONS.TOUR_VIEW, AGENCY_PERMISSIONS.TOUR_CONTENT_UPDATE, AGENCY_PERMISSIONS.BOOKING_MONITOR, ...customTours],
  ACCOUNTANT: [AGENCY_PERMISSIONS.CONTEXT_VIEW, P.AGENCY_BOOKINGS_VIEW, P.AGENCY_DASHBOARD_VIEW, AGENCY_PERMISSIONS.FINANCE_VIEW],
};

export const OWNER_CONTROL_PERMISSIONS: readonly AgencyPermission[] = [AGENCY_PERMISSIONS.CONTEXT_VIEW,
  AGENCY_PERMISSIONS.TEAM_VIEW, AGENCY_PERMISSIONS.TEAM_INVITE, AGENCY_PERMISSIONS.TEAM_MANAGE,
  AGENCY_PERMISSIONS.PERMISSIONS_MANAGE];

/** Only organization capabilities; never accept platform/traveler privileges here. */
export const AGENCY_PERMISSION_CATALOG: readonly AgencyPermission[] = Array.from(new Set(Object.values(AGENCY_ROLE_PERMISSIONS).flat()))
  .filter(p => p !== AGENCY_PERMISSIONS.FINANCE_MANAGE);

export interface PermissionSource {
  role: AgencyMemberRole;
  assignedRole?: { permissions: readonly string[] } | null;
  permissionOverrides?: readonly { permission: string; effect: string }[];
}

export function effectiveAgencyPermissions(member: PermissionSource): AgencyPermission[] {
  const overrides = member.permissionOverrides ?? [];
  const denied = new Set(overrides.filter(o => o.effect === 'DENY').map(o => o.permission));
  const granted = new Set<string>([...(member.assignedRole?.permissions ?? AGENCY_ROLE_PERMISSIONS[member.role]),
    ...overrides.filter(o => o.effect === 'ALLOW').map(o => o.permission)]);
  for (const permission of denied) granted.delete(permission);
  // Ownership recovery is an invariant, not a blanket business-permission bypass.
  if (member.role === 'OWNER') for (const permission of OWNER_CONTROL_PERMISSIONS) granted.add(permission);
  granted.add(AGENCY_PERMISSIONS.CONTEXT_VIEW);
  const known = new Set<string>([...AGENCY_PERMISSION_CATALOG, AGENCY_PERMISSIONS.FINANCE_MANAGE]);
  return [...granted].filter(p => known.has(p)).sort() as AgencyPermission[];
}

export const agencyAccessInclude = { assignedRole: true, permissionOverrides: true } as const;

export interface AgencyContext {
  agencyId: string;
  actorUserId: string;
  memberId: string;
  memberRole: AgencyMemberRole;
  isPrimaryOwner?: boolean;
  permissions: readonly AgencyPermission[];
  roleId?: string | null;
  roleName?: string;
  permissionVersion?: number;
}
