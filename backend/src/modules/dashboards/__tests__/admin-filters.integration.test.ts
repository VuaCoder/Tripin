import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

const app = createApp();
beforeAll(startDatabase, 120000);
afterAll(stopDatabase);
beforeEach(resetDatabase);
const from = '2026-09-30T17:00:00.000Z';
const to = '2026-10-02T16:59:59.999Z';
const bounds = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

describe('admin server filters and comparison', () => {
  it('uses confirmedAt/paidAt boundaries, excludes cancelled/unpaid revenue, and compares a disjoint previous period', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@filters.test');
    const agency = await createUser('AGENCY', 'agency@filters.test');
    const tour = await createApprovedTour(agency.id);
    const book = async (at: string, amount: number, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'PENDING' = 'CONFIRMED') => prisma.booking.create({ data: {
      bookingCode: randomUUID(), travelerId: randomUUID(), agencyId: agency.id, tourId: tour.tourId, departureId: tour.departureId,
      tourTitle: 'Date-filtered booking', departureDate: new Date('2026-11-01'), endDate: new Date('2026-11-02'), participants: 1,
      contactName: 'Test Traveler', contactPhone: '0901234567', unitPrice: amount, subtotal: amount, totalAmount: amount,
      commissionBps: 1000, commissionAmount: amount / 10, agencyAmount: amount * 0.9, status, isPaid: status !== 'PENDING',
      confirmedAt: new Date(at), createdAt: new Date(at),
    } });
    await book(from, 10000);
    await book(to, 30000, 'COMPLETED');
    await book('2026-09-30T16:59:59.999Z', 5000);
    await book('2026-10-02T17:00:00Z', 90000);
    await book('2026-10-01T00:00:00Z', 20000, 'CANCELLED');
    await book('2026-10-01T00:00:00Z', 60000, 'PENDING');
    let order = 9000;
    const pay = (at: string, amount: number, status: 'PAID' | 'PENDING' = 'PAID') => prisma.payment.create({ data: {
      purpose: 'SUBSCRIPTION', userId: admin.id, referenceId: randomUUID(), amount, description: 'Period payment', provider: 'PAYOS',
      providerOrderCode: BigInt(++order), status, paidAt: status === 'PAID' ? new Date(at) : null, expiresAt: new Date('2027-01-01'),
    } });
    await pay(to, 2000); await pay('2026-09-30T16:59:59.999Z', 1000); await pay(to, 7000, 'PENDING');
    const response = await request(app).get(`/api/v1/admin/dashboard?${bounds}`).set(bearer(admin.token));
    expect(response.status).toBe(200);
    expect(response.body.data.revenue).toEqual({ bookings: 2, gross: 40000, commission: 4000, net: 36000, subscriptions: { amount: 2000, count: 1 } });
    expect(response.body.data.comparison).toEqual({ bookings: 1, gross: 5000, commission: 500, net: 4500, subscriptions: { amount: 1000, count: 1 } });
    expect(response.body.data.period).toMatchObject({ from, to, previousFrom: '2026-09-28T17:00:00.000Z', previousTo: '2026-09-30T16:59:59.999Z' });
    expect(response.body.data.monthly).toEqual([{ month: '2026-09', bookings: 1, gross: 10000, commission: 1000 }, { month: '2026-10', bookings: 1, gross: 30000, commission: 3000 }]);
    const empty = await request(app).get('/api/v1/admin/dashboard?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59.999Z').set(bearer(admin.token));
    expect(empty.body.data.revenue.gross).toBe(0);
    expect(empty.body.data.monthly).toEqual([{ month: '2026-01', bookings: 0, gross: 0, commission: 0 }]);
  });

  it('filters the entire user list by account creation dates before pagination', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@filters.test');
    await createUser('TRAVELER', 'before@filters.test', { createdAt: new Date('2026-09-30T16:59:59.999Z') });
    await createUser('TRAVELER', 'first@filters.test', { createdAt: new Date(from) });
    await createUser('TRAVELER', 'last@filters.test', { createdAt: new Date(to) });
    const result = await request(app).get(`/api/v1/admin/users?${bounds}&role=TRAVELER&limit=1&page=2`).set(bearer(admin.token));
    expect(result.status).toBe(200);
    expect(result.body.meta).toMatchObject({ total: 2, totalPages: 2, page: 2 });
    expect(result.body.data[0].email).toBe('first@filters.test');
  });

  it('filters promotions with literal text, type, activation and overlapping validity periods before pagination', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@filters.test');
    const promotion = (code: string, title: string, start: string, end: string, discountType: 'PERCENT' | 'FIXED', isActive = true) => prisma.promotion.create({ data: {
      code, title, scope: 'PLATFORM', discountType, discountValue: 10, startsAt: new Date(start), endsAt: new Date(end), createdById: admin.id, isActive,
    } });
    await promotion('SAVE1', 'Save 50% now', '2026-09-01', '2026-10-01', 'FIXED');
    await promotion('SAVE2', 'Save 50% now', '2026-10-01', '2026-12-01', 'FIXED');
    await promotion('SAVE3', 'Save other', '2026-10-01', '2026-12-01', 'PERCENT');
    await promotion('SAVE4', 'Save 50% now', '2026-01-01', '2026-01-05', 'FIXED');
    await promotion('SAVE5', 'Save 50% now', '2026-10-01', '2026-12-01', 'FIXED', false);
    const result = await request(app).get(`/api/v1/admin/promotions?${bounds}&q=50%25&discountType=FIXED&isActive=true&limit=1&page=2`).set(bearer(admin.token));
    expect(result.status).toBe(200);
    expect(result.body.meta).toMatchObject({ total: 2, totalPages: 2, page: 2 });
    expect(result.body.data[0].discountType).toBe('FIXED');
    const noMatch = await request(app).get(`/api/v1/admin/promotions?q=${encodeURIComponent('50_')}`).set(bearer(admin.token));
    expect(noMatch.body.meta.total).toBe(0);
  });

  it('rejects partial/reversed/invalid ranges and excessive dashboard ranges without breaking role protection', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@filters.test');
    for (const path of ['/admin/dashboard', '/admin/users', '/admin/promotions']) {
      for (const query of ['from=2026-10-01', 'from=2026-10-05&to=2026-10-01', 'from=oops&to=2026-10-01']) {
        expect((await request(app).get(`/api/v1${path}?${query}`).set(bearer(admin.token))).status).toBe(400);
      }
    }
    expect((await request(app).get('/api/v1/admin/dashboard?from=2020-01-01&to=2026-10-01').set(bearer(admin.token))).status).toBe(400);
    expect((await request(app).get(`/api/v1/admin/dashboard?${bounds}`)).status).toBe(401);
  });
});
