import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { agencyService } from '../agency.service';
import { workplacesService } from '../workplaces.service';

const app = createApp();
beforeAll(startDatabase);
beforeEach(resetDatabase);
afterAll(stopDatabase);

async function fixture() {
  const owner = await createUser('TRAVELER', 'owner@rejoin.test');
  const staff = await createUser('TRAVELER', 'staff@rejoin.test');
  const agency = await workplacesService.create(owner.id, { companyName: 'Rejoin company', requestId: randomUUID() });
  const roles = await prisma.agencyRole.findMany({ where: { agencyId: agency.id } });
  const manager = roles.find(role => role.systemRole === 'MANAGER')!;
  const staffRole = roles.find(role => role.systemRole === 'STAFF')!;
  const tour = await createApprovedTour(agency.id);
  const member = await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: staff.id, role: 'MANAGER', roleId: manager.id,
    permissionOverrides: { create: { permission: 'agency:finance-view', effect: 'ALLOW' } },
    tourScopes: { create: { tourId: tour.tourId, allowedFields: ['title'] } } } });
  const ctx = await agencyService.resolve(owner.id, agency.id);
  const headers = { ...bearer(owner.token), 'X-Agency-Id': agency.id };
  return { owner, staff: { ...staff, email: 'staff@rejoin.test' }, agency, member, ctx, headers, roles, staffRole };
}

async function expectCleanRejoin(memberId: string, agencyId: string, roleId: string) {
  expect(await prisma.agencyMember.findUniqueOrThrow({ where: { id: memberId } })).toMatchObject({ status: 'ACTIVE', roleId });
  expect(await prisma.agencyMember.count({ where: { agencyId } })).toBe(2);
  expect(await prisma.agencyMemberPermissionOverride.count({ where: { memberId } })).toBe(0);
  expect(await prisma.agencyMemberTourScope.count({ where: { memberId } })).toBe(0);
}

