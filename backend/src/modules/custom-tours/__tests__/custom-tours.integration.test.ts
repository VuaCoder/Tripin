import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createApprovedTour, createUser, createVerifiedAgency, loadTour, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const send = (token: string, body: Record<string, unknown>) =>
  request(app).post('/api/v1/custom-tours').set(bearer(token)).send(body);

const decide = (token: string, id: string, decision: 'ACCEPT' | 'DECLINE' | 'CANCEL') =>
  request(app).patch(`/api/v1/custom-tours/${id}/decision`).set(bearer(token)).send({ decision });

describe('custom-tours (integration)', () => {
  async function setup() {
    const agency = await createVerifiedAgency('agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const other = await createUser('TRAVELER', 'other@example.com');
    const { tourId } = await createApprovedTour(agency.id);
    return { agency, traveler, other, tourId };
  }

  it('accepts any head-count from 2 to 50 and rejects the edges', async () => {
    const { traveler, tourId } = await setup();

    expect((await send(traveler.token, { sourceTourId: tourId, participants: 2 })).status).toBe(201);
    expect((await send(traveler.token, { sourceTourId: tourId, participants: 50 })).status).toBe(201);
    expect((await send(traveler.token, { sourceTourId: tourId, participants: 1 })).status).toBe(400);
    expect((await send(traveler.token, { sourceTourId: tourId, participants: 51 })).status).toBe(400);
    expect((await send(traveler.token, { sourceTourId: tourId, participants: 2, notes: 'x'.repeat(501) })).status).toBe(400);
  });

  it('stores the age composition the traveler entered and keeps it consistent with the head count', async () => {
    const { traveler, tourId } = await setup();

    const created = await send(traveler.token, {
      sourceTourId: tourId,
      participants: 6,
      guestCounts: { adults: 3, children: 2, infants: 1 },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.guestCounts).toEqual({ adults: 3, children: 2, infants: 1 });

    // The sum must match the head count and at least one adult is required.
    expect((await send(traveler.token, { sourceTourId: tourId, participants: 6, guestCounts: { adults: 6, children: 0, infants: 1 } })).status).toBe(400);
    expect((await send(traveler.token, { sourceTourId: tourId, participants: 3, guestCounts: { adults: 0, children: 3, infants: 0 } })).status).toBe(400);
  });

  it('keeps the start date the group asked for and opens the clone on it', async () => {
    const { agency, traveler, tourId } = await setup();
    const startDate = new Date(Date.now() + 21 * 86_400_000);
    startDate.setUTCHours(0, 0, 0, 0);

    const created = await send(traveler.token, {
      sourceTourId: tourId,
      participants: 2,
      startDate: startDate.toISOString(),
    });
    expect(created.status).toBe(201);
    expect(created.body.data.startDate).toBe(startDate.toISOString());

    const accepted = await decide(agency.token, created.body.data.id, 'ACCEPT');
    const clone = await loadTour(accepted.body.data.privateTour.id);
    expect(clone!.departures.map((departure) => departure.date.toISOString())).toEqual([startDate.toISOString()]);

    expect((await send(traveler.token, { sourceTourId: tourId, participants: 2, startDate: '2020-01-01' })).status).toBe(400);
  });

  it('only accepts a public, approved tour of a verified agency', async () => {
    const { agency, traveler, tourId } = await setup();
    const draft = await prisma.tour.create({
      data: { agencyId: agency.id, title: 'Draft', destination: 'Hue', durationDays: 1, basePrice: 1000, status: 'DRAFT' },
    });
    await prisma.tour.update({ where: { id: tourId }, data: { visibility: 'PRIVATE' } });
    // An agency whose profile exists but is not VERIFIED (the tour row needs the profile FK).
    const unverified = await createUser('AGENCY', 'unverified@example.com', { agencyProfile: { companyName: 'Unverified Travel' } });
    const { tourId: unverifiedTour } = await createApprovedTour(unverified.id);

    expect((await send(traveler.token, { sourceTourId: draft.id, participants: 2 })).status).toBe(404);
    expect((await send(traveler.token, { sourceTourId: tourId, participants: 2 })).status).toBe(404);
    expect((await send(traveler.token, { sourceTourId: unverifiedTour, participants: 2 })).status).toBe(404);
    expect(await prisma.customTourRequest.count()).toBe(0);
  });

  it('returns the same request for the same clientRequestId and rejects a different payload', async () => {
    const { traveler, tourId } = await setup();
    const body = { sourceTourId: tourId, participants: 4, notes: 'Muốn đi buổi sáng', clientRequestId: 'req_12345678' };

    const first = await send(traveler.token, body);
    const second = await send(traveler.token, body);
    expect(first.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await prisma.customTourRequest.count()).toBe(1);

    const reused = await send(traveler.token, { ...body, participants: 5 });
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('opens the traveler↔agency conversation and notifies the agency', async () => {
    const { agency, traveler, tourId } = await setup();
    const created = await send(traveler.token, { sourceTourId: tourId, participants: 3, notes: 'Đoàn công ty' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'SUBMITTED', nextStep: 'WAITING_AGENCY', participants: 3, notes: 'Đoàn công ty' });
    expect(created.body.data.sourceTour).toMatchObject({ id: tourId, title: 'Ha Long Bay 2D1N' });

    const request_ = await prisma.customTourRequest.findUniqueOrThrow({ where: { id: created.body.data.id } });
    expect(request_.conversationId).toBeTruthy();
    expect(await prisma.conversation.count({ where: { id: request_.conversationId! } })).toBe(1);

    const notification = await prisma.notification.findFirst({ where: { userId: agency.id, type: 'CUSTOM_TOUR_REQUESTED' } });
    expect(notification?.data).toMatchObject({ requestId: created.body.data.id });
    expect(JSON.stringify(notification?.data)).not.toContain('Đoàn công ty');
  });

  it('scopes list and detail to the owner', async () => {
    const { agency, traveler, other, tourId } = await setup();
    const created = await send(traveler.token, { sourceTourId: tourId, participants: 3 });
    const id = created.body.data.id as string;

    expect((await request(app).get(`/api/v1/custom-tours/${id}`).set(bearer(other.token))).status).toBe(404);
    expect((await request(app).get(`/api/v1/custom-tours/${id}`).set(bearer(traveler.token))).status).toBe(200);
    expect((await request(app).get(`/api/v1/custom-tours/${id}`).set(bearer(agency.token))).status).toBe(200);

    expect((await request(app).get('/api/v1/custom-tours').set(bearer(other.token))).body.data).toHaveLength(0);
    const mine = await request(app).get('/api/v1/custom-tours').set(bearer(traveler.token));
    expect(mine.body.data).toHaveLength(1);
    const inbox = await request(app).get('/api/v1/custom-tours').set(bearer(agency.token));
    expect(inbox.body.data).toHaveLength(1);
    expect(inbox.body.meta.total).toBe(1);
  });

  it('clones exactly one private tour on accept and locks the normal tour APIs', async () => {
    const { agency, traveler, tourId } = await setup();
    const created = await send(traveler.token, { sourceTourId: tourId, participants: 6 });
    const id = created.body.data.id as string;
    const sourceBefore = await loadTour(tourId);

    const accepted = await decide(agency.token, id, 'ACCEPT');
    expect(accepted.status).toBe(200);
    expect(accepted.body.data).toMatchObject({ status: 'NEGOTIATING', nextStep: 'NEGOTIATING' });
    expect(accepted.body.data.privateTour).toMatchObject({ status: 'DRAFT' });

    const request_ = await prisma.customTourRequest.findUniqueOrThrow({ where: { id } });
    const clone = (await loadTour(request_.privateTourId!))!;
    expect(clone).toMatchObject({
      agencyId: agency.id,
      title: sourceBefore!.title,
      destination: sourceBefore!.destination,
      durationDays: sourceBefore!.durationDays,
      status: 'DRAFT',
      visibility: 'PRIVATE',
      maxGroupSize: 6,
      basePrice: 1_000_000n,
      guideAssignment: null,
      ratingAvg: 0,
      ratingCount: 0,
      submittedAt: null,
    });
    expect(clone.departures).toHaveLength(1);
    expect(clone.departures[0]).toMatchObject({ capacity: 6, remaining: 6, priceOverride: null });
    expect(clone.departures[0]!.date.getTime()).toBe(sourceBefore!.departures[0]!.date.getTime());
    expect(await loadTour(tourId)).toEqual(sourceBefore);

    const writes = await Promise.all([
      request(app).patch(`/api/v1/agency/tours/${clone.id}`).set(bearer(agency.token)).send({ title: 'Private tour renamed' }),
      request(app).put(`/api/v1/agency/tours/${clone.id}/availability`).set(bearer(agency.token)).send({ departures: [] }),
      request(app).put(`/api/v1/agency/tours/${clone.id}/itinerary`).set(bearer(agency.token)).send({ days: [] }),
      request(app).put(`/api/v1/agency/tours/${clone.id}/guide`).set(bearer(agency.token)).send({ guideId: null }),
      request(app).post(`/api/v1/agency/tours/${clone.id}/submit`).set(bearer(agency.token)),
      request(app).delete(`/api/v1/agency/tours/${clone.id}`).set(bearer(agency.token)),
    ]);
    for (const response of writes) {
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('TOUR_PRIVATE_MANAGED_BY_CUSTOM_TOUR');
    }
    // The owner still reads it, and the public source tour stays editable.
    expect((await request(app).get(`/api/v1/agency/tours/${clone.id}`).set(bearer(agency.token))).body.data.visibility).toBe('PRIVATE');
    expect((await request(app).patch(`/api/v1/agency/tours/${tourId}`).set(bearer(agency.token)).send({ summary: 'Updated summary' })).status).toBe(200);
  });

  it('lets only one of two parallel accepts clone a tour', async () => {
    const { agency, traveler, tourId } = await setup();
    const created = await send(traveler.token, { sourceTourId: tourId, participants: 4 });
    const id = created.body.data.id as string;

    const [first, second] = await Promise.all([decide(agency.token, id, 'ACCEPT'), decide(agency.token, id, 'ACCEPT')]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await prisma.tour.count({ where: { agencyId: agency.id, visibility: 'PRIVATE' } })).toBe(1);
    expect(await prisma.customTourRequest.count({ where: { id, status: 'NEGOTIATING' } })).toBe(1);
  });

  it('declines or cancels without cloning, and only the right side may decide', async () => {
    const { agency, traveler, other, tourId } = await setup();
    const declined = (await send(traveler.token, { sourceTourId: tourId, participants: 3 })).body.data.id as string;
    const cancelled = (await send(traveler.token, { sourceTourId: tourId, participants: 3 })).body.data.id as string;

    const declinedResponse = await decide(agency.token, declined, 'DECLINE');
    expect(declinedResponse.status).toBe(200);
    expect(declinedResponse.body.data).toMatchObject({ status: 'DECLINED', nextStep: 'CLOSED' });
    expect(declinedResponse.body.data.privateTour).toBeUndefined();

    // The agency cannot withdraw a request, the traveler cannot answer one, strangers can do neither.
    expect((await decide(traveler.token, declined, 'ACCEPT')).status).toBe(404);
    expect((await decide(agency.token, cancelled, 'CANCEL')).status).toBe(404);
    expect((await decide(other.token, cancelled, 'CANCEL')).status).toBe(404);
    expect((await decide(agency.token, declined, 'ACCEPT')).body.error.code).toBe('INVALID_STATE_TRANSITION');

    const cancelledResponse = await decide(traveler.token, cancelled, 'CANCEL');
    expect(cancelledResponse.status).toBe(200);
    expect(cancelledResponse.body.data).toMatchObject({ status: 'CANCELLED', nextStep: 'CLOSED' });

    expect(await prisma.tour.count({ where: { visibility: 'PRIVATE' } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: traveler.id, type: 'CUSTOM_TOUR_DECIDED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: agency.id, type: 'CUSTOM_TOUR_DECIDED' } })).toBe(1);
  });
});
