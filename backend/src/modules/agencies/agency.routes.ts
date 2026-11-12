import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { requireAuth, userActor } from '../../middlewares/authorize';
import { agencyContext, requireAgencyPermission, resolveAgencyContext, requireVerifiedAgency } from '../../middlewares/agency-context';
import { sendOk } from '../../utils/api-response';
import { agencyService } from './agency.service';
import { AGENCY_PERMISSIONS as P } from './agency.policy';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/app-error';
import { notificationsRouter } from '../notifications/notifications.routes';

const id = z.string().uuid();
export const agencyIdentityRouter = Router();
agencyIdentityRouter.get('/me/agencies', requireAuth, async (req,res) => sendOk(res, await agencyService.listForUser(userActor(req).userId)));
export const agencyInvitationAcceptanceRouter = Router();
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
  sendOk(res, await prisma.agencyMember.findMany({ where: { agencyId: ctx.agencyId }, select: { id: true, userId: true, role: true, status: true, createdAt: true, updatedAt: true } }));
});
agencyFoundationRouter.patch('/members/:id', resolveAgencyContext, requireAgencyPermission(P.TEAM_MANAGE), validate({ params: z.object({ id }), body: z.object({ role: z.enum(['OWNER','MANAGER','STAFF','ACCOUNTANT']).optional(), status: z.enum(['ACTIVE','SUSPENDED','REMOVED']).optional() }).strict().refine(v=>v.role!==undefined||v.status!==undefined) }), async (req,res) => {
  const body = z.object({ role: z.enum(['OWNER','MANAGER','STAFF','ACCOUNTANT']).optional(), status: z.enum(['ACTIVE','SUSPENDED','REMOVED']).optional() }).strict().refine(v=>v.role!==undefined||v.status!==undefined).parse(req.body);
  sendOk(res, await agencyService.changeMember(agencyContext(req), id.parse(req.params.id), body));
});
agencyFoundationRouter.post('/invitations', resolveAgencyContext, requireAgencyPermission(P.TEAM_INVITE), validate({ body: z.object({ email: z.email().max(254), role: z.enum(['MANAGER','STAFF','ACCOUNTANT']) }).strict() }), async (req,res) => {
  const body = z.object({ email: z.email().max(254), role: z.enum(['MANAGER','STAFF','ACCOUNTANT']) }).strict().parse(req.body);
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
