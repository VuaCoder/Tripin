import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { reviewsRepository } from '../reviews.repository';

const app = createApp();
beforeAll(startDatabase, 120_000); afterAll(stopDatabase); beforeEach(resetDatabase);
async function fixture() {
  const agency = await createUser('AGENCY', 'agency@triage.test');
  const traveler = await createUser('TRAVELER', 'traveler@triage.test');
  const moderator = await createUser('MODERATOR', 'mod@triage.test');
  const { tourId } = await createApprovedTour(agency.id);
  const review = await reviewsRepository.create({ bookingId: randomUUID(), agencyId: agency.id, tourId, tourTitle: 'Tour', travelerId: traveler.id, rating: 4, comment: 'My review of the tour' });
  const report = () => prisma.report.create({ data: { reporterId: traveler.id, targetType: 'REVIEW', targetId: review.id, category: 'INAPPROPRIATE_CONTENT', description: 'Please check this review' } });
  const first = await report(); await report();
  const queue = await request(app).get('/api/v1/moderation/review-triage').set(bearer(moderator.token));
  expect(queue.status).toBe(200);
  const item = queue.body.data[0];
  const decide = (keep: boolean, overrides = {}) => request(app).post(`/api/v1/moderation/review-triage/${review.id}/decision`).set(bearer(moderator.token))
    .send({ keep, reason: 'Reviewed against content policy', contentVersion: item.contentVersion, reportIds: item.reports.map((r: { id: string }) => r.id), ...overrides });
  return { agency, traveler, moderator, tourId, review, report, first, queue, decide };
}
describe('reported-review triage (REVIEW-007)', () => {
  it('groups reports and Keep closes only the displayed report ids, leaving later reports pending', async () => {
    const { queue, decide, report, review } = await fixture();
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.data[0].reportCount).toBe(2);
    const later = await report();
    expect((await decide(true)).status).toBe(200);
    expect(await prisma.review.findUnique({ where: { id: review.id } })).toMatchObject({ status: 'VISIBLE' });
    expect(await prisma.report.count({ where: { status: 'REJECTED' } })).toBe(2);
    expect(await prisma.report.findUnique({ where: { id: later.id } })).toMatchObject({ status: 'OPEN' });
  });
  it('Remove atomically hides the review, resolves reports, updates rating and queues notifications', async () => {
    const { decide, review, tourId } = await fixture();
    expect((await decide(false)).status).toBe(200);
    expect(await prisma.review.findUnique({ where: { id: review.id } })).toMatchObject({ status: 'HIDDEN' });
    expect(await prisma.tour.findUnique({ where: { id: tourId } })).toMatchObject({ ratingCount: 0, ratingAvg: 0 });
    expect(await prisma.report.count({ where: { status: 'RESOLVED' } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { targetId: review.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: 'REVIEW_MODERATED' } })).toBe(2);
    expect(await prisma.mailOutbox.count()).toBe(2);
    expect((await decide(false)).status).toBe(409);
    expect(await prisma.auditLog.count({ where: { targetId: review.id } })).toBe(1);
  });
  it('rejects a stale content token and disallows traveler access', async () => {
    const { review, decide, traveler } = await fixture();
    await prisma.review.update({ where: { id: review.id }, data: { comment: 'Changed while moderator was reading' } });
    expect((await decide(false)).status).toBe(409);
    expect(await prisma.report.count({ where: { status: 'OPEN' } })).toBe(2);
    expect((await request(app).get('/api/v1/moderation/review-triage').set(bearer(traveler.token))).status).toBe(403);
  });
});
