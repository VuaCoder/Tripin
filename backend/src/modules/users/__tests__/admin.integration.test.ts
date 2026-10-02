import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@travel-platform/constants';
import { createApp } from '../../../app';
import { AuditLogModel } from '../../audit/audit.model';
import { BookingModel } from '../../bookings/bookings.model';
import { CategoryModel } from '../../categories/categories.model';
import { SystemSettingModel } from '../../system-settings/system-settings.model';
import { UserModel } from '../users.model';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

// Real Express app + real MongoDB: everything the Super admin configures (accounts, categories, commission, policies).
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const access = (token: string, id: string, body: object) => request(app).patch(`/api/v1/admin/users/${id}/access`).set(bearer(token)).send(body);

describe('admin: users and access', () => {
  it('only the Super admin lists accounts; filters and search work and treat the search text literally', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    await createUser('TRAVELER', 'an.nguyen@example.com', { fullName: 'An Nguyen' });
    await createUser('TRAVELER', 'binh@example.com', { fullName: 'Binh (VIP) Tran', status: 'BANNED' });
    await createUser('AGENCY', 'agency@example.com');

    expect((await request(app).get('/api/v1/admin/users').set(bearer(moderator.token))).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/users')).status).toBe(401);

    const list = (query: string) => request(app).get(`/api/v1/admin/users?${query}`).set(bearer(admin.token));
    expect((await list('')).body.meta.total).toBe(5);
    expect((await list('role=TRAVELER')).body.data).toHaveLength(2);
    expect((await list('status=BANNED')).body.data.map((u: { email: string }) => u.email)).toEqual(['binh@example.com']);
    expect((await list('q=nguyen')).body.data).toHaveLength(1);
    expect((await list(`q=${encodeURIComponent('(VIP)')}`)).body.data).toHaveLength(1); // parentheses are text, not regex
    expect((await list(`q=${encodeURIComponent('.*')}`)).body.data).toHaveLength(0);
    expect((await list('limit=2&page=2')).body.data).toHaveLength(2);
    expect((await list('role=HACKER')).status).toBe(400);
  });

  it('assigning a role or extra permissions changes what the user can do on the very next request', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const audit = () => request(app).get('/api/v1/admin/audit-logs').set(bearer(traveler.token));

    expect((await audit()).status).toBe(403);
    expect((await access(admin.token, traveler.id, { extraPermissions: [PERMISSIONS.AUDIT_LOG_VIEW] })).status).toBe(200);
    expect((await audit()).status).toBe(200);
    expect((await access(admin.token, traveler.id, { extraPermissions: [] })).status).toBe(200);
    expect((await audit()).status).toBe(403);

    expect((await request(app).get('/api/v1/agency/tours').set(bearer(traveler.token))).status).toBe(403);
    const promoted = await access(admin.token, traveler.id, { role: 'AGENCY' });
    expect(promoted.status).toBe(200);
    expect((await request(app).get('/api/v1/agency/tours').set(bearer(traveler.token))).status).toBe(200);
    expect((await UserModel.findById(traveler.id))!.agencyProfile!.verificationStatus).toBe('UNVERIFIED');

    expect(await AuditLogModel.countDocuments({ action: 'user.access_assigned' })).toBe(3);
  });

  it('refuses nonsense: unknown permissions, empty bodies, own account, unknown users, and non-admins', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');

    expect((await access(admin.token, traveler.id, { extraPermissions: ['everything:all'] })).status).toBe(400);
    expect((await access(admin.token, traveler.id, {})).status).toBe(400);
    expect((await access(admin.token, traveler.id, { role: 'GUEST' })).status).toBe(400); // GUEST is never persisted
    expect((await access(admin.token, traveler.id, { role: 'TRAVELER', isAdmin: true })).status).toBe(400);
    expect((await access(admin.token, admin.id, { role: 'TRAVELER' })).status).toBe(403);
    expect((await access(admin.token, '64b000000000000000000009', { role: 'AGENCY' })).status).toBe(404);
    expect((await access(moderator.token, traveler.id, { role: 'MODERATOR' })).status).toBe(403);
    expect((await access(traveler.token, traveler.id, { role: 'SUPER_ADMIN' })).status).toBe(403);
    expect((await UserModel.findById(traveler.id))!.role).toBe('TRAVELER');
  });

  it('the platform can never be left without a Super admin, even when two admins demote each other at once', async () => {
    const first = await createUser('SUPER_ADMIN', 'admin1@example.com');
    const second = await createUser('SUPER_ADMIN', 'admin2@example.com');

    const results = await Promise.all([access(first.token, second.id, { role: 'MODERATOR' }), access(second.token, first.id, { role: 'MODERATOR' })]);
    // 403 is legitimate too: once the first demotion lands, the second caller is no longer a Super admin.
    expect(results.every((r) => [200, 403, 409].includes(r.status))).toBe(true);
    expect(await UserModel.countDocuments({ role: 'SUPER_ADMIN', status: 'ACTIVE' })).toBeGreaterThanOrEqual(1);

    // Sequentially, the very last one is protected.
    const remaining = (await UserModel.findOne({ role: 'SUPER_ADMIN' }))!;
    const other = (await UserModel.findOne({ _id: { $ne: remaining.id } }))!;
    await UserModel.updateOne({ _id: other.id }, { $set: { role: 'SUPER_ADMIN' } });
    await UserModel.updateOne({ _id: other.id }, { $set: { role: 'MODERATOR' } });
    const sole = await access(first.token, remaining.id, { role: 'TRAVELER' });
    expect([403, 409]).toContain(sole.status);
  });
});

