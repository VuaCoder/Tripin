import { ROLES, type Role } from './roles';

/**
 * Permission = one capability from the use-case diagram (docs/architecture/TripRi.json).
 * Public (GUEST) capabilities need no permission and are exposed without authentication.
 */
export const PERMISSIONS = {
  // Account
  PROFILE_VIEW_OWN: 'profile:view-own',
  PROFILE_UPDATE_OWN: 'profile:update-own',

  // Traveler
  WISHLIST_MANAGE: 'wishlist:manage',
  CART_MANAGE: 'cart:manage',
  BOOKING_CREATE: 'booking:create',
  BOOKING_VIEW_OWN: 'booking:view-own',
  PAYMENT_CREATE: 'payment:create',
  ETICKET_VIEW_OWN: 'eticket:view-own',
  REVIEW_CREATE: 'review:create',
  REPORT_CREATE: 'report:create',
  SUPPORT_TICKET_CREATE: 'support:create',
  CHAT_USE: 'chat:use',
  AI_CHAT_USE: 'ai:chat',

  // Agency
  TOUR_CREATE: 'tour:create',
  TOUR_UPDATE_OWN: 'tour:update-own',
  TOUR_DELETE_OWN: 'tour:delete-own',
  TOUR_IMPORT: 'tour:import',
  TOUR_SET_AVAILABILITY: 'tour:set-availability',
  TOUR_CONFIGURE_ITINERARY: 'tour:configure-itinerary',
  TOUR_ASSIGN_GUIDE: 'tour:assign-guide',
  PROMOTION_AGENCY_MANAGE: 'promotion:agency-manage',
  AGENCY_DASHBOARD_VIEW: 'agency:dashboard',
  AGENCY_BOOKINGS_VIEW: 'agency:bookings-view',
  AGENCY_EXPORT_CUSTOMERS: 'agency:export-customers',
  COMPLAINT_RESPOND: 'complaint:respond',

  // Tour guide
  GUIDE_TOURS_VIEW: 'guide:tours-view',
  GUIDE_TOURS_VERIFY: 'guide:tours-verify',
  SUBSCRIPTION_SUBSCRIBE: 'subscription:subscribe',
  EARNINGS_VIEW: 'earnings:view',

  // Moderator
  MODERATION_DASHBOARD_VIEW: 'moderation:dashboard',
  TOUR_LIST_ALL: 'tour:list-all',
  TOUR_VALIDATE: 'tour:validate',
  TOUR_SUSPEND: 'tour:suspend',
  AGENCY_VERIFY: 'agency:verify',
  REVIEW_MODERATE: 'review:moderate',
  ACCOUNT_BAN: 'account:ban',
  DISPUTE_RESOLVE: 'dispute:resolve',
  COMPLAINT_HANDLE: 'complaint:handle',

  // Super admin
  ADMIN_DASHBOARD_VIEW: 'admin:dashboard',
  COMMISSION_CONFIGURE: 'commission:configure',
  PROMOTION_PLATFORM_MANAGE: 'promotion:platform-manage',
  USER_ASSIGN_PERMISSIONS: 'user:assign-permissions',
  CATEGORY_CONFIGURE: 'category:configure',
  POLICY_CONFIGURE: 'policy:configure',
  AUDIT_LOG_VIEW: 'audit:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

const ACCOUNT: Permission[] = [P.PROFILE_VIEW_OWN, P.PROFILE_UPDATE_OWN];

/** Default permissions of every role. SUPER_ADMIN receives all permissions. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.GUEST]: [],
  [ROLES.TRAVELER]: [
    ...ACCOUNT,
    P.WISHLIST_MANAGE,
    P.CART_MANAGE,
    P.BOOKING_CREATE,
    P.BOOKING_VIEW_OWN,
    P.PAYMENT_CREATE,
    P.ETICKET_VIEW_OWN,
    P.REVIEW_CREATE,
    P.REPORT_CREATE,
    P.SUPPORT_TICKET_CREATE,
    P.CHAT_USE,
    P.AI_CHAT_USE,
  ],
  [ROLES.AGENCY]: [
    ...ACCOUNT,
    P.TOUR_CREATE,
    P.TOUR_UPDATE_OWN,
    P.TOUR_DELETE_OWN,
    P.TOUR_IMPORT,
    P.TOUR_SET_AVAILABILITY,
    P.TOUR_CONFIGURE_ITINERARY,
    P.TOUR_ASSIGN_GUIDE,
    P.PROMOTION_AGENCY_MANAGE,
    P.AGENCY_DASHBOARD_VIEW,
    P.AGENCY_BOOKINGS_VIEW,
    P.AGENCY_EXPORT_CUSTOMERS,
    P.COMPLAINT_RESPOND,
  ],
  [ROLES.TOUR_GUIDE]: [
    ...ACCOUNT,
    P.GUIDE_TOURS_VIEW,
    P.GUIDE_TOURS_VERIFY,
    P.SUBSCRIPTION_SUBSCRIBE,
    P.EARNINGS_VIEW,
    P.CHAT_USE,
  ],
  [ROLES.MODERATOR]: [
    ...ACCOUNT,
    P.MODERATION_DASHBOARD_VIEW,
    P.TOUR_LIST_ALL,
    P.TOUR_VALIDATE,
    P.TOUR_SUSPEND,
    P.AGENCY_VERIFY,
    P.REVIEW_MODERATE,
    P.ACCOUNT_BAN,
    P.DISPUTE_RESOLVE,
    P.COMPLAINT_HANDLE,
  ],
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
};

/** Effective permissions = role defaults + extra permissions granted by SUPER_ADMIN. */
export function resolvePermissions(role: Role, extra: readonly Permission[] = []): Permission[] {
  return Array.from(new Set<Permission>([...ROLE_PERMISSIONS[role], ...extra]));
}

export function isPermission(value: string): value is Permission {
  return (Object.values(PERMISSIONS) as string[]).includes(value);
}
