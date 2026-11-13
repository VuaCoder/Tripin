import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { guestTotal, type GuestCounts, type PassengerType } from '@travel-platform/constants';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bookingsService } from '../../bookings';
import { bearer, createApprovedTour, createUser, createVerifiedAgency, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const future = (days = 45) => new Date(Date.now() + days * 86_400_000);
const guestCounts = (adults: number, children = 0, infants = 0): GuestCounts => ({ adults, children, infants });

const member = (index: number, guestType: PassengerType = 'ADULT') => ({
  fullName: `Khách thứ ${index}`,
  phone: '0912345678',
  idCard: String(index).padStart(12, '0'),
  guestType,
});

const book = (token: string, id: string, body: Record<string, unknown> = {}) =>
  request(app).post(`/api/v1/custom-tours/${id}/bookings`).set(bearer(token)).send(body);

describe('custom-tours booking (integration)', () => {
  let fixture = 0;

  /**
   * An ACCEPTED request whose passenger form is already saved: 2 adults + 1 child, offer frozen at revision 2.
   * Returns the offer the traveler accepted, so a test can compare the booking against it.
   */
  async function acceptedRequest(counts = guestCounts(2, 1), options: { accept?: boolean; saveDraft?: boolean } = {}) {
    fixture += 1;
    const agency = await createVerifiedAgency(`agency-${fixture}@example.com`);
    const traveler = await createUser('TRAVELER', `traveler-${fixture}@example.com`);
    const other = await createUser('TRAVELER', `other-${fixture}@example.com`);
    const { tourId } = await createApprovedTour(agency.id);
    await prisma.tour.update({
      where: { id: tourId },
      data: { agePricing: { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 } },
    });

    const created = await request(app).post('/api/v1/custom-tours').set(bearer(traveler.token)).send({ sourceTourId: tourId, participants: guestTotal(counts) });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    expect((await request(app).patch(`/api/v1/custom-tours/${id}/decision`).set(bearer(agency.token)).send({ decision: 'ACCEPT' })).status).toBe(200);
    expect((await request(app).patch(`/api/v1/custom-tours/${id}/draft`).set(bearer(agency.token)).send({
      revision: 1,
      guestCounts: counts,
      departure: { date: future().toISOString() },
    })).status).toBe(200);
    expect((await request(app).post(`/api/v1/custom-tours/${id}/offers`).set(bearer(agency.token)).send({ revision: 2 })).status).toBe(200);

    const offer = (await request(app).get(`/api/v1/custom-tours/${id}`).set(bearer(traveler.token))).body.data.offer;
    if (options.accept !== false) {
      const accepted = await request(app).post(`/api/v1/custom-tours/${id}/acceptance`).set(bearer(traveler.token)).send({ revision: 2 });
      expect(accepted.status).toBe(200);
    }
    if (options.saveDraft !== false) {
      const saved = await request(app).patch(`/api/v1/custom-tours/${id}/checkout-draft`).set(bearer(traveler.token)).send({
        checkoutRevision: 1,
        contact: { fullName: 'Nguyễn Văn A', phone: '0912345678' },
        passengers: [member(1), member(2), member(3, 'CHILD')],
        notes: 'Đoàn có trẻ nhỏ',
      });
      expect(saved.status).toBe(200);
    }
    return { agency, traveler, other, id, offer };
  }

  it('creates one booking from the frozen offer and returns that same booking on a retry', async () => {
    const { traveler, id, offer } = await acceptedRequest();

    const first = await book(traveler.token, id, { clientRequestId: 'booking-retry-1' });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      status: 'PENDING',
      participants: 3,
      unitPrice: offer.unitPrice,
      subtotal: offer.subtotal,
      totalAmount: offer.subtotal,
      discountAmount: 0,
      isPaid: false,
      contact: { fullName: 'Nguyễn Văn A', phone: '0912345678' },
      notes: 'Đoàn có trẻ nhỏ',
    });
    expect(first.body.data.bookingCode).toMatch(/^TRP-[A-Z2-9]{8}$/);
    // A batch insert shares one createdAt, so only the membership is guaranteed, not the row order.
    expect(first.body.data.passengers.map((p: { fullName: string }) => p.fullName).sort())
      .toEqual(['Khách thứ 1', 'Khách thứ 2', 'Khách thứ 3']);
    expect(first.body.data.passengers.filter((p: { guestType: string }) => p.guestType === 'CHILD')).toHaveLength(1);

    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: first.body.data.id } });
    expect(stored.customTourRequestId).toBe(id);
    expect(await prisma.bookingPassenger.count({ where: { bookingId: stored.id } })).toBe(3);

    const detail = await request(app).get(`/api/v1/custom-tours/${id}`).set(bearer(traveler.token));
    expect(detail.body.data).toMatchObject({
      nextStep: 'PAY',
      currentBooking: { id: stored.id, bookingCode: stored.bookingCode, status: 'PENDING', isPaid: false },
    });

    // The chat panel and the lists read `list`, not the detail: they need the same booking there.
    const list = await request(app).get('/api/v1/custom-tours?limit=10').set(bearer(traveler.token));
    expect(list.body.data.find((item: { id: string }) => item.id === id)).toMatchObject({
      nextStep: 'PAY',
      currentBooking: { id: stored.id, bookingCode: stored.bookingCode, status: 'PENDING', isPaid: false },
    });

    const retried = await book(traveler.token, id);
    expect(retried.status).toBe(200);
    expect(retried.body.data.id).toBe(stored.id);
    expect(await prisma.booking.count({ where: { customTourRequestId: id } })).toBe(1);
    // The one booking owns the whole departure, so a second create could not have reserved seats anyway.
    expect((await prisma.tourDeparture.findFirstOrThrow({ where: { tourId: stored.tourId } })).remaining).toBe(0);
  });

  it('prices from the accepted snapshot even after the private tour changes', async () => {
    const { traveler, id, offer } = await acceptedRequest();
    const record = await prisma.customTourRequest.findUniqueOrThrow({ where: { id } });
    await prisma.tour.update({ where: { id: record.privateTourId! }, data: { basePrice: 9_000_000 } });

    const created = await book(traveler.token, id);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ unitPrice: offer.unitPrice, subtotal: offer.subtotal, totalAmount: offer.subtotal });
    expect(created.body.data.unitPrice).not.toBe(9_000_000);
  });

  it('refuses to book without a complete passenger form, and stores nothing', async () => {
    const { traveler, id } = await acceptedRequest(guestCounts(2, 1), { saveDraft: false });

    const refused = await book(traveler.token, id);
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.booking.count({ where: { customTourRequestId: id } })).toBe(0);
  });

  it('is only for the traveler who owns an accepted request', async () => {
    const { agency, other, traveler, id } = await acceptedRequest();
    const beforeAcceptance = await acceptedRequest(guestCounts(2, 1), { accept: false, saveDraft: false });

    expect((await book(other.token, id)).status).toBe(404);
    expect((await book(agency.token, id)).status).toBe(403);
    const early = await book(beforeAcceptance.traveler.token, beforeAcceptance.id);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('INVALID_STATE_TRANSITION');
    expect(await prisma.booking.count({ where: { customTourRequestId: id } })).toBe(0);

    const created = await book(traveler.token, id);
    expect(created.status).toBe(201);
    expect(created.body.data.id).toBeTruthy();
  });

  it('lets two submissions race but leaves exactly one live booking', async () => {
    const { traveler, id } = await acceptedRequest();

    const [first, second] = await Promise.all([book(traveler.token, id), book(traveler.token, id)]);
    expect([first.status, second.status].every((status) => status === 200 || status === 201)).toBe(true);
    expect(first.body.data.id).toBe(second.body.data.id);
    expect(await prisma.booking.count({ where: { customTourRequestId: id } })).toBe(1);
    expect(await prisma.bookingPassenger.count({ where: { bookingId: first.body.data.id } })).toBe(3);
  });

  it('books again after the previous booking was cancelled, without touching the offer', async () => {
    const { traveler, id, offer } = await acceptedRequest();
    const first = await book(traveler.token, id);
    expect(first.status).toBe(201);

    expect((await request(app).post(`/api/v1/bookings/${first.body.data.id}/cancel`).set(bearer(traveler.token)).send({})).status).toBe(200);
    const cancelled = await request(app).get(`/api/v1/custom-tours/${id}`).set(bearer(traveler.token));
    expect(cancelled.body.data.currentBooking).toBeUndefined();
    expect(cancelled.body.data.nextStep).toBe('ENTER_PASSENGERS');

    const again = await book(traveler.token, id);
    expect(again.status).toBe(201);
    expect(again.body.data.id).not.toBe(first.body.data.id);
    expect(again.body.data).toMatchObject({ subtotal: offer.subtotal, status: 'PENDING' });
    expect((await prisma.customTourRequest.findUniqueOrThrow({ where: { id } })).offerSnapshot).toMatchObject({ subtotal: offer.subtotal });
  });

  it('rebooks from the same snapshot after the payment window expired', async () => {
    const { traveler, id, offer } = await acceptedRequest();
    const first = await book(traveler.token, id);
    expect(first.status).toBe(201);

    await prisma.booking.update({ where: { id: first.body.data.id }, data: { paymentExpiresAt: new Date(Date.now() - 60_000) } });
    expect(await bookingsService.expirePendingBookings()).toBe(1);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: first.body.data.id } })).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'PAYMENT_EXPIRED',
      isPaid: false,
    });

    const expired = await request(app).get(`/api/v1/custom-tours/${id}`).set(bearer(traveler.token));
    expect(expired.body.data.currentBooking).toBeUndefined();
    expect(expired.body.data.nextStep).toBe('ENTER_PASSENGERS');

    // The old booking is never revived; a new one is created from the frozen offer and its seat hold.
    const again = await book(traveler.token, id);
    expect(again.status).toBe(201);
    expect(again.body.data.id).not.toBe(first.body.data.id);
    expect(again.body.data).toMatchObject({ status: 'PENDING', unitPrice: offer.unitPrice, subtotal: offer.subtotal });
    expect(await prisma.booking.count({ where: { customTourRequestId: id } })).toBe(2);
    expect(await prisma.bookingPassenger.count({ where: { bookingId: again.body.data.id } })).toBe(3);
  });

  it('refuses to book a suspended tour or a departure that has already passed', async () => {
    const { traveler, id } = await acceptedRequest();
    const record = await prisma.customTourRequest.findUniqueOrThrow({ where: { id } });

    await prisma.tour.update({ where: { id: record.privateTourId! }, data: { status: 'SUSPENDED' } });
    const suspended = await book(traveler.token, id);
    expect(suspended.status).toBe(409);
    expect(suspended.body.error.code).toBe('TOUR_UNAVAILABLE');

    await prisma.tour.update({ where: { id: record.privateTourId! }, data: { status: 'APPROVED' } });
    // The offer's frozen day is what the booking may use; move it into the past.
    await prisma.customTourRequest.update({
      where: { id },
      data: { offerSnapshot: { ...(record.offerSnapshot as Record<string, unknown>), departureDate: new Date(Date.now() - 86_400_000).toISOString() } },
    });
    const passed = await book(traveler.token, id);
    expect(passed.status).toBe(409);
    expect(passed.body.error.code).toBe('DEPARTURE_PASSED');
    expect(await prisma.booking.count({ where: { customTourRequestId: id } })).toBe(0);
  });

  it('does not open a second booking path: a private tour is unknown to POST /bookings', async () => {
    const { traveler, id } = await acceptedRequest();
    const record = await prisma.customTourRequest.findUniqueOrThrow({ where: { id } });
    const departure = await prisma.tourDeparture.findFirstOrThrow({ where: { tourId: record.privateTourId! } });

    const direct = await request(app).post('/api/v1/bookings').set(bearer(traveler.token)).send({
      tourId: record.privateTourId,
      departureId: departure.id,
      participants: 3,
      contact: { fullName: 'Nguyễn Văn A', phone: '0912345678' },
    });
    expect(direct.status).toBe(404);
    expect(await prisma.booking.count({ where: { customTourRequestId: id } })).toBe(0);
  });
});
