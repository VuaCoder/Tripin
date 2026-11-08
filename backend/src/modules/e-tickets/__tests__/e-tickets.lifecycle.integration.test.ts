import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { bookingsRepository } from '../../bookings/bookings.repository';
import { eTicketsRepository } from '../e-tickets.repository';
import { retryTicketFulfillment } from '../e-tickets.fulfillment';

const app = createApp();
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

async function fixture() {
  const agency = await createUser('AGENCY', 'agency@lifecycle.test');
  const traveler = await createUser('TRAVELER', 'traveler@lifecycle.test');
  const { tourId, departureId } = await createApprovedTour(agency.id);
  const response = await request(app).post('/api/v1/bookings').set(bearer(traveler.token))
    .send({ tourId, departureId, participants: 1, contact: { fullName: 'Test Guest', phone: '0901234567' } });
  expect(response.status).toBe(201);
  const booking = await prisma.booking.update({ where: { id: response.body.data.id }, data: { status: 'CONFIRMED', isPaid: true } });
  const ticket = {
    bookingId: booking.id, bookingCode: booking.bookingCode, code: 'ETK-AAAAAAAAAAAAAAAA',
    travelerId: traveler.id, agencyId: agency.id, tourId, tourTitle: booking.tourTitle,
    departureDate: booking.departureDate, participants: 1, holderName: 'Test Guest', issuedAt: new Date(),
  };
  return { booking, ticket, traveler };
}

describe('ticket lifecycle invariants (BOOK-003, BOOK-012)', () => {
  it('lists tickets by status with the pickup location and checks a QR in only once through the scan API', async () => {
    const { booking, ticket, traveler } = await fixture();
    await prisma.tour.update({ where: { id: booking.tourId }, data: { meetingPoint: 'Pickup point' } });
    await eTicketsRepository.create(ticket);
    const mine = await request(app).get('/api/v1/e-tickets').set(bearer(traveler.token)).query({ status: 'VALID' });
    expect(mine.status).toBe(200);
    expect(mine.body.data[0].tour.meetingPoint).toBe('Pickup point');
    expect((await request(app).get('/api/v1/e-tickets').set(bearer(traveler.token)).query({ status: 'USED' })).body.data).toEqual([]);
    const guide = await createUser('TOUR_GUIDE', 'scanner@lifecycle.test');
    await prisma.tourGuideAssignment.create({ data: { guideId: guide.id, tourId: booking.tourId, status: 'ACCEPTED', feePerBooking: 0 } });
    const scan = (token: string) => request(app).post('/api/v1/e-tickets/scan').set(bearer(token)).send({ tourId: booking.tourId, departureId: booking.departureId, code: ticket.code });
    expect((await scan(traveler.token)).status).toBe(403);
    expect((await scan(guide.token)).status).toBe(200);
    const duplicate = await scan(guide.token);
    expect(duplicate.status).toBe(409); expect(duplicate.body.error.code).toBe('TICKET_ALREADY_USED');
  });
  it('rejects stale issuance after cancellation', async () => {
    const { booking, ticket } = await fixture();
    await bookingsRepository.transition(booking.id, ['CONFIRMED'], { status: 'CANCELLED' });
    await expect(eTicketsRepository.create(ticket)).rejects.toMatchObject({ code: 'BOOKING_NOT_CONFIRMED' });
    expect(await prisma.eTicket.count()).toBe(0);
  });

  it('cancels an issued ticket in the booking cancellation transaction', async () => {
    const { booking, ticket } = await fixture();
    await eTicketsRepository.create(ticket);
    await bookingsRepository.transition(booking.id, ['CONFIRMED'], { status: 'CANCELLED' });
    expect(await prisma.eTicket.findUnique({ where: { bookingId: booking.id } })).toMatchObject({ status: 'CANCELLED', cancelledAt: expect.any(Date) });
  });

  it('never leaves a VALID ticket when issuance races cancellation on separate transactions', async () => {
    const { booking, ticket } = await fixture();
    const results = await Promise.allSettled([
      eTicketsRepository.create(ticket),
      bookingsRepository.transition(booking.id, ['CONFIRMED'], { status: 'CANCELLED' }),
    ]);
    expect(results[1].status).toBe('fulfilled');
    expect(await prisma.booking.findUnique({ where: { id: booking.id } })).toMatchObject({ status: 'CANCELLED' });
    expect(await prisma.eTicket.count({ where: { bookingId: booking.id, status: 'VALID' } })).toBe(0);
  });

  it('guards completion in the database even if a caller bypasses service validation', async () => {
    const { booking } = await fixture();
    expect(await bookingsRepository.transition(booking.id, ['CONFIRMED'], { status: 'COMPLETED' })).toBeNull();
    expect(await prisma.booking.findUnique({ where: { id: booking.id } })).toMatchObject({ status: 'CONFIRMED' });
  });

  it('repairs a missing ticket after three minutes, once even with parallel sweeps', async () => {
    const { booking } = await fixture();
    await prisma.booking.update({ where: { id: booking.id }, data: { confirmedAt: new Date(Date.now() - 4 * 60_000) } });
    await Promise.all([retryTicketFulfillment(), retryTicketFulfillment()]);
    expect(await prisma.eTicket.count({ where: { bookingId: booking.id } })).toBe(1);
    expect(await prisma.booking.findUnique({ where: { id: booking.id } })).toMatchObject({ fulfillmentStatus: 'COMPLETED' });
    expect(await retryTicketFulfillment()).toBe(0);
  });

  it('does not repair a newly confirmed or cancelled booking', async () => {
    const { booking } = await fixture();
    await prisma.booking.update({ where: { id: booking.id }, data: { confirmedAt: new Date() } });
    expect(await retryTicketFulfillment()).toBe(0);
    await bookingsRepository.transition(booking.id, ['CONFIRMED'], { status: 'CANCELLED' });
    expect(await retryTicketFulfillment(new Date(Date.now() + 10 * 60_000))).toBe(0);
    expect(await prisma.eTicket.count()).toBe(0);
  });

  it('persists a failed attempt and repairs it when storage recovers', async () => {
    const { booking } = await fixture();
    const now = new Date();
    await prisma.booking.update({ where: { id: booking.id }, data: { confirmedAt: new Date(now.getTime() - 4 * 60_000) } });
    const create = vi.spyOn(eTicketsRepository, 'create').mockRejectedValueOnce(new Error('temporary storage outage'));
    try {
      expect(await retryTicketFulfillment(now)).toBe(0);
      expect(await prisma.booking.findUnique({ where: { id: booking.id } })).toMatchObject({ fulfillmentStatus: 'FAILED', fulfillmentAttempts: 1 });
      expect(await retryTicketFulfillment(now)).toBe(0);
      expect(await retryTicketFulfillment(new Date(now.getTime() + 3 * 60_000))).toBe(1);
      expect(await prisma.eTicket.count({ where: { bookingId: booking.id } })).toBe(1);
    } finally { create.mockRestore(); }
  });

  it('repairs a completed trip as USED without weakening normal issuance guards', async () => {
    const { booking, ticket } = await fixture();
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'COMPLETED', endDate: new Date(Date.now() - 1), confirmedAt: new Date(Date.now() - 4 * 60_000) } });
    await expect(eTicketsRepository.create(ticket)).rejects.toMatchObject({ code: 'BOOKING_NOT_CONFIRMED' });
    expect(await retryTicketFulfillment()).toBe(1);
    expect(await prisma.eTicket.findUnique({ where: { bookingId: booking.id } })).toMatchObject({ status: 'USED' });
  });
});