describe('admin: categories', () => {
  it('public list shows active categories in order; admin creates, renames, deactivates and re-activates', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const create = (body: object, token = admin.token) => request(app).post('/api/v1/admin/categories').set(bearer(token)).send(body);

    const beach = await create({ name: 'Beach', sortOrder: 2 });
    const mountain = await create({ name: 'Mountain', sortOrder: 1 });
    expect(beach.status).toBe(201);
    expect((await create({ name: 'beach' })).status).toBe(409); // same slug
    expect((await create({ name: 'X' })).status).toBe(400);
    expect((await create({ name: 'Forest', isActive: false })).status).toBe(400); // unknown field
    expect((await create({ name: 'Forest' }, traveler.token)).status).toBe(403);

    const publicNames = async () => (await request(app).get('/api/v1/categories')).body.data.map((c: { name: string }) => c.name);
    expect(await publicNames()).toEqual(['Mountain', 'Beach']);

    expect((await request(app).patch(`/api/v1/admin/categories/${beach.body.data.id}`).set(bearer(admin.token)).send({ name: 'Sea & Beach' })).status).toBe(200);
    expect((await request(app).patch(`/api/v1/admin/categories/${mountain.body.data.id}`).set(bearer(admin.token)).send({ name: 'Sea & Beach' })).status).toBe(409);

    // "Delete" deactivates, so tours keep a valid reference; the admin list still shows it.
    expect((await request(app).delete(`/api/v1/admin/categories/${beach.body.data.id}`).set(bearer(admin.token))).status).toBeLessThan(300);
    expect(await publicNames()).toEqual(['Mountain']);
    expect(await CategoryModel.countDocuments()).toBe(2);
    expect((await request(app).get('/api/v1/admin/categories').set(bearer(admin.token))).body.data).toHaveLength(2);
    expect((await request(app).patch(`/api/v1/admin/categories/${beach.body.data.id}`).set(bearer(admin.token)).send({ isActive: true })).status).toBe(200);
    expect(await publicNames()).toEqual(['Mountain', 'Sea & Beach']);
    expect(await AuditLogModel.countDocuments({ action: { $regex: '^category\\.' } })).toBeGreaterThanOrEqual(4);
  });

  it('two admins creating the same category at once produce one category', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const results = await Promise.all(
      Array.from({ length: 4 }, () => request(app).post('/api/v1/admin/categories').set(bearer(admin.token)).send({ name: 'Cultural Heritage' })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect(await CategoryModel.countDocuments()).toBe(1);
  });
});

