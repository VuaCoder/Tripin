import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { AuditLogModel } from '../../audit/audit.model';
import { TourModel } from '../../tours/tours.model';
import { WishlistItemModel } from '../wishlists.model';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

// Real Express app + real MongoDB: the traveler's saved tours, and the audit log that staff read.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

describe('wishlists (integration)', () => {
  async function setup() {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const other = await createUser('TRAVELER', 'other@example.com');
    const tour = await createApprovedTour(agency.id);
    return { agency, traveler, other, ...tour };
  }
  const add = (token: string, tourId: string) => request(app).post(`/api/v1/wishlist/${tourId}`).set(bearer(token));

  it('adding is idempotent even in parallel; removing is idempotent; lists are private', async () => {
    const { traveler, other, tourId } = await setup();

    const results = await Promise.all(Array.from({ length: 6 }, () => add(traveler.token, tourId)));
    expect(results.every((r) => r.status < 300)).toBe(true);
    expect(await WishlistItemModel.countDocuments()).toBe(1);

    const mine = await request(app).get('/api/v1/wishlist').set(bearer(traveler.token));
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0]).toMatchObject({ tourId, available: true });
    expect((await request(app).get('/api/v1/wishlist').set(bearer(other.token))).body.data).toHaveLength(0);

    // Somebody else removing "their" entry does not touch mine.
    expect((await request(app).delete(`/api/v1/wishlist/${tourId}`).set(bearer(other.token))).status).toBeLessThan(300);
    expect(await WishlistItemModel.countDocuments()).toBe(1);

    expect((await request(app).delete(`/api/v1/wishlist/${tourId}`).set(bearer(traveler.token))).status).toBeLessThan(300);
    expect((await request(app).delete(`/api/v1/wishlist/${tourId}`).set(bearer(traveler.token))).status).toBeLessThan(300);
    expect(await WishlistItemModel.countDocuments()).toBe(0);
  });

  it('only public tours can be saved; a tour that stops being public stays listed but flagged unavailable', async () => {
    const { traveler, tourId } = await setup();
    const draft = await TourModel.create({ agencyId: (await TourModel.findById(tourId))!.agencyId, title: 'Draft tour', destination: 'Hue', durationDays: 1, basePrice: 1000, status: 'DRAFT' });

    expect((await add(traveler.token, draft.id)).status).toBe(404);
    expect((await add(traveler.token, '64b000000000000000000009')).status).toBe(404);
    expect((await add(traveler.token, 'nope')).status).toBe(400);

    expect((await add(traveler.token, tourId)).status).toBeLessThan(300);
    await TourModel.updateOne({ _id: tourId }, { $set: { status: 'SUSPENDED' } });
    const list = await request(app).get('/api/v1/wishlist').set(bearer(traveler.token));
    expect(list.body.data[0].available).toBe(false);
    expect(list.body.data[0].tour).toBeUndefined();
    // ...and it can still be removed.
    expect((await request(app).delete(`/api/v1/wishlist/${tourId}`).set(bearer(traveler.token))).status).toBeLessThan(300);
    expect(await WishlistItemModel.countDocuments()).toBe(0);
  });

  it('needs the traveler permission', async () => {
    const { agency, tourId } = await setup();
    expect((await add(agency.token, tourId)).status).toBe(403);
    expect((await request(app).post(`/api/v1/wishlist/${tourId}`)).status).toBe(401);
  });
});

describe('audit log (integration)', () => {
  it('records privileged actions, filters by action/actor/target/date, is read-only and staff-only', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');

    await request(app).post(`/api/v1/moderation/users/${traveler.id}/ban`).set(bearer(moderator.token)).send({ reason: 'Fraudulent chargebacks' });
    await request(app).put('/api/v1/admin/settings/commission').set(bearer(admin.token)).send({ ratePercent: 8 });
    await request(app).post('/api/v1/admin/categories').set(bearer(admin.token)).send({ name: 'Wellness' });

    const logs = (query = '', token = admin.token) => request(app).get(`/api/v1/admin/audit-logs${query}`).set(bearer(token));
    const all = await logs();
    expect(all.status).toBe(200);
    expect(all.body.data.map((l: { action: string }) => l.action).sort()).toEqual(['category.created', 'settings.commission_updated', 'user.banned']);
    expect(all.body.data[0].createdAt >= all.body.data.at(-1).createdAt).toBe(true); // newest first

    expect((await logs('?action=user.banned')).body.data).toHaveLength(1);
    expect((await logs(`?actorId=${moderator.id}`)).body.data).toHaveLength(1);
    expect((await logs(`?targetType=user&targetId=${traveler.id}`)).body.data).toHaveLength(1);
    expect((await logs(`?from=${encodeURIComponent(new Date(Date.now() + 60_000).toISOString())}`)).body.data).toHaveLength(0);
    expect((await logs('?action=made.up')).status).toBe(400);
    expect((await logs('?from=2030-01-01&to=2020-01-01')).status).toBe(400);
    expect((await logs('?limit=101')).status).toBe(400);

    const banned = all.body.data.find((l: { action: string }) => l.action === 'user.banned');
    expect(banned.metadata.reason).toBe('Fraudulent chargebacks');
    expect(JSON.stringify(all.body)).not.toMatch(/passwordHash|token/i);

    expect((await logs('', moderator.token)).status).toBe(403);
    expect((await logs('', traveler.token)).status).toBe(403);
    expect((await request(app).delete('/api/v1/admin/audit-logs')).status).toBeGreaterThanOrEqual(401);
    expect(await AuditLogModel.countDocuments()).toBe(3);
  });
});
