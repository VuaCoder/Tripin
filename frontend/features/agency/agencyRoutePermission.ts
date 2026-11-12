/** UI gates mirror server permission names, never infer grants from global roles. */
export function agencyRoutePermission(pathname: string): string | null {
  if (pathname === '/agency') return 'agency:dashboard';
  const routes: [string, string][] = [
    ['/agency/tours', 'tour:update-own'], ['/agency/calendar', 'tour:update-own'],
    ['/agency/bookings', 'agency:bookings-view'], ['/agency/promotions', 'promotion:agency-manage'],
    ['/agency/complaints', 'complaint:respond'], ['/agency/premium', 'premium:contribute'],
    ['/agency/finance', 'agency:finance-view'],
  ];
  return routes.find(([route]) => pathname === route || pathname.startsWith(route + '/'))?.[1] ?? null;
}
