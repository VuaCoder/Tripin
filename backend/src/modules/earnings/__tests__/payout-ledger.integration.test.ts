import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { earningsRepository } from '../earnings.repository';

const app = createApp();
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);
async function fixture(amount = 150000) {
  const agency = await createUser('AGENCY', 'agency@ledger.test', {agencyProfile:{companyName:'Agency',verificationStatus:'VERIFIED'}});
  const stranger = await createUser('AGENCY', 'stranger@ledger.test', {agencyProfile:{companyName:'Stranger',verificationStatus:'VERIFIED'}});
  const guide = await createUser('TOUR_GUIDE', 'guide@ledger.test');
  const { tourId } = await createApprovedTour(agency.id);
  const bookingId = crypto.randomUUID();
  const earning = await earningsRepository.create({ guideId: guide.id, agencyId: agency.id, tourId, bookingId, bookingCode: 'BOOK-LEDGER', tourTitle: 'Tour', amount, earnedAt: new Date() });
  return { agency, stranger, guide, earning };
}
describe('guide payout ledger (PAY-018)', () => {
  it('keeps whole VND above the Int32 limit numeric in payout and audit responses', async () => {
    const { earning, agency, guide } = await fixture(3_000_000_000);
    expect(earning.amount).toBe(3_000_000_000);
    expect(earning.payout!.amount).toBe(3_000_000_000);
    expect((await earningsRepository.findByBookingId(earning.bookingId))!.payout!.amount).toBe(3_000_000_000);
    const list = await request(app).get('/api/v1/earnings/me/ledger').set(bearer(guide.token));
    expect(list.status).toBe(200);
    expect(list.body.data[0].amount).toBe(3_000_000_000);
    const transfer = await request(app).post(`/api/v1/earnings/payouts/${earning.payout!.id}/transfer`).set(bearer(agency.token)).send({ transferReference: 'LARGE-VND-REF' });
    expect(transfer.status).toBe(410);
    expect(transfer.body.error.code).toBe('LEGACY_TRANSFER_QUARANTINED');
    expect(await prisma.auditLog.count({ where: { targetId: earning.payout!.id } })).toBe(0);
    expect((await prisma.guidePayoutLedger.findUniqueOrThrow({ where: { id: earning.payout!.id } })).amount).toBe(3_000_000_000n);
  });
  it('creates a pending ledger with the earning and exposes it only to its guide', async () => {
    const { earning, guide } = await fixture();
    expect(earning.payout).toMatchObject({ status: 'PENDING', amount: 150000 });
    const response = await request(app).get('/api/v1/earnings/me/ledger').set(bearer(guide.token));
    expect(response.status).toBe(200);
    expect(response.body.data[0].payout).toMatchObject({ id: earning.payout!.id, status: 'PENDING' });
    const other = await createUser('TOUR_GUIDE', 'other@ledger.test');
    expect((await request(app).get('/api/v1/earnings/me/ledger').set(bearer(other.token))).body.data).toEqual([]);
  });
  it('quarantines all transfer mutations without changing the ledger or audit', async () => {
    const { earning, agency, stranger, guide } = await fixture();
    const transfer = (token: string, ref = 'BANK-REF-1') => request(app).post(`/api/v1/earnings/payouts/${earning.payout!.id}/transfer`).set(bearer(token)).send({ transferReference: ref });
    expect((await transfer(guide.token)).status).toBe(403);
    expect((await transfer(stranger.token)).status).toBe(410);
    expect((await transfer(agency.token)).status).toBe(410);
    expect((await transfer(agency.token)).status).toBe(410);
    expect((await transfer(agency.token, 'DIFFERENT-REF')).status).toBe(410);
    expect(await prisma.auditLog.count({ where: { targetId: earning.payout!.id } })).toBe(0);
    expect(await prisma.guidePayoutLedger.findUnique({ where: { id: earning.payout!.id } })).toMatchObject({ status: 'PENDING', transferredAt: null });
  });
});
