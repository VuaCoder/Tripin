import type { AgencyMembership } from '@/features/auth/types';

/** Start at a capability the selected membership actually holds. */
export function workplaceHome(agency: AgencyMembership) {
  if (agency.verificationStatus !== 'VERIFIED') return agency.memberRole === 'OWNER' ? '/agency/application/workplace' : '/agency';
  const routes = [
    ['agency:dashboard', '/agency'],
    ['tour:update-own', '/agency/tours'],
    ['agency:tour-view', '/agency/work/tours'],
    ['agency:bookings-view', '/agency/bookings'],
    ['agency:booking-monitor', '/agency/work/bookings'],
    ['agency:team-view', '/agency/team'],
  ];
  return routes.find(([permission]) => agency.permissions.includes(permission))?.[1] ?? '/agency/notifications';
}
