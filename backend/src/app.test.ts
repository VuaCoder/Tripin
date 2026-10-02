import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

// HTTP-level smoke tests that need no database (GUEST requests never hit the database).
const app = createApp();

describe('app', () => {
  it('serves the health check under /api/v1', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: 'ok' } });
  });

  it('answers unknown routes with the standard error envelope', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('rejects invalid input with 400 and per-field details', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'bad', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('refuses protected routes without a session', async () => {
    const res = await request(app).patch('/api/v1/auth/two-factor').send({ enabled: true });
    expect(res.status).toBe(401);
  });

  it('rejects a forged bearer token', async () => {
    const res = await request(app).patch('/api/v1/auth/two-factor').set('Authorization', 'Bearer forged.token.value').send({ enabled: true });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});
