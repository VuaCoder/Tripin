/** Only credential/cookie based POSTs may ignore a stale access token. */
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/login', '/auth/register', '/auth/google', '/auth/verify-otp',
  '/auth/resend-otp', '/auth/forgot-password', '/auth/reset-password',
  '/auth/refresh', '/auth/logout', '/auth/agency/login', '/auth/agency/google',
  '/auth/agency/register', '/auth/agency/verify-otp', '/auth/agency/resend-otp',
]);

export function isPublicAuthRequest(pathname: string, method = 'GET'): boolean {
  return method.toUpperCase() === 'POST' && PUBLIC_AUTH_PATHS.has(pathname);
}
