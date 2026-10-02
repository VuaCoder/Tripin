import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { isTest } from '../config/env';
import { AppError } from '../utils/app-error';

interface Options {
  windowMs: number;
  limit: number;
}

/** Per-IP rate limiter that answers with the standard error envelope. Disabled under test. */
export function createRateLimiter({ windowMs, limit }: Options): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTest,
    handler: (_req, _res, next) => next(AppError.tooManyRequests()),
  });
}

/** Strict limiter for credential / OTP endpoints. */
export const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 20 });
