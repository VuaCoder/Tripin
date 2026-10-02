import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/app-error';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Metadata on the middleware so the route audit tests can see which parts of a request a route validates. */
export const VALIDATE_META = Symbol.for('travel.validate');
export interface ValidateMeta {
  body: boolean;
  query: boolean;
  params: boolean;
}

/**
 * Validates body / query / params with zod. Parsed (and coerced) values are stored on `req.validatedInput`
 * because Express 5 makes `req.query` read-only. Read them in controllers with `validated<B, Q, P>(req)`.
 */
export function validate(schemas: Schemas): RequestHandler {
  const handler: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
    const result: NonNullable<Request['validatedInput']> = {};
    const issues: { location: string; path: string; message: string }[] = [];

    for (const location of ['body', 'query', 'params'] as const) {
      const schema = schemas[location];
      if (!schema) continue;
      const parsed = schema.safeParse(req[location] ?? {});
      if (parsed.success) {
        result[location] = parsed.data;
      } else {
        for (const issue of parsed.error.issues) {
          issues.push({ location, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) return next(AppError.badRequest('Request validation failed', issues));
    req.validatedInput = result;
    next();
  };
  const meta: ValidateMeta = { body: Boolean(schemas.body), query: Boolean(schemas.query), params: Boolean(schemas.params) };
  (handler as unknown as Record<symbol, ValidateMeta>)[VALIDATE_META] = meta;
  return handler;
}

/** Typed accessor for the values stored by `validate`. */
export function validated<B = unknown, Q = unknown, P = unknown>(req: Request): { body: B; query: Q; params: P } {
  const input = req.validatedInput ?? {};
  return { body: input.body as B, query: input.query as Q, params: input.params as P };
}
