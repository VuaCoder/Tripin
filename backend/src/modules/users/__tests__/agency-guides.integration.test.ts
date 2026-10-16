import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { bearer, createApprovedTour, createUser, createVerifiedAgency, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

const app = createApp();
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

describe('Agency guide directory and assignment', () => {
  it('searches only active guides by name, paginates stably and never returns private fields', async () => {
    const agency = await createVerifiedAgency('agency@example.com');
    const a = await createUser('TOUR_GUIDE', 'private-a@example.com', { fullName: 'An Guide', phone: '0901234567', guideProfile: { create: { bio: 'Huong dan vien', languages: ['Vietnamese'], specialties: ['Culture'], licenseNumber: 'SECRET-LICENSE' } } });
    const b = await createUser('TOUR_GUIDE', 'private-b@example.com', { fullName: 'Binh Guide' });
    await createUser('TOUR_GUIDE', 'banned@example.com', { fullName: 'Another Guide', status: 'BANNED' });
    await createUser('TRAVELER', 'traveler@example.com', { fullName: 'A Guide' });
    const first = await request(app).get('/api/v1/agency/guides').query({ q: 'GUIDE', limit: 1 }).set(bearer(agency.token));
    expect(first.status).toBe(200);
    expect(first.body.meta).toMatchObject({ page: 1, total: 2, totalPages: 2 });
    expect(first.body.data[0]).toEqual({ id: a.id, fullName: 'An Guide', bio: 'Huong dan vien', languages: ['Vietnamese'], specialties: ['Culture'] });
    expect(JSON.stringify(first.body.data)).not.toMatch(/private-a|0901234567|SECRET-LICENSE|passwordHash|extraPermissions/);
    const second = await request(app).get('/api/v1/agency/guides').query({ q: 'guide', limit: 1, page: 2 }).set(bearer(agency.token));
    expect(second.body.data[0].id).toBe(b.id);
    for (const q of ['private-a', '%']) expect((await request(app).get('/api/v1/agency/guides').query({ q }).set(bearer(agency.token))).body.data).toEqual([]);
    expect((await request(app).get('/api/v1/agency/guides').query({ q: 'x'.repeat(121) }).set(bearer(agency.token))).status).toBe(400);
    expect((await request(app).get('/api/v1/agency/guides').query({ limit: 101 }).set(bearer(agency.token))).status).toBe(400);
    expect((await request(app).get('/api/v1/agency/guides')).status).toBe(401);
    const traveler = await createUser('TRAVELER', 'no-permission@example.com');
    expect((await request(app).get('/api/v1/agency/guides').set(bearer(traveler.token))).status).toBe(403);
  });

  it('reflects pending, acceptance, reassignment, decline and removal across Agency/Guide identities', async () => {
    const agency = await createVerifiedAgency('owner@example.com');
    const other = await createVerifiedAgency('other@example.com');
    const guide = await createUser('TOUR_GUIDE', 'guide@example.com');
    const replacement = await createUser('TOUR_GUIDE', 'replacement@example.com');
    const banned = await createUser('TOUR_GUIDE', 'banned@example.com', { status: 'BANNED' });
    const { tourId } = await createApprovedTour(agency.id);
    const assign = (token: string, guideId: string | null, feePerBooking = 100_000) => request(app).put(`/api/v1/agency/tours/${tourId}/guide`).set(bearer(token)).send({ guideId, feePerBooking });
    expect((await assign(other.token, guide.id)).status).toBe(404);
    expect((await assign(agency.token, banned.id)).status).toBe(404);
    expect((await assign(agency.token, guide.id, -1)).status).toBe(400);
    expect((await assign(agency.token, guide.id)).body.data.guideAssignment.status).toBe('PENDING');
    const list = await request(app).get('/api/v1/guide/tours').set(bearer(guide.token));
    expect(list.body.data[0]).toMatchObject({ id: tourId, agencyId: agency.id, assignment: { status: 'PENDING', feePerBooking: 100_000 } });
    expect((await request(app).post(`/api/v1/guide/tours/${tourId}/verification`).set(bearer(replacement.token)).send({ accept: true })).status).toBe(404);
    expect((await request(app).post(`/api/v1/guide/tours/${tourId}/verification`).set(bearer(guide.token)).send({ accept: true })).status).toBe(200);
    expect((await request(app).get(`/api/v1/agency/tours/${tourId}`).set(bearer(agency.token))).body.data.guideAssignment.status).toBe('ACCEPTED');
    expect((await assign(agency.token, replacement.id, 250_000)).body.data.guideAssignment.status).toBe('PENDING');
    expect((await request(app).get('/api/v1/guide/tours').set(bearer(guide.token))).body.data).toEqual([]);
    await request(app).post(`/api/v1/guide/tours/${tourId}/verification`).set(bearer(replacement.token)).send({ accept: false, note: 'Unavailable on these dates' });
    expect((await request(app).get(`/api/v1/agency/tours/${tourId}`).set(bearer(agency.token))).body.data.guideAssignment).toMatchObject({ status: 'DECLINED', note: 'Unavailable on these dates' });
    expect((await assign(agency.token, null)).body.data.guideAssignment).toBeUndefined();
    expect((await request(app).get('/api/v1/guide/tours').set(bearer(replacement.token))).body.data).toEqual([]);
  });
});
