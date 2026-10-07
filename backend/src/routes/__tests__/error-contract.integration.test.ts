import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import {
  PASSWORD,
  bearer,
  captureMail,
  createApprovedTour,
  createCategory,
  createUser,
  createVerifiedAgency,
  registerAndVerify,
  resetDatabase,
  startDatabase,
  stopDatabase,
  loadTour,
} from '../../test/integration';
import { prisma } from '../../config/database';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

// Every documented error code is provoked over HTTP, on a real database, and must come back with the documented status.
const app = createApp();
const mail = captureMail();

const documented = new Map<string, number>();
for (const row of readFileSync(path.resolve(process.cwd(), '../docs/api/ERRORS.md'), 'utf-8').matchAll(/^\| `([A-Z][A-Z0-9_]+)` \| (\d{3}) \|/gm)) {
  documented.set(row[1]!, Number(row[2]));
}
const observed = new Set<string>();

/** Asserts the standard envelope, the documented status and the code; remembers that the code was seen. */
function expectError(res: Response, code: string): void {
  expect(res.body.success, JSON.stringify(res.body)).toBe(false);
  expect(res.body.error.code, JSON.stringify(res.body)).toBe(code);
  expect(res.status, `${code} must answer with its documented status`).toBe(documented.get(code));
  expect(typeof res.body.error.message).toBe('string');
  observed.add(code);
}

// Codes that cannot be provoked deterministically in a test; each is covered where noted.
const COVERED_ELSEWHERE: Record<string, string> = {
  CONFLICT: 'global handler for unique-constraint violations (parallel creation tests)',
  CONCURRENT_UPDATE: 'needs a lost compare-and-set: service tests with fake repositories',
  RATE_LIMITED: 'limiters are disabled under test; middleware is trivial',
  INTERNAL_ERROR: 'security.integration.test.ts (500 envelope)',
  PAYMENT_IN_PROGRESS: 'needs a parallel checkout that is slower than the retry budget',
};

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);

const contact = { fullName: 'Nguyen Van A', phone: '0901234567' };
const day = 86_400_000;

