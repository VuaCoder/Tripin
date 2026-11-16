import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { prisma } from '../../../config/database';
import { startDatabase, stopDatabase, resetDatabase, createUser, createApprovedTour, bearer } from '../../../test/integration';
import { createApp } from '../../../app';
import { completionService, DAY } from '../completion.service';
import { deliverPendingCompletions, remindDueCompletions } from '../completion.jobs';
import * as audit from '../../audit/audit.writer';
import * as notifications from '../../notifications/notifications.writer';

const app = createApp();
beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(resetDatabase);

async function fixture(count = 1, daysAhead = -5, historicalLast = false) {
  const owner = await createUser('AGENCY', `owner-${randomUUID()}@test.dev`);
  const traveler = await createUser('TRAVELER', `traveler-${randomUUID()}@test.dev`);
  const tour = await createApprovedTour(owner.id, { daysAhead, capacity: 500 });
  const start = (await prisma.tourDeparture.findUniqueOrThrow({ where: { id: tour.departureId } })).date;
  const end = new Date(start.getTime() + 2 * DAY);
  const bookings = await Promise.all(Array.from({ length: count }, (_, index) => prisma.booking.create({ data: {
    bookingCode: `TEST-${randomUUID()}`, travelerId: traveler.id, agencyId: owner.id, tourId: tour.tourId, departureId: tour.departureId,
    participants: 1, tourTitle: 'Ha Long Bay 2D1N', departureDate: start, endDate: end,
    contactName: 'Traveler', contactPhone: '0901234567', unitPrice: 100000, subtotal: 100000, totalAmount: 100000,
    commissionBps: 1000, commissionAmount: 10000, agencyAmount: 90000,
    status: historicalLast && index === count - 1 ? 'COMPLETED' : 'CONFIRMED', isPaid: true,
    ...(historicalLast && index === count - 1 ? { completedAt: end } : {}),
  } } )));
  const actor = { agencyId: owner.id, userId: owner.id, role: 'AGENCY' as const };
  const report = { expectedRevision: 0, actualEndAt: end.toISOString(), summary: 'Chuyến đi diễn ra đúng lịch trình đã thống nhất.', changes: '', incidents: '', evidence: [], amendmentReason: '', attendance: bookings.map(b => ({ bookingId: b.id, attendedCount: b.participants })) };
  const endpoint = `/api/v1/agency/tours/${tour.tourId}/departures/${tour.departureId}/completion`;
  return { owner, traveler, tour, bookings, actor, report, end, endpoint };
}

