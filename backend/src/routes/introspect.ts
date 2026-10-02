import type { Router } from 'express';
import type { Permission } from '@travel-platform/constants';
import { GUARD_META, type GuardMeta } from '../middlewares/authorize';
import { VALIDATE_META, type ValidateMeta } from '../middlewares/validate';
import { apiRouter, mounts } from './registry';
import './index'; // make sure every module router is mounted before the table is read

export const API_PREFIX = '/api/v1';

export type Access = 'public' | 'login' | Permission[];

export interface RouteInfo {
  method: string;
  /** Full path, e.g. /api/v1/tours/:id */
  path: string;
  /** Mount prefix of the module router, e.g. /agency/tours ("" for routes defined directly on the API router). */
  mount: string;
  access: Access;
  /** Which request parts the route validates with zod. */
  validates: ValidateMeta;
}

type Layer = {
  handle: ((...args: unknown[]) => unknown) & { stack?: Layer[] };
  route?: { path: string; methods: Record<string, boolean>; stack: Layer[] };
};

const metaOf = (handle: unknown): GuardMeta | undefined =>
  typeof handle === 'function' ? (handle as unknown as Record<symbol, GuardMeta | undefined>)[GUARD_META] : undefined;

const validateMetaOf = (handle: unknown): ValidateMeta | undefined =>
  typeof handle === 'function' ? (handle as unknown as Record<symbol, ValidateMeta | undefined>)[VALIDATE_META] : undefined;

function accessOf(guards: GuardMeta[]): Access {
  const permissions = guards.flatMap((guard) => (guard.kind === 'permission' ? guard.permissions : []));
  if (permissions.length > 0) return Array.from(new Set(permissions));
  return guards.some((guard) => guard.kind === 'auth') ? 'login' : 'public';
}

function routesOf(router: Router, mountPrefix: string): RouteInfo[] {
  const found: RouteInfo[] = [];
  const routerGuards: GuardMeta[] = []; // guards added with router.use(...) apply to every route declared after them
  for (const layer of (router as unknown as { stack: Layer[] }).stack) {
    if (!layer.route) {
      const meta = metaOf(layer.handle);
      if (meta) routerGuards.push(meta);
      continue;
    }
    const routeGuards = layer.route.stack.map((l) => metaOf(l.handle)).filter((m): m is GuardMeta => Boolean(m));
    const access = accessOf([...routerGuards, ...routeGuards]);
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
      found.push({ method: method.toUpperCase(), path: `${API_PREFIX}${mountPrefix}${tail}`, mount: mountPrefix, access, validates });
    }
  }
  return found;
}

/** The complete HTTP surface of the API with who may call each route, read from the live routers. */
export function listRoutes(): RouteInfo[] {
  const all = [...routesOf(apiRouter, ''), ...mounts.flatMap(({ prefix, router }) => routesOf(router, prefix))];
  // The apiRouter itself contains one `use` layer per mounted router (no route): routesOf(apiRouter) only yields /health.
  return all.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
