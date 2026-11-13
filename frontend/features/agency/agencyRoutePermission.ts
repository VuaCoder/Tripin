/** UI gates mirror server permission names, never infer grants from global roles. */
export function agencyRoutePermission(pathname: string): string | null {
  if (pathname === '/agency') return 'agency:dashboard';
  if (pathname === '/agency/tours/new') return 'tour:create';
  if (pathname === '/agency/tours/import') return 'tour:import';
  if (/^\/agency\/tours\/[^/]+\/edit(?:\/|$)/.test(pathname)) return 'tour:update-own';
  const routes: [string, string][] = [
    ['/agency/work/tours', 'agency:tour-view'], ['/agency/work/bookings', 'agency:booking-monitor'],
    ['/agency/tours', 'agency:tour-view'], ['/agency/calendar', 'tour:update-own'],
    ['/agency/bookings', 'agency:bookings-view'], ['/agency/promotions', 'promotion:agency-manage'],
    ['/agency/complaints', 'complaint:respond'], ['/agency/premium', 'premium:contribute'],
    ['/agency/finance', 'agency:finance-view'],
    ['/agency/team', 'agency:team-view'],
    ['/agency/settings/team', 'agency:team-view'],
  ];
  return routes.find(([route]) => pathname === route || pathname.startsWith(route + '/'))?.[1] ?? null;
}