describe('Agency departure completion', () => {
  it('confirms only add-ons purchased in eligible bookings, freezing checkout names and aggregate quantities', async () => {
    const f = await fixture(3);
    const extra = { serviceId: 'pickup', name: 'Đưa đón sân bay', unit: 'khách', quantity: 2, terms: 'original terms', participants: [{ fullName: 'PRIVATE_EXTRA_PASSENGER' }], pickups: [{ address: 'PRIVATE_PICKUP_ADDRESS' }] };
    await prisma.booking.update({ where: { id: f.bookings[0]!.id }, data: { serviceSnapshot: [extra] } });
    await prisma.booking.update({ where: { id: f.bookings[1]!.id }, data: { serviceSnapshot: [{ ...extra, quantity: 1 }] } });
    await prisma.booking.update({ where: { id: f.bookings[2]!.id }, data: { serviceSnapshot: [{ ...extra, quantity: 99 }], status: 'CANCELLED' } });
    await prisma.tour.update({ where: { id: f.tour.tourId }, data: { optionalServices: [{ ...extra, name: 'New catalog name' }] } });
    const detail = await request(app).get(f.endpoint).set(bearer(f.owner.token));
    expect(detail.status).toBe(200);
    expect(detail.body.data.bookedServices).toEqual([expect.objectContaining({ key: expect.any(String), serviceId: 'pickup', name: extra.name, quantity: 3, bookingCount: 2 })]);
    expect(JSON.stringify(detail.body)).not.toContain('PRIVATE_EXTRA_PASSENGER');
    expect(JSON.stringify(detail.body)).not.toContain('PRIVATE_PICKUP_ADDRESS');
    const report = { ...f.report, attendance: f.report.attendance.slice(0, 2) };
    const send = (body: object, action = 'submit') => request(app).post(`${f.endpoint}/${action}`).set(bearer(f.owner.token)).send(body);
    expect((await send(report)).status).toBe(400);
    expect((await send({ ...report, serviceConfirmations: [{ key: 'f'.repeat(64), status: 'PROVIDED' }] })).status).toBe(400);
    const key = detail.body.data.bookedServices[0].key;
    expect((await send({ ...report, serviceConfirmations: [{ key, status: 'UNCONFIRMED' }] })).status).toBe(400);
    const response = await send({ ...report, serviceConfirmations: [{ key, status: 'PARTIALLY_PROVIDED' }] });
    expect(response.status).toBe(200);
    expect(response.body.data.reports[0].payload).toMatchObject({ bookedServices: detail.body.data.bookedServices, serviceConfirmations: [{ key, status: 'PARTIALLY_PROVIDED' }] });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.bookings[2]!.id } })).status).toBe('CANCELLED');
  });
  it('saves the expanded report, separates absence from incidents, and preserves versions', async () => {
    const f = await fixture(2);
    const report = { ...f.report, attendance: [], actualParticipants: 1, actualGuests: { adults: 1, children: 0, infants: 0 },
      noChanges: true, noIncidents: true, services: { transport: 'PROVIDED', guide: 'PROVIDED', entranceTickets: 'NOT_APPLICABLE' },
      absenceReason: 'Một khách báo ốm, Agency đã liên hệ và xác nhận không tham gia.',
      additionalNotes: 'Đã bàn giao hành lý.', evidence: ['https://res.cloudinary.com/test/tour.jpg'] };
    const draft = await request(app).post(`${f.endpoint}/draft`).set(bearer(f.owner.token)).send(report);
    expect(draft.status).toBe(200);
    expect(draft.body.data.reports[0].payload).toMatchObject({ ...report, attendance: expect.any(Array) });
    const completed = await request(app).post(`${f.endpoint}/submit`).set(bearer(f.owner.token)).send({ ...report, expectedRevision: 1 });
    expect(completed.status).toBe(200);
    expect(completed.body.data.reports[0].payload).toMatchObject({ ...report, expectedRevision: 1, attendance: expect.any(Array) });
    const amendment = await request(app).post(`${f.endpoint}/submit`).set(bearer(f.owner.token)).send({ ...report, expectedRevision: 2, additionalNotes: 'Đã đối soát dịch vụ với đối tác.', amendmentReason: 'Bổ sung sau khi đối soát dịch vụ.' });
    expect(amendment.status).toBe(200);
    expect(amendment.body.data.reports[0].payload.additionalNotes).toContain('đối soát');
    expect(amendment.body.data.reports[1].payload.additionalNotes).toBe(report.additionalNotes);
    expect(await prisma.tourCompletionDelivery.count()).toBe(2);
  });

  it('allows incomplete drafts but rejects missing service confirmation or absence details on submit', async () => {
    const f = await fixture();
    const report = { ...f.report, services: { transport: 'UNCONFIRMED', guide: 'PROVIDED', entranceTickets: 'NOT_APPLICABLE' } };
    expect((await request(app).post(`${f.endpoint}/submit`).set(bearer(f.owner.token)).send(report)).status).toBe(400);
    const services = { ...report.services, transport: 'PROVIDED' };
    for (const extra of [{ noChanges: false }, { noIncidents: false }, { noChanges: true, changes: 'Có thay đổi chưa được xác nhận.' }, { actualParticipants: 0, attendance: [], absenceReason: '' }]) {
      expect((await request(app).post(`${f.endpoint}/submit`).set(bearer(f.owner.token)).send({ ...report, services, ...extra })).status).toBe(400);
    }
    expect(await prisma.tourCompletionReport.count()).toBe(0);
    expect((await request(app).post(`${f.endpoint}/draft`).set(bearer(f.owner.token)).send(report)).status).toBe(200);
  });

  it('closes 50 bookings once, leaves other departures/cancellations intact and delivers retryable fanout', async () => {
    const f = await fixture(51);
    const other = await prisma.tourDeparture.create({ data: { tourId: f.tour.tourId, date: new Date(Date.now() + DAY), capacity: 50, remaining: 50 } });
    const untouched = await prisma.booking.create({ data: { ...f.bookings[0]!, id: randomUUID(), bookingCode: randomUUID(), departureId: other.id,
      serviceSnapshot: [], guestPricing: undefined, passengerSnapshot: undefined, cancellationPolicySnapshot: undefined } });
    await prisma.booking.update({ where: { id: f.bookings[50]!.id }, data: { status: 'CANCELLED' } });
    f.report.attendance.pop();
    const results = await Promise.allSettled([1, 2].map(() => completionService.save(f.actor, f.tour.tourId, f.tour.departureId, f.report, true)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.booking.count({ where: { departureId: f.tour.departureId, status: 'COMPLETED' } })).toBe(50);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: untouched.id } })).status).toBe('CONFIRMED');
    expect(await prisma.tourCompletionReport.count()).toBe(1);
    expect(await prisma.tourCompletionDelivery.count()).toBe(50);
    await Promise.all([deliverPendingCompletions(), deliverPendingCompletions()]);
    expect(await prisma.notification.count({ where: { type: 'BOOKING_COMPLETED' } })).toBe(50);
    expect(await deliverPendingCompletions()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'tour.completion_submitted' } })).toBe(1);
  });

  it('persists drafts without completing, versions amendments, freezes the snapshot and refuses stale writes', async () => {
    const f = await fixture();
    const draft = await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, f.report, false);
    expect(draft.completedAt).toBeNull();
    expect(await prisma.tourCompletionDelivery.count()).toBe(0);
    await prisma.tour.update({ where: { id: f.tour.tourId }, data: { title: 'A changed catalog title' } });
    await expect(completionService.save(f.actor, f.tour.tourId, f.tour.departureId, f.report, true)).rejects.toMatchObject({ code: 'CONCURRENT_UPDATE' });
    const completed = await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, { ...f.report, expectedRevision: 1 }, true);
    expect(completed.snapshot).toMatchObject({ title: 'Ha Long Bay 2D1N' });
    const amended = await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, { ...f.report, expectedRevision: 2, amendmentReason: 'Bổ sung thông tin sau đối soát' }, true);
    expect(amended.reports).toHaveLength(3);
    expect(amended.completedAt).toEqual(completed.completedAt);
    expect(await prisma.tourCompletionDelivery.count()).toBe(1);
  });

  it('rolls back report and bookings when audit fails', async () => {
    const f = await fixture();
    const spy = vi.spyOn(audit, 'writeAudit').mockRejectedValueOnce(new Error('audit unavailable'));
    try { await expect(completionService.save(f.actor, f.tour.tourId, f.tour.departureId, f.report, true)).rejects.toThrow('audit unavailable'); }
    finally { spy.mockRestore(); }
    expect(await prisma.tourCompletionReport.count()).toBe(0);
    expect(await prisma.tourCompletionDelivery.count()).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.bookings[0]!.id } })).status).toBe('CONFIRMED');
  });

  it('reminds at +24h, deduplicates concurrent workers, escalates after 72h and stops after submission', async () => {
    const f = await fixture();
    expect(await remindDueCompletions(new Date(f.end.getTime() + DAY - 1))).toBe(0);
    await Promise.all([remindDueCompletions(new Date(f.end.getTime() + DAY)), remindDueCompletions(new Date(f.end.getTime() + DAY))]);
    expect(await prisma.notification.count({ where: { type: 'TOUR_COMPLETION_DUE' } })).toBe(1);
    expect(await remindDueCompletions(new Date(f.end.getTime() + 3 * DAY))).toBe(1);
    expect(await prisma.notification.count({ where: { type: 'TOUR_COMPLETION_OVERDUE' } })).toBe(1);
    await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, f.report, true);
    expect(await remindDueCompletions(new Date(f.end.getTime() + 5 * DAY))).toBe(0);
  });

  it('retries an entirely rolled-back delivery, including earning and ticket side effects', async () => {
    const f = await fixture();
    const guide = await createUser('TOUR_GUIDE', 'guide@test.dev');
    await prisma.tourGuideAssignment.create({ data: { tourId: f.tour.tourId, guideId: guide.id, status: 'ACCEPTED', feePerBooking: 90000 } });
    await prisma.eTicket.create({ data: { bookingId: f.bookings[0]!.id, bookingCode: f.bookings[0]!.bookingCode, code: randomUUID(), travelerId: f.traveler.id, agencyId: f.owner.id, tourId: f.tour.tourId, tourTitle: 'Tour', departureDate: f.bookings[0]!.departureDate, participants: 1, holderName: 'Traveler', issuedAt: new Date() } });
    await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, f.report, true);
    const spy = vi.spyOn(notifications, 'writeNotification').mockRejectedValueOnce(new Error('notification failed'));
    try { expect(await deliverPendingCompletions()).toBe(0); } finally { spy.mockRestore(); }
    expect(await prisma.earning.count()).toBe(0);
    expect((await prisma.eTicket.findFirstOrThrow()).status).toBe('VALID');
    expect(await deliverPendingCompletions(new Date(Date.now() + 2 * 60000))).toBe(1);
    expect(await prisma.earning.count()).toBe(1);
    expect((await prisma.eTicket.findFirstOrThrow()).status).toBe('USED');
  });

  it('rejects cross-tenant access, premature submission, duplicate attendance and old completion endpoints', async () => {
    const f = await fixture();
    const stranger = await createUser('AGENCY', 'stranger@test.dev');
    expect((await request(app).get(f.endpoint).set(bearer(stranger.token))).status).toBe(404);
    expect((await request(app).get(f.endpoint).set(bearer(f.traveler.token))).status).toBe(403);
    await expect(completionService.save(f.actor, f.tour.tourId, f.tour.departureId, { ...f.report, attendance: [...f.report.attendance, ...f.report.attendance] }, true)).rejects.toMatchObject({ statusCode: 400 });
    const future = await fixture(1, -1);
    await expect(completionService.save(future.actor, future.tour.tourId, future.tour.departureId, future.report, true)).rejects.toMatchObject({ code: 'TRIP_NOT_ENDED' });
    const unstarted = await fixture(1, 2);
    await expect(completionService.get(unstarted.owner.id, unstarted.tour.tourId, unstarted.tour.departureId)).rejects.toMatchObject({ code: 'TRIP_NOT_STARTED' });
    const old = await request(app).post(`/api/v1/bookings/${f.bookings[0]!.id}/complete`).set(bearer(f.traveler.token));
    expect(old.status).toBe(409);
    expect(old.body.error.code).toBe('AGENCY_COMPLETION_REQUIRED');
  });

  it('lists only ended, uncompleted departures and rejects a revoked manager at submit time', async () => {
    const f = await fixture();
    await fixture(1, -1);
    const list = await request(app).get('/api/v1/agency/completions').set(bearer(f.owner.token));
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].departureId).toBe(f.tour.departureId);
    const manager = await createUser('TRAVELER', 'manager@test.dev');
    await prisma.agencyMember.create({ data: { agencyId: f.owner.id, userId: manager.id, role: 'MANAGER', status: 'SUSPENDED' } });
    await expect(completionService.save({ ...f.actor, userId: manager.id, role: 'TRAVELER' }, f.tour.tourId, f.tour.departureId, f.report, true)).rejects.toMatchObject({ statusCode: 403 });
    await prisma.agencyMember.update({ where: { agencyId_userId: { agencyId: f.owner.id, userId: manager.id } }, data: { status: 'ACTIVE' } });
    expect((await request(app).get('/api/v1/agency/completions').set({ ...bearer(manager.token), 'X-Agency-Id': f.owner.id })).status).toBe(200);
    await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, f.report, true);
    expect((await request(app).get('/api/v1/agency/completions').set(bearer(f.owner.token))).body.data.items).toHaveLength(0);
  });

  it('records an absent group, omits the review invitation and preserves historical completed bookings', async () => {
    const f = await fixture(2, -5, true);
    const report = { ...f.report, attendance: f.report.attendance.map((a, i) => ({ ...a, attendedCount: i === 0 ? 0 : 1 })), incidents: 'Nhóm khách không tham gia chuyến đi.' };
    await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, report, true);
    await deliverPendingCompletions();
    const notification = await prisma.notification.findFirstOrThrow({ where: { type: 'BOOKING_COMPLETED' } });
    expect(notification.data).toMatchObject({ reviewEligible: 'false' });
    expect(await prisma.tourCompletionDelivery.count()).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.bookings[1]!.id } })).attendedParticipants).toBeNull();
    expect((await request(app).post('/api/v1/reviews').set(bearer(f.traveler.token)).send({ bookingId: f.bookings[0]!.id, rating: 5, comment: 'Nội dung đánh giá chuyến đi.' })).body.error.code).toBe('BOOKING_NOT_ATTENDED');
  });

  it('moves submitted departures into tenant-scoped history and preserves report links', async () => {
    const f = await fixture(3);
    await prisma.tour.update({ where: { id: f.tour.tourId }, data: { images: ['https://res.cloudinary.com/test/cover.jpg', 'https://res.cloudinary.com/test/second.jpg'], destination: 'Đà Nẵng' } });
    const other = await fixture();
    await completionService.save(other.actor, other.tour.tourId, other.tour.departureId, other.report, true);
    const get = (status: string) => request(app).get('/api/v1/agency/completions').query({ status }).set(bearer(f.owner.token));
    expect((await get('pending')).body.data.items[0]).toMatchObject({ coverImage: 'https://res.cloudinary.com/test/cover.jpg', destination: 'Đà Nẵng', durationDays: 2 });
    expect((await get('completed')).body.data.items).toHaveLength(0);
    await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, f.report, true);
    expect((await get('pending')).body.data.items).toHaveLength(0);
    const history = await get('completed');
    expect(history.status).toBe(200);
    expect(history.body.data.items).toHaveLength(1);
    expect(history.body.data.items[0]).toMatchObject({ departureId: f.tour.departureId, tourId: f.tour.tourId, hasReport: true, bookingCount: 3, participants: 3, completedAt: expect.any(String) });
    expect(history.body.data.items[0]).toMatchObject({ coverImage: 'https://res.cloudinary.com/test/cover.jpg', destination: 'Đà Nẵng', durationDays: 2 });
    expect((await request(app).get(f.endpoint).set(bearer(f.owner.token))).body.data.reports[0].submitted).toBe(true);
    expect((await get('unknown')).status).toBe(400);
    expect((await request(app).get('/api/v1/agency/completions?status=completed').set(bearer(f.traveler.token))).status).toBe(403);
  });

  it('includes legacy completed departures in history without inventing an Agency report', async () => {
    const f = await fixture(1, -5, true);
    const res = await request(app).get('/api/v1/agency/completions?status=completed').set(bearer(f.owner.token));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ departureId: f.tour.departureId, hasReport: false });
    expect(await prisma.tourCompletionReport.count()).toBe(0);
  });

  it('blocks legacy workers from completing bookings without submitted attendance', async () => {
    const f = await fixture();
    await expect(prisma.booking.update({ where: { id: f.bookings[0]!.id }, data: { status: 'COMPLETED', completedAt: new Date() } })).rejects.toThrow('AGENCY_COMPLETION_REQUIRED');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.bookings[0]!.id } })).status).toBe('CONFIRMED');
    await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, f.report, false);
    await expect(prisma.booking.update({ where: { id: f.bookings[0]!.id }, data: { status: 'COMPLETED' } })).rejects.toThrow('AGENCY_COMPLETION_REQUIRED');
    await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, { ...f.report, expectedRevision: 1 }, true);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.bookings[0]!.id } })).status).toBe('COMPLETED');
  });

  it('stores total attendance including children without allocating partial attendance to bookings', async () => {
    const f = await fixture(2);
    await prisma.booking.update({ where: { id: f.bookings[0]!.id }, data: { participants: 3, guestPricing: { guests: { adults: 2, children: 1, infants: 0 } } } });
    await prisma.booking.update({ where: { id: f.bookings[1]!.id }, data: { participants: 5, guestPricing: { guests: { adults: 2, children: 2, infants: 1 } } } });
    const report = { ...f.report, actualEndAt: null, actualParticipants: 6, actualGuests: { adults: 3, children: 2, infants: 1 }, attendance: [], incidents: 'Hai khách không tham gia chuyến đi.' };
    const counts = await request(app).get(f.endpoint).set(bearer(f.owner.token));
    expect(counts.body.data.bookedGuests).toEqual({ adults: 4, children: 3, infants: 1 });
    const response = await request(app).post(`${f.endpoint}/submit`).set(bearer(f.owner.token)).send(report);
    expect(response.status).toBe(200);
    expect(response.body.data.reports[0].payload).toMatchObject({ actualParticipants: 6, bookedParticipants: 8, actualEndAt: null });
    expect(response.body.data.reports[0].payload.attendance).toEqual(expect.arrayContaining(f.bookings.map(b => ({ bookingId: b.id, attendedCount: null }))));
    expect(response.body.data.bookings.every((b: { status: string; attendedParticipants: number | null }) => b.status === 'COMPLETED' && b.attendedParticipants === null)).toBe(true);
    const moderator = await createUser('MODERATOR', 'aggregate-reader@test.dev');
    const read = await request(app).get(`/api/v1/moderation/tour-completions/${response.body.data.id}`).set(bearer(moderator.token));
    expect(read.body.data.bookedParticipants).toBe(8);
    expect(read.body.data.reports[0].attendedCount).toBe(6);
    expect(read.body.data.reports[0].actualGuests).toEqual({ adults: 3, children: 2, infants: 1 });
    const corrected = await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, { ...report, expectedRevision: 1, actualParticipants: 7, actualGuests: { adults: 4, children: 2, infants: 1 }, amendmentReason: 'Điều chỉnh số khách sau đối soát.' }, true);
    expect(corrected.reports).toHaveLength(2);
    expect(corrected.reports[0]!.payload).toMatchObject({ actualParticipants: 7, actualGuests: { adults: 4, children: 2, infants: 1 } });
    expect(corrected.reports[1]!.payload).toMatchObject({ actualParticipants: 6, actualGuests: { adults: 3, children: 2, infants: 1 } });
  });

  it('validates aggregate counts and records zero attendance for all groups only when the total is zero', async () => {
    const f = await fixture(2);
    const report = { ...f.report, actualEndAt: null, actualParticipants: 3, attendance: [] };
    await expect(completionService.save(f.actor, f.tour.tourId, f.tour.departureId, report, false)).rejects.toMatchObject({ statusCode: 400 });
    const fractional = await request(app).post(`${f.endpoint}/submit`).set(bearer(f.owner.token)).send({ ...report, actualParticipants: 1.5 });
    expect(fractional.status).toBe(400);
    const overGroup = await request(app).post(`${f.endpoint}/submit`).set(bearer(f.owner.token)).send({ ...report, actualParticipants: 2, actualGuests: { adults: 1, children: 1, infants: 0 } });
    expect(overGroup.status).toBe(400);
    const badSum = await request(app).post(`${f.endpoint}/submit`).set(bearer(f.owner.token)).send({ ...report, actualParticipants: 2, actualGuests: { adults: 1, children: 0, infants: 0 } });
    expect(badSum.status).toBe(400);
    await expect(completionService.save(f.actor, f.tour.tourId, f.tour.departureId, { ...report, actualParticipants: 0 }, true)).rejects.toMatchObject({ statusCode: 400 });
    await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, { ...report, actualParticipants: 0, incidents: 'Toàn bộ khách không tham gia chuyến đi.' }, true);
    expect(await prisma.booking.count({ where: { departureId: f.tour.departureId, attendedParticipants: 0, status: 'COMPLETED' } })).toBe(2);
  });

  it('corrects attendance with a reason without completing twice or replaying delivery', async () => {
    const f = await fixture(2);
    const report = { ...f.report, actualParticipants: 0, actualGuests: { adults: 0, children: 0, infants: 0 }, attendance: [], incidents: 'Chưa ghi nhận khách do nhập nhầm số lượng.' };
    const original = await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, report, true);
    await deliverPendingCompletions();
    const notificationsBefore = await prisma.notification.count({ where: { type: 'BOOKING_COMPLETED' } });
    const bookingTimes = await prisma.booking.findMany({ where: { departureId: f.tour.departureId }, select: { id: true, completedAt: true }, orderBy: { id: 'asc' } });
    const correctedReport = { ...report, expectedRevision: 1, actualParticipants: 1, actualGuests: { adults: 1, children: 0, infants: 0 }, amendmentReason: 'Sửa số khách bị nhập nhầm trong báo cáo.' };
    const corrected = await completionService.save(f.actor, f.tour.tourId, f.tour.departureId, correctedReport, true);
    expect(corrected.completedAt).toEqual(original.completedAt);
    expect(corrected.bookings.every(b => b.status === 'COMPLETED' && b.attendedParticipants === null)).toBe(true);
    expect(await prisma.booking.findMany({ where: { departureId: f.tour.departureId }, select: { id: true, completedAt: true }, orderBy: { id: 'asc' } })).toEqual(bookingTimes);
    expect(await prisma.tourCompletionDelivery.count()).toBe(2);
    expect(await deliverPendingCompletions()).toBe(0);
    expect(await prisma.notification.count({ where: { type: 'BOOKING_COMPLETED' } })).toBe(notificationsBefore);
    const auditRow = await prisma.auditLog.findFirstOrThrow({ where: { action: 'tour.completion_amended' } });
    expect(auditRow.metadata).toMatchObject({ attendanceBefore: { total: 0 }, attendanceAfter: { total: 1 }, reason: correctedReport.amendmentReason });
    await expect(completionService.save(f.actor, f.tour.tourId, f.tour.departureId, { ...correctedReport, expectedRevision: 2, amendmentReason: '' }, true)).rejects.toMatchObject({ statusCode: 400 });
    await expect(completionService.save(f.actor, f.tour.tourId, f.tour.departureId, correctedReport, true)).rejects.toMatchObject({ code: 'CONCURRENT_UPDATE' });
  });
});
