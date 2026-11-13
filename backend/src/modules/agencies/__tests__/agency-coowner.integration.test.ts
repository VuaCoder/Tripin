import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { startDatabase, stopDatabase, resetDatabase, createUser, bearer } from '../../../test/integration';
import { workplacesService } from '../workplaces.service';
import { agencyService } from '../agency.service';
import { agencyAccessService } from '../agency-access.service';
import { agencyWorkService } from '../agency-work.service';

const app = createApp();
beforeAll(startDatabase);
beforeEach(resetDatabase);
afterAll(stopDatabase);

async function fixture() {
  const owner = await createUser('TRAVELER', 'owner@coowner.test');
  const staff = await createUser('TRAVELER', 'staff@coowner.test');
  const agency = await workplacesService.create(owner.id, { companyName: 'Shared company', requestId: randomUUID() });
  const role = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: agency.id, systemRole: 'STAFF' } });
  const member = await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: staff.id, role: 'STAFF', roleId: role.id,
    permissionOverrides: { create: { permission: 'agency:finance-view', effect: 'DENY' } } } });
  const ctx = await agencyService.resolve(owner.id, agency.id);
  const headers = { ...bearer(owner.token), 'X-Agency-Id': agency.id };
  return { owner, staff, agency, member, ctx, headers };
}

