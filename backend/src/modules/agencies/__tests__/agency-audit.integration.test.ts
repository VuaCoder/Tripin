import { beforeAll, afterAll, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../../../config/database';
import { startDatabase, stopDatabase, createUser, createApprovedTour } from '../../../test/integration';
import { AUDIT_ACTIONS } from '../../audit/audit.types';
import { agencyService } from '../agency.service';
import { agencyAccessService } from '../agency-access.service';
import { agencyWorkService } from '../agency-work.service';
import { workplacesService } from '../workplaces.service';

beforeAll(startDatabase);
afterAll(stopDatabase);
it('writes every workplace/team action and never writes join secrets to audit', async () => {
  const owner = await createUser('TRAVELER', 'owner@audit.work');
  const staff = await createUser('TRAVELER', 'staff@audit.work');
  const guest = await createUser('TRAVELER', 'invited@audit.work');
  const agency = await workplacesService.create(owner.id, { requestId: randomUUID(), companyName: 'Agency audit' });
  const ctx = await agencyService.resolve(owner.id, agency.id);
  await workplacesService.saveApplication(ctx, { companyName: 'Agency audit', licenseNumber: 'LIC-123', address: 'HCMC District 1' }, true);
  const code = await workplacesService.rotateCode(ctx);
  const pending = await workplacesService.request(staff.id, code.code);
  const role = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: agency.id, systemRole: 'STAFF' } });
  await workplacesService.review(ctx, pending.id, role.id);
  const member = await prisma.agencyMember.findUniqueOrThrow({ where: { agencyId_userId: { agencyId: agency.id, userId: staff.id } } });
  await agencyAccessService.saveRole(ctx, { name: 'Observer', permissions: ['agency:context-view'] });
  await agencyAccessService.setMemberAccess(ctx, member.id, { roleId: role.id, overrides: [] });
  await agencyService.changeMember(ctx, member.id, { status: 'SUSPENDED' });
  await agencyService.changeMember(ctx, member.id, { status: 'ACTIVE' });
  const revoked = await agencyService.invite(ctx, { email: 'revoked@audit.work', role: 'STAFF' });
  await agencyService.revoke(ctx, revoked.id);
  const invitation = await agencyService.invite(ctx, { email: 'invited@audit.work', role: 'STAFF' });
  const token = 'b'.repeat(64);
  await prisma.agencyInvitation.update({ where: { id: invitation.id }, data: { tokenHash: createHash('sha256').update(token).digest('hex') } });
  await agencyService.accept(guest.id, token);
  const tour = await createApprovedTour(agency.id);
  await agencyWorkService.setTourScopes(ctx, member.id, [{ tourId: tour.tourId, allowedFields: ['title'] }]);
  await agencyWorkService.updateScopedContent(await agencyService.resolve(staff.id, agency.id), tour.tourId, { title: 'Updated scoped title' });
  const rows = await prisma.auditLog.findMany();
  const actions = rows.map(r => r.action);
  for (const action of [AUDIT_ACTIONS.AGENCY_CREATED, AUDIT_ACTIONS.AGENCY_APPLICATION_SAVED,
    AUDIT_ACTIONS.AGENCY_JOIN_CODE_CHANGED, AUDIT_ACTIONS.AGENCY_JOIN_REQUEST_CHANGED,
    AUDIT_ACTIONS.AGENCY_ROLE_SAVED, AUDIT_ACTIONS.AGENCY_MEMBER_ACCESS_CHANGED,
    AUDIT_ACTIONS.AGENCY_MEMBER_CHANGED, AUDIT_ACTIONS.AGENCY_INVITATION_CREATED,
    AUDIT_ACTIONS.AGENCY_INVITATION_REVOKED, AUDIT_ACTIONS.AGENCY_INVITATION_ACCEPTED,
    AUDIT_ACTIONS.AGENCY_TOUR_SCOPE_CHANGED, AUDIT_ACTIONS.AGENCY_TOUR_CONTENT_CHANGED]) expect(actions).toContain(action);
  expect(JSON.stringify(rows)).not.toContain(code.code);
  expect(JSON.stringify(rows)).not.toContain(token);
  const count = rows.length;
  await expect(agencyService.changeMember(ctx, ctx.memberId, { status: 'SUSPENDED' })).rejects.toMatchObject({ statusCode: 403 });
  expect(await prisma.auditLog.count()).toBe(count);
});