describe('admin: commission and policies', () => {
  it('the commission is validated, audited, and snapshotted into each new booking (old bookings never change)', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const { tourId, departureId } = await createApprovedTour(agency.id, { price: 1_000_000, capacity: 10 });
    const setRate = (ratePercent: unknown, token = admin.token) => request(app).put('/api/v1/admin/settings/commission').set(bearer(token)).send({ ratePercent });
    const book = () =>
      request(app)
        .post('/api/v1/bookings')
        .set(bearer(traveler.token))
        .send({ tourId, departureId, participants: 1, contact: { fullName: 'Nguyen Van A', phone: '0901234567' } });

    const initial = await request(app).get('/api/v1/admin/settings/commission').set(bearer(admin.token));
    expect(initial.status).toBe(200);

    expect((await setRate(-1)).status).toBe(400);
    expect((await setRate(101)).status).toBe(400);
    expect((await setRate(12.345)).status).toBe(400);
    expect((await setRate('10')).status).toBe(400);
    expect((await setRate(10, traveler.token)).status).toBe(403);

    expect((await setRate(10)).status).toBe(200);
    const oldBooking = (await book()).body.data.id;
    expect((await setRate(12.5)).status).toBe(200);
    const newBooking = (await book()).body.data.id;

    expect((await BookingModel.findById(oldBooking))!.commissionBps).toBe(1000);
    const fresh = (await BookingModel.findById(newBooking))!;
    expect(fresh.commissionBps).toBe(1250);
    expect(fresh.commissionAmount).toBe(125_000);
    expect(fresh.agencyAmount).toBe(875_000);
    expect(await AuditLogModel.countDocuments({ action: 'settings.commission_updated' })).toBe(2);
  });

  it('policies are public to read, admin-only to write, limited to the known keys, and audited', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    const put = (key: string, body: object, token = admin.token) => request(app).put(`/api/v1/admin/policies/${key}`).set(bearer(token)).send(body);

    expect((await request(app).get('/api/v1/policies/cancellation')).status).toBeLessThan(500);
    expect((await put('cancellation', { title: 'Cancellation', content: 'Free until 48h before departure.', params: { cancellationWindowHours: 48 } })).status).toBe(200);
    const read = await request(app).get('/api/v1/policies/cancellation');
    expect(read.status).toBe(200);
    expect(read.body.data.params.cancellationWindowHours).toBe(48);
    expect((await request(app).get('/api/v1/policies')).body.data.length).toBeGreaterThanOrEqual(1);

    expect((await put('cancellation', { title: 'x', content: 'y' }, moderator.token)).status).toBe(403);
    expect((await put('not-a-policy', { title: 'Hello', content: 'World' })).status).toBe(400);
    expect((await put('terms', { title: 'Terms', content: 'x'.repeat(60_000) })).status).toBe(400);
    expect((await put('terms', { title: 'Terms', content: 'ok', params: { 'bad key!': 1 } })).status).toBe(400);
    expect((await request(app).get('/api/v1/policies/nope')).status).toBe(400);
    expect(await SystemSettingModel.countDocuments()).toBe(1);
    expect(await AuditLogModel.countDocuments({ action: 'settings.policy_updated' })).toBe(1);
  });

  it('a cancellation window set by the admin is what the booking rules use', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const { tourId, departureId } = await createApprovedTour(agency.id, { daysAhead: 3 });
    await request(app)
      .put('/api/v1/admin/policies/cancellation')
      .set(bearer(admin.token))
      .send({ title: 'Cancellation', content: 'Strict', params: { cancellationWindowHours: 24 * 10 } });
    const booking = await request(app)
      .post('/api/v1/bookings')
      .set(bearer(traveler.token))
      .send({ tourId, departureId, participants: 1, contact: { fullName: 'Nguyen Van A', phone: '0901234567' } });
    await BookingModel.updateOne({ _id: booking.body.data.id }, { $set: { status: 'CONFIRMED', isPaid: true }, $unset: { paymentExpiresAt: 1 } });

    const cancel = await request(app).post(`/api/v1/bookings/${booking.body.data.id}/cancel`).set(bearer(traveler.token)).send({});
    expect(cancel.status).toBe(409); // departure is 3 days away, the window is 10 days
  });
});
