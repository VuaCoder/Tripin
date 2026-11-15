import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { authenticate } from '../authenticate';

describe('public auth ignores stale bearer without weakening protected routes', () => {
  it.each(['/auth/login', '/auth/agency/login', '/auth/refresh', '/auth/logout', '/auth/google'])(
    '%s accepts credential/cookie authentication', async path => {
      const req = { path: `/api/v1${path}`, method: 'POST', headers: { authorization: 'Bearer expired' } } as Request;
      const next = vi.fn();
      await authenticate(req, {} as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.actor.kind).toBe('guest');
    },
  );
  it.each([
    ['POST', '/auth/change-password'], ['PATCH', '/auth/two-factor'],
    ['GET', '/auth/security'], ['GET', '/auth/login'],
    ['POST', '/auth/login/extra'], ['PUT', '/auth/agency/application'],
  ])('%s %s still rejects invalid JWT', async (method, path) => {
    const req = { path: `/api/v1${path}`, method, headers: { authorization: 'Bearer expired' } } as Request;
    const next = vi.fn();
    await authenticate(req, {} as Response, next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: 'TOKEN_INVALID' });
  });
});
