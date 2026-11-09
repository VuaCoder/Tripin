// Vitest setup: deterministic environment so config/env.ts can be imported without a .env file.
process.env.NODE_ENV = 'test';
// Prevent a developer's local Google credentials from changing offline test behavior.
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
// Public test fixture key, never used by the application outside tests.
process.env.PAYOUT_ENCRYPTION_KEYS = JSON.stringify({ v1: Buffer.alloc(32, 7).toString('base64') });
process.env.PAYOUT_ENCRYPTION_KEY_ID = 'v1';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef';
