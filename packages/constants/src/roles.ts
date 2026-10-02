/**
 * Access actors of the platform.
 * GUEST is NOT persisted: it is the actor assigned when there is no valid session.
 */
export const ROLES = {
  GUEST: 'GUEST',
  TRAVELER: 'TRAVELER',
  AGENCY: 'AGENCY',
  TOUR_GUIDE: 'TOUR_GUIDE',
  MODERATOR: 'MODERATOR',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles that exist in the database (everything except GUEST). */
export const PERSISTED_ROLES = [
  ROLES.TRAVELER,
  ROLES.AGENCY,
  ROLES.TOUR_GUIDE,
  ROLES.MODERATOR,
  ROLES.SUPER_ADMIN,
] as const;
export type PersistedRole = (typeof PERSISTED_ROLES)[number];

/** Roles a person may pick when registering themselves. Staff roles are assigned by SUPER_ADMIN. */
export const SELF_REGISTRATION_ROLES = [ROLES.TRAVELER, ROLES.AGENCY, ROLES.TOUR_GUIDE] as const;
export type SelfRegistrationRole = (typeof SELF_REGISTRATION_ROLES)[number];

export const STAFF_ROLES = [ROLES.MODERATOR, ROLES.SUPER_ADMIN] as const;