describe('removed agency members can rejoin with new consent', () => {
  it('re-invites by email and restores the same member with only the new role', async () => {
    const { staff, agency, member, ctx, headers, roles } = await fixture();
    await agencyService.changeMember(ctx, member.id, { status: 'REMOVED' });
    const accountant = roles.find(role => role.systemRole === 'ACCOUNTANT')!;
    const invited = await request(app).post('/api/v1/agency/invitations').set(headers).send({ email: staff.email, role: 'ACCOUNTANT', roleId: accountant.id });
    expect(invited.status).toBe(201);
    expect(await agencyService.listForUser(staff.id)).toHaveLength(0);
    const accepted = await request(app).post(`/api/v1/agency-invitations/${invited.body.data.id}/accept`).set(bearer(staff.token)).send({});
    expect(accepted.status).toBe(200); expect(accepted.body.data.memberId).toBe(member.id);
    await expectCleanRejoin(member.id, agency.id, accountant.id);
    expect((await prisma.agencyMember.findUniqueOrThrow({ where: { id: member.id } })).createdAt).toEqual(member.createdAt);
  });
  it('allows a new code request but grants nothing until a fresh owner approval', async () => {
    const { staff, agency, member, ctx, staffRole } = await fixture();
    await agencyService.changeMember(ctx, member.id, { status: 'REMOVED' });
    const code = await workplacesService.rotateCode(ctx);
    const pending = await workplacesService.request(staff.id, code.code);
    expect((await workplacesService.request(staff.id, code.code)).id).toBe(pending.id);
    expect(await agencyService.listForUser(staff.id)).toHaveLength(0);
    expect((await prisma.agencyMember.findUniqueOrThrow({ where: { id: member.id } })).status).toBe('REMOVED');
    await workplacesService.review(ctx, pending.id, staffRole.id);
    await expectCleanRejoin(member.id, agency.id, staffRole.id);
  });
  it('revokes older invitations and cancels pending requests when removing a member', async () => {
    const { owner, staff, agency, member, ctx, staffRole } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    const invitation = await prisma.agencyInvitation.create({ data: { agencyId: agency.id, email: staff.email, role: 'STAFF', roleId: staffRole.id,
      tokenHash: randomUUID(), invitedByUserId: owner.id, expiresAt: new Date(Date.now() + 60000) } });
    const pending = await prisma.agencyJoinRequest.create({ data: { agencyId: agency.id, userId: staff.id, joinCodeId: code.id } });
    await agencyService.changeMember(ctx, member.id, { status: 'REMOVED' });
    expect((await prisma.agencyInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status).toBe('REVOKED');
    expect((await prisma.agencyJoinRequest.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('CANCELLED');
    await expect(agencyService.acceptById(staff.id, invitation.id)).rejects.toMatchObject({ statusCode: 409 });
    await expect(workplacesService.review(ctx, pending.id, staffRole.id)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('still blocks suspended members from invitations and code requests', async () => {
    const { staff, member, ctx } = await fixture();
    await agencyService.changeMember(ctx, member.id, { status: 'SUSPENDED' });
    const code = await workplacesService.rotateCode(ctx);
    await expect(workplacesService.request(staff.id, code.code)).rejects.toMatchObject({ statusCode: 409 });
    await expect(agencyService.invite(ctx, { email: staff.email, role: 'STAFF' })).rejects.toMatchObject({ statusCode: 409 });
  });
  it('serializes email acceptance and code approval without duplicating or overwriting the new role', async () => {
    const { staff, agency, member, ctx, staffRole } = await fixture();
    await agencyService.changeMember(ctx, member.id, { status: 'REMOVED' });
    const code = await workplacesService.rotateCode(ctx);
    const pending = await workplacesService.request(staff.id, code.code);
    const invitation = await agencyService.invite(ctx, { email: staff.email, role: 'ACCOUNTANT' });
    await Promise.allSettled([agencyService.acceptById(staff.id, invitation.id), workplacesService.review(ctx, pending.id, staffRole.id)]);
    const current = await prisma.agencyMember.findUniqueOrThrow({ where: { id: member.id } });
    expect(['ACCOUNTANT', 'STAFF']).toContain(current.role);
    await expectCleanRejoin(member.id, agency.id, current.roleId!);
    expect((await prisma.agencyJoinRequest.findUniqueOrThrow({ where: { id: pending.id } })).status).not.toBe('PENDING');
  });
  it('retires stale legacy invitations and requests so a removed member can apply again', async () => {
    const { owner, staff, agency, member, ctx, staffRole } = await fixture();
    const code = await workplacesService.rotateCode(ctx);
    const staleAt = new Date(Date.now() - 60000);
    const oldInvite = await prisma.agencyInvitation.create({ data: { agencyId: agency.id, email: staff.email, role: 'STAFF', roleId: staffRole.id,
      tokenHash: randomUUID(), invitedByUserId: owner.id, createdAt: staleAt, expiresAt: new Date(Date.now() + 60000) } });
    const oldRequest = await prisma.agencyJoinRequest.create({ data: { agencyId: agency.id, userId: staff.id, joinCodeId: code.id, createdAt: staleAt } });
    // Simulate the previous removal workflow that did not invalidate admissions.
    await prisma.agencyMember.update({ where: { id: member.id }, data: { status: 'REMOVED', updatedAt: new Date() } });
    const next = await agencyService.invite(ctx, { email: staff.email, role: 'STAFF' });
    expect(next.id).not.toBe(oldInvite.id);
    expect((await prisma.agencyInvitation.findUniqueOrThrow({ where: { id: oldInvite.id } })).status).toBe('REVOKED');
    await expect(agencyService.acceptById(staff.id, oldInvite.id)).rejects.toMatchObject({ statusCode: 409 });
    const pending = await workplacesService.request(staff.id, code.code);
    expect(pending.id).not.toBe(oldRequest.id);
    expect((await prisma.agencyJoinRequest.findUniqueOrThrow({ where: { id: oldRequest.id } })).status).toBe('CANCELLED');
    await expect(workplacesService.review(ctx, oldRequest.id, staffRole.id)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('does not let another co-manager restore a removed former co-manager', async () => {
    const { staff, agency, member, ctx, staffRole } = await fixture();
    await agencyService.changeMember(ctx, member.id, { role: 'OWNER' });
    const other = await createUser('TRAVELER', 'other@rejoin.test');
    await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: other.id, role: 'STAFF', roleId: staffRole.id } });
    const otherMember = await prisma.agencyMember.findUniqueOrThrow({ where: { agencyId_userId: { agencyId: agency.id, userId: other.id } } });
    await agencyService.changeMember(ctx, otherMember.id, { role: 'OWNER' });
    const co = await agencyService.resolve(other.id, agency.id);
    await agencyService.changeMember(ctx, member.id, { status: 'REMOVED' });
    const code = await workplacesService.rotateCode(ctx);
    const pending = await workplacesService.request(staff.id, code.code);
    await expect(agencyService.invite(co, { email: staff.email, role: 'STAFF' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(workplacesService.review(co, pending.id, staffRole.id)).rejects.toMatchObject({ statusCode: 403 });
    await workplacesService.review(ctx, pending.id, staffRole.id);
    expect((await prisma.agencyMember.findUniqueOrThrow({ where: { id: member.id } })).role).toBe('STAFF');
  });
});