describe('error contract over HTTP', () => {
  it('general codes: 401, 403, 404, 409 transition, 503, validation', async () => {
    await resetDatabase();
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    const agency = await createVerifiedAgency('agency@example.com');
    const categoryId = await createCategory();

    expectError(await request(app).get('/api/v1/bookings/me'), 'UNAUTHENTICATED');
    expectError(await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'Whatever123' }), 'INVALID_CREDENTIALS');
    expectError(await request(app).get('/api/v1/users/me').set(bearer('garbage.token.value')), 'TOKEN_INVALID');
    expectError(await request(app).get('/api/v1/admin/users').set(bearer(traveler.token)), 'FORBIDDEN');
    expectError(await request(app).get('/api/v1/nope'), 'NOT_FOUND');
    expectError(await request(app).post('/api/v1/auth/google').send({ idToken: 'fake-id-token-0001' }), 'SERVICE_UNAVAILABLE');
    expectError(await request(app).post('/api/v1/auth/login').send({ email: 'bad' }), 'VALIDATION_ERROR');

    // A draft tour cannot be approved: nothing was submitted.
    const tour = await request(app)
      .post('/api/v1/agency/tours')
      .set(bearer(agency.token))
      .send({ title: 'Ha Long Bay 2D1N', destination: 'Quang Ninh', durationDays: 2, basePrice: 1_000_000, categoryIds: [categoryId] });
    const tourId = tour.body.data.id;
    expectError(await request(app).post(`/api/v1/moderation/tours/${tourId}/validate`).set(bearer(moderator.token)).send({ approve: true }), 'INVALID_STATE_TRANSITION');

    // Submitting without any departure.
    expectError(await request(app).post(`/api/v1/agency/tours/${tourId}/submit`).set(bearer(agency.token)), 'NO_OPEN_DEPARTURE');
    // Itinerary day beyond the duration.
    expectError(
      await request(app).put(`/api/v1/agency/tours/${tourId}/itinerary`).set(bearer(agency.token)).send({ days: [{ day: 9, title: 'Too far away' }] }),
      'ITINERARY_EXCEEDS_DURATION',
    );
  });

  it('accounts and sessions', async () => {
    await resetDatabase();
    const email = 'flow@example.com';
    await registerAndVerify(app, mail, email);
    expectError(await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, fullName: 'Flow Tester' }), 'EMAIL_ALREADY_REGISTERED');

    // Wrong, expired and over-guessed codes.
    const fresh = 'otp@example.com';
    await request(app).post('/api/v1/auth/register').send({ email: fresh, password: PASSWORD, fullName: 'Otp Tester' });
    const verify = (code: string) => request(app).post('/api/v1/auth/verify-otp').send({ email: fresh, code, purpose: 'REGISTER' });
    const real = mail.codeFor(fresh);
    const wrong = real === '000000' ? '111111' : '000000';
    expectError(await verify(wrong), 'OTP_INVALID');
    expectError(await request(app).post('/api/v1/auth/register').send({ email: fresh, password: PASSWORD, fullName: 'Otp Tester' }), 'OTP_RESEND_TOO_SOON');
    await prisma.otp.updateMany({ where: {}, data: { expiresAt: new Date(Date.now() - 1000) } });
    expectError(await verify(real), 'OTP_EXPIRED');
    await prisma.otp.updateMany({ where: {}, data: { expiresAt: new Date(Date.now() + 600_000), attempts: 50 } });
    expectError(await verify(wrong), 'OTP_TOO_MANY_ATTEMPTS');

    // Unverified account, banned account.
    expectError(await request(app).post('/api/v1/auth/login').send({ email: fresh, password: PASSWORD }), 'ACCOUNT_NOT_VERIFIED');
    const banned = await createUser('TRAVELER', 'banned@example.com');
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    await request(app).post(`/api/v1/moderation/users/${banned.id}/ban`).set(bearer(moderator.token)).send({ reason: 'Repeated fraud attempts' });
    expectError(await request(app).get('/api/v1/users/me').set(bearer(banned.token)), 'ACCOUNT_BANNED');

    // Last Super admin: a second, banned Super admin does not count as a spare.
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const dormant = await createUser('SUPER_ADMIN', 'dormant@example.com', { status: 'BANNED' });
    expectError(await request(app).patch(`/api/v1/admin/users/${dormant.id}/access`).set(bearer(admin.token)).send({ role: 'MODERATOR' }), 'LAST_SUPER_ADMIN');

    // Unverified agency submitting a tour.
    const unverified = await createUser('AGENCY', 'unverified@example.com', { agencyProfile: { companyName: 'X Co', verificationStatus: 'UNVERIFIED' } });
    const categoryId = await createCategory('Mountain');
    const tour = await request(app)
      .post('/api/v1/agency/tours')
      .set(bearer(unverified.token))
      .send({ title: 'Sapa trekking', destination: 'Lao Cai', durationDays: 3, basePrice: 2_000_000, categoryIds: [categoryId] });
    expectError(await request(app).post(`/api/v1/agency/tours/${tour.body.data.id}/submit`).set(bearer(unverified.token)), 'AGENCY_NOT_VERIFIED');

    // Agency portal separation: an agency account cannot use the traveler login, and an unfinished agency
    // registration cannot sign in through the agency portal.
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    await createUser('AGENCY', 'agency-login@example.com', { passwordHash });
    expectError(await request(app).post('/api/v1/auth/login').send({ email: 'agency-login@example.com', password: PASSWORD }), 'AGENCY_PORTAL_REQUIRED');
    await createUser('AGENCY', 'agency-pending@example.com', { passwordHash, status: 'PENDING_VERIFICATION' });
    expectError(await request(app).post('/api/v1/auth/agency/login').send({ email: 'agency-pending@example.com', password: PASSWORD }), 'AGENCY_ONBOARDING_REQUIRED');
  });

  it('tours, categories and promotions', async () => {
    await resetDatabase();
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const agency = await createVerifiedAgency('agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const { tourId, departureId } = await createApprovedTour(agency.id, { capacity: 5, price: 1_000_000 });

    expectError(await request(app).post('/api/v1/admin/categories').set(bearer(admin.token)).send({ name: 'Beach' }).then(async () => request(app).post('/api/v1/admin/categories').set(bearer(admin.token)).send({ name: 'beach' })), 'CATEGORY_EXISTS');

    const book = (participants = 1) =>
      request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({ tourId, departureId, participants, contact });
    const first = await book(2);
    expect(first.status).toBe(201);

    // Sold seats protect the departure and the tour.
    const date = (await loadTour(tourId))!.departures[0]!.date.toISOString();
    const dep = { id: departureId, date, isOpen: true };
    expectError(await request(app).put(`/api/v1/agency/tours/${tourId}/availability`).set(bearer(agency.token)).send({ departures: [{ ...dep, capacity: 1 }] }), 'CAPACITY_BELOW_BOOKED');
    expectError(await request(app).put(`/api/v1/agency/tours/${tourId}/availability`).set(bearer(agency.token)).send({ departures: [] }), 'DEPARTURE_HAS_BOOKINGS');
    expectError(await request(app).delete(`/api/v1/agency/tours/${tourId}`).set(bearer(agency.token)), 'TOUR_HAS_BOOKINGS');

    // A tour in review is locked.
    const locked = await prisma.tour.create({ data: { agencyId: agency.id, title: 'In review', destination: 'Hue', durationDays: 1, basePrice: 1, status: 'PENDING_REVIEW' } });
    expectError(await request(app).patch(`/api/v1/agency/tours/${locked.id}`).set(bearer(agency.token)).send({ title: 'Changed title' }), 'TOUR_LOCKED');

    // Seats and departures.
    expectError(await book(50), 'NOT_ENOUGH_SEATS');
    await prisma.tourDeparture.updateMany({ where: { tourId }, data: { isOpen: false } });
    expectError(await book(1), 'DEPARTURE_UNAVAILABLE');
    await prisma.tourDeparture.updateMany({ where: { tourId }, data: { isOpen: true } });

    // Promotions.
    const promo = (body: object) =>
      request(app)
        .post('/api/v1/agency/promotions')
        .set(bearer(agency.token))
        .send({ code: 'SAVE10', title: 'Save ten', discountType: 'PERCENT', discountValue: 10, startsAt: new Date(Date.now() - day).toISOString(), endsAt: new Date(Date.now() + day).toISOString(), ...body });
    const created = await promo({});
    expectError(await promo({}), 'PROMOTION_CODE_EXISTS');
    const withCode = (code: string) => request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({ tourId, departureId, participants: 1, contact, promotionCode: code });
    expect((await withCode('SAVE10')).status).toBe(201);
    expectError(await request(app).patch(`/api/v1/agency/promotions/${created.body.data.id}`).set(bearer(agency.token)).send({ discountValue: 20 }), 'PROMOTION_IN_USE');

    await promo({ code: 'FUTURE', startsAt: new Date(Date.now() + 2 * day).toISOString(), endsAt: new Date(Date.now() + 3 * day).toISOString() });
    expectError(await withCode('FUTURE'), 'PROMOTION_NOT_STARTED');
    await promo({ code: 'OFF1' }).then((r) => request(app).patch(`/api/v1/agency/promotions/${r.body.data.id}`).set(bearer(agency.token)).send({ isActive: false }));
    expectError(await withCode('OFF1'), 'PROMOTION_INACTIVE');
    await promo({ code: 'OLD1' });
    await prisma.promotion.updateMany({ where: { code: 'OLD1' }, data: { endsAt: new Date(Date.now() - 1000) } });
    expectError(await withCode('OLD1'), 'PROMOTION_EXPIRED');
    await promo({ code: 'BIG1', minOrderAmount: 90_000_000 });
    expectError(await withCode('BIG1'), 'PROMOTION_MIN_ORDER');
    await promo({ code: 'ONCE1', usageLimit: 1 });
    expect((await withCode('ONCE1')).status).toBe(201);
    expectError(await withCode('ONCE1'), 'PROMOTION_EXHAUSTED');
    const other = await createVerifiedAgency('other@example.com');
    await request(app).post('/api/v1/agency/promotions').set(bearer(other.token)).send({ code: 'THEIRS', title: 'Their promo', discountType: 'FIXED', discountValue: 1000, startsAt: new Date(Date.now() - day).toISOString(), endsAt: new Date(Date.now() + day).toISOString() });
    expectError(await withCode('THEIRS'), 'PROMOTION_NOT_APPLICABLE');
  });

  it('bookings, payments, reviews, reports, support, wishlists', async () => {
    await resetDatabase();
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const { tourId, departureId } = await createApprovedTour(agency.id, { capacity: 10, daysAhead: 3 });
    const create = async () => (await request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({ tourId, departureId, participants: 1, contact })).body.data.id as string;
    const checkout = (id: string) => request(app).post(`/api/v1/payments/bookings/${id}/checkout`).set(bearer(traveler.token));

    const cancelled = await create();
    await request(app).post(`/api/v1/bookings/${cancelled}/cancel`).set(bearer(traveler.token)).send({});
    expectError(await checkout(cancelled), 'BOOKING_NOT_PAYABLE');
    const stale = await create();
    await prisma.booking.updateMany({ where: { id: stale }, data: { paymentExpiresAt: new Date(Date.now() - 1000) } });
    expectError(await checkout(stale), 'BOOKING_PAYMENT_EXPIRED');

    // An order with nothing to pay cannot be booked online.
    const freeTour = await createApprovedTour(agency.id, { price: 0, capacity: 5, daysAhead: 20 });
    expectError(
      await request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({ tourId: freeTour.tourId, departureId: freeTour.departureId, participants: 1, contact }),
      'BOOKING_AMOUNT_TOO_LOW',
    );

    // Cancelling a paid trip that is too close to departure (policy window 10 days, departure in 3 days).
    await request(app).put('/api/v1/admin/policies/cancellation').set(bearer(admin.token)).send({ title: 'Cancellation', content: 'Strict', params: { cancellationWindowHours: 240 } });
    const paid = await create();
    await prisma.booking.updateMany({ where: { id: paid }, data: { status: 'CONFIRMED', isPaid: true, paymentExpiresAt: null } });
    expectError(await request(app).post(`/api/v1/bookings/${paid}/cancel`).set(bearer(traveler.token)).send({}), 'CANCELLATION_WINDOW_PASSED');

    // Reviews.
    expectError(await request(app).post('/api/v1/reviews').set(bearer(traveler.token)).send({ bookingId: paid, rating: 5, comment: 'Wonderful trip indeed' }), 'BOOKING_NOT_COMPLETED');
    await prisma.booking.updateMany({ where: { id: paid }, data: { status: 'COMPLETED' } });
    expect((await request(app).post('/api/v1/reviews').set(bearer(traveler.token)).send({ bookingId: paid, rating: 5, comment: 'Wonderful trip indeed' })).status).toBe(201);
    expectError(await request(app).post('/api/v1/reviews').set(bearer(traveler.token)).send({ bookingId: paid, rating: 4, comment: 'Wonderful trip indeed' }), 'REVIEW_EXISTS');

    // Reports.
    const report = { targetType: 'TOUR', targetId: tourId, category: 'OTHER', description: 'Something is wrong with this tour.' };
    expect((await request(app).post('/api/v1/reports').set(bearer(traveler.token)).send(report)).status).toBe(201);
    expectError(await request(app).post('/api/v1/reports').set(bearer(traveler.token)).send(report), 'REPORT_ALREADY_OPEN');

    // Support tickets: closed and full.
    const ticket = await request(app).post('/api/v1/support/tickets').set(bearer(traveler.token)).send({ subject: 'Cannot open ticket', category: 'OTHER', message: 'The link does not open.' });
    const id = ticket.body.data.id;
    const reply = () => request(app).post(`/api/v1/support/tickets/${id}/messages`).set(bearer(traveler.token)).send({ text: 'Any news?' });
    await prisma.supportTicketMessage.createMany({ data: Array.from({ length: 200 }, (_, i) => ({ ticketId: id, authorId: traveler.id, authorKind: 'USER', text: `m${i}` })) });
    await prisma.supportTicket.updateMany({ where: { id: id }, data: { messageCount: 200 } });
    expectError(await reply(), 'TICKET_FULL');
    await request(app).post(`/api/v1/support/tickets/${id}/close`).set(bearer(traveler.token));
    expectError(await reply(), 'TICKET_CLOSED');

    // Wishlist limit.
    await prisma.wishlistItem.createMany({ data: Array.from({ length: 200 }, () => ({ userId: traveler.id, tourId: randomUUID() })) });
    expectError(await request(app).post(`/api/v1/wishlist/${tourId}`).set(bearer(traveler.token)), 'WISHLIST_FULL');

    // Cart limit.
    await prisma.cartItem.createMany({ data: Array.from({ length: 20 }, () => ({ userId: traveler.id, tourId: randomUUID(), departureId: randomUUID(), participants: 1 })) });
    expectError(await request(app).post('/api/v1/cart/items').set(bearer(traveler.token)).send({ tourId, departureId, participants: 1 }), 'CART_FULL');
  });

  it('AI conversation limit', async () => {
    const { aiService } = await import('../../modules/ai');
    await resetDatabase();
    const traveler = await createUser('TRAVELER', 'ai@example.com');
    const conversation = await prisma.aiConversation.create({ data: {
      userId: traveler.id,
      title: 'Full',
      messages: { create: Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}`, createdAt: new Date() })) },
      messageCount: 100,
    } });
    (aiService as unknown as { provider: unknown }).provider = { name: 'fake', enabled: true, generate: async () => ({ text: 'ok' }) };
    expectError(await request(app).post('/api/v1/ai/chat').set(bearer(traveler.token)).send({ conversationId: conversation.id, message: 'one more' }), 'AI_CONVERSATION_FULL');
  });

  it('every documented code was provoked, except the few that are covered elsewhere', () => {
    const missing = [...documented.keys()].filter((code) => !observed.has(code) && !(code in COVERED_ELSEWHERE));
    expect(missing).toEqual([]);
    for (const code of Object.keys(COVERED_ELSEWHERE)) expect(documented.has(code)).toBe(true);
  });
});
