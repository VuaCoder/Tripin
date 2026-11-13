import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { guestTotal, type GuestCounts, type PassengerType } from '@travel-platform/constants';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createApprovedTour, createUser, createVerifiedAgency, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const future = (days = 45) => new Date(Date.now() + days * 86_400_000);
const guestCounts = (adults: number, children = 0, infants = 0): GuestCounts => ({ adults, children, infants });

const save = (token: string, id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/v1/custom-tours/${id}/checkout-draft`).set(bearer(token)).send(body);

const member = (index: number, guestType: PassengerType = 'ADULT') => ({
  fullName: `Khách thứ ${index}`,
  phone: '0912345678',
  idCard: String(index).padStart(12, '0'),
  guestType,
});

describe('custom-tours checkout draft (integration)', () => {
  /**
   * An ACCEPTED request: 2 adults + 1 child, offer frozen at revision 2 with those counts.
   * The child needs age pricing on the tour or the offer cannot be priced.
   */
  async function acceptedRequest(counts = guestCounts(2, 1), accept = true) {
    const agency = await createVerifiedAgency('agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const other = await createUser('TRAVELER', 'other@example.com');
    const { tourId } = await createApprovedTour(agency.id);
    await prisma.tour.update({
      where: { id: tourId },
      data: { agePricing: { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 } },
    });

    const created = await request(app)
      .post('/api/v1/custom-tours')
      .set(bearer(traveler.token))
      .send({ sourceTourId: tourId, participants: guestTotal(counts) });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const acceptedByAgency = await request(app)
      .patch(`/api/v1/custom-tours/${id}/decision`)
      .set(bearer(agency.token))
      .send({ decision: 'ACCEPT' });
    expect(acceptedByAgency.status).toBe(200);

    const draft = await request(app)
      .patch(`/api/v1/custom-tours/${id}/draft`)
      .set(bearer(agency.token))
      .send({ revision: 1, guestCounts: counts, departure: { date: future().toISOString() } });
    expect(draft.status).toBe(200);

    const offered = await request(app).post(`/api/v1/custom-tours/${id}/offers`).set(bearer(agency.token)).send({ revision: 2 });
    expect(offered.status).toBe(200);

    if (accept) {
      const accepted = await request(app).post(`/api/v1/custom-tours/${id}/acceptance`).set(bearer(traveler.token)).send({ revision: 2 });
      expect(accepted.status).toBe(200);
    }
    return { agency, traveler, other, id };
  }

  const body = (overrides: Record<string, unknown> = {}) => ({
    checkoutRevision: 1,
    contact: { fullName: 'Nguyễn Văn A', phone: '0912345678' },
    passengers: [member(1), member(2), member(3, 'CHILD')],
    ...overrides,
  });

  it('saves the form, bumps its own revision and returns it on GET without touching the offer revision', async () => {
    const { traveler, id } = await acceptedRequest();

    const saved = await save(traveler.token, id, body({ notes: '  Đoàn có trẻ nhỏ  ' }));
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({
      status: 'ACCEPTED',
      revision: 2,
      nextStep: 'ENTER_PASSENGERS',
      checkoutRevision: 2,
      checkoutDraft: {
        contact: { fullName: 'Nguyễn Văn A', phone: '0912345678' },
        passengers: [member(1), member(2), member(3, 'CHILD')],
        notes: 'Đoàn có trẻ nhỏ',
      },
    });

    const read = await request(app).get(`/api/v1/custom-tours/${id}`).set(bearer(traveler.token));
    expect(read.status).toBe(200);
    expect(read.body.data.checkoutRevision).toBe(2);
    expect(read.body.data.checkoutDraft).toMatchObject({ notes: 'Đoàn có trẻ nhỏ' });

    const row = await prisma.customTourRequest.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ revision: 2, checkoutRevision: 2 });
    expect(row.offerSnapshot).not.toBeNull();
  });

  it('rejects a form that does not describe the accepted group, and stores nothing', async () => {
    const { traveler, id } = await acceptedRequest();

    const invalid = [
      { label: 'one row short', value: body({ passengers: [member(1), member(2)] }) },
      { label: 'wrong age mix', value: body({ passengers: [member(1), member(2), member(3)] }) },
      { label: 'duplicate id card', value: body({ passengers: [member(1), member(2), { ...member(3, 'CHILD'), idCard: member(1).idCard }] }) },
      { label: 'id card not 12 digits', value: body({ passengers: [member(1), member(2), { ...member(3, 'CHILD'), idCard: '0123456789' }] }) },
      { label: 'bad phone', value: body({ passengers: [member(1), member(2), { ...member(3, 'CHILD'), phone: '12' }] }) },
      { label: 'client price', value: body({ subtotal: 1 }) },
    ];
    for (const { label, value } of invalid) {
      const response = await save(traveler.token, id, value);
      expect(response.status, label).toBe(400);
      expect(response.body.error.code, label).toBe('VALIDATION_ERROR');
    }

    const row = await prisma.customTourRequest.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ checkoutDraft: null, checkoutRevision: 1 });
  });

  it('lets one of two saves at the same revision win, and the loser retry with the fresh revision', async () => {
    const { traveler, id } = await acceptedRequest();

    const [first, second] = await Promise.all([save(traveler.token, id, body()), save(traveler.token, id, body())]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const winner = first.status === 200 ? first : second;
    const loser = first.status === 409 ? first : second;
    expect(winner.body.data.checkoutRevision).toBe(2);
    expect(loser.body.error.code).toBe('CONCURRENT_UPDATE');

    const retried = await save(traveler.token, id, body({ checkoutRevision: winner.body.data.checkoutRevision }));
    expect(retried.status).toBe(200);
    expect(retried.body.data.checkoutRevision).toBe(3);
  });

  it('is only for the traveler who owns the request', async () => {
    const { agency, other, id } = await acceptedRequest();

    expect((await save(other.token, id, body())).status).toBe(404);
    expect((await save(agency.token, id, body())).status).toBe(403);
    expect((await prisma.customTourRequest.findUniqueOrThrow({ where: { id } })).checkoutDraft).toBeNull();
  });

  it('is refused until the traveler accepts the offer', async () => {
    const { traveler, id } = await acceptedRequest(guestCounts(2, 1), false);

    const early = await save(traveler.token, id, body());
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('INVALID_STATE_TRANSITION');
    expect((await prisma.customTourRequest.findUniqueOrThrow({ where: { id } })).checkoutDraft).toBeNull();
  });
});
