import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, type Permission } from '@travel-platform/constants';
import { listRoutes, type RouteInfo } from '../introspect';

/**
 * Security regression net for the whole HTTP surface (read from the live routers):
 * adding a route that is public, login-only or unvalidated must be a conscious edit of the lists below.
 */
const routes = listRoutes();
const label = (route: RouteInfo) => `${route.method} ${route.path.replace('/api/v1', '')}`;
const labels = (items: RouteInfo[]) => items.map(label).sort();

/** Endpoints anybody (GUEST) may call. Mutations here are credential flows or the signed payment webhook. */
const PUBLIC_ROUTES = [
  'GET /agencies/:id',
  'GET /categories',
  'GET /health',
  'GET /policies',
  'GET /policies/:key',
  'GET /reviews',
  'GET /subscriptions/plans',
  'GET /tour-guides/:id',
  'GET /tours',
  'GET /tours/:id',
  'POST /auth/forgot-password',
  'POST /auth/google',
  'POST /auth/login',
  'POST /auth/logout',
  'POST /auth/refresh',
  'POST /auth/register',
  'POST /auth/reset-password',
  'POST /auth/verify-otp',
  'POST /payments/webhooks/payos',
].sort();

/** Logged-in-only routes WITHOUT a permission: each one is scoped to the caller's own data by the token. */
const LOGIN_ONLY_ROUTES = [
  'GET /notifications',
  'GET /notifications/unread-count',
  'GET /payments/:id',
  'PATCH /auth/two-factor',
  'PATCH /notifications/:id/read',
  'POST /notifications/read-all',
].sort();

/** Mutating routes that carry no JSON body by design (pure actions on the caller's own resource / signed callbacks). */
const BODYLESS_MUTATIONS = [
  'PATCH /notifications/:id/read',
  'POST /agency/tours/:id/submit',
  'POST /auth/logout',
  'POST /auth/refresh',
  'POST /chat/conversations/:id/read',
  'POST /moderation/users/:id/unban',
  'POST /notifications/read-all',
  'POST /payments/bookings/:bookingId/checkout',
  'POST /payments/webhooks/payos',
  'POST /support/tickets/:id/close',
  'POST /users/me/agency-verification',
  'POST /wishlist/:tourId',
].sort();

describe('route audit: who can call what', () => {
  it('has exactly the intended public endpoints', () => {
    expect(labels(routes.filter((r) => r.access === 'public'))).toEqual(PUBLIC_ROUTES);
  });

  it('has exactly the intended login-only endpoints', () => {
    expect(labels(routes.filter((r) => r.access === 'login'))).toEqual(LOGIN_ONLY_ROUTES);
  });

  it('never exposes an admin / staff / agency / guide area without a permission', () => {
    const staffAreas = ['/admin/', '/moderation/', '/agency/', '/guide/', '/earnings'];
    const unguarded = routes.filter((r) => staffAreas.some((area) => r.path.includes(area)) && !Array.isArray(r.access));
    expect(labels(unguarded)).toEqual([]);
  });

  it('only public mutations are credential flows or the signed webhook', () => {
    const publicMutations = routes.filter((r) => r.access === 'public' && r.method !== 'GET');
    expect(labels(publicMutations).every((l) => l.includes('/auth/') || l.includes('/payments/webhooks/'))).toBe(true);
  });

  it('every permission a route demands can be held by at least one role (no unreachable endpoint)', () => {
    const grantable = (needed: Permission[]) =>
      Object.values(ROLES).some((role) => needed.every((p) => ROLE_PERMISSIONS[role].includes(p)));
    const unreachable = routes.filter((r) => Array.isArray(r.access) && !grantable(r.access));
    expect(labels(unreachable)).toEqual([]);
  });

  it('every defined permission protects at least one route (no dead permission)', () => {
    const used = new Set(routes.flatMap((r) => (Array.isArray(r.access) ? r.access : [])));
    const unused = Object.values(PERMISSIONS).filter((p) => !used.has(p));
    expect(unused).toEqual([]);
  });
});

describe('route audit: input validation', () => {
  it('validates every path parameter (ids are checked as ObjectIds before any query)', () => {
    expect(labels(routes.filter((r) => r.path.includes('/:') && !r.validates.params))).toEqual([]);
  });

  it('validates the body of every mutating route except the documented bodyless actions', () => {
    const missing = routes.filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method) && !r.validates.body);
    expect(labels(missing)).toEqual(BODYLESS_MUTATIONS);
  });

  it('validates the query string of every collection endpoint (pagination limits are bounded)', () => {
    const lists = routes.filter(
      (r) =>
        r.method === 'GET' &&
        ['/tours', '/reviews', '/bookings/me', '/notifications', '/wishlist', '/earnings/me', '/admin/users', '/admin/audit-logs'].some(
          (suffix) => r.path.endsWith(suffix),
        ),
    );
    expect(lists.length).toBeGreaterThan(5);
    expect(labels(lists.filter((r) => !r.validates.query))).toEqual([]);
  });
});
