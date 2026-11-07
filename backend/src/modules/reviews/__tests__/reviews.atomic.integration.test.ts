import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../config/database';
import { createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { reviewsRepository } from '../reviews.repository';
import { AUDIT_ACTIONS } from '../../audit/audit.types';
import { decodeMailBody } from '../../notifications/mail-outbox';
import { createApp } from '../../../app';
import request from 'supertest';
import { bearer } from '../../../test/integration';
import { reviewContentVersion } from '../reviews.revision';

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);
async function fixture() {
  const agency = await createUser('AGENCY', 'agency@atomic.test');
  const traveler = await createUser('TRAVELER', 'traveler@atomic.test');
  const moderator = await createUser('MODERATOR', 'mod@atomic.test');
  const { tourId } = await createApprovedTour(agency.id);
  return { tourId, moderator, review: { bookingId: randomUUID(), tourId, tourTitle: 'Tour', agencyId: agency.id, travelerId: traveler.id, rating: 4, comment: 'Excellent trip.' } };
}
describe('review/rating/audit atomicity (REVIEW-001, REVIEW-003)', () => {
  it('rejects stale content tokens and CAS guards content changes occurring after the service read', async () => {
    const { review, moderator } = await fixture();
    const created = await reviewsRepository.create(review);
    const contentVersion = reviewContentVersion(created);
    await prisma.review.update({ where: { id: created.id }, data: { comment: 'Changed after moderator opened the dialog' } });
    const response = await request(createApp()).post(`/api/v1/moderation/reviews/${created.id}/moderate`).set(bearer(moderator.token))
      .send({ hide: true, reason: 'Policy violation', contentVersion });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('REVIEW_REVISION_CONFLICT');
    expect(await reviewsRepository.transition(created.id, 'VISIBLE', { status: 'HIDDEN' }, undefined, { comment: created.comment, rating: created.rating, images: created.images })).toBeNull();
    expect(await prisma.review.findUnique({ where: { id: created.id } })).toMatchObject({ status: 'VISIBLE' });
    expect(await prisma.auditLog.count({ where: { targetId: created.id } })).toBe(0);
  });
  it('keeps the aggregate exact when reviews and visibility changes run concurrently', async () => {
    const { review, tourId } = await fixture();
    const created = await Promise.all([1, 2, 3, 4, 5].map((rating) => reviewsRepository.create({ ...review, bookingId: randomUUID(), rating })));
    expect(await prisma.tour.findUnique({ where: { id: tourId } })).toMatchObject({ ratingAvg: 3, ratingCount: 5 });
    await Promise.all(created.slice(0, 2).map((r) => reviewsRepository.transition(r.id, 'VISIBLE', { status: 'HIDDEN' })));
    expect(await prisma.tour.findUnique({ where: { id: tourId } })).toMatchObject({ ratingAvg: 4, ratingCount: 3 });
  });
  it('rolls back review creation if updating the rating fails', async () => {
    const { review, tourId } = await fixture();
    await prisma.$executeRawUnsafe(`CREATE FUNCTION test_rating_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated rating failure'; END; $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER test_rating_failure BEFORE UPDATE ON "Tour" FOR EACH ROW EXECUTE FUNCTION test_rating_failure()`);
    try {
      await expect(reviewsRepository.create(review)).rejects.toThrow();
      expect(await prisma.review.count()).toBe(0);
      expect(await prisma.tour.findUnique({ where: { id: tourId } })).toMatchObject({ ratingAvg: 0, ratingCount: 0 });
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER test_rating_failure ON "Tour"');
      await prisma.$executeRawUnsafe('DROP FUNCTION test_rating_failure()');
    }
  });
  it('rolls back visibility and rating if the mandatory audit write fails', async () => {
    const { review, tourId, moderator } = await fixture();
    const created = await reviewsRepository.create(review);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated audit failure'; END; $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER test_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION test_audit_failure()`);
    try {
      await expect(reviewsRepository.transition(created.id, 'VISIBLE', { status: 'HIDDEN' }, {
        actorId: moderator.id, actorRole: 'MODERATOR', action: AUDIT_ACTIONS.REVIEW_MODERATED, targetType: 'review', targetId: created.id,
      })).rejects.toThrow();
      expect(await prisma.review.findUnique({ where: { id: created.id } })).toMatchObject({ status: 'VISIBLE' });
      expect(await prisma.tour.findUnique({ where: { id: tourId } })).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
      expect(await prisma.auditLog.count({ where: { targetId: created.id } })).toBe(0);
      expect(await prisma.notification.count({ where: { type: 'REVIEW_MODERATED' } })).toBe(0);
      expect(await prisma.mailOutbox.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER test_audit_failure ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION test_audit_failure()');
    }
  });
  it('persists notifications and retryable email for the reviewer and agency, once per decision', async () => {
    const { review, moderator } = await fixture();
    const created = await reviewsRepository.create(review);
    const audit = { actorId: moderator.id, actorRole: 'MODERATOR' as const, action: AUDIT_ACTIONS.REVIEW_MODERATED, targetType: 'review', targetId: created.id, metadata: { reason: 'Violation of the abusive language policy' } };
    await reviewsRepository.transition(created.id, 'VISIBLE', { status: 'HIDDEN' }, audit);
    const notifications = await prisma.notification.findMany({ where: { type: 'REVIEW_MODERATED' } });
    expect(notifications.map((n) => n.userId).sort()).toEqual([review.travelerId, review.agencyId].sort());
    expect(notifications.every((n) => n.body.includes('abusive language policy'))).toBe(true);
    const outbox = await prisma.mailOutbox.findMany();
    expect(outbox).toHaveLength(2);
    expect(outbox.every((mail) => decodeMailBody(mail.text).includes('abusive language policy') && mail.sentAt === null)).toBe(true);
    expect(await reviewsRepository.transition(created.id, 'VISIBLE', { status: 'HIDDEN' }, audit)).toBeNull();
    expect(await prisma.notification.count()).toBe(2);
    expect(await prisma.mailOutbox.count()).toBe(2);
  });
});
