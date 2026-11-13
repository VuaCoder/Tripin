import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import request from 'supertest';
import { prisma } from '../../../config/database';
import { createApp } from '../../../app';
import { startDatabase, stopDatabase, resetDatabase, createUser, bearer, captureMail, registerAndVerify, PASSWORD } from '../../../test/integration';
import { decodeMailBody } from '../../notifications/mail-outbox';
import { workplacesService, JOIN_CODE_TTL_MS } from '../workplaces.service';
import { agencyService } from '../agency.service';
import { agencyProfileRepository } from '../agency-profile.repository';

const app = createApp();
let mail: ReturnType<typeof captureMail>;
beforeAll(async () => { await startDatabase(); mail = captureMail(); });
beforeEach(resetDatabase);
afterAll(async () => { vi.restoreAllMocks(); await stopDatabase(); });
async function fixture() {
  const owner = await createUser('TRAVELER', 'owner@work.test');
  const staff = await createUser('TRAVELER', 'staff@work.test');
  const agency = await workplacesService.create(owner.id, { companyName: 'Workplace A', requestId: randomUUID() });
  const ctx = await agencyService.resolve(owner.id, agency.id);
  const role = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: agency.id, systemRole: 'STAFF' } });
  return { owner, staff, agency, ctx, role };
}
describe('workplace onboarding, real transactions', () => {
  it('authenticates account first, then creates a tenant and exposes join-code metadata over HTTP', async () => {
    const email = 'new-partner@work.test';
    const account = await registerAndVerify(app, mail, email);
    const login = await request(app).post('/api/v1/auth/agency/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('TRAVELER');
    expect(login.body.data.agencies).toEqual([]);
    expect((await request(app).get('/api/v1/agency/members').set(bearer(account.token))).status).toBe(403);
    const created = await request(app).post('/api/v1/agencies').set(bearer(account.token)).send({ companyName: 'Partner mới', requestId: randomUUID() });
    expect(created.status).toBe(201);
    const agencyId = created.body.data.id;
    expect(agencyId).not.toBe(account.userId);
    const memberships = await request(app).get('/api/v1/users/me/agencies').set(bearer(account.token));
    expect(memberships.body.data).toMatchObject([{ agencyId, memberRole: 'OWNER' }]);
    const generated = await request(app).post('/api/v1/agency/join-codes').set(bearer(account.token)).set('X-Agency-Id', agencyId).send({});
    expect(generated.status).toBe(201);
    expect(generated.body.data.code).toHaveLength(12);
    const current = await request(app).get('/api/v1/agency/join-codes/current').set(bearer(account.token)).set('X-Agency-Id', agencyId);
    expect(current.status).toBe(200);
    expect(current.body.data.id).toBe(generated.body.data.id);
    expect(current.body.data).not.toHaveProperty('code');
  });
  it('supports legacy owners through common registration OTP, password login and 2FA', async () => {
    const email = 'legacy@work.test';
    expect((await request(app).post('/api/v1/auth/agency/register').send({ email, password: PASSWORD, fullName: 'Legacy Owner', phone: '0901234567', companyName: 'Legacy agency', licenseNumber: 'LIC-ABC', address: 'District 1 HCMC' })).status).toBe(201);
    const verified = await request(app).post('/api/v1/auth/verify-otp').send({ email, code: mail.codeFor(email), purpose: 'REGISTER' });
    expect(verified.status).toBe(200); expect(verified.body.data.agencies[0].memberRole).toBe('OWNER');
    const userId = verified.body.data.user.id;
    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200); expect(login.body.data.twoFactorRequired).toBe(true);
    const otp = await request(app).post('/api/v1/auth/verify-otp').send({ email, code: mail.codeFor(email), purpose: 'LOGIN_2FA' });
    expect(otp.status).toBe(200); expect(otp.body.data.agencies[0].memberRole).toBe('OWNER');
  });
  it('accepts an email invitation after common account registration and OTP', async () => {
    const { ctx } = await fixture();
    const email = 'new.member@work.test';
    const invitation = await agencyService.invite(ctx, { email, role: 'STAFF' });
    const outbox = await prisma.mailOutbox.findUniqueOrThrow({ where: { dedupKey: 'agency-invitation:' + invitation.id } });
    const body = decodeMailBody(outbox.text);
    expect(body).toContain('Workplace A');
    expect(body).toContain('Lời mời của tôi');
    expect(body).not.toMatch(/https?:|localhost|token=/i);
    const session = await registerAndVerify(app, mail, email);
    const inbox = await request(app).get('/api/v1/users/me/agency-invitations?page=1').set(bearer(session.token));
    expect(inbox.status).toBe(200);
    expect(inbox.body.data).toMatchObject({ total: 1, page: 1, items: [{ id: invitation.id }] });
    expect(JSON.stringify(inbox.body)).not.toMatch(/tokenHash|invitedByUserId/);
    const accepted = await request(app).post(`/api/v1/agency-invitations/${invitation.id}/accept`).set(bearer(session.token)).send({});
    expect(accepted.status).toBe(200);
    expect((await agencyService.listForUser(session.userId))[0]?.memberRole).toBe('STAFF');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: session.userId } })).role).toBe('TRAVELER');
  });
  it('scopes personal invitations to the authenticated verified email, without a tenant', async () => {
    const { ctx, staff, owner } = await fixture();
    const invitation = await agencyService.invite(ctx, { email: 'STAFF@work.test', role: 'STAFF' });
    const wrong = await request(app).post(`/api/v1/agency-invitations/${invitation.id}/accept`).set(bearer(owner.token)).send({});
    const missing = await request(app).post(`/api/v1/agency-invitations/${randomUUID()}/accept`).set(bearer(owner.token)).send({});
    expect(wrong.status).toBe(404); expect(wrong.body.error).toEqual(missing.body.error);
    expect((await agencyService.myInvitations(owner.id)).total).toBe(0);
    expect((await agencyService.myInvitations(staff.id)).total).toBe(1);
    expect((await request(app).get('/api/v1/users/me/agency-invitations')).status).toBe(401);
    expect((await request(app).get('/api/v1/users/me/agency-invitations?page=0').set(bearer(staff.token))).status).toBe(400);
    await prisma.user.update({ where: { id: staff.id }, data: { emailVerifiedAt: null } });
    await expect(agencyService.myInvitations(staff.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(agencyService.acceptById(staff.id, invitation.id)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('filters expired and revoked invitations and refuses stale acceptance', async () => {
    const { ctx, staff } = await fixture();
    const invitation = await agencyService.invite(ctx, { email: 'staff@work.test', role: 'STAFF' });
    await prisma.agencyInvitation.update({ where: { id: invitation.id }, data: { createdAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) } });
    expect((await agencyService.myInvitations(staff.id)).total).toBe(0);
    await expect(agencyService.acceptById(staff.id, invitation.id)).rejects.toMatchObject({ statusCode: 409 });
    const next = await agencyService.invite(ctx, { email: 'staff@work.test', role: 'STAFF' });
    await agencyService.revoke(ctx, next.id);
    expect((await agencyService.myInvitations(staff.id)).total).toBe(0);
    await expect(agencyService.acceptById(staff.id, next.id)).rejects.toMatchObject({ statusCode: 409 });
    expect(await agencyService.listForUser(staff.id)).toHaveLength(0);
  });
  it('serializes duplicate acceptance, closes a pending code request and preserves other ownership', async () => {
    const { ctx, staff, agency } = await fixture();
    const own = await workplacesService.create(staff.id, { companyName: 'Own company', requestId: randomUUID() });
    const code = await workplacesService.rotateCode(ctx);
    await workplacesService.request(staff.id, code.code);
    const invitation = await agencyService.invite(ctx, { email: 'staff@work.test', role: 'STAFF' });
    const results = await Promise.allSettled([agencyService.acceptById(staff.id, invitation.id), agencyService.acceptById(staff.id, invitation.id)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.agencyMember.count({ where: { userId: staff.id, agencyId: agency.id } })).toBe(1);
    expect(await prisma.agencyJoinRequest.findFirst({ where: { userId: staff.id, agencyId: agency.id } })).toMatchObject({ status: 'CANCELLED' });
    expect((await agencyService.listForUser(staff.id)).find(m => m.agencyId === own.id)?.memberRole).toBe('OWNER');
    expect((await agencyService.myInvitations(staff.id)).total).toBe(0);
  });
  it('rechecks inviter authority and cannot reactivate a suspended membership', async () => {
    const { ctx, staff, owner, agency, role } = await fixture();
    const invitation = await agencyService.invite(ctx, { email: 'staff@work.test', role: 'STAFF' });
    await prisma.user.update({ where: { id: owner.id }, data: { status: 'BANNED' } });
    await expect(agencyService.acceptById(staff.id, invitation.id)).rejects.toMatchObject({ statusCode: 403 });
    await prisma.user.update({ where: { id: owner.id }, data: { status: 'ACTIVE' } });
    await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: staff.id, role: 'STAFF', roleId: role.id, status: 'SUSPENDED' } });
    await expect(agencyService.acceptById(staff.id, invitation.id)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('paginates across invitations from multiple agencies without leaking other emails', async () => {
    const { owner, staff } = await fixture();
    // One pending invitation per agency/email, matching the production unique index.
    for (let i = 0; i < 23; i++) {
      const agency = await workplacesService.create(owner.id, { companyName: `Company ${i}`, requestId: randomUUID() });
      const role = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: agency.id, systemRole: 'STAFF' } });
      await prisma.agencyInvitation.create({ data: { agencyId: agency.id, roleId: role.id,
        email: i === 22 ? 'someone.else@work.test' : 'staff@work.test', role: 'STAFF',
        tokenHash: `fixture-${i}`, invitedByUserId: owner.id, expiresAt: new Date(Date.now() + 60000),
      } });
    }
    const first = await agencyService.myInvitations(staff.id, 1);
    const second = await agencyService.myInvitations(staff.id, 2);
    expect(first.total).toBe(22); expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(2);
    expect(new Set([...first.items, ...second.items].map(i => i.id)).size).toBe(22);
  });
  it('creates independent agencies, preserves identity and serializes idempotent retries', async () => {
    const { owner, staff, agency, role } = await fixture();
    await prisma.agencyMember.create({ data: { userId: staff.id, agencyId: agency.id, role: 'STAFF', roleId: role.id } });
    const input = { companyName: 'Staff owns B', requestId: randomUUID() };
    const [a,b] = await Promise.all([workplacesService.create(staff.id, input), workplacesService.create(staff.id, input)]);
    expect(a.id).toBe(b.id); expect(a.userId).toBeNull(); expect(a.id).not.toBe(staff.id);
    const memberships = await agencyService.listForUser(staff.id);
    expect(memberships.map(m => m.memberRole).sort()).toEqual(['OWNER','STAFF']);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).role).toBe('TRAVELER');
    expect((await agencyService.listForUser(owner.id))).toHaveLength(1);
  });
  it('allows creation without selected agency and refuses unverified accounts and mass assignment', async () => {
    const { owner } = await fixture();
    const created = await request(app).post('/api/v1/agencies').set(bearer(owner.token)).send({ companyName: 'Second workplace', requestId: randomUUID() });
    expect(created.status).toBe(201);
    expect((await request(app).post('/api/v1/agencies').set(bearer(owner.token)).send({ companyName: 'Smuggled', requestId: randomUUID(), userId: owner.id, verificationStatus: 'VERIFIED' })).status).toBe(400);
    await prisma.user.update({ where: { id: owner.id }, data: { emailVerifiedAt: null } });
    await expect(workplacesService.create(owner.id, { companyName: 'No access', requestId: randomUUID() })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('does not expose a former workplace through creation-key replay after removal', async () => {
    const { owner, agency } = await fixture();
    const key = await prisma.agencyCreationKey.findFirstOrThrow({ where: { agencyId: agency.id } });
    await prisma.agencyMember.updateMany({ where: { agencyId: agency.id, userId: owner.id }, data: { status: 'REMOVED' } });
    await expect(workplacesService.create(owner.id, { companyName: 'Workplace A', requestId: key.key })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('rotates and revokes codes; plaintext is never stored or returned by metadata', async () => {
    const { ctx, staff } = await fixture();
    const first = await workplacesService.rotateCode(ctx);
    expect(first.code).toMatch(/^[2-9A-HJ-NP-Z]{12}$/);
    expect(new Date(first.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(JOIN_CODE_TTL_MS);
    const stored = await prisma.agencyJoinCode.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.codeHash).toBe(createHash('sha256').update(first.code).digest('hex'));
    expect(await workplacesService.currentCode(ctx)).not.toHaveProperty('code');
    const second = await workplacesService.rotateCode(ctx);
    await expect(workplacesService.request(staff.id, first.code)).rejects.toMatchObject({ statusCode: 400 });
    await workplacesService.revokeCode(ctx, second.id);
    await expect(workplacesService.request(staff.id, second.code)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('deduplicates pending requests, grants nothing until approval, and retains requests after expiry', async () => {
    const { ctx, staff, agency, role } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    const [a,b] = await Promise.all([workplacesService.request(staff.id, code.code.toLowerCase()), workplacesService.request(staff.id, code.code)]);
    expect(a.id).toBe(b.id); expect(await agencyService.listForUser(staff.id)).toEqual([]);
    expect((await request(app).get('/api/v1/agency/context').set({ ...bearer(staff.token), 'X-Agency-Id': agency.id })).status).toBe(403);
    await prisma.agencyJoinCode.update({ where: { id: code.id }, data: { createdAt: new Date(Date.now()-3600000), expiresAt: new Date(Date.now()-1000) } });
    await Promise.all([workplacesService.review(ctx, a.id, role.id), workplacesService.review(ctx, a.id, role.id)]);
    expect(await prisma.agencyMember.count({ where: { userId: staff.id, agencyId: agency.id } })).toBe(1);
    expect((await agencyService.resolve(staff.id, agency.id)).memberRole).toBe('STAFF');
  });
  it('refuses expired codes and codes whose issuer lost OWNER', async () => {
    const { ctx, staff } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    await prisma.agencyJoinCode.update({ where: { id: code.id }, data: { createdAt: new Date(Date.now()-3600000), expiresAt: new Date(Date.now()-1000) } });
    await expect(workplacesService.request(staff.id, code.code)).rejects.toMatchObject({ statusCode: 400 });
    const next = await workplacesService.rotateCode(ctx);
    await prisma.agencyMember.update({ where: { id: ctx.memberId }, data: { status: 'SUSPENDED' } });
    await expect(workplacesService.request(staff.id, next.code)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects non-owner administration and cross-tenant/OWNER roles', async () => {
    const { ctx, staff, role, agency } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    const join = await workplacesService.request(staff.id, code.code);
    const ownerRole = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: agency.id, systemRole: 'OWNER' } });
    await expect(workplacesService.review(ctx, join.id, ownerRole.id)).rejects.toMatchObject({ statusCode: 400 });
    const second = await workplacesService.create(staff.id, { companyName: 'Other agency', requestId: randomUUID() });
    const foreignRole = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: second.id, systemRole: 'STAFF' } });
    await expect(workplacesService.review(ctx, join.id, foreignRole.id)).rejects.toMatchObject({ statusCode: 400 });
    await workplacesService.review(ctx, join.id, role.id);
    const staffCtx = await agencyService.resolve(staff.id, agency.id);
    await expect(workplacesService.rotateCode(staffCtx)).rejects.toMatchObject({ statusCode: 403 });
    await expect(workplacesService.application(staffCtx)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('rechecks removed owner and banned applicant during approval', async () => {
    const { ctx, staff, role } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    const join = await workplacesService.request(staff.id, code.code);
    await prisma.user.update({ where: { id: staff.id }, data: { status: 'BANNED' } });
    await expect(workplacesService.review(ctx, join.id, role.id)).rejects.toMatchObject({ statusCode: 403 });
    await prisma.agencyMember.update({ where: { id: ctx.memberId }, data: { status: 'REMOVED' } });
    await expect(workplacesService.review(ctx, join.id, role.id)).rejects.toMatchObject({ statusCode: 403 });
    expect(await prisma.agencyMember.count({ where: { userId: staff.id } })).toBe(0);
  });
  it('cancel/reject have terminal states and are scoped to the requester/agency', async () => {
    const { ctx, staff, owner, role } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    const join = await workplacesService.request(staff.id, code.code);
    await expect(workplacesService.cancel(owner.id, join.id)).rejects.toMatchObject({ statusCode: 404 });
    await workplacesService.cancel(staff.id, join.id);
    await expect(workplacesService.review(ctx, join.id, role.id)).rejects.toMatchObject({ statusCode: 409 });
    const next = await workplacesService.request(staff.id, code.code);
    await workplacesService.review(ctx, next.id);
    await expect(workplacesService.review(ctx, next.id, role.id)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('approval and rejection racing reach one terminal state', async () => {
    const { ctx, staff, role } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    const join = await workplacesService.request(staff.id, code.code);
    const results = await Promise.allSettled([workplacesService.review(ctx, join.id, role.id), workplacesService.review(ctx, join.id)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const saved = await prisma.agencyJoinRequest.findUniqueOrThrow({ where: { id: join.id } });
    expect(await prisma.agencyMember.count({ where: { userId: staff.id } })).toBe(saved.status === 'APPROVED' ? 1 : 0);
  });
  it('email acceptance and approval never overwrite the membership role', async () => {
    const { ctx, staff, role } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    const join = await workplacesService.request(staff.id, code.code);
    const inv = await agencyService.invite(ctx, { email: 'staff@work.test', role: 'MANAGER' });
    const token = 'a'.repeat(64);
    await prisma.agencyInvitation.update({ where: { id: inv.id }, data: { tokenHash: createHash('sha256').update(token).digest('hex') } });
    await Promise.allSettled([workplacesService.review(ctx, join.id, role.id), agencyService.accept(staff.id, token)]);
    expect(await prisma.agencyMember.count({ where: { userId: staff.id } })).toBe(1);
    expect((await prisma.agencyJoinRequest.findUniqueOrThrow({ where: { id: join.id } })).status).not.toBe('PENDING');
  });
  it('suspended membership cannot rejoin through a code', async () => {
    const { ctx, staff, agency, role } = await fixture();
    await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: staff.id, roleId: role.id, role: 'STAFF', status: 'SUSPENDED' } });
    const code = await workplacesService.rotateCode(ctx);
    await expect(workplacesService.request(staff.id, code.code)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('independent profile can be submitted, moderated, resubmitted and publicly resolved', async () => {
    const { ctx, agency } = await fixture();
    const mod = await createUser('MODERATOR', 'mod@work.test');
    await expect(workplacesService.saveApplication(ctx, { companyName: 'A' }, true)).rejects.toMatchObject({ statusCode: 400 });
    await workplacesService.saveApplication(ctx, { companyName: 'Legal name', licenseNumber: 'LIC-123', address: 'District 1, HCMC' }, true);
    expect((await agencyProfileRepository.list('PENDING', { page: 1, limit: 20 })).items[0]?.id).toBe(agency.id);
    await agencyProfileRepository.decide({ userId: mod.id, role: 'MODERATOR' }, agency.id, { approve: true });
    expect((await agencyProfileRepository.publicProfile(agency.id)).verified).toBe(true);
    await workplacesService.saveApplication(ctx, { companyName: 'Changed legal name' });
    expect((await workplacesService.application(ctx)).verificationStatus).toBe('UNVERIFIED');
  });
  it('cross-tenant request references and inconsistent request states fail database checks', async () => {
    const { ctx, staff, agency } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    const other = await workplacesService.create(staff.id, { companyName: 'B', requestId: randomUUID() });
    await expect(prisma.agencyJoinRequest.create({ data: { agencyId: other.id, userId: staff.id, joinCodeId: code.id } })).rejects.toThrow();
    await expect(prisma.agencyJoinRequest.create({ data: { agencyId: agency.id, userId: staff.id, joinCodeId: code.id, status: 'APPROVED' } })).rejects.toThrow();
  });
});
