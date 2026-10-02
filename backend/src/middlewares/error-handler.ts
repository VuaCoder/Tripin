import type { ErrorRequestHandler, RequestHandler } from 'express';
import { isProduction } from '../config/env';
import type { ErrorBody } from '../utils/api-response';
import { AppError, ERROR_CODES } from '../utils/app-error';
import { logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/** The only place errors become HTTP responses. Single format, no stack traces or internals in production. */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;

  if (error instanceof AppError) {
    const body: ErrorBody = {
      success: false,
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    };
    res.status(error.statusCode).json(body);
    return;
  }

  // body-parser errors (malformed JSON, payload too large) carry a status
  const status = typeof error?.status === 'number' && error.status >= 400 && error.status < 500 ? error.status : undefined;
  if (status) {
    res.status(status).json({
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: status === 413 ? 'Payload too large' : 'Malformed request' },
    } satisfies ErrorBody);
    return;
  }

  // Unique-constraint violation (Prisma P2002) that slipped past the service-level checks
  if (error?.code === 'P2002') {
    res.status(409).json({
      success: false,
      error: { code: ERROR_CODES.CONFLICT, message: 'Resource already exists' },
    } satisfies ErrorBody);
    return;
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, isProduction ? { message: error?.message } : error);
  res.status(500).json({
    success: false,
    error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Internal server error' },
  } satisfies ErrorBody);
};
