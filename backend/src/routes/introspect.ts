import type { Router } from 'express';
import type { PersistedRole } from '@travel-platform/constants';
import type { AgencyPermission } from '../modules/agencies/agency.policy';
import { GUARD_META, type GuardMeta } from '../middlewares/authorize';
import { VALIDATE_META, type ValidateMeta } from '../middlewares/validate';
import { apiRouter, mounts } from './registry';
import './index'; // make sure every module router is mounted before the table is read

export const API_PREFIX = '/api/v1';

export type Access = 'public' | 'login' | AgencyPermission[];

export interface RouteInfo {
  method: string;
  /** Full path, e.g. /api/v1/tours/:id */
  path: string;
  /** Mount prefix of the module router, e.g. /agency/tours ("" for routes defined directly on the API router). */
  mount: string;
  access: Access;
  roles: PersistedRole[];
  /** Which request parts the route validates with zod. */
  validates: ValidateMeta;
}

type Layer = {
  slash?: boolean;
  handle: ((...args: unknown[]) => unknown) & { stack?: Layer[] };
  route?: { path: string; methods: Record<string, boolean>; stack: Layer[] };
};

const metaOf = (handle: unknown): GuardMeta | undefined =>
  typeof handle === 'function' ? (handle as unknown as Record<symbol, GuardMeta | undefined>)[GUARD_META] : undefined;

const validateMetaOf = (handle: unknown): ValidateMeta | undefined =>
  typeof handle === 'function' ? (handle as unknown as Record<symbol, ValidateMeta | undefined>)[VALIDATE_META] : undefined;

function accessOf(guards: GuardMeta[]): Access {
  const permissions = guards.flatMap((guard) =>
    guard.kind === 'permission' || guard.kind === 'any_permission' ? guard.permissions : []
  );
  if (permissions.length > 0) return Array.from(new Set(permissions));
  return guards.some((guard) => guard.kind === 'auth' || guard.kind === 'role') ? 'login' : 'public';
}

function routesOf(router: Router, mountPrefix: string, inheritedGuards: GuardMeta[] = [], includeChildren = true): RouteInfo[] {
  const found: RouteInfo[] = [];
  const routerGuards: GuardMeta[] = [...inheritedGuards]; // router.use guards apply to routes declared after them
  for (const layer of (router as unknown as { stack: Layer[] }).stack) {
    if (!layer.route) {
      const meta = metaOf(layer.handle);
      if (meta) routerGuards.push(meta);
      // Express marks use(childRouter) mounted at '/' with slash=true.
      // Preserve parent guards, without mistaking guards inside a child for
      // middleware that applies to its parent's later sibling routes.
      if (includeChildren && layer.slash && layer.handle.stack) {
        found.push(...routesOf(layer.handle as unknown as Router, mountPrefix, routerGuards));
      }
      continue;
    }
    const routeGuards = layer.route.stack.map((l) => metaOf(l.handle)).filter((m): m is GuardMeta => Boolean(m));
    const access = accessOf([...routerGuards, ...routeGuards]);
    const roles = [...routerGuards, ...routeGuards].flatMap((guard) => guard.kind === 'role' ? [guard.role] : []);
    const validates: ValidateMeta = { body: false, query: false, params: false };
    for (const l of layer.route.stack) {
      const meta = validateMetaOf(l.handle);
      if (meta) {
        validates.body ||= meta.body;
        validates.query ||= meta.query;
        validates.params ||= meta.params;
      }
    }
    for (const method of Object.keys(layer.route.methods)) {
      const tail = layer.route.path === '/' ? '' : layer.route.path;
      found.push({ method: method.toUpperCase(), path: `${API_PREFIX}${mountPrefix}${tail}`, mount: mountPrefix, access, roles, validates });
    }
  }
  return found;
}

/** The complete HTTP surface of the API with who may call each route, read from the live routers. */
export function listRoutes(): RouteInfo[] {
  const all = [...routesOf(apiRouter, '', [], false), ...mounts.flatMap(({ prefix, router }) => routesOf(router, prefix))];
  // The apiRouter itself contains one `use` layer per mounted router (no route): routesOf(apiRouter) only yields /health.
  return all.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
