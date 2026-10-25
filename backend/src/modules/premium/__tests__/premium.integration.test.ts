import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
vi.hoisted(() => {
  process.env.PAYOS_CLIENT_ID = 'test-client';
  process.env.PAYOS_API_KEY = 'test-api-key';
  process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';
});
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import {
  bearer,
  createApprovedTour,
  createUser,
  resetDatabase,
  signedPayosWebhook,
  startDatabase,
  stopDatabase,
  stubPayosApi,
} from '../../../test/integration';
import { premiumRepository as repo } from '../premium.repository';
import { usersRepository } from '../../users/users.repository';
const app = createApp();
beforeAll(startDatabase, 120000);
afterAll(stopDatabase);
beforeEach(async () => {
  await resetDatabase();
  stubPayosApi();
});
const day = 86400000;
async function fixture(capacity = 20, quantity = 2) {
  const agency = await createUser('AGENCY', 'agency@test.com');
  const traveler = await createUser('TRAVELER', 'traveler@test.com');
  const tour = await createApprovedTour(agency.id);
  const source = await repo.contribute(agency.id, {
    acceptedTerms: true,
    title: 'Ưu đãi Premium',
    tourIds: [tour.tourId],
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscountAmount: 100000,
    minOrderAmount: 100000,
    capacity,
  });
  await repo.decideContribution(source.id, 'APPROVED');
  const plan = await repo.createPlan({
    code: 'PREMIUM_30',
    name: 'Premium 30 ngày',
    audience: 'TRAVELER',
    price: 99000,
    durationDays: 30,
    version: 1,
    benefits: ['Voucher theo kỳ'],
    vouchers: [{ contributionId: source.id, quantity }],
  });
  await repo.publishPlan(plan.id, true);
  await prisma.systemSetting.create({
    data: { key: 'premium.enabled.TRAVELER', value: true },
  });
  return { agency, traveler, tour, source, plan };
}
async function purchase(f: Awaited<ReturnType<typeof fixture>>) {
  const s = await repo.pending(f.traveler.id, 'TRAVELER', f.plan.id);
  await repo.activate(s.id, f.traveler.id);
  await repo.grantDue();
  return s;
}
describe('Premium end-to-end and invariants', () => {
  it('paginates own periods and reads the exact callback period without exposing another account', async () => {
    const f = await fixture();
    await purchase(f);
    const next = await repo.pending(f.traveler.id, 'TRAVELER', f.plan.id);
    await repo.activate(next.id, f.traveler.id);
    const page = await request(app)
      .get('/api/v1/premium/me/history?page=2&limit=1')
      .set(bearer(f.traveler.token));
    expect(page.status).toBe(200);
    expect(page.body.meta.total).toBe(2);
    expect(page.body.data).toHaveLength(1);
    expect(
      (
        await request(app)
          .get(`/api/v1/premium/subscriptions/${next.id}`)
          .set(bearer(f.traveler.token))
      ).body.data.id,
    ).toBe(next.id);
    const other = await createUser('TRAVELER', 'other@test.com');
    expect(
      (
        await request(app)
          .get(`/api/v1/premium/subscriptions/${next.id}`)
          .set(bearer(other.token))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get('/api/v1/premium/me/history?limit=1000')
          .set(bearer(f.traveler.token))
      ).status,
    ).toBe(400);
  });
  it('requires explicit Agency consent and Super Admin approval before opening a plan', async () => {
    const agency = await createUser('AGENCY', 'consent@test.com');
    const admin = await createUser('SUPER_ADMIN', 'admin@test.com');
    const tour = await createApprovedTour(agency.id);
    const body = {
      title: 'Voucher đồng hành',
      tourIds: [tour.tourId],
      discountType: 'FIXED',
      discountValue: 100000,
      minOrderAmount: 500000,
      capacity: 10,
    };
    expect(
      (
        await request(app)
          .post('/api/v1/agency/premium/contributions')
          .set(bearer(agency.token))
          .send(body)
      ).status,
    ).toBe(400);
    const submitted = await request(app)
      .post('/api/v1/agency/premium/contributions')
      .set(bearer(agency.token))
      .send({ ...body, acceptedTerms: true });
    expect(submitted.status).toBe(201);
    const sourceId = submitted.body.data.id;
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/premium/contributions/${sourceId}`)
          .set(bearer(admin.token))
          .send({ status: 'APPROVED' })
      ).status,
    ).toBe(200);
    const draft = await request(app)
      .post('/api/v1/admin/premium/plans')
      .set(bearer(admin.token))
      .send({
        code: 'TRAVEL_01',
        name: 'Premium Traveler',
        audience: 'TRAVELER',
        price: 99000,
        durationDays: 30,
        version: 1,
        benefits: ['Voucher theo kỳ'],
        vouchers: [{ contributionId: sourceId, quantity: 1 }],
      });
    expect(draft.status).toBe(201);
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/premium/plans/${draft.body.data.id}`)
          .set(bearer(admin.token))
          .send({ published: true })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get('/api/v1/premium/plans')).body.data,
    ).toHaveLength(0);
    expect(
      (
        await request(app)
          .put('/api/v1/admin/premium/flags')
          .set(bearer(admin.token))
          .send({ audience: 'TRAVELER', enabled: true })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get('/api/v1/premium/plans')).body.data,
    ).toHaveLength(1);
    expect(
      await prisma.auditLog.count({ where: { action: 'premium.changed' } }),
    ).toBe(4);
  });
  it('preserves Guide data on expiration, hides public extras and leaves the basic profile accessible', async () => {
    const guide = await createUser('TOUR_GUIDE', 'pro@test.com');
    const plan = await repo.createPlan({
      code: 'GUIDE_PRO',
      name: 'Premium Guide',
      audience: 'TOUR_GUIDE',
      price: 199000,
      durationDays: 30,
      version: 1,
      benefits: ['Hồ sơ chuyên nghiệp'],
      vouchers: [],
    });
    await repo.publishPlan(plan.id, true);
    const s = await repo.pending(guide.id, 'TOUR_GUIDE', plan.id);
    await repo.activate(s.id, guide.id);
    const profile = {
      introduction: 'Chuyên tour văn hóa Việt Nam',
      portfolio: [{ title: 'Huế', description: 'Tour di sản' }],
      certificates: [
        { name: 'Sơ cứu', issuer: 'Đơn vị đào tạo', issuedAt: '2026-01-01' },
      ],
    };
    expect(
      (
        await request(app)
          .put('/api/v1/premium/guide/profile')
          .set(bearer(guide.token))
          .send(profile)
      ).status,
    ).toBe(200);
    const publicProfile = await request(app).get(
      `/api/v1/premium/guides/${guide.id}`,
    );
    expect(publicProfile.body.data.active).toBe(true);
    expect(JSON.stringify(publicProfile.body.data)).not.toMatch(
      /price|paidAt|endsAt|paymentId/,
    );
    expect(
      (
        await request(app)
          .get('/api/v1/premium/guide/analytics')
          .set(bearer(guide.token))
      ).status,
    ).toBe(200);
    await prisma.subscription.update({
      where: { id: s.id },
      data: { endsAt: new Date(Date.now() - 1) },
    });
    expect(
      (await request(app).get(`/api/v1/premium/guides/${guide.id}`)).body.data
        .profile,
    ).toBeNull();
    expect(
      (
        await request(app)
          .put('/api/v1/premium/guide/profile')
          .set(bearer(guide.token))
          .send(profile)
      ).status,
    ).toBe(403);
    expect(
      (await request(app).get('/api/v1/users/me').set(bearer(guide.token)))
        .status,
    ).toBe(200);
    expect((await repo.guideProfile(guide.id))?.introduction).toBe(
      profile.introduction,
    );
  });
  it('does not turn a Traveler membership into Guide benefits after a role change', async () => {
    const f = await fixture();
    await purchase(f);
    await prisma.user.update({
      where: { id: f.traveler.id },
      data: { role: 'TOUR_GUIDE' },
    });
    expect((await repo.status(f.traveler.id)).active).toBe(false);
    const directory = await usersRepository.listActiveGuides(undefined, {
      page: 1,
      limit: 20,
    });
    expect(
      (directory.items[0] as { premiumActive?: boolean }).premiumActive,
    ).toBe(false);
  });
  it('checkout -> signed webhook grants exactly one set despite parallel replays', async () => {
    const f = await fixture();
    const res = await request(app)
      .post('/api/v1/premium/subscribe')
      .set(bearer(f.traveler.token))
      .send({ planId: f.plan.id });
    expect(res.status).toBe(201);
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: res.body.data.checkout.paymentId },
    });
    const body = signedPayosWebhook(
      Number(payment.providerOrderCode),
      payment.amount,
    );
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post('/api/v1/payments/webhooks/payos').send(body),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await prisma.premiumVoucher.count()).toBe(2);
    expect((await repo.status(f.traveler.id)).active).toBe(true);
    const callback = await request(app)
      .get(`/api/v1/payments/${payment.id}`)
      .set(bearer(f.traveler.token));
    expect(callback.body.data.premium).toBe(true);
  });
  it('never oversells capacity under competing users and rejects wrong role', async () => {
    const f = await fixture(2, 2);
    const other = await createUser('TRAVELER', 'other@test.com');
    const results = await Promise.allSettled([
      repo.pending(f.traveler.id, 'TRAVELER', f.plan.id),
      repo.pending(other.id, 'TRAVELER', f.plan.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (
        await prisma.premiumContribution.findUniqueOrThrow({
          where: { id: f.source.id },
        })
      ).reserved,
    ).toBe(2);
    await expect(
      repo.pending(f.agency.id, 'TOUR_GUIDE', f.plan.id),
    ).rejects.toThrow();
  });
  it('keeps sold terms after Agency stops and grants future renewals only when due', async () => {
    const f = await fixture();
    await purchase(f);
    const renewal = await repo.pending(f.traveler.id, 'TRAVELER', f.plan.id);
    await repo.activate(renewal.id, f.traveler.id);
    await repo.stopContribution(f.source.id, f.agency.id);
    await repo.grantDue();
    expect(await prisma.premiumVoucher.count()).toBe(2);
    const period = await prisma.subscription.findUniqueOrThrow({
      where: { id: renewal.id },
    });
    await repo.grantDue(new Date(period.startsAt!.getTime() + 1));
    await repo.grantDue(new Date(period.startsAt!.getTime() + 1));
    expect(await prisma.premiumVoucher.count()).toBe(4);
    await expect(
      repo.pending(f.traveler.id, 'TRAVELER', f.plan.id),
    ).rejects.toThrow();
  });
  it('serializes renewals from different plans with no overlap', async () => {
    const f = await fixture();
    await purchase(f);
    const second = await repo.createPlan({
      code: 'OTHER_30',
      name: 'Premium khác',
      audience: 'TRAVELER',
      price: 99000,
      durationDays: 30,
      version: 2,
      benefits: ['Voucher'],
      vouchers: [{ contributionId: f.source.id, quantity: 2 }],
    });
    await repo.publishPlan(second.id, true);
    const a = await repo.pending(f.traveler.id, 'TRAVELER', f.plan.id),
      b = await repo.pending(f.traveler.id, 'TRAVELER', second.id);
    await Promise.all([
      repo.activate(a.id, f.traveler.id),
      repo.activate(b.id, f.traveler.id),
    ]);
    const periods = await prisma.subscription.findMany({
      where: { userId: f.traveler.id, status: 'ACTIVE' },
      orderBy: { startsAt: 'asc' },
    });
    expect(periods[1]!.startsAt).toEqual(periods[0]!.endsAt);
    expect(periods[2]!.startsAt).toEqual(periods[1]!.endsAt);
    expect(new Date((await repo.status(f.traveler.id)).endsAt!).getTime()).toBe(
      periods[2]!.endsAt!.getTime(),
    );
  });
  it('owns voucher leases and atomically attaches one booking; cancellation releases once', async () => {
    const f = await fixture();
    await purchase(f);
    const [v] = await repo.vouchers(f.traveler.id);
    const other = await createUser('TRAVELER', 'other@test.com');
    await expect(
      repo.reserveVoucher(v!.id, other.id, f.agency.id, f.tour.tourId, 1000000),
    ).rejects.toThrow();
    const body = {
      tourId: f.tour.tourId,
      departureId: f.tour.departureId,
      participants: 1,
      contact: { fullName: 'Test Traveler', phone: '0901234567' },
      premiumVoucherId: v!.id,
    };
    const results = await Promise.all([
      request(app)
        .post('/api/v1/bookings')
        .set(bearer(f.traveler.token))
        .send(body),
      request(app)
        .post('/api/v1/bookings')
        .set(bearer(f.traveler.token))
        .send(body),
    ]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const booking = results.find((r) => r.status === 201)!.body.data;
    expect(booking.totalAmount).toBe(900000);
    await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set(bearer(f.traveler.token))
      .send({});
    await repo.releaseBookingVoucher(booking.id);
    expect(
      (await prisma.premiumVoucher.findUniqueOrThrow({ where: { id: v!.id } }))
        .heldAt,
    ).toBeNull();
    const bad = await request(app)
      .post('/api/v1/bookings')
      .set(bearer(f.traveler.token))
      .send({ ...body, promotionCode: 'OTHER' });
    expect(bad.status).toBe(400);
  });
  it('refunds a future period once, releases commitment and cannot reactivate it', async () => {
    const f = await fixture();
    const first = await purchase(f);
    await expect(
      repo.requestRefund(f.traveler.id, first.id, 'Không sử dụng nữa'),
    ).rejects.toThrow();
    const next = await repo.pending(f.traveler.id, 'TRAVELER', f.plan.id);
    await repo.activate(next.id, f.traveler.id);
    const admin = await createUser('SUPER_ADMIN', 'admin@test.com');
    const refund = await repo.requestRefund(
      f.traveler.id,
      next.id,
      'Không sử dụng nữa',
    );
    await repo.decideRefund(refund.id, admin.id, 'APPROVE', 'Đủ điều kiện');
    await repo.activate(next.id, f.traveler.id);
    expect(
      (await prisma.subscription.findUniqueOrThrow({ where: { id: next.id } }))
        .revokedAt,
    ).not.toBeNull();
    await repo.decideRefund(
      refund.id,
      admin.id,
      'COMPLETE',
      'Đã chuyển khoản',
      'BANK-123',
    );
    await repo.decideRefund(
      refund.id,
      admin.id,
      'COMPLETE',
      'Lặp lại',
      'BANK-123',
    );
    expect(
      (
        await prisma.premiumContribution.findUniqueOrThrow({
          where: { id: f.source.id },
        })
      ).reserved,
    ).toBe(2);
    expect(await prisma.premiumVoucher.count()).toBe(2);
  });
  it('releases abandoned holds and late money becomes a refund instead of taking capacity', async () => {
    const f = await fixture();
    const s = await repo.pending(f.traveler.id, 'TRAVELER', f.plan.id);
    await repo.releaseExpiredHolds(new Date(Date.now() + day));
    expect(
      (
        await prisma.premiumContribution.findUniqueOrThrow({
          where: { id: f.source.id },
        })
      ).reserved,
    ).toBe(0);
    await repo.activate(s.id, f.traveler.id);
    expect((await repo.status(f.traveler.id)).active).toBe(false);
    expect(
      (
        await prisma.premiumRefund.findUniqueOrThrow({
          where: { subscriptionId: s.id },
        })
      ).status,
    ).toBe('APPROVED');
  });
  it('ranks paid Guides before pagination, expires by time and preserves legacy plans', async () => {
    const a = await createUser('TOUR_GUIDE', 'a@test.com', {
      fullName: 'A Guide',
    });
    const z = await createUser('TOUR_GUIDE', 'z@test.com', {
      fullName: 'Z Guide',
    });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        code: 'GUIDE',
        name: 'Guide Premium',
        price: 100,
        durationDays: 30,
        isPremium: true,
        audience: 'TOUR_GUIDE',
      },
    });
    const s = await prisma.subscription.create({
      data: {
        userId: z.id,
        planId: plan.id,
        planCode: 'GUIDE',
        planName: 'Premium',
        price: 100,
        durationDays: 30,
        isPremium: true,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - day),
        endsAt: new Date(Date.now() + day),
      },
    });
    expect(
      (await usersRepository.listActiveGuides(undefined, { page: 1, limit: 1 }))
        .items[0]!.id,
    ).toBe(z.id);
    await prisma.subscription.update({
      where: { id: s.id },
      data: { endsAt: new Date(Date.now() - 1) },
    });
    expect(
      (await usersRepository.listActiveGuides(undefined, { page: 1, limit: 1 }))
        .items[0]!.id,
    ).toBe(a.id);
    expect((await repo.status(z.id)).expired).toBe(true);
    const legacy = await prisma.subscriptionPlan.create({
      data: { code: 'OLD', name: 'Legacy', price: 100, durationDays: 30 },
    });
    expect(legacy.isPremium).toBe(false);
  });
  it('denies management, forged role/price and cross-account data', async () => {
    const f = await fixture();
    await purchase(f);
    expect(
      (
        await request(app)
          .get('/api/v1/admin/premium/plans')
          .set(bearer(f.traveler.token))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/premium/subscribe')
          .set(bearer(f.traveler.token))
          .send({ planId: f.plan.id, price: 1 })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .put('/api/v1/premium/guide/profile')
          .set(bearer(f.traveler.token))
          .send({})
      ).status,
    ).toBe(403);
    const other = await createUser('TRAVELER', 'other@test.com');
    const list = await request(app)
      .get('/api/v1/premium/me/vouchers')
      .set(bearer(other.token));
    expect(list.body.data).toHaveLength(0);
    expect((await request(app).get('/api/v1/premium/me')).status).toBe(401);
  });
});
