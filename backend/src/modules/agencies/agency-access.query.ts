import type { Prisma } from '../../config/database';
import { OWNER_CONTROL_PERMISSIONS, type AgencyPermission } from './agency.policy';

/** SQL counterpart of effectiveAgencyPermissions; used for atomic inbox visibility checks. */
export function memberHasAgencyPermission(permission: AgencyPermission): Prisma.AgencyMemberWhereInput {
  return { OR: [
    ...(OWNER_CONTROL_PERMISSIONS.includes(permission) ? [{ role: 'OWNER' as const }] : []),
    { AND: [
      { permissionOverrides: { none: { permission, effect: 'DENY' } } },
      { OR: [{ assignedRole: { permissions: { has: permission } } },
        { permissionOverrides: { some: { permission, effect: 'ALLOW' } } }] },
    ] },
  ] };
}
