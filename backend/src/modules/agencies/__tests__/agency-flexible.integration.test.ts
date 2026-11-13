import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { prisma } from '../../../config/database';
import { createApp } from '../../../app';
import { startDatabase, stopDatabase, createUser, createApprovedTour, bearer } from '../../../test/integration';
import { agencyService } from '../agency.service';
import { AGENCY_ROLE_PERMISSIONS } from '../agency.policy';
import { writeAgencyNotification } from '../../notifications/notifications.writer';
import { notificationsRepository } from '../../notifications/notifications.repository';

const app = createApp();
let owner: Awaited<ReturnType<typeof createUser>>;
let other: Awaited<ReturnType<typeof createUser>>;
let traveler: Awaited<ReturnType<typeof createUser>>;
let memberId: string;
let financeRoleId: string;
const scope = (token: string, agencyId = owner.id) => ({ ...bearer(token), 'X-Agency-Id': agencyId });
const permissions = ['agency:context-view','agency:finance-view'];

beforeAll(async () => {
  await startDatabase();
  owner = await createUser('AGENCY', 'owner@flex.test', { agencyProfile: { companyName: 'Agency A', verificationStatus: 'VERIFIED' } });
  other = await createUser('AGENCY', 'other@flex.test', { agencyProfile: { companyName: 'Agency B', verificationStatus: 'VERIFIED' } });
  traveler = await createUser('TRAVELER', 'traveler@flex.test');
  const member = await prisma.agencyMember.create({ data: { agencyId: owner.id, userId: traveler.id, role: 'STAFF' } });
  memberId = member.id;
});
afterAll(stopDatabase);

