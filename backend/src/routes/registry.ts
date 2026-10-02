import { Router } from 'express';

/** The versioned API router (mounted at /api/v1 by `app.ts`). */
export const apiRouter = Router();

/** Every module router mounted below `/api/v1`, with its prefix, in mounting order. Used for docs and audit tests. */
export const mounts: { prefix: string; router: Router }[] = [];

/** Mounts a module router and records it. Use this (not `apiRouter.use`) in `routes/index.ts`. */
export function mount(prefix: string, router: Router): void {
  mounts.push({ prefix, router });
  apiRouter.use(prefix, router);
}
