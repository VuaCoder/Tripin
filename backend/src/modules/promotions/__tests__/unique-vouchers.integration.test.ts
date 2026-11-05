import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app';
import { prisma, runInTransaction } from '../../../config/database';
import { bearer, captureMail, createApprovedTour, createUser, loadTour, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { bookingsRepository } from '../../bookings/bookings.repository';
import { bookingsService } from '../../bookings';
import { notificationsService } from '../../notifications';
import { promotionsRepository } from '../promotions.repository';
import { promotionsService } from '..';

const app = createApp();
const contact = { fullName: 'Unique voucher traveler', phone: '0901234567' };
const day = 86_400_000;
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(async () => { await resetDatabase(); captureMail(); });
afterEach(() => vi.restoreAllMocks());

async function fixture(quota = 50) {
  const agency = await createUser('AGENCY', 'agency@example.com');
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const tour = await createApprovedTour(agency.id, { price: 1_000_000, capacity: 50 });
  const promotion = await prisma.promotion.create({ data: {
    code: 'BATCH', title: 'Private batch', scope: 'AGENCY', ownerId: agency.id, createdById: agency.id,
    codeType: 'UNIQUE_BATCH', discountType: 'FIXED', discountValue: 100_000,
    startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + day), usageLimit: quota,
    usageLimitPerUser: 50,
  } });
  const instance = await prisma.promotionCodeInstance.create({ data: { promotionId: promotion.id, code: 'PRIVATE_ONE' } });
  return { agency, traveler, ...tour, promotion, instance };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
const book = (f: Fixture, token = f.traveler.token, extra: object = {}) => request(app).post('/api/v1/bookings')
  .set(bearer(token)).send({ tourId: f.tourId, departureId: f.departureId, participants: 1, contact, promotionCode: f.instance.code, ...extra });
const cancel = (f: Fixture, id: string) => request(app).post(`/api/v1/bookings/${id}/cancel`).set(bearer(f.traveler.token)).send({});
async function expectUnused(f: Fixture) {
  expect(await prisma.promotionCodeInstance.findUnique({ where: { id: f.instance.id } })).toMatchObject({ isUsed: false, usedAt: null, usedById: null, bookingId: null });
  expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(0);
  expect(await prisma.booking.count()).toBe(0);
  expect((await loadTour(f.tourId))!.departures[0]!.remaining).toBe(50);
}

describe('unique batch voucher transaction', () => {
  it('stores both shared vouchers as BIGINT snapshots and releases both exactly once', async () => {
    const f = await fixture();
    await prisma.tourDeparture.update({ where: { id: f.departureId }, data: { priceOverride: 1_000_000_000 } });
    const shared = await prisma.promotion.update({ where: { id: f.promotion.id }, data: {
      codeType: 'SHARED', code: 'AGENCY_SHARED', discountValue: 3_000_000_000, usageLimitPerUser: 1,
    } });
    const platform = await prisma.promotion.create({ data: {
      code: 'PLATFORM_SHARED', title: 'Platform', scope: 'PLATFORM', createdById: f.agency.id,
      discountType: 'FIXED', discountValue: 4_000_000_000, usageLimitPerUser: 1,
      startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + day),
    } });
    const extra = { promotionCode: undefined, participants: 10, agencyPromotionCode: shared.code, platformPromotionCode: platform.code };
    const first = await book(f, f.traveler.token, extra);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.data.redemptions.map((r: { discountAmount: number }) => r.discountAmount).sort()).toEqual([3_000_000_000, 4_000_000_000]);
    expect(await prisma.promotionRedemption.count()).toBe(2);
    expect(await promotionsRepository.countUserUsages(f.traveler.id, platform.id)).toBe(1);
    const replay = await book(f, f.traveler.token, extra);
    expect(replay.body.error.code).toBe('PROMOTION_USER_LIMIT_REACHED');
    expect((await cancel(f, first.body.data.id)).status).toBe(200);
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: shared.id } })).usedCount).toBe(0);
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: platform.id } })).usedCount).toBe(0);
    expect(await promotionsRepository.countUserUsages(f.traveler.id, platform.id)).toBe(0);
  });

  it('serializes concurrent bookings by the same user at per-user limit one', async () => {
    const f = await fixture();
    await prisma.promotion.update({ where: { id: f.promotion.id }, data: { codeType: 'SHARED', code: 'SHARED_LIMIT', usageLimitPerUser: 1 } });
    const results = await Promise.all(Array.from({ length: 12 }, () => book(f, f.traveler.token, { promotionCode: 'SHARED_LIMIT' })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.body.error?.code === 'PROMOTION_USER_LIMIT_REACHED')).toHaveLength(11);
    expect(await prisma.booking.count()).toBe(1);
    expect(await prisma.promotionRedemption.count()).toBe(1);
  });

  it('preview is read-only; booking binds the code to its owner and blocks reuse', async () => {
    const f = await fixture();
    for (let i = 0; i < 3; i++) {
      const preview = await request(app).get('/api/v1/promotions/preview').set(bearer(f.traveler.token))
        .query({ code: f.instance.code, tourId: f.tourId, subtotal: 1_000_000 });
      expect(preview.status).toBe(200);
    }
    await expectUnused(f);
    const response = await book(f);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const used = (await prisma.promotionCodeInstance.findUnique({ where: { id: f.instance.id } }))!;
    expect(used).toMatchObject({ isUsed: true, usedById: f.traveler.id, bookingId: response.body.data.id });
    expect(used.usedAt).toBeInstanceOf(Date);
    const reused = await book(f);
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe('PROMOTION_CODE_USED');
    const previewUsed = await request(app).get('/api/v1/promotions/preview').set(bearer(f.traveler.token))
      .query({ code: f.instance.code, tourId: f.tourId, subtotal: 1_000_000 });
    expect(previewUsed.body.error.code).toBe('PROMOTION_CODE_USED');
    expect(await prisma.booking.count()).toBe(1);
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(1);
    expect((await loadTour(f.tourId))!.departures[0]!.remaining).toBe(49);
  });

  it('requires transaction, booking and user context before consuming a unique code', async () => {
    const f = await fixture();
    await expect(promotionsService.redeem(f.instance.code, f.tourId, 1_000_000, { userId: f.traveler.id })).rejects.toMatchObject({ statusCode: 400 });
    await expectUnused(f);
  });

  it('twenty travelers racing the same code produce exactly one booking and redemption', async () => {
    const f = await fixture();
    const travelers = await Promise.all(Array.from({ length: 20 }, (_, i) => createUser('TRAVELER', `race${i}@example.com`)));
    const responses = await Promise.all(travelers.map((traveler) => book(f, traveler.token)));
    expect(responses.filter((res) => res.status === 201)).toHaveLength(1);
    const losers = responses.filter((res) => res.status !== 201);
    expect(losers).toHaveLength(19);
    expect(losers.every((res) => res.status === 409 && res.body.error.code === 'PROMOTION_CODE_USED')).toBe(true);
    expect(await prisma.booking.count()).toBe(1);
    expect(await prisma.promotionCodeInstance.count({ where: { isUsed: true } })).toBe(1);
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(1);
    expect((await loadTour(f.tourId))!.departures[0]!.remaining).toBe(49);
  });

  it('parallel retries with the same clientRequestId return one booking and keep one seat', async () => {
    const f = await fixture();
    const responses = await Promise.all(Array.from({ length: 8 }, () => book(f, f.traveler.token, { clientRequestId: 'unique-retry-1234' })));
    expect(responses.every((res) => res.status === 201)).toBe(true);
    expect(new Set(responses.map((res) => res.body.data.id)).size).toBe(1);
    expect(await prisma.booking.count()).toBe(1);
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(1);
    expect((await loadTour(f.tourId))!.departures[0]!.remaining).toBe(49);
  });

  it('same-key retries wait for the first commit when it holds the last seat', async () => {
    const f = await fixture();
    await prisma.tourDeparture.update({ where: { id: f.departureId }, data: { capacity: 1, remaining: 1 } });
    const create = bookingsRepository.create.bind(bookingsRepository);
    let reachedInsert!: () => void;
    const atInsert = new Promise<void>((resolve) => { reachedInsert = resolve; });
    vi.spyOn(bookingsRepository, 'create').mockImplementationOnce(async (data, tx) => {
      reachedInsert();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return create(data, tx);
    });
    const extra = { clientRequestId: 'last-seat-retry-1234' };
    const pending = book(f, f.traveler.token, extra).then((res) => res);
    await atInsert;
    const second = await book(f, f.traveler.token, extra);
    const first = await pending;
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await prisma.booking.count()).toBe(1);
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(1);
    expect((await loadTour(f.tourId))!.departures[0]!.remaining).toBe(0);
  });

  it('rolls back an instance when quota rejects it after the CAS update', async () => {
    const f = await fixture();
    vi.spyOn(promotionsRepository, 'consume').mockImplementationOnce(async (_id, _userId, tx) => {
      expect(tx).toBeDefined();
      expect((await tx!.promotionCodeInstance.findUnique({ where: { id: f.instance.id } }))!.isUsed).toBe(true);
      return { success: false, reason: 'EXHAUSTED' };
    });
    const response = await book(f);
    expect(response.status).toBe(409);
    await expectUnused(f);
  });

  it('rolls back the instance when an exception occurs between CAS and quota', async () => {
    const f = await fixture();
    vi.spyOn(promotionsRepository, 'consume').mockRejectedValueOnce(new Error('injected quota failure'));
    expect((await book(f)).status).toBe(500);
    await expectUnused(f);
  });

  it('rolls back quota and code when the booking INSERT fails', async () => {
    const f = await fixture();
    vi.spyOn(bookingsRepository, 'create').mockRejectedValueOnce(new Error('injected persistence failure'));
    expect((await book(f)).status).toBe(500);
    await expectUnused(f);
  });

  it('rolls back even a completed INSERT if the transaction fails before commit', async () => {
    const f = await fixture();
    const create = bookingsRepository.create.bind(bookingsRepository);
    vi.spyOn(bookingsRepository, 'create').mockImplementationOnce(async (data, tx) => {
      await create(data, tx);
      throw new Error('injected after insert');
    });
    expect((await book(f)).status).toBe(500);
    await expectUnused(f);
  });

  it('rolls back the first unique code if the second stacked voucher fails', async () => {
    const f = await fixture();
    const response = await book(f, f.traveler.token, { agencyPromotionCode: f.instance.code, platformPromotionCode: 'DOES_NOT_EXIST' });
    expect(response.status).toBe(404);
    await expectUnused(f);
  });

  it('the losing code remains unused when two different codes compete for the last quota', async () => {
    const f = await fixture(1);
    const second = await prisma.promotionCodeInstance.create({ data: { promotionId: f.promotion.id, code: 'PRIVATE_TWO' } });
    const other = await createUser('TRAVELER', 'other@example.com');
    const results = await Promise.all([book(f), book(f, other.token, { promotionCode: second.code })]);
    expect(results.filter((res) => res.status === 201)).toHaveLength(1);
    expect(results.filter((res) => res.status === 409)).toHaveLength(1);
    expect(await prisma.promotionCodeInstance.count({ where: { isUsed: true } })).toBe(1);
    expect(await prisma.promotionCodeInstance.count({ where: { isUsed: false, bookingId: null } })).toBe(1);
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(1);
  });

  it('retries the entire transaction after a real booking-code uniqueness violation', async () => {
    const f = await fixture();
    const first = await book(f, f.traveler.token, { promotionCode: undefined });
    expect(first.status).toBe(201);
    const create = bookingsRepository.create.bind(bookingsRepository);
    const spy = vi.spyOn(bookingsRepository, 'create').mockImplementationOnce((data, tx) => create({ ...data, bookingCode: first.body.data.bookingCode }, tx));
    const response = await book(f);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(await prisma.booking.count()).toBe(2);
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(1);
    expect((await loadTour(f.tourId))!.departures[0]!.remaining).toBe(48);
  });

  it('notification failure after commit does not release codes, quota or inventory', async () => {
    const f = await fixture();
    vi.spyOn(notificationsService, 'notify').mockRejectedValueOnce(new Error('injected notification failure'));
    expect((await book(f)).status).toBe(201);
    expect(await prisma.booking.count()).toBe(1);
    expect((await prisma.promotionCodeInstance.findUnique({ where: { id: f.instance.id } }))!.isUsed).toBe(true);
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(1);
    expect((await loadTour(f.tourId))!.departures[0]!.remaining).toBe(49);
  });

  it('cancel restores the code exactly once; stale cleanup cannot release its next booking', async () => {
    const f = await fixture();
    const first = await book(f);
    expect(first.status).toBe(201);
    const results = await Promise.all(Array.from({ length: 4 }, () => cancel(f, first.body.data.id)));
    expect(results.filter((res) => res.status === 200)).toHaveLength(1);
    expect((await prisma.promotionCodeInstance.findUnique({ where: { id: f.instance.id } }))!.isUsed).toBe(false);
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(0);
    const second = await book(f);
    expect(second.status).toBe(201);
    const released = await runInTransaction((tx) => promotionsRepository.releaseCodeInstance(f.instance.id, first.body.data.id, tx));
    expect(released).toBe(false);
    expect(await prisma.promotionCodeInstance.findUnique({ where: { id: f.instance.id } })).toMatchObject({ isUsed: true, bookingId: second.body.data.id });
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(1);
  });

  it('expiry restores a pending code, while a confirmed booking retains it', async () => {
    const f = await fixture();
    const first = await book(f);
    await prisma.booking.update({ where: { id: first.body.data.id }, data: { paymentExpiresAt: new Date(Date.now() - 1000) } });
    expect(await bookingsService.expirePendingBookings()).toBe(1);
    expect(await bookingsService.expirePendingBookings()).toBe(0);
    expect((await prisma.promotionCodeInstance.findUnique({ where: { id: f.instance.id } }))!.isUsed).toBe(false);
    const second = await book(f);
    await prisma.booking.update({ where: { id: second.body.data.id }, data: { status: 'CONFIRMED', isPaid: true } });
    expect(await bookingsService.expirePendingBookings()).toBe(0);
    expect((await prisma.promotionCodeInstance.findUnique({ where: { id: f.instance.id } }))!.bookingId).toBe(second.body.data.id);
  });

  it('cancelling two stacked unique vouchers restores both codes and counters', async () => {
    const f = await fixture();
    const platform = await prisma.promotion.create({ data: {
      code: 'PLATFORM_BATCH', title: 'Platform batch', scope: 'PLATFORM', createdById: f.agency.id,
      codeType: 'UNIQUE_BATCH', discountType: 'FIXED', discountValue: 50_000,
      startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + day),
    } });
    const code = await prisma.promotionCodeInstance.create({ data: { promotionId: platform.id, code: 'PLATFORM_PRIVATE' } });
    const response = await book(f, f.traveler.token, { agencyPromotionCode: f.instance.code, platformPromotionCode: code.code });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data.totalAmount).toBe(850_000);
    expect(await prisma.promotionCodeInstance.count({ where: { bookingId: response.body.data.id, isUsed: true } })).toBe(2);
    expect((await cancel(f, response.body.data.id)).status).toBe(200);
    expect(await prisma.promotionCodeInstance.count({ where: { isUsed: true } })).toBe(0);
    expect((await prisma.promotion.findMany()).every((promo) => promo.usedCount === 0)).toBe(true);
  });

  it('rolls cancellation and code release back together when counter release fails', async () => {
    const f = await fixture();
    const booked = await book(f);
    vi.spyOn(promotionsRepository, 'release').mockRejectedValueOnce(new Error('injected release failure'));
    expect((await cancel(f, booked.body.data.id)).status).toBe(500);
    expect((await prisma.booking.findUnique({ where: { id: booked.body.data.id } }))!.status).toBe('PENDING');
    expect((await prisma.promotionCodeInstance.findUnique({ where: { id: f.instance.id } }))!.isUsed).toBe(true);
    expect((await prisma.promotion.findUnique({ where: { id: f.promotion.id } }))!.usedCount).toBe(1);
    expect((await loadTour(f.tourId))!.departures[0]!.remaining).toBe(49);
  });
});
