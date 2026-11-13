import { describe, expect, it, vi } from 'vitest';
import { DISCOUNT_TYPE, PROMOTION_CODE_TYPE, PROMOTION_SCOPE, ROLES } from '@travel-platform/constants';
import { computeDiscount, assertApplicable } from '../promotions.policy';
import { PromotionsService } from '../promotions.service';
import type { ConsumePromotionResult } from '../promotions.repository';

const DAY = 24 * 60 * 60 * 1000;
const ago = (d: number) => new Date(Date.now() - d * DAY);
const ahead = (d: number) => new Date(Date.now() + d * DAY);

type P = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function promo(over: P = {}): P {
  return {
    id: 'p1',
    scope: PROMOTION_SCOPE.AGENCY,
    ownerId: 'a1',
    code: 'SUMMER10',
    title: 'Summer',
    discountType: DISCOUNT_TYPE.PERCENT,
    discountValue: 10,
    minOrderAmount: 0,
    startsAt: ago(1),
    endsAt: ahead(5),
    usedCount: 0,
    isActive: true,
    ...over,
  };
}

function make(seed: P[] = [], tourAgency = 'a1') {
  const db = [...seed];
  const repo = {
    create: vi.fn(async (data: P) => {
      const doc = { id: `p${db.length + 1}`, usedCount: 0, isActive: true, ...data };
      db.push(doc);
      return doc;
    }),
    findById: vi.fn(async (id: string) => db.find((p) => p.id === id) ?? null),
    findByCode: vi.fn(async (code: string) => db.find((p) => p.code === code.toUpperCase()) ?? null),
    updateById: vi.fn(async (id: string, patch: P) => {
      const doc = db.find((p) => p.id === id);
      if (doc) Object.assign(doc, patch);
      return doc ?? null;
    }),
    list: vi.fn(async () => ({ items: db, total: db.length })),
    consume: vi.fn(async (): Promise<boolean | ConsumePromotionResult> => true),
    release: vi.fn(async () => undefined),
    countUserUsages: vi.fn(async () => 0),
  };
  const tours = { getTourFacts: vi.fn(async (id: string) => (id === 'ghost' ? null : { id, agencyId: tourAgency })) };
  const audit = { record: vi.fn(async () => undefined) };
  return { service: new PromotionsService(repo as never, tours as never, audit), repo, audit, db };
}

const agency = { userId: 'a1', role: ROLES.AGENCY } as const;
const admin = { userId: 's1', role: ROLES.SUPER_ADMIN } as const;
const input = {
  code: 'NEWCODE',
  title: 'New promo',
  discountType: DISCOUNT_TYPE.PERCENT,
  discountValue: 15,
  startsAt: ago(0),
  endsAt: ahead(10),
};

it('uses active agency as promotion owner while preserving the member as creator', async () => {
  const { service, repo } = make();
  await service.createForAgency({ userId: 'member-1', agencyId: 'a1', role: ROLES.AGENCY }, input);
  expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'a1', createdById: 'member-1' }));
});

describe('computeDiscount', () => {
  it('floors PERCENT discounts to whole VND and applies the cap', () => {
    expect(computeDiscount({ discountType: 'PERCENT', discountValue: 10, maxDiscountAmount: null }, 1_234_567)).toBe(123_456);
    expect(computeDiscount({ discountType: 'PERCENT', discountValue: 50, maxDiscountAmount: 100_000 }, 1_000_000)).toBe(100_000);
  });

  it('never exceeds the order for FIXED discounts', () => {
    expect(computeDiscount({ discountType: 'FIXED', discountValue: 500_000, maxDiscountAmount: null }, 300_000)).toBe(300_000);
  });
});

describe('assertApplicable', () => {
  const ctx = { agencyId: 'a1', subtotal: 1_000_000 };
  it.each([
    ['inactive', { isActive: false }, 'PROMOTION_INACTIVE'],
    ['not started', { startsAt: ahead(1) }, 'PROMOTION_NOT_STARTED'],
    ['expired', { endsAt: ago(1) }, 'PROMOTION_EXPIRED'],
    ['other agency', { ownerId: 'a2' }, 'PROMOTION_NOT_APPLICABLE'],
    ['below minimum', { minOrderAmount: 2_000_000 }, 'PROMOTION_MIN_ORDER'],
    ['exhausted', { usageLimit: 5, usedCount: 5 }, 'PROMOTION_EXHAUSTED'],
  ])('rejects %s', (_label, over, code) => {
    expect(() => assertApplicable(promo(over) as never, ctx)).toThrowError(expect.objectContaining({ code, statusCode: 409 }));
  });

  it('accepts a platform promotion on any agency\'s tour', () => {
    expect(() => assertApplicable(promo({ scope: PROMOTION_SCOPE.PLATFORM, ownerId: undefined }) as never, { agencyId: 'zzz', subtotal: 1 })).not.toThrow();
  });
});

