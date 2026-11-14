import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createUser, createVerifiedAgency, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { AUDIT_ACTIONS } from '../../audit/audit.types';
import { systemSettingsService } from '../../system-settings';

const app = createApp();
const scope = (token: string, agencyId: string) => ({ ...bearer(token), 'X-Agency-Id': agencyId });

async function setup() {
  const owner = await createVerifiedAgency('owner@commission.test');
  const manager = await createUser('AGENCY', 'manager@commission.test');
  const accountant = await createUser('AGENCY', 'accountant@commission.test');
  const staff = await createUser('AGENCY', 'staff@commission.test');
  const other = await createVerifiedAgency('other@commission.test');
  const admin = await createUser('SUPER_ADMIN', 'admin@commission.test');
  for (const [userId, role] of [[manager.id, 'MANAGER'], [accountant.id, 'ACCOUNTANT'], [staff.id, 'STAFF']] as const) {
    await prisma.agencyMember.create({ data: { agencyId: owner.id, userId, role } });
  }
  return { owner, manager, accountant, staff, other, admin };
}

let a: Awaited<ReturnType<typeof setup>>;
const createRequest = (token: string, agencyId: string, body: { requestedSharePercent: number; reason: string }) =>
  request(app).post('/api/v1/agency/commission/requests').set(scope(token, agencyId)).send(body);

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(async () => { await resetDatabase(); a = await setup(); });

describe('agency commission requests (integration)', () => {
  it('shows the effective agency share and lets only the owner request a change', async () => {
    const overview = await request(app).get('/api/v1/agency/commission').set(scope(a.owner.token, a.owner.id));
    expect(overview.status).toBe(200);
    expect(overview.body.data.effectiveSharePercent).toBe(100);
    expect(overview.body.data.pendingRequest).toBeNull();

    const created = await createRequest(a.owner.token, a.owner.id, { requestedSharePercent: 20, reason: 'Mùa cao điểm' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'PENDING', currentSharePercent: 100, requestedSharePercent: 20 });

    const audit = await prisma.auditLog.findFirst({ where: { action: AUDIT_ACTIONS.AGENCY_COMMISSION_REQUESTED } });
    expect(audit?.actorId).toBe(a.owner.id);
    expect(audit?.actorRole).toBe('AGENCY');

    expect((await createRequest(a.owner.token, a.owner.id, { requestedSharePercent: 10, reason: 'Lần hai' })).status).toBe(409);
    for (const member of [a.manager, a.accountant, a.staff]) {
      expect((await createRequest(member.token, a.owner.id, { requestedSharePercent: 10, reason: 'Thử quyền' })).status).toBe(403);
    }
    expect((await createRequest(a.owner.token, a.owner.id, { requestedSharePercent: 50.5, reason: 'Quá mức' })).status).toBe(400);
    expect((await createRequest(a.owner.token, a.owner.id, { requestedSharePercent: -1, reason: 'Âm' })).status).toBe(400);
  });

  it('cancels a pending request, and never another agency\'s request', async () => {
    const created = await createRequest(a.owner.token, a.owner.id, { requestedSharePercent: 20, reason: 'Đổi ý' });
    const foreign = await request(app).post(`/api/v1/agency/commission/requests/${created.body.data.id}/cancel`).set(scope(a.other.token, a.other.id));
    expect(foreign.status).toBe(404);

    const cancelled = await request(app).post(`/api/v1/agency/commission/requests/${created.body.data.id}/cancel`).set(scope(a.owner.token, a.owner.id));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    const overview = await request(app).get('/api/v1/agency/commission').set(scope(a.owner.token, a.owner.id));
    expect(overview.body.data.pendingRequest).toBeNull();
  });

  it('approves into the agency override and applies it to future bookings', async () => {
    const created = await createRequest(a.owner.token, a.owner.id, { requestedSharePercent: 20, reason: 'Cam kết doanh số' });

    const list = await request(app).get('/api/v1/admin/settings/agency-commission-requests?status=PENDING').set(bearer(a.admin.token));
    expect(list.status).toBe(200);
    expect(list.body.data.map((row: { id: string }) => row.id)).toContain(created.body.data.id);

    const approved = await request(app)
      .post(`/api/v1/admin/settings/agency-commission-requests/${created.body.data.id}/approve`)
      .set(bearer(a.admin.token)).send({ note: 'Đồng ý' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');

    const profile = await prisma.agencyProfile.findUniqueOrThrow({ where: { id: a.owner.id } });
    expect(profile.commissionRateBps).toBe(8000);
    expect(profile.commissionVersion).toBe(1);
    expect(await systemSettingsService.getCommissionBps(a.owner.id)).toBe(8000);

    const overview = await request(app).get('/api/v1/agency/commission').set(scope(a.owner.token, a.owner.id));
    expect(overview.body.data.effectiveSharePercent).toBe(20);
    expect(overview.body.data.overrideSharePercent).toBe(20);
  });

  it('rejects a stale request instead of overwriting a newer rate', async () => {
    const created = await createRequest(a.owner.token, a.owner.id, { requestedSharePercent: 20, reason: 'Cũ' });
    const direct = await request(app)
      .put(`/api/v1/admin/settings/agency-commissions/${a.owner.id}`)
      .set(bearer(a.admin.token)).send({ ratePercent: 15, expectedVersion: 0 });
    expect(direct.status).toBe(200);

    const approved = await request(app)
      .post(`/api/v1/admin/settings/agency-commission-requests/${created.body.data.id}/approve`)
      .set(bearer(a.admin.token)).send({});
    expect(approved.status).toBe(409);
    expect(approved.body.error.code).toBe('SETTINGS_CONFLICT');
  });

  it('rejects with a required reason and leaves the rate untouched', async () => {
    const created = await createRequest(a.owner.token, a.owner.id, { requestedSharePercent: 30, reason: 'Đề nghị' });
    expect((await request(app).post(`/api/v1/admin/settings/agency-commission-requests/${created.body.data.id}/reject`).set(bearer(a.admin.token)).send({})).status).toBe(400);

    const rejected = await request(app)
      .post(`/api/v1/admin/settings/agency-commission-requests/${created.body.data.id}/reject`)
      .set(bearer(a.admin.token)).send({ note: 'Chưa đủ điều kiện' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect((await prisma.agencyProfile.findUniqueOrThrow({ where: { id: a.owner.id } })).commissionRateBps).toBeNull();
    expect(await prisma.notification.findFirst({ where: { agencyId: a.owner.id, type: 'AGENCY_COMMISSION_DECIDED' } })).not.toBeNull();
  });
});
