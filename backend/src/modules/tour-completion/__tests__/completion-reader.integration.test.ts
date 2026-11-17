import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { startDatabase, stopDatabase, resetDatabase, createUser, createApprovedTour, bearer } from '../../../test/integration';

const app = createApp();
const base = '/api/v1/moderation/tour-completions';
beforeAll(startDatabase); afterAll(stopDatabase); beforeEach(resetDatabase);
async function fixture(submitted = true) {
  const owner = await createUser('AGENCY', `owner-${randomUUID()}@test.dev`, { agencyProfile: { companyName: 'Saigon Travel' } });
  const { tourId, departureId } = await createApprovedTour(owner.id, { daysAhead: -5 });
  const start = new Date(Date.now() - 5 * 86400000), end = new Date(Date.now() - 3 * 86400000);
  const completion = await prisma.tourCompletion.create({ data: { agencyId: owner.id, tourId, departureId, scheduledEndAt: end, completedAt: submitted ? new Date() : null,
    snapshot: { title: 'Chuyến đi Đà Nẵng', departureAt: start.toISOString(), durationDays: 2, itinerary: [], guide: { guideId: randomUUID() } } } });
  const booking = await prisma.booking.create({ data: { agencyId: owner.id, tourId, departureId, travelerId: owner.id, bookingCode: randomUUID(), tourTitle: 'Tour', departureDate: start, endDate: end,
    participants: 3, contactName: 'PRIVATE_CONTACT', contactPhone: '0912345678', passengerSnapshot: [{ idCard: 'PRIVATE_ID_CARD' }],
    unitPrice: 100000, subtotal: 300000, totalAmount: 300000, commissionBps: 1000, commissionAmount: 30000, agencyAmount: 270000, status: 'COMPLETED' } });
  const payload = { expectedRevision: 0, actualEndAt: end.toISOString(), summary: 'Báo cáo chuyến đi đã thực hiện đầy đủ.', changes: '', incidents: '', evidence: ['https://example.com/evidence.jpg'], amendmentReason: '', attendance: [{ bookingId: booking.id, attendedCount: 3 }] };
  await prisma.tourCompletionReport.create({ data: { completionId: completion.id, actorId: owner.id, revision: 1, submitted: false, payload: { ...payload, summary: 'DRAFT_PRIVATE' } } });
  if (submitted) await prisma.tourCompletionReport.create({ data: { completionId: completion.id, actorId: owner.id, revision: 2, submitted: true, payload: { ...payload,
    noChanges: true, noIncidents: true, services: { transport: 'PROVIDED', guide: 'PROVIDED', entranceTickets: 'NOT_APPLICABLE' },
    bookedServices: [{ key: 'a'.repeat(64), serviceId: 'meal', name: 'Suất ăn mua thêm', unit: 'suất', quantity: 3, bookingCount: 1 }], serviceConfirmations: [{ key: 'a'.repeat(64), status: 'PROVIDED' }],
    absenceReason: 'Không có khách vắng.', additionalNotes: 'Đã đối soát dịch vụ.' } } });
  return { owner, completion, booking, payload };
}
describe('internal read-only completion reports', () => {
  it('lists every agency including agencies with no submitted report, then scopes reports by agency', async () => {
    const f = await fixture();
    const empty = await fixture(false);
    await prisma.user.update({ where: { id: f.owner.id }, data: { avatarUrl: 'https://res.cloudinary.com/test/agency.jpg' } });
    await prisma.agencyProfile.update({ where: { id: f.owner.id }, data: { address: 'Đà Nẵng' } });
    await prisma.agencyProfile.update({ where: { id: empty.owner.id }, data: { companyName: 'Agency chưa có báo cáo', verificationStatus: 'UNVERIFIED' } });
    const mod = await createUser('MODERATOR', 'directory@test.dev');
    const list = await request(app).get(`${base}/agencies`).set(bearer(mod.token));
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(2);
    expect(list.body.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: f.owner.id, reportCount: 1, avatarUrl: 'https://res.cloudinary.com/test/agency.jpg', address: 'Đà Nẵng', verified: true }),
      expect.objectContaining({ id: empty.owner.id, reportCount: 0, name: 'Agency chưa có báo cáo', lastCompletedAt: null }),
    ]));
    expect(JSON.stringify(list.body)).not.toContain('contactPhone');
    const agency = await request(app).get(`${base}/agencies/${f.owner.id}`).set(bearer(mod.token));
    expect(agency.status).toBe(200);
    expect(agency.body.data).toEqual(list.body.data.items.find((item: { id: string }) => item.id === f.owner.id));
    const emptyAgency = await request(app).get(`${base}/agencies/${empty.owner.id}`).set(bearer(mod.token));
    expect(emptyAgency.body.data).toMatchObject({ reportCount: 0, verified: false });
    expect((await request(app).get(`${base}/agencies/${randomUUID()}`).set(bearer(mod.token))).status).toBe(404);
    expect((await request(app).get(`${base}/agencies/${f.owner.id}`).set(bearer(f.owner.token))).status).toBe(403);
    expect((await request(app).patch(`${base}/agencies/${f.owner.id}`).set(bearer(mod.token)).send({ name: 'Changed' })).status).toBe(404);
    expect((await request(app).get(base).query({ agencyId: empty.owner.id }).set(bearer(mod.token))).body.data.total).toBe(0);
    expect((await request(app).get(base).query({ agencyId: f.owner.id }).set(bearer(mod.token))).body.data.items[0].id).toBe(f.completion.id);
    expect((await request(app).get(`${base}/agencies`).query({ q: 'chưa có' }).set(bearer(mod.token))).body.data.total).toBe(1);
    expect((await request(app).get(`${base}/agencies`).query({ page: 2 }).set(bearer(mod.token))).body.data.items).toHaveLength(0);
    expect((await request(app).get(`${base}/agencies`)).status).toBe(401);
    expect((await request(app).get(`${base}/agencies`).set(bearer(f.owner.token))).status).toBe(403);
    expect((await request(app).post(`${base}/agencies`).set(bearer(mod.token))).status).toBe(404);
  });
  it('allows Moderator/Super Admin to read submitted history, hides drafts and passenger/contact data', async () => {
    const f = await fixture();
    await prisma.tour.update({ where: { id: f.completion.tourId }, data: { images: ['https://res.cloudinary.com/test/cover.jpg'], destination: 'Đà Nẵng' } });
    await fixture(false);
    for (const role of ['MODERATOR', 'SUPER_ADMIN'] as const) {
      const user = await createUser(role, `${role}@test.dev`);
      const list = await request(app).get(base).set(bearer(user.token));
      expect(list.status).toBe(200); expect(list.body.data.total).toBe(1);
      expect(list.body.data.items[0].hasAmendment).toBe(false);
      expect(list.body.data.items[0]).toMatchObject({ tourId: f.completion.tourId, departureId: f.completion.departureId,
        coverImage: 'https://res.cloudinary.com/test/cover.jpg', destination: 'Đà Nẵng', durationDays: 2, endAt: f.completion.scheduledEndAt.toISOString(), bookingCount: 1, participants: 3 });
      const detail = await request(app).get(`${base}/${f.completion.id}`).set(bearer(user.token));
      expect(detail.status).toBe(200);
      expect(detail.body.data.reports).toHaveLength(1);
      expect(detail.body.data.reports[0]).toMatchObject({ revision: 2, summary: f.payload.summary, attendedCount: 3 });
      expect(detail.body.data.reports[0]).toMatchObject({ noChanges: true, noIncidents: true, services: { transport: 'PROVIDED' }, absenceReason: 'Không có khách vắng.', additionalNotes: 'Đã đối soát dịch vụ.' });
      expect(detail.body.data.reports[0]).toMatchObject({ bookedServices: [{ name: 'Suất ăn mua thêm', quantity: 3 }], serviceConfirmations: [{ status: 'PROVIDED' }] });
      expect(detail.body.data.bookedParticipants).toBe(3);
      for (const secret of ['DRAFT_PRIVATE', 'PRIVATE_CONTACT', 'PRIVATE_ID_CARD', '0912345678', 'bookingId', 'guideId']) expect(JSON.stringify(detail.body)).not.toContain(secret);
      expect((await request(app).get(`${base}/by-booking/${f.booking.id}`).set(bearer(user.token))).body.data.id).toBe(f.completion.id);
    }
  });
  it('rejects guests, other roles including delegated grants, revoked permission, and draft-only IDs', async () => {
    const f = await fixture(false);
    expect((await request(app).get(base)).status).toBe(401);
    for (const role of ['TRAVELER', 'AGENCY', 'TOUR_GUIDE'] as const) {
      const user = await createUser(role, `${role}@test.dev`, { extraPermissions: ['tour-completion:view'] });
      expect((await request(app).get(base).set(bearer(user.token))).status).toBe(403);
    }
    const revoked = await createUser('MODERATOR', 'revoked@test.dev', { revokedPermissions: ['tour-completion:view'] });
    expect((await request(app).get(base).set(bearer(revoked.token))).status).toBe(403);
    const mod = await createUser('MODERATOR', 'mod@test.dev');
    expect((await request(app).get(`${base}/${f.completion.id}`).set(bearer(mod.token))).status).toBe(404);
    expect((await request(app).get(`${base}/by-booking/${f.booking.id}`).set(bearer(mod.token))).status).toBe(404);
  });
  it('filters, paginates and never exposes mutation routes', async () => {
    const f = await fixture();
    const mod = await createUser('MODERATOR', 'mod@test.dev');
    expect((await request(app).get(base).query({ q: 'đà nẵng', agency: 'saigon' }).set(bearer(mod.token))).body.data.total).toBe(1);
    expect((await request(app).get(base).query({ agency: 'No match' }).set(bearer(mod.token))).body.data.total).toBe(0);
    expect((await request(app).get(base).query({ page: 2 }).set(bearer(mod.token))).body.data.items).toHaveLength(0);
    expect((await request(app).get(base).query({ from: '2030-01-01', to: '2020-01-01' }).set(bearer(mod.token))).status).toBe(400);
    for (const method of ['post', 'patch', 'delete'] as const) {
      expect((await request(app)[method](`${base}/${f.completion.id}`).set(bearer(mod.token)).send({ summary: 'Change' })).status).toBe(404);
    }
    expect(await prisma.tourCompletionReport.count()).toBe(2);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
