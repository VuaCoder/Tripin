import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PERMISSIONS, type PersistedRole } from '@travel-platform/constants';
import { createApp } from '../../../app';
import { listRoutes } from '../../../routes/introspect';
import { prisma } from '../../../config/database';
import { bearer, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

const app = createApp();
beforeAll(startDatabase, 120000);
afterAll(stopDatabase);
beforeEach(resetDatabase);
const unknownId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const adminRoutes = listRoutes().filter((route) => route.path.startsWith('/api/v1/admin/'));

describe('ADMIN-01 role boundary over the real HTTP stack', () => {
  it('persists platform promotion CRUD, keeps agency scope separate, and audits only confirmed changes', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example');
    const agency = await createUser('AGENCY', 'agency@test.example');
    const body = { code: 'PLATFORM10', title: 'Platform discount', discountType: 'PERCENT', discountValue: 10, startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), usageLimit: 5 };
    const created = await request(app).post('/api/v1/admin/promotions').set(bearer(admin.token)).send(body);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ scope: 'PLATFORM', code: 'PLATFORM10', isRunning: true });
    const id = created.body.data.id;
    expect((await request(app).post('/api/v1/admin/promotions').set(bearer(admin.token)).send(body)).status).toBe(409);
    const foreign = await request(app).post('/api/v1/agency/promotions').set(bearer(agency.token)).send({ ...body, code: 'AGENCY10' });
    expect(foreign.status).toBe(201);
    const list = await request(app).get('/api/v1/admin/promotions?page=1&limit=1&isActive=true').set(bearer(admin.token));
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].id).toBe(id);
    expect((await request(app).get(`/api/v1/admin/promotions/${foreign.body.data.id}`).set(bearer(admin.token))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/admin/promotions/${id}`).set(bearer(admin.token)).send({ title: 'Updated platform discount', isActive: false })).status).toBe(200);
    const read = await request(app).get(`/api/v1/admin/promotions/${id}`).set(bearer(admin.token));
    expect(read.body.data).toMatchObject({ title: 'Updated platform discount', isActive: false, isRunning: false });
    const inactive = await request(app).get('/api/v1/admin/promotions?isActive=false').set(bearer(admin.token));
    expect(inactive.body.data).toHaveLength(1);
    expect((await prisma.promotion.findUnique({ where: { id } }))?.title).toBe('Updated platform discount');
    expect(await prisma.auditLog.count({ where: { action: 'promotion.platform_changed' } })).toBe(2);
  });

  it.each(['TRAVELER', 'AGENCY', 'TOUR_GUIDE', 'MODERATOR'] as PersistedRole[])('refuses every admin route for %s even with every extra permission', async (role) => {
    const user = await createUser(role, `${role}@test.example`, { extraPermissions: Object.values(PERMISSIONS) });
    const before = await prisma.user.findUnique({ where: { id: user.id } });
    for (const route of adminRoutes) {
      const path = route.path.replace(':id', unknownId).replace(':key', 'cancellation');
      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      const guest = await request(app)[method](path).send({ ratePercent: 50, role: 'SUPER_ADMIN' });
      expect(guest.status, `${route.method} ${path} guest`).toBe(401);
      const response = await request(app)[method](path).set(bearer(user.token)).send({ ratePercent: 50, role: 'SUPER_ADMIN' });
      expect(response.status, `${route.method} ${path} ${role}`).toBe(403);
    }
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toEqual(before);
    expect(await prisma.systemSetting.count()).toBe(0);
    expect(await prisma.category.count()).toBe(0);
    expect(await prisma.promotion.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
    expect((await request(app).get('/api/v1/policies')).status).toBe(200);
    expect((await request(app).get('/api/v1/categories')).status).toBe(200);
  });

  it('refuses invalid policy hours without changing the saved policy, then reflects valid text and typed params', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example');
    const put = (params: object) => request(app).put('/api/v1/admin/policies/cancellation').set(bearer(admin.token)).send({ title: 'Cancellation', content: 'Text', params });
    expect((await put({ cancellationWindowHours: 48, enabled: true, note: 'keep me' })).status).toBe(200);
    for (const value of [-1, '24', true]) expect((await put({ cancellationWindowHours: value })).status).toBe(400);
    const read = await request(app).get('/api/v1/policies/cancellation');
    expect(read.body.data).toMatchObject({ content: 'Text', params: { cancellationWindowHours: 48, enabled: true, note: 'keep me' } });
    expect(await prisma.auditLog.count()).toBe(1);
  });
});
