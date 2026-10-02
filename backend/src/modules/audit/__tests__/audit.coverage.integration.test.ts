import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { AUDIT_ACTIONS } from '../audit.types';
import { bearer, createApprovedTour, createCategory, createUser, createVerifiedAgency, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { prisma } from '../../../config/database';
import { randomUUID } from 'node:crypto';

// Real Express app + real PostgreSQL: every privileged mutation leaves EXACTLY ONE audit entry, refused or no-op ones leave none.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const day = 86_400_000;
const oid = () => randomUUID();

interface Actors {
  admin: Awaited<ReturnType<typeof createUser>>;
  moderator: Awaited<ReturnType<typeof createUser>>;
  traveler: Awaited<ReturnType<typeof createUser>>;
  agency: Awaited<ReturnType<typeof createUser>>;
}
async function actors(): Promise<Actors> {
  return {
    admin: await createUser('SUPER_ADMIN', 'admin@example.com'),
    moderator: await createUser('MODERATOR', 'mod@example.com'),
    traveler: await createUser('TRAVELER', 'traveler@example.com'),
    agency: await createVerifiedAgency('agency@example.com'),
  };
}

/** Runs `act`, which must change the audit log by exactly one entry of `action` written by `actor`. */
async function expectOneAudit(action: string, actorId: string, act: () => Promise<{ status: number }>, targetId?: string) {
  const before = await prisma.auditLog.count();
  const res = await act();
  expect(res.status, `${action} request`).toBeLessThan(300);
  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' }, skip: before });
  expect(entries, `${action} must add exactly one entry`).toHaveLength(1);
  expect(entries[0]!.action).toBe(action);
  expect(String(entries[0]!.actorId)).toBe(actorId);
  expect(entries[0]!.actorRole).toMatch(/MODERATOR|SUPER_ADMIN/);
  if (targetId) expect(entries[0]!.targetId).toBe(targetId);
  expect(JSON.stringify(entries[0]!.metadata ?? {})).not.toMatch(/passwordHash|token|secret/i);
  return entries[0]!;
}

async function expectNoAudit(act: () => Promise<{ status: number }>, expectedStatus?: (status: number) => boolean) {
  const before = await prisma.auditLog.count();
  const res = await act();
  if (expectedStatus) expect(expectedStatus(res.status), `status ${res.status}`).toBe(true);
  expect(await prisma.auditLog.count()).toBe(before);
}

describe('audit coverage (integration)', () => {
  it('admin settings: commission, policies, categories, platform promotions, access assignment', async () => {
    const a = await actors();
    const asAdmin = (r: request.Test) => r.set(bearer(a.admin.token));

    await expectOneAudit(AUDIT_ACTIONS.COMMISSION_UPDATED, a.admin.id, () => asAdmin(request(app).put('/api/v1/admin/settings/commission')).send({ ratePercent: 9 }));
    await expectOneAudit(AUDIT_ACTIONS.POLICY_UPDATED, a.admin.id, () => asAdmin(request(app).put('/api/v1/admin/policies/terms')).send({ title: 'Terms of use', content: 'Be nice.' }), 'policy:terms');

    const created = await expectOneAudit(AUDIT_ACTIONS.CATEGORY_CREATED, a.admin.id, () => asAdmin(request(app).post('/api/v1/admin/categories')).send({ name: 'Wellness' }));
    const categoryId = created.targetId!;
    await expectOneAudit(AUDIT_ACTIONS.CATEGORY_UPDATED, a.admin.id, () => asAdmin(request(app).patch(`/api/v1/admin/categories/${categoryId}`)).send({ name: 'Wellness & Spa' }), categoryId);
    await expectOneAudit(AUDIT_ACTIONS.CATEGORY_DELETED, a.admin.id, () => asAdmin(request(app).delete(`/api/v1/admin/categories/${categoryId}`)), categoryId);

    const promo = await expectOneAudit(AUDIT_ACTIONS.PROMOTION_PLATFORM_CHANGED, a.admin.id, () =>
      asAdmin(request(app).post('/api/v1/admin/promotions')).send({
        code: 'PLATFORM5',
        title: 'Platform five',
        discountType: 'PERCENT',
        discountValue: 5,
        startsAt: new Date(Date.now() - day).toISOString(),
        endsAt: new Date(Date.now() + day).toISOString(),
      }),
    );
    await expectOneAudit(AUDIT_ACTIONS.PROMOTION_PLATFORM_CHANGED, a.admin.id, () => asAdmin(request(app).patch(`/api/v1/admin/promotions/${promo.targetId}`)).send({ isActive: false }), promo.targetId ?? undefined);

    await expectOneAudit(AUDIT_ACTIONS.USER_ACCESS_ASSIGNED, a.admin.id, () => asAdmin(request(app).patch(`/api/v1/admin/users/${a.traveler.id}/access`)).send({ extraPermissions: ['audit:view'] }), a.traveler.id);

    // An agency's own promotion is not a privileged platform change.
    await expectNoAudit(() =>
      request(app)
        .post('/api/v1/agency/promotions')
        .set(bearer(a.agency.token))
        .send({ code: 'AGENCY5', title: 'Agency five', discountType: 'PERCENT', discountValue: 5, startsAt: new Date(Date.now() - day).toISOString(), endsAt: new Date(Date.now() + day).toISOString() }),
    );
  });

  it('moderation: tours, agencies, reviews, reports, bans', async () => {
    const a = await actors();
    const asMod = (r: request.Test) => r.set(bearer(a.moderator.token));
    const categoryId = await createCategory();

    // Tour: approve, then suspend; another tour rejected.
    const { tourId } = await createApprovedTour(a.agency.id);
    await prisma.tour.updateMany({ where: { id: tourId }, data: { status: 'PENDING_REVIEW' } });
    await expectOneAudit(AUDIT_ACTIONS.TOUR_VALIDATED, a.moderator.id, () => asMod(request(app).post(`/api/v1/moderation/tours/${tourId}/validate`)).send({ approve: true }), tourId);
    await expectOneAudit(AUDIT_ACTIONS.TOUR_SUSPENDED, a.moderator.id, () => asMod(request(app).post(`/api/v1/moderation/tours/${tourId}/suspend`)).send({ reason: 'Safety complaint' }), tourId);
    const second = await prisma.tour.create({ data: { agencyId: a.agency.id, title: 'Second tour', destination: 'Hue', durationDays: 1, basePrice: 1, categories: { connect: [categoryId].map((id) => ({ id })) }, status: 'PENDING_REVIEW' } });
    await expectOneAudit(AUDIT_ACTIONS.TOUR_VALIDATED, a.moderator.id, () => asMod(request(app).post(`/api/v1/moderation/tours/${second.id}/validate`)).send({ approve: false, reason: 'Photos are missing' }), second.id);

    // Agency verification.
    const pending = await createUser('AGENCY', 'pending@example.com', { agencyProfile: { companyName: 'P Co', licenseNumber: 'LIC-9', verificationStatus: 'PENDING' } });
    await expectOneAudit(AUDIT_ACTIONS.AGENCY_VERIFICATION_DECIDED, a.moderator.id, () => asMod(request(app).post(`/api/v1/moderation/agencies/${pending.id}/verify`)).send({ approve: true }), pending.id);

    // Review hide and restore.
    const review = await prisma.review.create({ data: { bookingId: oid(), tourId: oid(), tourTitle: 'T', agencyId: a.agency.id, travelerId: a.traveler.id, rating: 3, comment: 'It was an average trip.' } });
    await expectOneAudit(AUDIT_ACTIONS.REVIEW_MODERATED, a.moderator.id, () => asMod(request(app).post(`/api/v1/moderation/reviews/${review.id}/moderate`)).send({ hide: true, reason: 'Offensive language' }), review.id);
    await expectOneAudit(AUDIT_ACTIONS.REVIEW_MODERATED, a.moderator.id, () => asMod(request(app).post(`/api/v1/moderation/reviews/${review.id}/moderate`)).send({ hide: false }), review.id);

    // Report decision.
    const report = await prisma.report.create({ data: { reporterId: a.traveler.id, targetType: 'TOUR', targetId: oid(), category: 'OTHER', description: 'Something is wrong here.', agencyId: a.agency.id, status: 'OPEN' } });
    await expectOneAudit(AUDIT_ACTIONS.REPORT_RESOLVED, a.moderator.id, () => asMod(request(app).post(`/api/v1/moderation/reports/${report.id}/resolve`)).send({ decision: 'RESOLVED', note: 'Upheld after review.' }), report.id);

    // Ban and unban.
    await expectOneAudit(AUDIT_ACTIONS.USER_BANNED, a.moderator.id, () => asMod(request(app).post(`/api/v1/moderation/users/${a.traveler.id}/ban`)).send({ reason: 'Chargeback fraud' }), a.traveler.id);
    await expectOneAudit(AUDIT_ACTIONS.USER_UNBANNED, a.moderator.id, () => asMod(request(app).post(`/api/v1/moderation/users/${a.traveler.id}/unban`)).send({}), a.traveler.id);
  });

  it('refused, invalid and no-op privileged requests leave no trace', async () => {
    const a = await actors();
    const { tourId } = await createApprovedTour(a.agency.id);
    const asMod = (r: request.Test) => r.set(bearer(a.moderator.token));
    const asTraveler = (r: request.Test) => r.set(bearer(a.traveler.token));

    // Wrong role.
    await expectNoAudit(() => asTraveler(request(app).put('/api/v1/admin/settings/commission')).send({ ratePercent: 1 }), (s) => s === 403);
    await expectNoAudit(() => asTraveler(request(app).post(`/api/v1/moderation/users/${a.admin.id}/ban`)).send({ reason: 'Because I can' }), (s) => s === 403);
    await expectNoAudit(() => request(app).post(`/api/v1/moderation/tours/${tourId}/suspend`).send({ reason: 'Anonymous' }), (s) => s === 401);
    // Moderators may not use admin functions.
    await expectNoAudit(() => asMod(request(app).put('/api/v1/admin/policies/terms')).send({ title: 'Hijack', content: 'x' }), (s) => s === 403);
    // Invalid input.
    await expectNoAudit(() => request(app).put('/api/v1/admin/settings/commission').set(bearer(a.admin.token)).send({ ratePercent: 500 }), (s) => s === 400);
    await expectNoAudit(() => asMod(request(app).post(`/api/v1/moderation/tours/${tourId}/suspend`)).send({}), (s) => s === 400);
    // Business rules that refuse: banning a super admin, banning yourself, illegal transition, unknown target.
    await expectNoAudit(() => asMod(request(app).post(`/api/v1/moderation/users/${a.admin.id}/ban`)).send({ reason: 'Not allowed' }), (s) => s === 403);
    await expectNoAudit(() => asMod(request(app).post(`/api/v1/moderation/users/${a.moderator.id}/ban`)).send({ reason: 'Self ban' }), (s) => s === 403);
    await expectNoAudit(() => asMod(request(app).post(`/api/v1/moderation/tours/${tourId}/validate`)).send({ approve: true }), (s) => s === 409); // already approved
    await expectNoAudit(() => asMod(request(app).post(`/api/v1/moderation/users/${oid()}/unban`)).send({}), (s) => s === 404);
    // A no-op access assignment (nothing to change) is not a change.
    await expectNoAudit(() => request(app).patch(`/api/v1/admin/users/${a.traveler.id}/access`).set(bearer(a.admin.token)).send({ role: 'TRAVELER' }), (s) => s === 200);
    // Concurrent duplicates: two moderators ban the same person at once - one entry.
    const second = await createUser('MODERATOR', 'mod2@example.com');
    const victim = await createUser('TRAVELER', 'victim@example.com');
    const results = await Promise.all([
      request(app).post(`/api/v1/moderation/users/${victim.id}/ban`).set(bearer(a.moderator.token)).send({ reason: 'Spam accounts' }),
      request(app).post(`/api/v1/moderation/users/${victim.id}/ban`).set(bearer(second.token)).send({ reason: 'Spam accounts' }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: AUDIT_ACTIONS.USER_BANNED, targetId: victim.id } })).toBe(1);
  });

  it('every action declared in AUDIT_ACTIONS is exercised by this file', () => {
    const source = require('node:fs').readFileSync(__filename, 'utf-8') as string;
    const unused = Object.keys(AUDIT_ACTIONS).filter((key) => !source.includes(`AUDIT_ACTIONS.${key}`));
    expect(unused).toEqual([]);
  });
});
