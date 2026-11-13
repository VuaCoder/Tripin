import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { requireAuth, userActor } from '../../middlewares/authorize';
import { agencyContext, requireAgencyPermission, resolveAgencyContext, requireVerifiedAgency } from '../../middlewares/agency-context';
import { sendOk } from '../../utils/api-response';
import { agencyService } from './agency.service';
import { agencyOwnershipSelect, primaryAgencyOwnerId, agencyOwnerLabel } from './agency-ownership';
import { agencyAccessInclude, AGENCY_PERMISSION_CATALOG, AGENCY_PERMISSIONS as P, effectiveAgencyPermissions } from './agency.policy';
import { agencyAccessService } from './agency-access.service';
import { agencyWorkService } from './agency-work.service';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/app-error';
import { notificationsRouter } from '../notifications/notifications.routes';
import { createRateLimiter } from '../../middlewares/rate-limit';

const id = z.string().uuid();
const roleBody = z.object({ name: z.string().trim().min(1).max(80), permissions: z.array(z.string().max(100)).max(100) }).strict();
const accessBody = z.object({ roleId: id, overrides: z.array(z.object({ permission: z.string().max(100), effect: z.enum(['ALLOW','DENY']) }).strict()).max(100) }).strict();
const inviteBody = z.object({ email: z.email().max(254), role: z.enum(['MANAGER','STAFF','ACCOUNTANT']), roleId: id.optional() }).strict();
const tourScopesBody = z.object({ scopes: z.array(z.object({ tourId: id, allowedFields: z.array(z.enum(['title','summary','description'])).max(3) }).strict()).max(200) }).strict();
const scopedContentBody = z.object({ title: z.string().trim().min(5).max(200).optional(), summary: z.string().trim().max(500).optional(), description: z.string().trim().max(20000).optional() }).strict().refine(v => Object.keys(v).length > 0);
export const agencyIdentityRouter = Router();
agencyIdentityRouter.get('/me/agencies', requireAuth, async (req,res) => sendOk(res, await agencyService.listForUser(userActor(req).userId)));
agencyIdentityRouter.get('/me/agency-invitations', requireAuth, validate({ query: z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }).strict() }), async (req,res) =>
  sendOk(res, await agencyService.myInvitations(userActor(req).userId, Number(req.query.page ?? 1))));
export const agencyInvitationAcceptanceRouter = Router();
agencyInvitationAcceptanceRouter.post('/:id/accept', requireAuth, createRateLimiter({ windowMs: 15 * 60000, limit: 30 }),
  validate({ params: z.object({ id }), body: z.object({}).strict() }), async (req,res) =>
    sendOk(res, await agencyService.acceptById(userActor(req).userId, id.parse(req.params.id))));
