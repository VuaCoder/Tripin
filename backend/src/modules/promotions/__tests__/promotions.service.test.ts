import { describe, expect, it, vi } from 'vitest';
import { DISCOUNT_TYPE, PROMOTION_SCOPE, ROLES } from '@travel-platform/constants';
import { computeDiscount, assertApplicable } from '../promotions.policy';
import { PromotionsService } from '../promotions.service';

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
    updateById: vi.fn(async (id: string, update: { $set: P }) => {
      const doc = db.find((p) => p.id === id);
      if (doc) Object.assign(doc, update.$set);
      return doc ?? null;
    }),
    list: vi.fn(async () => ({ items: db, total: db.length })),
    consume: vi.fn(async () => true),
    release: vi.fn(async () => undefined),
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

describe('computeDiscount', () => {
  it('floors PERCENT discounts to whole VND and applies the cap', () => {
    expect(computeDiscount({ discountType: 'PERCENT', discountValue: 10, maxDiscountAmount: undefined }, 1_234_567)).toBe(123_456);
    expect(computeDiscount({ discountType: 'PERCENT', discountValue: 50, maxDiscountAmount: 100_000 }, 1_000_000)).toBe(100_000);
  });

  it('never exceeds the order for FIXED discounts', () => {
    expect(computeDiscount({ discountType: 'FIXED', discountValue: 500_000, maxDiscountAmount: undefined }, 300_000)).toBe(300_000);
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
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ scope: 'AGENCY', ownerId: 'a1', createdBy: 'a1' }));
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
