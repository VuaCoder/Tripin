import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isUniqueViolation, nullIfNotFound, prisma } from '../database';
import { createUser, resetDatabase, startDatabase, stopDatabase } from '../../test/integration';
import { toursRepository } from '../../modules/tours/tours.repository';
import { usersRepository } from '../../modules/users/users.repository';

// What the services rely on from the database layer, checked against a real PostgreSQL (not a fake error).
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

describe('unique violations', () => {
  it('are recognised, and attributed to the column that clashed', async () => {
    await createUser('TRAVELER', 'dup@example.com');
    const error = await prisma.user.create({ data: { email: 'dup@example.com', fullName: 'Again' } }).catch((e: unknown) => e);
    expect(isUniqueViolation(error)).toBe(true);
    expect(isUniqueViolation(error, 'email')).toBe(true);
    expect(isUniqueViolation(error, 'googleId')).toBe(false);
  });

  it('name the right column for a composite key and for a partial unique index', async () => {
    const user = await createUser('TRAVELER', 't@example.com');
    const first = { userId: user.id, tourId: '11111111-1111-4111-8111-111111111111' };
    await prisma.wishlistItem.create({ data: first });
    const composite = await prisma.wishlistItem.create({ data: first }).catch((e: unknown) => e);
    expect(isUniqueViolation(composite, 'tourId')).toBe(true);

    // One PENDING payment per (purpose, referenceId): enforced by a partial unique index from the migration SQL.
    const payment = (order: number) =>
      prisma.payment.create({
        data: {
          purpose: 'BOOKING',
          userId: user.id,
          referenceId: '22222222-2222-4222-8222-222222222222',
          amount: 100_000,
          description: 'x',
          provider: 'PAYOS',
          providerOrderCode: BigInt(order),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    await payment(1);
    const partial = await payment(2).catch((e: unknown) => e);
    expect(isUniqueViolation(partial, 'referenceId')).toBe(true);
    expect(isUniqueViolation(partial, 'providerOrderCode')).toBe(false);
    const sameOrderCode = await payment(1).catch((e: unknown) => e);
    expect(isUniqueViolation(sameOrderCode, 'providerOrderCode')).toBe(true);
  });

  it('a missing row on update becomes null instead of an exception', async () => {
    const missing = await prisma.category
      .update({ where: { id: '33333333-3333-4333-8333-333333333333' }, data: { name: 'x' } })
      .catch(nullIfNotFound);
    expect(missing).toBeNull();
  });
});

describe('text search', () => {
  it('matches case-insensitively and treats user input as data, never as a pattern', async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    for (const title of ['Ha Long Bay', 'Sapa 100% fun', 'Hue_city walk']) {
      await prisma.tour.create({ data: { agencyId: agency.id, title, destination: 'VN', durationDays: 1, basePrice: 1, status: 'APPROVED' } });
    }
    const search = async (q: string) => (await toursRepository.searchPublic({ page: 1, limit: 20, sort: 'newest', q })).items.map((t) => t.title).sort();
    expect(await search('ha LONG')).toEqual(['Ha Long Bay']);
    // `%` and `_` are LIKE wildcards: if they were not escaped, "%" would match every tour and "_" any single character.
    expect(await search('%')).toEqual(['Sapa 100% fun']);
    expect(await search('Hue_c')).toEqual(['Hue_city walk']);
    expect(await search('Hue-c')).toEqual([]);
    expect(await search("'; DROP TABLE \"Tour\"; --")).toEqual([]);
    expect(await prisma.tour.count()).toBe(3);
  });

  it('applies to the user directory search too', async () => {
    await createUser('TRAVELER', 'anna_b@example.com');
    await createUser('TRAVELER', 'annaXb@example.com');
    const { items } = await usersRepository.list({ q: 'anna_b' }, { page: 1, limit: 10 });
    expect(items.map((u) => u.email)).toEqual(['anna_b@example.com']);
  });
});