agencyInvitationAcceptanceRouter.post('/accept', requireAuth, validate({ body: z.object({ token: z.string().min(32).max(200) }).strict() }), async (req,res) => {
  const body = z.object({ token: z.string().min(32).max(200) }).strict().parse(req.body);
  sendOk(res, await agencyService.accept(userActor(req).userId, body.token));
});
export const agencyFoundationRouter = Router();
// The personal inbox remains unchanged; this inbox is restricted to the selected organization.
agencyFoundationRouter.use('/notifications', resolveAgencyContext, requireAgencyPermission(P.CONTEXT_VIEW), notificationsRouter);
agencyFoundationRouter.get('/context', resolveAgencyContext, requireAgencyPermission(P.CONTEXT_VIEW), (req,res) => sendOk(res, agencyContext(req)));
agencyFoundationRouter.get('/members', resolveAgencyContext, requireAgencyPermission(P.TEAM_VIEW), async (req,res) => {
  const ctx = agencyContext(req);
  const members = await prisma.agencyMember.findMany({ where: { agencyId: ctx.agencyId }, include: { ...agencyAccessInclude, agency: { select: agencyOwnershipSelect }, tourScopes: true, user: { select: { fullName: true, email: true, phone: true, avatarUrl: true, emailVerifiedAt: true } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  sendOk(res, members.map(m => ({ id: m.id, userId: m.userId, isPrimaryOwner: m.userId === primaryAgencyOwnerId(m.agency), role: m.role, roleId: m.roleId, roleName: m.role === 'OWNER' ? agencyOwnerLabel(m.userId === primaryAgencyOwnerId(m.agency)) : m.assignedRole?.name ?? m.role,
    status: m.status, user: m.user, createdAt: m.createdAt, updatedAt: m.updatedAt, tourScopes: m.tourScopes.map(s => ({ tourId: s.tourId, allowedFields: s.allowedFields })),
    permissions: effectiveAgencyPermissions(m), overrides: m.permissionOverrides.map(o => ({ permission: o.permission, effect: o.effect })) })));
});
agencyFoundationRouter.get('/permissions', resolveAgencyContext, requireAgencyPermission(P.TEAM_VIEW), (_req,res) => sendOk(res, AGENCY_PERMISSION_CATALOG));
agencyFoundationRouter.put('/members/:id/tour-scopes', resolveAgencyContext, requireAgencyPermission(P.PERMISSIONS_MANAGE), validate({ params: z.object({ id }), body: tourScopesBody }), async (req,res) => sendOk(res, await agencyWorkService.setTourScopes(agencyContext(req), id.parse(req.params.id), tourScopesBody.parse(req.body).scopes)));
agencyFoundationRouter.get('/work/tours', resolveAgencyContext, requireVerifiedAgency, requireAgencyPermission(P.TOUR_VIEW), validate({ query: z.object({}).strict() }), async (req,res) => {
  const ctx = agencyContext(req);
  sendOk(res, await prisma.tour.findMany({ where: { agencyId: ctx.agencyId, status: { not: 'ARCHIVED' } },
    select: { id: true, title: true, summary: true, description: true, status: true, memberScopes: { where: { memberId: ctx.memberId }, select: { allowedFields: true } } }, orderBy: { title: 'asc' }, take: 200 }));
});
agencyFoundationRouter.patch('/work/tours/:id/content', resolveAgencyContext, requireVerifiedAgency, requireAgencyPermission(P.TOUR_CONTENT_UPDATE), validate({ params: z.object({ id }), body: scopedContentBody }), async (req,res) => sendOk(res, await agencyWorkService.updateScopedContent(agencyContext(req), id.parse(req.params.id), scopedContentBody.parse(req.body))));
agencyFoundationRouter.get('/work/bookings', resolveAgencyContext, requireVerifiedAgency, requireAgencyPermission(P.BOOKING_MONITOR), validate({ query: z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict() }), async (req,res) => {
  const page = z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
  sendOk(res, await prisma.booking.findMany({ where: { agencyId: agencyContext(req).agencyId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 50,
    select: { id: true, bookingCode: true, tourTitle: true, departureDate: true, status: true, participants: true, contactName: true, contactPhone: true } }));
});
agencyFoundationRouter.get('/roles', resolveAgencyContext, requireAgencyPermission(P.TEAM_VIEW), async (req,res) => sendOk(res, await agencyAccessService.listRoles(agencyContext(req))));
agencyFoundationRouter.post('/roles', resolveAgencyContext, requireAgencyPermission(P.PERMISSIONS_MANAGE), validate({ body: roleBody }), async (req,res) => sendOk(res, await agencyAccessService.saveRole(agencyContext(req), roleBody.parse(req.body)), 201));
agencyFoundationRouter.patch('/roles/:id', resolveAgencyContext, requireAgencyPermission(P.PERMISSIONS_MANAGE), validate({ params: z.object({ id }), body: roleBody }), async (req,res) => sendOk(res, await agencyAccessService.saveRole(agencyContext(req), roleBody.parse(req.body), id.parse(req.params.id))));
agencyFoundationRouter.put('/members/:id/access', resolveAgencyContext, requireAgencyPermission(P.PERMISSIONS_MANAGE), validate({ params: z.object({ id }), body: accessBody }), async (req,res) => sendOk(res, await agencyAccessService.setMemberAccess(agencyContext(req), id.parse(req.params.id), accessBody.parse(req.body))));
agencyFoundationRouter.get('/invitations', resolveAgencyContext, requireAgencyPermission(P.TEAM_VIEW), async (req,res) => sendOk(res,
  await prisma.agencyInvitation.findMany({ where: { agencyId: agencyContext(req).agencyId }, select: { id: true, email: true, role: true, roleId: true, status: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 })));
agencyFoundationRouter.patch('/members/:id', resolveAgencyContext, requireAgencyPermission(P.TEAM_MANAGE), validate({ params: z.object({ id }), body: z.object({ role: z.enum(['OWNER','MANAGER','STAFF','ACCOUNTANT']).optional(), status: z.enum(['ACTIVE','SUSPENDED','REMOVED']).optional() }).strict().refine(v=>v.role!==undefined||v.status!==undefined) }), async (req,res) => {
  const body = z.object({ role: z.enum(['OWNER','MANAGER','STAFF','ACCOUNTANT']).optional(), status: z.enum(['ACTIVE','SUSPENDED','REMOVED']).optional() }).strict().refine(v=>v.role!==undefined||v.status!==undefined).parse(req.body);
  sendOk(res, await agencyService.changeMember(agencyContext(req), id.parse(req.params.id), body));
});
agencyFoundationRouter.post('/invitations', resolveAgencyContext, requireAgencyPermission(P.TEAM_INVITE), validate({ body: inviteBody }), async (req,res) => {
  const body = inviteBody.parse(req.body);
  sendOk(res, await agencyService.invite(agencyContext(req), body), 201);
});
agencyFoundationRouter.post('/invitations/:id/revoke', resolveAgencyContext, requireAgencyPermission(P.TEAM_MANAGE), validate({ params: z.object({ id }) }), async (req,res) => sendOk(res, await agencyService.revoke(agencyContext(req), id.parse(req.params.id))));
agencyFoundationRouter.get('/finance/summary', resolveAgencyContext, requireVerifiedAgency, requireAgencyPermission(P.FINANCE_VIEW), async (req,res) => {
  const result = await prisma.booking.aggregate({ where: { agencyId: agencyContext(req).agencyId, isPaid: true, status: { in: ['CONFIRMED','COMPLETED'] } }, _sum: { agencyAmount: true }, _count: true });
  sendOk(res, { agencyId: agencyContext(req).agencyId, paidBookingCount: result._count, bookingNetAmount: (result._sum.agencyAmount ?? 0n).toString(), currency: 'VND', reconciledBalance: false });
});
const validationErrors: ErrorRequestHandler = (error, _req, _res, next) => next(error instanceof z.ZodError ? AppError.badRequest('Invalid agency request') : error);
agencyIdentityRouter.use(validationErrors);
agencyInvitationAcceptanceRouter.use(validationErrors);
agencyFoundationRouter.use(validationErrors);