describe('adding a co-owner through the existing ownership workflow', () => {
  it('preserves the current owner, clears old staff overrides and gives both the same owner template', async () => {
    const { owner, staff, agency, member, headers } = await fixture();
    await prisma.user.update({ where: { id: staff.id }, data: { phone: '0901234567' } });
    const result = await request(app).patch(`/api/v1/agency/members/${member.id}`).set(headers).send({ role: 'OWNER' });
    expect(result.status).toBe(200);
    expect(await prisma.agencyMember.count({ where: { agencyId: agency.id, role: 'OWNER', status: 'ACTIVE' } })).toBe(2);
    const first = (await agencyService.listForUser(owner.id))[0]!;
    const second = (await agencyService.listForUser(staff.id))[0]!;
    expect(second.roleId).toBe(first.roleId); expect(second.permissions).toEqual(first.permissions);
    expect(first.isPrimaryOwner).toBe(true); expect(first.roleName).toBe('Owner');
    expect(second.isPrimaryOwner).toBe(false); expect(second.roleName).toBe('Co_Owner');
    const roster = await request(app).get('/api/v1/agency/members').set(headers);
    expect(roster.body.data.find((m: { userId: string }) => m.userId === owner.id)).toMatchObject({ isPrimaryOwner: true, roleName: 'Owner' });
    expect(roster.body.data.find((m: { userId: string }) => m.userId === staff.id)).toMatchObject({ isPrimaryOwner: false, roleName: 'Co_Owner' });
    const staffProfile = roster.body.data.find((m: { userId: string }) => m.userId === staff.id);
    expect(staffProfile.user).toMatchObject({ phone: '0901234567', avatarUrl: null });
    expect(staffProfile.user.emailVerifiedAt).toBeTruthy();
    expect(staffProfile.createdAt).toBeTruthy(); expect(staffProfile.updatedAt).toBeTruthy();
    expect(Object.keys(staffProfile.user).sort()).toEqual(['avatarUrl', 'email', 'emailVerifiedAt', 'fullName', 'phone']);
    expect(await prisma.agencyMemberPermissionOverride.count({ where: { memberId: member.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).role).toBe('TRAVELER');
    const selfHeaders = { ...bearer(staff.token), 'X-Agency-Id': agency.id };
    expect((await request(app).patch(`/api/v1/agency/members/${member.id}`).set(selfHeaders).send({ role: 'STAFF' })).status).toBe(403);
  });
  it('rejects a manager trying to promote a member even with permission-management grants', async () => {
    const { agency, member } = await fixture();
    const manager = await createUser('TRAVELER', 'manager@coowner.test');
    await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: manager.id, role: 'MANAGER', permissionOverrides: { create: [
      { permission: 'agency:team-manage', effect: 'ALLOW' },
      { permission: 'agency:permissions-manage', effect: 'ALLOW' },
    ] } } });
    const result = await request(app).patch(`/api/v1/agency/members/${member.id}`).set(bearer(manager.token)).set('X-Agency-Id', agency.id).send({ role: 'OWNER' });
    expect(result.status).toBe(403);
    expect((await prisma.agencyMember.findUniqueOrThrow({ where: { id: member.id } })).role).toBe('STAFF');
  });
  it('rejects inactive or unverified recipients without clearing their previous overrides', async () => {
    const { staff, member, ctx } = await fixture();
    await prisma.agencyMember.update({ where: { id: member.id }, data: { status: 'SUSPENDED' } });
    await expect(agencyService.changeMember(ctx, member.id, { role: 'OWNER' })).rejects.toMatchObject({ statusCode: 409 });
    await prisma.agencyMember.update({ where: { id: member.id }, data: { status: 'ACTIVE' } });
    await prisma.user.update({ where: { id: staff.id }, data: { emailVerifiedAt: null } });
    await expect(agencyService.changeMember(ctx, member.id, { role: 'OWNER' })).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.agencyMemberPermissionOverride.count({ where: { memberId: member.id } })).toBe(1);
  });
  it('keeps tenant isolation and does not let a missing management grant promote ownership', async () => {
    const { owner, member, ctx } = await fixture();
    const other = await workplacesService.create(owner.id, { companyName: 'Other company', requestId: randomUUID() });
    const foreign = await agencyService.resolve(owner.id, other.id);
    await expect(agencyService.changeMember(foreign, member.id, { role: 'OWNER' })).rejects.toMatchObject({ statusCode: 404 });
    await prisma.agencyMemberPermissionOverride.create({ data: { agencyId: ctx.agencyId, memberId: ctx.memberId, permission: 'agency:finance-view', effect: 'DENY' } });
    await expect(agencyService.changeMember(ctx, member.id, { role: 'OWNER' })).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each([{ role: 'STAFF' as const }, { status: 'SUSPENDED' as const }, { status: 'REMOVED' as const }])('protects the primary owner from a co-owner patch %j', async patch => {
    const { staff, agency, member, ctx } = await fixture();
    await agencyService.changeMember(ctx, member.id, { role: 'OWNER' });
    const result = await request(app).patch(`/api/v1/agency/members/${ctx.memberId}`)
      .set(bearer(staff.token)).set('X-Agency-Id', agency.id).send(patch);
    expect(result.status).toBe(403);
    expect(await prisma.agencyMember.findUniqueOrThrow({ where: { id: ctx.memberId } })).toMatchObject({ role: 'OWNER', status: 'ACTIVE' });
  });
  it('blocks access, role-template and scope bypasses against the primary owner', async () => {
    const { staff, agency, member, ctx } = await fixture();
    await agencyService.changeMember(ctx, member.id, { role: 'OWNER' });
    const co = await agencyService.resolve(staff.id, agency.id);
    const primary = await prisma.agencyMember.findUniqueOrThrow({ where: { id: ctx.memberId } });
    await expect(agencyAccessService.setMemberAccess(co, primary.id, { roleId: primary.roleId!, overrides: [{ permission: 'agency:finance-view', effect: 'DENY' }] })).rejects.toMatchObject({ statusCode: 403 });
    await expect(agencyAccessService.saveRole(co, { name: 'Changed owner', permissions: ['agency:context-view'] }, primary.roleId!)).rejects.toMatchObject({ statusCode: 403 });
    await expect(agencyWorkService.setTourScopes(co, primary.id, [])).rejects.toMatchObject({ statusCode: 403 });
    // Even the primary owner cannot quietly restrict a co-owner's shared template.
    await expect(agencyAccessService.setMemberAccess(ctx, member.id, { roleId: primary.roleId!, overrides: [] })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('allows ordinary team work but reserves all co-owner administration to the primary owner', async () => {
    const { staff, agency, member, ctx } = await fixture();
    await agencyService.changeMember(ctx, member.id, { role: 'OWNER' });
    const co = await agencyService.resolve(staff.id, agency.id);
    const third = await createUser('TRAVELER', 'third@coowner.test');
    const role = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: agency.id, systemRole: 'STAFF' } });
    const target = await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: third.id, role: 'STAFF', roleId: role.id } });
    await agencyAccessService.setMemberAccess(co, target.id, { roleId: role.id, overrides: [{ permission: 'agency:finance-view', effect: 'ALLOW' }] });
    await agencyService.changeMember(co, target.id, { status: 'SUSPENDED' });
    await agencyService.changeMember(co, target.id, { status: 'ACTIVE' });
    expect((await agencyService.invite(co, { email: 'invite@coowner.test', role: 'STAFF' })).status).toBe('PENDING');
    await expect(agencyService.changeMember(co, target.id, { role: 'OWNER' })).rejects.toMatchObject({ statusCode: 403 });
    await agencyService.changeMember(ctx, target.id, { role: 'OWNER' });
    await expect(agencyService.changeMember(co, target.id, { role: 'STAFF' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(agencyService.changeMember(co, target.id, { status: 'REMOVED' })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('lets the primary owner downgrade a co-owner and invalidates cached authority', async () => {
    const { staff, agency, member, ctx } = await fixture();
    await agencyService.changeMember(ctx, member.id, { role: 'OWNER' });
    const stale = await agencyService.resolve(staff.id, agency.id);
    await prisma.agencyMemberPermissionOverride.create({ data: { agencyId: agency.id, memberId: member.id, permission: 'agency:permissions-manage', effect: 'ALLOW' } });
    await agencyService.changeMember(ctx, member.id, { role: 'STAFF' });
    const current = await agencyService.resolve(staff.id, agency.id);
    expect(current.memberRole).toBe('STAFF'); expect(current.isPrimaryOwner).toBe(false);
    expect(current.permissions).not.toContain('agency:team-manage');
    expect(current.permissions).not.toContain('agency:permissions-manage');
    expect(await prisma.agencyMemberPermissionOverride.count({ where: { memberId: member.id } })).toBe(0);
    await expect(agencyService.changeMember(stale, ctx.memberId, { status: 'SUSPENDED' })).rejects.toMatchObject({ statusCode: 403 });
    expect((await agencyService.resolve(ctx.actorUserId, agency.id)).isPrimaryOwner).toBe(true);
  });
  it('lets the primary owner suspend and remove a co-owner', async () => {
    const { member, ctx } = await fixture();
    await agencyService.changeMember(ctx, member.id, { role: 'OWNER' });
    expect((await agencyService.changeMember(ctx, member.id, { status: 'SUSPENDED' })).status).toBe('SUSPENDED');
    expect((await agencyService.changeMember(ctx, member.id, { status: 'ACTIVE' })).status).toBe('ACTIVE');
    expect((await agencyService.changeMember(ctx, member.id, { status: 'REMOVED' })).status).toBe('REMOVED');
  });
  it('recognizes the legacy profile owner without guessing from membership ordering', async () => {
    const owner = await createUser('AGENCY', 'legacy@coowner.test', { agencyProfile: { companyName: 'Legacy company' } });
    const ctx = await agencyService.resolve(owner.id, owner.id);
    expect(ctx.isPrimaryOwner).toBe(true);
    expect(ctx.roleName).toBe('Owner');
  });
});
