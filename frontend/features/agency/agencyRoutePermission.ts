/** UI gates mirror server permission names, never infer grants from global roles. */
export function agencyRoutePermission(pathname: string): string | null {
  if (pathname === '/agency') return 'agency:dashboard';
  const routes: [string, string][] = [
    ['/agency/tours', 'tour:update-own'], ['/agency/calendar', 'tour:update-own'],
    ['/agency/bookings', 'agency:bookings-view'], ['/agency/promotions', 'promotion:agency-manage'],
    ['/agency/complaints', 'complaint:respond'], ['/agency/premium', 'premium:contribute'],
    ['/agency/finance', 'agency:finance-view'], ['/agency/settings/team', 'agency:team-view'],
  ];
  return routes.find(([route]) => pathname === route || pathname.startsWith(route + '/'))?.[1] ?? null;
}

/** Landing page for members who cannot view the dashboard. */
export function agencyLandingRoute(permissions: string[]): string | null {
  const destinations: [string, string][] = [
    ['agency:dashboard', '/agency'],
    ['agency:bookings-view', '/agency/bookings'],
    ['custom-tour:view', '/agency/custom-tours'],
    ['tour:update-own', '/agency/tours'],
    ['complaint:respond', '/agency/complaints'],
    ['promotion:agency-manage', '/agency/promotions'],
    ['agency:team-view', '/agency/settings/team'],
  ];
  return destinations.find(([permission]) => permissions.includes(permission))?.[1] ?? null;
}
