import type { Actor } from './actor';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` for every request (GUEST when there is no valid session). */
      actor: Actor;
      /** Set by `validate`; read it through `validated<Body, Query, Params>(req)`. */
      validatedInput?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
