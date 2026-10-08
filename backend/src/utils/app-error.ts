/**
 * Machine-readable error codes shared by several modules. Codes that belong to one feature (e.g. `TOUR_LOCKED`) are
 * written next to the rule that throws them. EVERY code, shared or not, must have a row in docs/api/ERRORS.md
 * (a test enforces it).
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_INVALID: 'TOKEN_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  OTP_RESEND_TOO_SOON: 'OTP_RESEND_TOO_SOON',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TWO_FACTOR_REQUIRES_PASSWORD: 'TWO_FACTOR_REQUIRES_PASSWORD',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | (string & {});

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  /** Operational errors are safe to show to the client. Anything else is reported as a generic 500. */
  readonly isOperational = true;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown, code: ErrorCode = ERROR_CODES.VALIDATION_ERROR) {
    return new AppError(400, code, message, details);
  }
  static unauthenticated(message = 'Authentication required', code: ErrorCode = ERROR_CODES.UNAUTHENTICATED) {
    return new AppError(401, code, message);
  }
  static forbidden(message = 'You do not have permission to perform this action', code: ErrorCode = ERROR_CODES.FORBIDDEN) {
    return new AppError(403, code, message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError(404, ERROR_CODES.NOT_FOUND, message);
  }
  static conflict(message: string, code: ErrorCode = ERROR_CODES.CONFLICT) {
    return new AppError(409, code, message);
  }
  static invalidTransition(from: string, to: string, entity = 'Resource') {
    return new AppError(409, ERROR_CODES.INVALID_STATE_TRANSITION, `${entity} cannot move from ${from} to ${to}`);
  }
  static tooManyRequests(message = 'Too many requests, please try again later', code: ErrorCode = ERROR_CODES.RATE_LIMITED) {
    return new AppError(429, code, message);
  }
  static unavailable(message = 'Service temporarily unavailable') {
    return new AppError(503, ERROR_CODES.SERVICE_UNAVAILABLE, message);
  }
}
