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
async function fixture() {
  const agency = await createUser('AGENCY', 'agency@ledger.test');
  const stranger = await createUser('AGENCY', 'stranger@ledger.test');
  const guide = await createUser('TOUR_GUIDE', 'guide@ledger.test');
  const { tourId } = await createApprovedTour(agency.id);
  const bookingId = crypto.randomUUID();
  const earning = await earningsRepository.create({ guideId: guide.id, agencyId: agency.id, tourId, bookingId, bookingCode: 'BOOK-LEDGER', tourTitle: 'Tour', amount: 150000, earnedAt: new Date() });
  return { agency, stranger, guide, earning };
}
describe('guide payout ledger (PAY-018)', () => {
  it('creates a pending ledger with the earning and exposes it only to its guide', async () => {
    const { earning, guide } = await fixture();
    expect(earning.payout).toMatchObject({ status: 'PENDING', amount: 150000 });
    const response = await request(app).get('/api/v1/earnings/me/ledger').set(bearer(guide.token));
    expect(response.status).toBe(200);
    expect(response.body.data[0].payout).toMatchObject({ id: earning.payout!.id, status: 'PENDING' });
    const other = await createUser('TOUR_GUIDE', 'other@ledger.test');
    expect((await request(app).get('/api/v1/earnings/me/ledger').set(bearer(other.token))).body.data).toEqual([]);
  });
  it('records agency transfer once with an audit and prevents guide or foreign agency writes', async () => {
    const { earning, agency, stranger, guide } = await fixture();
    const transfer = (token: string, ref = 'BANK-REF-1') => request(app).post(`/api/v1/earnings/payouts/${earning.payout!.id}/transfer`).set(bearer(token)).send({ transferReference: ref });
    expect((await transfer(guide.token)).status).toBe(403);
    expect((await transfer(stranger.token)).status).toBe(404);
    expect((await transfer(agency.token)).status).toBe(200);
    expect((await transfer(agency.token)).status).toBe(200);
    expect((await transfer(agency.token, 'DIFFERENT-REF')).status).toBe(409);
    expect(await prisma.auditLog.count({ where: { targetId: earning.payout!.id } })).toBe(1);
    expect(await prisma.guidePayoutLedger.findUnique({ where: { id: earning.payout!.id } })).toMatchObject({ status: 'TRANSFERRED', transferredAt: expect.any(Date) });
  });
});
