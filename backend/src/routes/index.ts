import { mount } from './registry';
import { auditRouter } from '../modules/audit';
import { authRouter } from '../modules/auth';
import { adminCategoriesRouter, publicCategoriesRouter } from '../modules/categories';
import { agencyToursRouter, guideToursRouter, publicToursRouter } from '../modules/tours';
import { adminPromotionsRouter, agencyPromotionsRouter, promotionsRouter } from '../modules/promotions';
import { wishlistsRouter } from '../modules/wishlists';
import { cartsRouter } from '../modules/carts';
import { notificationsRouter } from '../modules/notifications';
import { agencyBookingsRouter, agencyCustomersExportRouter, bookingsRouter } from '../modules/bookings';
import { paymentsRouter } from '../modules/payments';
import { eTicketsRouter } from '../modules/e-tickets';
import { reviewsRouter } from '../modules/reviews';
import { subscriptionsRouter } from '../modules/subscriptions';
import { earningsRouter } from '../modules/earnings';
import { chatRouter } from '../modules/chat';
import { aiRouter } from '../modules/ai';
import { agencyComplaintsRouter, reportsRouter } from '../modules/reports';
import { supportRouter } from '../modules/support';
import { moderationRouter } from '../modules/moderation';
import { adminDashboardRouter, agencyDashboardRouter, moderationDashboardRouter } from '../modules/dashboards';
import { adminPoliciesRouter, adminSettingsRouter, publicPoliciesRouter } from '../modules/system-settings';
import { adminUsersRouter, publicAgenciesRouter, publicGuidesRouter, usersRouter } from '../modules/users';

/**
 * Central route registry mounted at /api/v1.
 * To expose a new module: export its router from `modules/<name>/index.ts` and add ONE `mount(...)` line here
 * (`mount` also records the prefix, which feeds docs/api/ENDPOINTS.md and the route audit tests).
 */
export { apiRouter } from './registry';
import { apiRouter } from './registry';

apiRouter.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptimeSeconds: Math.round(process.uptime()) } });
});

mount('/auth', authRouter);
mount('/users', usersRouter);
mount('/tour-guides', publicGuidesRouter);
mount('/agencies', publicAgenciesRouter);
mount('/admin/users', adminUsersRouter);
mount('/admin/audit-logs', auditRouter);
mount('/categories', publicCategoriesRouter);
mount('/admin/categories', adminCategoriesRouter);
mount('/policies', publicPoliciesRouter);
mount('/admin/settings', adminSettingsRouter);
mount('/admin/policies', adminPoliciesRouter);
mount('/tours', publicToursRouter);
mount('/agency/tours', agencyToursRouter);
mount('/guide/tours', guideToursRouter);
mount('/agency/promotions', agencyPromotionsRouter);
mount('/admin/promotions', adminPromotionsRouter);
mount('/promotions', promotionsRouter);
mount('/wishlist', wishlistsRouter);
mount('/cart', cartsRouter);
mount('/notifications', notificationsRouter);
mount('/bookings', bookingsRouter);
mount('/agency/bookings', agencyBookingsRouter);
mount('/payments', paymentsRouter);
mount('/e-tickets', eTicketsRouter);
mount('/reviews', reviewsRouter);
mount('/subscriptions', subscriptionsRouter);
mount('/earnings', earningsRouter);
mount('/chat', chatRouter);
mount('/ai', aiRouter);
mount('/reports', reportsRouter);
mount('/agency/complaints', agencyComplaintsRouter);
mount('/support/tickets', supportRouter);
mount('/moderation', moderationRouter);
mount('/agency/dashboard', agencyDashboardRouter);
mount('/moderation/dashboard', moderationDashboardRouter);
mount('/admin/dashboard', adminDashboardRouter);
mount('/agency/tours', agencyCustomersExportRouter);