describe('create / update', () => {
  it('creates an agency promotion owned by the caller; no audit for agency scope', async () => {
    const { service, repo, audit } = make();
    await service.createForAgency(agency, input);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ scope: 'AGENCY', ownerId: 'a1', createdById: 'a1' }));
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('audits platform promotion changes', async () => {
    const { service, audit } = make();
    await service.createForPlatform(admin, input);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'promotion.platform_changed' }));
  });

  it('rejects duplicate codes, bad windows, bad percentages and cap on FIXED', async () => {
    const { service } = make([promo({ code: 'NEWCODE' })]);
    await expect(service.createForAgency(agency, input)).rejects.toMatchObject({ code: 'PROMOTION_CODE_EXISTS' });
    const fresh = make().service;
    await expect(fresh.createForAgency(agency, { ...input, endsAt: ago(1), startsAt: ago(3) })).rejects.toMatchObject({ statusCode: 400 });
    await expect(fresh.createForAgency(agency, { ...input, startsAt: ahead(5), endsAt: ahead(2) })).rejects.toMatchObject({ statusCode: 400 });
    await expect(fresh.createForAgency(agency, { ...input, discountValue: 150 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      fresh.createForAgency(agency, { ...input, discountType: DISCOUNT_TYPE.FIXED, discountValue: 50_000, maxDiscountAmount: 10_000 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('hides other agencies\' promotions and the wrong scope behind 404', async () => {
    const { service } = make([promo(), promo({ id: 'p2', scope: PROMOTION_SCOPE.PLATFORM, ownerId: undefined })]);
    await expect(service.updateForAgency({ userId: 'a2', role: ROLES.AGENCY }, 'p1', { title: 'Hijack' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.updateForAgency(agency, 'p2', { title: 'Wrong scope' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getForPlatform('p1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('locks the discount once used, and keeps usageLimit >= usedCount', async () => {
    const { service } = make([promo({ usedCount: 3 })]);
    await expect(service.updateForAgency(agency, 'p1', { discountValue: 20 })).rejects.toMatchObject({ code: 'PROMOTION_IN_USE' });
    await expect(service.updateForAgency(agency, 'p1', { usageLimit: 2 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.updateForAgency(agency, 'p1', { isActive: false })).resolves.toMatchObject({ isActive: false });
  });

  it('validates the merged window on update', async () => {
    const { service } = make([promo()]);
    await expect(service.updateForAgency(agency, 'p1', { endsAt: ago(5) })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('locks immutable fields for active started promotions (PAY-019)', async () => {
    // Promotion has started (startsAt in past) and 0 usedCount
    const { service } = make([promo({ startsAt: ago(2), endsAt: ahead(5), usedCount: 0, discountValue: 10, minOrderAmount: 100_000 })]);

    // Modifying discountValue should be rejected with 400 Bad Request
    await expect(service.updateForAgency(agency, 'p1', { discountValue: 15 })).rejects.toMatchObject({
      statusCode: 400,
      code: 'PROMOTION_ACTIVE_LOCKED',
    });

    // Modifying minOrderAmount should be rejected with 400 Bad Request
    await expect(service.updateForAgency(agency, 'p1', { minOrderAmount: 200_000 })).rejects.toMatchObject({
      statusCode: 400,
      code: 'PROMOTION_ACTIVE_LOCKED',
    });

    // Modifying startsAt should be rejected with 400 Bad Request
    await expect(service.updateForAgency(agency, 'p1', { startsAt: ago(3) })).rejects.toMatchObject({
      statusCode: 400,
      code: 'PROMOTION_ACTIVE_LOCKED',
    });

    // Modifying allowed fields (title, endsAt, isActive) should succeed
    const updated = await service.updateForAgency(agency, 'p1', {
      title: 'Extended Summer Sale',
      endsAt: ahead(10),
      isActive: true,
    });
    expect(updated.title).toBe('Extended Summer Sale');

    // Promotion that has NOT started yet (startsAt in future) allows modifying discountValue and minOrderAmount
    const futureService = make([promo({ id: 'p2', startsAt: ahead(2), endsAt: ahead(10), usedCount: 0, discountValue: 10 })]).service;
    const futureUpdated = await futureService.updateForAgency(agency, 'p2', { discountValue: 25, minOrderAmount: 50_000 });
    expect(futureUpdated.discountValue).toBe(25);
    expect(futureUpdated.minOrderAmount).toBe(50_000);
  });
});

describe('preview / redeem (used by bookings)', () => {
  it('previews the discount without consuming a redemption', async () => {
    const { service, repo } = make([promo()]);
    const result = await service.preview('summer10', 't1', 2_000_000);
    expect(result).toMatchObject({ discountAmount: 200_000, finalAmount: 1_800_000, code: 'SUMMER10' });
    expect(repo.consume).not.toHaveBeenCalled();
  });

  it('redeem consumes one redemption atomically', async () => {
    const { service, repo } = make([promo()]);
    const applied = await service.redeem('SUMMER10', 't1', 1_000_000);
    expect(applied).toEqual({ promotionId: 'p1', code: 'SUMMER10', scope: 'AGENCY', discountAmount: 100_000 });
    expect(repo.consume).toHaveBeenCalledWith('p1');
  });

  it('redeem fails cleanly when the atomic consume loses the race', async () => {
    const { service, repo } = make([promo({ usageLimit: 1 })]);
    repo.consume.mockResolvedValueOnce(false as never);
    await expect(service.redeem('SUMMER10', 't1', 1_000_000)).rejects.toMatchObject({ code: 'PROMOTION_EXHAUSTED' });
  });

  it('enforces atomic single-winner quota under 20 concurrent requests (PAY-017)', async () => {
    const { service, repo } = make([promo({ usageLimit: 1, usedCount: 0 })]);
    let consumedCount = 0;
    repo.consume.mockImplementation(async () => {
      if (consumedCount === 0) {
        consumedCount += 1;
        return { success: true };
      }
      return { success: false, reason: 'EXHAUSTED' };
    });

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => service.redeem('SUMMER10', 't1', 1_000_000)),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(19);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ code: 'PROMOTION_EXHAUSTED' });
    }
  });

  it('enforces atomic user usage limit in transaction when limit reached (PAY-017)', async () => {
    const { service, repo } = make([promo({ usageLimitPerUser: 1 })]);
    repo.consume.mockResolvedValueOnce({ success: false, reason: 'USER_LIMIT_REACHED' });

    await expect(service.redeem('SUMMER10', 't1', 1_000_000, { userId: 'u1' })).rejects.toMatchObject({
      code: 'PROMOTION_USER_LIMIT_REACHED',
    });
    expect(repo.consume).toHaveBeenCalledWith('p1', 'u1');
  });

  it('refuses another agency\'s code for this tour, and unknown codes/tours', async () => {
    const { service } = make([promo({ ownerId: 'a2' })]);
    await expect(service.preview('SUMMER10', 't1', 1_000_000)).rejects.toMatchObject({ code: 'PROMOTION_NOT_APPLICABLE' });
    await expect(service.preview('NOPE', 't1', 1)).rejects.toMatchObject({ statusCode: 404 });
    await expect(make([promo()]).service.preview('SUMMER10', 'ghost', 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('release gives the redemption back', async () => {
    const { service, repo } = make();
    await service.release('p1');
    expect(repo.release).toHaveBeenCalledWith('p1');
  });
});

describe('sweepExpiringVouchers (smart leisure-slot alert)', () => {
  it('dispatches notifications during the user leisure time slot', async () => {
    const notify = vi.fn(async () => undefined);
    const hasRecentVoucherAlert = vi.fn(async () => false);
    const users = {
      getPreferences: vi.fn(async () => ({
        freeTimeSlots: [{ id: 'slot_1', name: 'Nghỉ trưa', start: '11:45', end: '13:00', enabled: true }],
        voucherExpiryAlerts: true,
        emailAlerts: false,
      })),
    };
    const repo = {
      findExpiringUserVouchers: vi.fn(async () => [
        {
          id: 'v1',
          userId: 'u1',
          promotion: promo({ title: 'Flash 20%', endsAt: ahead(1) }),
        },
      ]),
    };
    const service = new PromotionsService(repo as never, {} as never, {} as never, { notify, hasRecentVoucherAlert } as never, users as never);

    // Mock date to 12:15 VN time (UTC 05:15)
    const testDate = new Date('2026-10-22T05:15:00.000Z');
    const sent = await service.sweepExpiringVouchers(testDate);
    expect(sent).toBe(1);
    expect(notify).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        type: 'VOUCHER_EXPIRING_SOON',
        title: expect.stringContaining('Ưu đãi giờ rảnh'),
      }),
      expect.any(Object),
    );
  });

  it('skips dispatching outside user free-time slots when not urgent', async () => {
    const notify = vi.fn(async () => undefined);
    const hasRecentVoucherAlert = vi.fn(async () => false);
    const users = {
      getPreferences: vi.fn(async () => ({
        freeTimeSlots: [{ id: 'slot_1', name: 'Nghỉ trưa', start: '11:45', end: '13:00', enabled: true }],
        voucherExpiryAlerts: true,
        emailAlerts: false,
      })),
    };
    const repo = {
      findExpiringUserVouchers: vi.fn(async () => [
        {
          id: 'v1',
          userId: 'u1',
          promotion: promo({ title: 'Flash 20%', endsAt: ahead(1) }),
        },
      ]),
    };
    const service = new PromotionsService(repo as never, {} as never, {} as never, { notify, hasRecentVoucherAlert } as never, users as never);

    // Mock date to 09:00 VN time (UTC 02:00)
    const testDate = new Date('2026-10-22T02:00:00.000Z');
    const sent = await service.sweepExpiringVouchers(testDate);
    expect(sent).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('triggers urgent alert when voucher expires in less than 3 hours even outside leisure slots', async () => {
    const notify = vi.fn(async () => undefined);
    const hasRecentVoucherAlert = vi.fn(async () => false);
    const users = {
      getPreferences: vi.fn(async () => ({
        freeTimeSlots: [{ id: 'slot_1', name: 'Nghỉ trưa', start: '11:45', end: '13:00', enabled: true }],
        voucherExpiryAlerts: true,
        emailAlerts: false,
      })),
    };
    const testDate = new Date('2026-10-22T02:00:00.000Z');
    const repo = {
      findExpiringUserVouchers: vi.fn(async () => [
        {
          id: 'v1',
          userId: 'u1',
          promotion: promo({ title: 'Flash 20%', endsAt: new Date(testDate.getTime() + 2 * 60 * 60 * 1000) }),
        },
      ]),
    };
    const service = new PromotionsService(repo as never, {} as never, {} as never, { notify, hasRecentVoucherAlert } as never, users as never);

    const sent = await service.sweepExpiringVouchers(testDate);
    expect(sent).toBe(1);
    expect(notify).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        type: 'VOUCHER_EXPIRING_URGENT',
        title: expect.stringContaining('Cơ hội cuối'),
      }),
      expect.any(Object),
    );
  });

  it('lists active public agency promotions for storefront, excluding expired and UNIQUE_BATCH', async () => {
    const now = new Date();
    const repo = {
      list: vi.fn(async () => ({
        items: [
          promo({ id: 'p1', ownerId: 'a1', title: 'Agency 10%', isActive: true, codeType: PROMOTION_CODE_TYPE.SHARED, startsAt: new Date(now.getTime() - 10000), endsAt: new Date(now.getTime() + 100000) }),
          promo({ id: 'p2', ownerId: 'a1', title: 'Expired 20%', isActive: true, codeType: PROMOTION_CODE_TYPE.SHARED, startsAt: new Date(now.getTime() - 20000), endsAt: new Date(now.getTime() - 1000) }),
          promo({ id: 'p3', ownerId: 'a1', title: 'Batch VIP', isActive: true, codeType: PROMOTION_CODE_TYPE.UNIQUE_BATCH, startsAt: new Date(now.getTime() - 10000), endsAt: new Date(now.getTime() + 100000) }),
        ],
        total: 3,
      })),
    };
    const service = new PromotionsService(repo as never, {} as never, {} as never, {} as never, {} as never);
    const result = await service.listPublicAgencyPromotions('a1');

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Agency 10%');
    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'AGENCY', ownerId: 'a1', isActive: true }),
      { page: 1, limit: 50 },
    );
  });

  it('rejects batch prefix directly without an individual code instance', async () => {
    const batchPromo = promo({
      id: 'p-batch',
      code: 'TEST',
      codeType: PROMOTION_CODE_TYPE.UNIQUE_BATCH,
      isActive: true,
      startsAt: new Date(Date.now() - 10000),
      endsAt: new Date(Date.now() + 100000),
    });
    const repo = {
      findByCode: vi.fn(async () => ({ promotion: batchPromo })), // no codeInstance
    };
    const tours = {
      getTourFacts: vi.fn(async () => ({ agencyId: 'a1' })),
    };
    const service = new PromotionsService(repo as never, tours as never, {} as never, {} as never, {} as never);

    await expect(service.preview('TEST', 'tour-1', 1000000)).rejects.toThrowError(
      expect.objectContaining({ details: 'PROMOTION_BATCH_PREFIX_NOT_USABLE', statusCode: 400 }),
    );
  });

  it('archives a promotion and rejects archived promotion code on resolve', async () => {
    const { service } = make([promo({ id: 'p1', code: 'OLDPROMO', isArchived: false, isActive: true })]);

    // Archive the promotion
    const updated = await service.updateForAgency(agency as any, 'p1', { isArchived: true });
    expect(updated.isArchived).toBe(true);
    expect(updated.isActive).toBe(false);

    // Resolving archived code should be rejected
    await expect(service.preview('OLDPROMO', 'tour-1', 500000)).rejects.toThrowError(
      expect.objectContaining({ details: 'PROMOTION_ARCHIVED', statusCode: 400 }),
    );
  });
});