describe('tenant-owned roles and member overrides', () => {
  it('seeds all four templates for new onboarding without changing legacy IDs', async () => {
    const profile = await prisma.agencyProfile.findUniqueOrThrow({ where: { id: owner.id } });
    expect(profile.userId).toBe(owner.id);
    const roles = await prisma.agencyRole.findMany({ where: { agencyId: owner.id } });
    expect(roles).toHaveLength(4);
    for (const role of roles) expect([...role.permissions].sort()).toEqual([...AGENCY_ROLE_PERMISSIONS[role.systemRole!]].sort());
    const membership = await prisma.agencyMember.findUniqueOrThrow({ where: { agencyId_userId: { agencyId: owner.id, userId: owner.id } } });
    expect(membership.role).toBe('OWNER'); expect(membership.roleId).not.toBeNull();
  });
  it('creates custom finance role inside the selected tenant', async () => {
    const response = await request(app).post('/api/v1/agency/roles').set(scope(owner.token)).send({ name: 'Finance reader', permissions });
    expect(response.status).toBe(201); financeRoleId = response.body.data.id;
    expect(response.body.data.systemRole).toBeNull();
  });
  it('assigns a custom role without changing the Traveler global identity', async () => {
    const response = await request(app).put(`/api/v1/agency/members/${memberId}/access`).set(scope(owner.token)).send({ roleId: financeRoleId, overrides: [] });
    expect(response.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: traveler.id } })).role).toBe('TRAVELER');
    const context = await request(app).get('/api/v1/agency/context').set(scope(traveler.token));
    expect(context.body.data.roleName).toBe('Finance reader');
    expect(context.body.data.permissions).toEqual([...permissions].sort());
    expect(context.body.data.permissionVersion).toBeGreaterThan(0);
  });
  it('uses effective finance permission, not a global AGENCY role', async () => {
    expect((await request(app).get('/api/v1/agency/finance/summary').set(scope(traveler.token))).status).toBe(200);
    expect((await request(app).post('/api/v1/agency/tours').set(scope(traveler.token)).send({})).status).toBe(403);
  });
  it('DENY overrides the role and blocks a previously issued token', async () => {
    const saved = await request(app).put(`/api/v1/agency/members/${memberId}/access`).set(scope(owner.token)).send({ roleId: financeRoleId, overrides: [{ permission: 'agency:finance-view', effect: 'DENY' }] });
    expect(saved.status).toBe(200);
    expect((await request(app).get('/api/v1/agency/finance/summary').set(scope(traveler.token))).status).toBe(403);
  });
  it('clearing overrides restores inheritance', async () => {
    expect((await request(app).put(`/api/v1/agency/members/${memberId}/access`).set(scope(owner.token)).send({ roleId: financeRoleId, overrides: [] })).status).toBe(200);
    expect((await request(app).get('/api/v1/agency/finance/summary').set(scope(traveler.token))).status).toBe(200);
  });
  it('rejects platform privileges, duplicate overrides and cross-tenant role assignment', async () => {
    expect((await request(app).post('/api/v1/agency/roles').set(scope(owner.token)).send({ name: 'Escalation', permissions: ['agency:context-view','user:assign-permissions'] })).status).toBe(400);
    const foreign = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: other.id, systemRole: 'STAFF' } });
    expect((await request(app).put(`/api/v1/agency/members/${memberId}/access`).set(scope(owner.token)).send({ roleId: foreign.id, overrides: [] })).status).toBe(404);
    await expect(prisma.agencyMember.update({ where: { id: memberId }, data: { roleId: foreign.id } })).rejects.toThrow();
  });
  it('rejects cross-tenant member access and unauthorized role writes', async () => {
    expect((await request(app).put(`/api/v1/agency/members/${memberId}/access`).set(scope(other.token, other.id)).send({ roleId: financeRoleId, overrides: [] })).status).toBe(404);
    expect((await request(app).post('/api/v1/agency/roles').set(scope(traveler.token)).send({ name: 'Mine', permissions })).status).toBe(403);
  });
  it('does not let the primary owner remove or demote their own membership', async () => {
    const ctx = await agencyService.resolve(owner.id, owner.id);
    expect((await request(app).patch(`/api/v1/agency/members/${ctx.memberId}`).set(scope(owner.token)).send({ status: 'SUSPENDED' })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/agency/members/${ctx.memberId}`).set(scope(owner.token)).send({ role: 'STAFF' })).status).toBe(403);
  });
  it('suspension invalidates access immediately, including existing tokens', async () => {
    expect((await request(app).patch(`/api/v1/agency/members/${memberId}`).set(scope(owner.token)).send({ status: 'SUSPENDED' })).status).toBe(200);
    expect((await request(app).get('/api/v1/agency/finance/summary').set(scope(traveler.token))).status).toBe(403);
    expect((await request(app).patch(`/api/v1/agency/members/${memberId}`).set(scope(owner.token)).send({ status: 'ACTIVE' })).status).toBe(200);
  });
  it('supports different roles in two agencies without mixing their grants', async () => {
    await prisma.agencyMember.create({ data: { agencyId: other.id, userId: traveler.id, role: 'STAFF' } });
    expect((await request(app).get('/api/v1/agency/finance/summary').set(scope(traveler.token, other.id))).status).toBe(403);
    expect((await request(app).get('/api/v1/agency/finance/summary').set(scope(traveler.token))).status).toBe(200);
    const noSelection = await request(app).get('/api/v1/agency/context').set(bearer(traveler.token));
    expect(noSelection.status).toBe(403);
  });
  it('STAFF can read tours but cannot edit, change availability or export customers', async () => {
    const tour = await createApprovedTour(other.id);
    expect((await request(app).get('/api/v1/agency/tours').set(scope(traveler.token, other.id))).status).toBe(200);
    expect((await request(app).patch(`/api/v1/agency/tours/${tour.tourId}`).set(scope(traveler.token, other.id)).send({ title: 'Changed title' })).status).toBe(403);
    expect((await request(app).put(`/api/v1/agency/tours/${tour.tourId}/availability`).set(scope(traveler.token, other.id)).send({})).status).toBe(403);
  });
  it('accepts a custom-role invitation without changing the global role', async () => {
    const recipient = await createUser('TRAVELER', 'invitee@flex.test');
    const ctx = await agencyService.resolve(owner.id, owner.id);
    const invite = await agencyService.invite(ctx, { email: 'invitee@flex.test', role: 'STAFF', roleId: financeRoleId });
    expect(invite).not.toHaveProperty('tokenHash');
    // Deterministic test token only; production raw invitation tokens are never returned by API.
    const token = 'a'.repeat(64);
    await prisma.agencyInvitation.update({ where: { id: invite.id }, data: { tokenHash: createHash('sha256').update(token).digest('hex') } });
    expect((await request(app).post('/api/v1/agency-invitations/accept').set(bearer(recipient.token)).send({ token })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: recipient.id } })).role).toBe('TRAVELER');
    expect((await agencyService.resolve(recipient.id, owner.id)).roleId).toBe(financeRoleId);
    expect((await request(app).post('/api/v1/agency-invitations/accept').set(bearer(recipient.token)).send({ token })).status).toBe(400);
  });
  it('audit logs record permission changes against the actor and tenant', async () => {
    const rows = await prisma.auditLog.findMany({ where: { action: 'agency.member_access_changed' } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => row.actorId === owner.id && (row.metadata as { agencyId: string }).agencyId === owner.id)).toBe(true);
  });
  it('scoped editing rejects unassigned tours, undelegated fields and price/status writes', async () => {
    const tour = await createApprovedTour(other.id);
    const ctx = await agencyService.resolve(traveler.id, other.id);
    const endpoint = `/api/v1/agency/work/tours/${tour.tourId}/content`;
    expect((await request(app).patch(endpoint).set(scope(traveler.token, other.id)).send({ title: 'Permitted title' })).status).toBe(403);
    const assigned = await request(app).put(`/api/v1/agency/members/${ctx.memberId}/tour-scopes`).set(scope(other.token, other.id))
      .send({ scopes: [{ tourId: tour.tourId, allowedFields: ['title'] }] });
    expect(assigned.status).toBe(200);
    expect((await request(app).patch(endpoint).set(scope(traveler.token, other.id)).send({ summary: 'Not allowed' })).status).toBe(403);
    expect((await request(app).patch(endpoint).set(scope(traveler.token, other.id)).send({ title: 'Permitted title', basePrice: 1 })).status).toBe(400);
    expect((await request(app).patch(endpoint).set(scope(traveler.token, other.id)).send({ title: 'Permitted title' })).status).toBe(200);
    const stored = await prisma.tour.findUniqueOrThrow({ where: { id: tour.tourId } });
    expect(stored.title).toBe('Permitted title'); expect(stored.basePrice).toBe(1000000n); expect(stored.status).toBe('APPROVED');
    await prisma.tour.update({ where: { id: tour.tourId }, data: { status: 'PENDING_REVIEW' } });
    expect((await request(app).patch(endpoint).set(scope(traveler.token, other.id)).send({ title: 'Changed again' })).status).toBe(409);
  });
  it('does not assign a tour from another agency', async () => {
    const tour = await createApprovedTour(owner.id);
    const ctx = await agencyService.resolve(traveler.id, other.id);
    expect((await request(app).put(`/api/v1/agency/members/${ctx.memberId}/tour-scopes`).set(scope(other.token, other.id))
      .send({ scopes: [{ tourId: tour.tourId, allowedFields: ['title'] }] })).status).toBe(404);
    await expect(prisma.agencyMemberTourScope.create({ data: { agencyId: other.id, memberId: ctx.memberId, tourId: tour.tourId, allowedFields: ['title'] } })).rejects.toThrow();
  });
  it('a delegated permission administrator cannot grant Finance, edit self, or edit OWNER', async () => {
    const manager = await createUser('TRAVELER', 'manager@flex.test');
    const member = await prisma.agencyMember.create({ data: { agencyId: owner.id, userId: manager.id, role: 'MANAGER', permissionOverrides: { create: { permission: 'agency:permissions-manage', effect: 'ALLOW' } } } });
    expect((await request(app).post('/api/v1/agency/roles').set(scope(manager.token)).send({ name: 'Finance escalation', permissions })).status).toBe(403);
    expect((await request(app).put(`/api/v1/agency/members/${member.id}/access`).set(scope(manager.token)).send({ roleId: member.roleId, overrides: [] })).status).toBe(403);
    const ctx = await agencyService.resolve(owner.id, owner.id);
    expect((await request(app).put(`/api/v1/agency/members/${ctx.memberId}/access`).set(scope(manager.token)).send({ roleId: ctx.roleId, overrides: [] })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/agency/roles/${member.roleId}`).set(scope(manager.token)).send({ name: 'Modified self', permissions: ['agency:context-view'] })).status).toBe(403);
  });
  it('rechecks inviter permissions at acceptance, not just when mail was created', async () => {
    const sender = await createUser('TRAVELER', 'sender@flex.test');
    const recipient = await createUser('TRAVELER', 'recipient@flex.test');
    const member = await prisma.agencyMember.create({ data: { agencyId: owner.id, userId: sender.id, role: 'MANAGER', permissionOverrides: { create: { permission: 'agency:team-invite', effect: 'ALLOW' } } } });
    const invitation = await agencyService.invite(await agencyService.resolve(sender.id, owner.id), { email: 'recipient@flex.test', role: 'STAFF' });
    const token = 'b'.repeat(64);
    await prisma.agencyInvitation.update({ where: { id: invitation.id }, data: { tokenHash: createHash('sha256').update(token).digest('hex') } });
    await prisma.agencyMemberPermissionOverride.update({ where: { memberId_permission: { memberId: member.id, permission: 'agency:team-invite' } }, data: { effect: 'DENY' } });
    expect((await request(app).post('/api/v1/agency-invitations/accept').set(bearer(recipient.token)).send({ token })).status).toBe(403);
  });
  it('notification fanout and existing inbox rows honor effective permission overrides', async () => {
    const ctx = await agencyService.resolve(traveler.id, other.id);
    const staffRole = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: other.id, systemRole: 'STAFF' } });
    const access = `/api/v1/agency/members/${ctx.memberId}/access`;
    expect((await request(app).put(access).set(scope(other.token, other.id)).send({ roleId: staffRole.id, overrides: [{ permission: 'agency:bookings-view', effect: 'ALLOW' }] })).status).toBe(200);
    await prisma.$transaction(tx => writeAgencyNotification(tx, other.id, { type: 'BOOKING_CONFIRMED', title: 'Booking test', body: 'Private booking details' }, false));
    expect(await notificationsRepository.countUnread(traveler.id, other.id)).toBe(1);
    expect((await request(app).put(access).set(scope(other.token, other.id)).send({ roleId: staffRole.id, overrides: [{ permission: 'agency:bookings-view', effect: 'DENY' }] })).status).toBe(200);
    expect(await notificationsRepository.countUnread(traveler.id, other.id)).toBe(0);
    const rows = await prisma.$transaction(tx => writeAgencyNotification(tx, other.id, { type: 'BOOKING_CONFIRMED', title: 'New booking', body: 'Private content' }, false));
    expect(rows.some(row => row.userId === traveler.id)).toBe(false);
  });
});
