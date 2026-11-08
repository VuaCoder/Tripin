import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { backfillGuidePayoutAccounts } from '../../../scripts/backfill-guide-payout-accounts';
import { usersRepository } from '../users.repository';

const app = createApp();
const account = { bankName: 'Test Bank', accountNumber: '00123456789', accountHolder: 'TEST GUIDE' };
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

describe('guide payout account (GUIDE-001)', () => {
  it('stores encrypted account data and masks all read/update responses, then clears it', async () => {
    const guide = await createUser('TOUR_GUIDE', 'guide@payout.test');
    const saved = await request(app).patch('/api/v1/users/me').set(bearer(guide.token)).send({ bankAccount: account });
    expect(saved.status).toBe(200);
    expect(saved.body.data.bankAccount).toEqual({ ...account, accountNumber: '****6789' });
    const stored = await prisma.guidePayoutAccount.findUniqueOrThrow({ where: { guideId: guide.id } });
    expect(stored.last4).toBe('6789');
    expect(JSON.stringify(stored)).not.toContain(account.accountNumber);
    expect(JSON.stringify(stored)).not.toContain(account.accountHolder);
    expect((await request(app).get('/api/v1/users/me').set(bearer(guide.token))).body.data.bankAccount.accountNumber).toBe('****6789');
    expect((await request(app).patch('/api/v1/users/me').set(bearer(guide.token)).send({ bankAccount: { ...account, accountNumber: '****6789' } })).status).toBe(400);
    expect((await request(app).patch('/api/v1/users/me').set(bearer(guide.token)).send({ bankAccount: null })).status).toBe(200);
    expect(await prisma.guidePayoutAccount.count()).toBe(0);
  });
  it('rejects non-guides and does not leak accounts to another guide', async () => {
    const traveler = await createUser('TRAVELER', 'traveler@payout.test');
    const guide = await createUser('TOUR_GUIDE', 'other@payout.test');
    expect((await request(app).patch('/api/v1/users/me').set(bearer(traveler.token)).send({ bankAccount: account })).status).toBe(403);
    expect((await request(app).get('/api/v1/users/me').set(bearer(guide.token))).body.data.bankAccount).toBeUndefined();
  });
  it('backfills existing accounts idempotently and removes plaintext without losing preferences', async () => {
    const guide = await createUser('TOUR_GUIDE', 'legacy@payout.test');
    await prisma.user.update({ where: { id: guide.id }, data: { preferences: { bankAccount: account, emailAlerts: true } } });
    expect(await backfillGuidePayoutAccounts()).toBe(1);
    expect(await backfillGuidePayoutAccounts()).toBe(0);
    expect(await prisma.guidePayoutAccount.count()).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: guide.id } })).preferences).toEqual({ emailAlerts: true });
    await usersRepository.updateById(guide.id, { preferences: { bankAccount: account, emailAlerts: false } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: guide.id } })).preferences).toEqual({ emailAlerts: false });
  });
});
