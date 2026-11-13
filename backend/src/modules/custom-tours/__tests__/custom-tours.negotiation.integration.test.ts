import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createApprovedTour, createUser, createVerifiedAgency, loadTour, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const future = (days = 45) => new Date(Date.now() + days * 86_400_000);

const saveDraft = (token: string, id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/v1/custom-tours/${id}/draft`).set(bearer(token)).send(body);
const sendOffer = (token: string, id: string, body: Record<string, unknown>) =>
  request(app).post(`/api/v1/custom-tours/${id}/offers`).set(bearer(token)).send(body);
const acceptOffer = (token: string, id: string, body: Record<string, unknown>) =>
  request(app).post(`/api/v1/custom-tours/${id}/acceptance`).set(bearer(token)).send(body);

const guestCounts = (adults: number, children = 0, infants = 0) => ({ adults, children, infants });

describe('custom-tours negotiation (integration)', () => {
  /** A request already accepted by the agency: NEGOTIATING with one private DRAFT tour. */
  async function setup(participants = 4) {
    const agency = await createVerifiedAgency('agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const other = await createUser('TRAVELER', 'other@example.com');
    const { tourId } = await createApprovedTour(agency.id);
    const created = await request(app).post('/api/v1/custom-tours').set(bearer(traveler.token)).send({ sourceTourId: tourId, participants });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const accepted = await request(app)
      .patch(`/api/v1/custom-tours/${id}/decision`)
      .set(bearer(agency.token))
      .send({ decision: 'ACCEPT' });
    expect(accepted.status).toBe(200);
    return { agency, traveler, other, tourId, id, privateTourId: accepted.body.data.privateTour.id as string };
  }

  /** NEGOTIATING at revision 2 with the negotiated content and counts saved, ready for an offer. */
  async function readyToOffer(participants = 4) {
    const context = await setup(participants);
    const saved = await saveDraft(context.agency.token, context.id, {
      revision: 1,
      content: {
        title: 'Ha Long Bay riêng cho đoàn',
        summary: 'Hành trình riêng theo yêu cầu của đoàn.',
        description: 'Ngày 1: Hà Nội – Hạ Long.\nNgày 2: Hạ Long – Hà Nội.',
        inclusions: ['Xe đưa đón', 'Bữa ăn theo chương trình'],
        exclusions: ['Chi phí cá nhân'],
        cancellationPolicy: 'Hủy trước 7 ngày hoàn 100%.',
      },
      guestCounts: guestCounts(participants),
      departure: { date: future().toISOString() },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.revision).toBe(2);
    return context;
  }

  it('lets one of two drafts at the same revision win and the loser retry with the fresh revision', async () => {
    const { agency, id } = await setup();
    const body = {
      revision: 1,
      content: { title: 'Ha Long Bay riêng cho đoàn' },
      guestCounts: guestCounts(4),
    };

    const [first, second] = await Promise.all([saveDraft(agency.token, id, body), saveDraft(agency.token, id, body)]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const winner = first.status === 200 ? first : second;
    const loser = first.status === 409 ? first : second;
    expect(winner.body.data).toMatchObject({ status: 'NEGOTIATING', revision: 2 });
    expect(loser.body.error.code).toBe('CONCURRENT_UPDATE');

    const retried = await saveDraft(agency.token, id, { ...body, revision: winner.body.data.revision });
    expect(retried.status).toBe(200);
    expect(retried.body.data.revision).toBe(3);
    expect((await prisma.customTourRequest.findUniqueOrThrow({ where: { id } })).revision).toBe(3);
  });

  it('accepts only the offered revision and approves the private tour', async () => {
    const { agency, traveler, other, id, privateTourId } = await readyToOffer();
    const offered = await sendOffer(agency.token, id, { revision: 2 });
    expect(offered.status).toBe(200);
    expect(offered.body.data).toMatchObject({ status: 'OFFERED', revision: 2, nextStep: 'REVIEW_OFFER' });
    expect(offered.body.data.offer).toMatchObject({
      revision: 2,
      unitPrice: 1_000_000,
      subtotal: 4_000_000,
      guestCounts: guestCounts(4),
      // The whole negotiated content is frozen with the price, so the chat panel can show the terms.
      content: {
        title: 'Ha Long Bay riêng cho đoàn',
        destination: 'Quang Ninh',
        durationDays: 2,
        summary: 'Hành trình riêng theo yêu cầu của đoàn.',
        inclusions: ['Xe đưa đón', 'Bữa ăn theo chương trình'],
        exclusions: ['Chi phí cá nhân'],
        cancellationPolicy: 'Hủy trước 7 ngày hoàn 100%.',
      },
    });

    expect((await acceptOffer(other.token, id, { revision: 2 })).status).toBe(404);

    const stale = await acceptOffer(traveler.token, id, { revision: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONCURRENT_UPDATE');

    const accepted = await acceptOffer(traveler.token, id, { revision: 2 });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data).toMatchObject({ status: 'ACCEPTED', revision: 2, nextStep: 'ENTER_PASSENGERS' });
    expect(accepted.body.data.privateTour).toMatchObject({ status: 'APPROVED' });

    const row = await prisma.customTourRequest.findUniqueOrThrow({ where: { id } });
    expect(row.acceptedAt).toBeInstanceOf(Date);
    expect(await loadTour(privateTourId)).toMatchObject({ status: 'APPROVED', visibility: 'PRIVATE' });

    const notification = await prisma.notification.findFirst({ where: { userId: agency.id, type: 'CUSTOM_TOUR_ACCEPTED' } });
    expect(notification?.data).toMatchObject({ requestId: id, conversationId: row.conversationId });
  });

  it('returns an offered request to NEGOTIATING when edited, voiding the old snapshot', async () => {
    const { agency, traveler, id } = await readyToOffer();
    expect((await sendOffer(agency.token, id, { revision: 2 })).status).toBe(200);

    const edited = await saveDraft(agency.token, id, { revision: 2, content: { title: 'Bản đã sửa cho đoàn' } });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ status: 'NEGOTIATING', revision: 3 });
    expect(edited.body.data.offer).toBeUndefined();

    const stale = await acceptOffer(traveler.token, id, { revision: 2 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('INVALID_STATE_TRANSITION');

    const resent = await sendOffer(agency.token, id, { revision: 3 });
    expect(resent.status).toBe(200);
    expect(resent.body.data.offer).toMatchObject({ revision: 3 });
    expect((await acceptOffer(traveler.token, id, { revision: 3 })).status).toBe(200);
  });

  it('never takes money from the client and writes no snapshot when the body carries it', async () => {
    const { agency, id } = await readyToOffer();

    for (const body of [
      { revision: 2, unitPrice: 1 },
      { revision: 2, subtotal: 1 },
      { revision: 2, unitPrice: 1, subtotal: 1 },
    ]) {
      const response = await sendOffer(agency.token, id, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const row = await prisma.customTourRequest.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'NEGOTIATING', revision: 2, offerSnapshot: null });
  });

  it('rejects missing adults, counts that do not sum, a past departure and a capacity that is not the head count', async () => {
    const { agency, id } = await setup(4);

    for (const body of [
      { revision: 1, guestCounts: guestCounts(0, 4) },
      { revision: 1, guestCounts: guestCounts(2) },
      { revision: 1, departure: { date: new Date(Date.now() - 86_400_000).toISOString() } },
      { revision: 1, departure: { date: future().toISOString(), capacity: 5 } },
      { revision: 1, content: { maxGroupSize: 9 } },
    ]) {
      const response = await saveDraft(agency.token, id, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    expect(await prisma.customTourRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'NEGOTIATING',
      revision: 1,
      guestCounts: null,
    });
  });

  it('requires age pricing to send an offer for children', async () => {
    const { agency, id } = await setup(4);
    const saved = await saveDraft(agency.token, id, {
      revision: 1,
      guestCounts: guestCounts(2, 2),
      departure: { date: future().toISOString() },
    });
    expect(saved.status).toBe(200);

    const offered = await sendOffer(agency.token, id, { revision: 2 });
    expect(offered.status).toBe(400);
    expect(offered.body.error.code).toBe('VALIDATION_ERROR');
    expect((await prisma.customTourRequest.findUniqueOrThrow({ where: { id } })).offerSnapshot).toBeNull();
  });

  it('persists the draft content and the single departure with capacity = participants', async () => {
    const { agency, id, privateTourId } = await setup(6);
    const departureDate = future(60);

    const saved = await saveDraft(agency.token, id, {
      revision: 1,
      content: {
        title: 'Đoàn riêng Hạ Long',
        summary: 'Tóm tắt đoàn riêng',
        description: 'Mô tả chuyến đi riêng',
        destination: 'Quảng Ninh',
        durationDays: 3,
        basePrice: 2_500_000,
        images: ['https://example.com/halong.png'],
        inclusions: ['Bữa sáng'],
        exclusions: ['Bảo hiểm du lịch'],
        meetingPoint: 'Bến tàu Tuần Châu',
        travelNotes: 'Mang giày thoải mái',
        requiredDocuments: 'CCCD 12 số',
        childPricingPolicy: 'Trẻ em dưới 12 tuổi giảm 30%',
        cancellationPolicy: 'Hủy trước 7 ngày',
      },
      guestCounts: guestCounts(4, 2),
      departure: { date: departureDate.toISOString(), capacity: 6 },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ revision: 2, guestCounts: guestCounts(4, 2) });

    const tour = (await loadTour(privateTourId))!;
    expect(tour).toMatchObject({
      title: 'Đoàn riêng Hạ Long',
      summary: 'Tóm tắt đoàn riêng',
      destination: 'Quảng Ninh',
      durationDays: 3,
      basePrice: 2_500_000n,
      maxGroupSize: 6,
      status: 'DRAFT',
      visibility: 'PRIVATE',
      meetingPoint: 'Bến tàu Tuần Châu',
    });
    expect(tour.departures).toHaveLength(1);
    expect(tour.departures[0]).toMatchObject({ capacity: 6 });
    expect(tour.departures[0]!.date.toISOString()).toBe(departureDate.toISOString());
  });

  it('freezes draft, offers and acceptance after ACCEPTED and keeps the private tour locked', async () => {
    const { agency, traveler, id, privateTourId } = await readyToOffer();
    expect((await sendOffer(agency.token, id, { revision: 2 })).status).toBe(200);
    expect((await acceptOffer(traveler.token, id, { revision: 2 })).status).toBe(200);

    const responses = await Promise.all([
      saveDraft(agency.token, id, { revision: 2, content: { title: 'Sau khi chốt' } }),
      sendOffer(agency.token, id, { revision: 2 }),
      acceptOffer(traveler.token, id, { revision: 2 }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
    }

    const write = await request(app).patch(`/api/v1/agency/tours/${privateTourId}`).set(bearer(agency.token)).send({ title: 'Đổi trực tiếp' });
    expect(write.status).toBe(409);
    expect(write.body.error.code).toBe('TOUR_PRIVATE_MANAGED_BY_CUSTOM_TOUR');
  });
});
