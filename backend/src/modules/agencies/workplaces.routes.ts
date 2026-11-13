import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { isTest } from '../../config/env';
import { requireAuth, userActor } from '../../middlewares/authorize';
import { agencyContext, requireAgencyPermission, resolveAgencyContext } from '../../middlewares/agency-context';
import { createRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { sendOk } from '../../utils/api-response';
import { AppError } from '../../utils/app-error';
import { workplacesService } from './workplaces.service';

const id = z.object({ id: z.string().uuid() });
const page = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }).strict();
const empty = z.object({}).strict();
export const workplaceApplicationBody = z.object({
  companyName: z.string().trim().min(2).max(200), address: z.string().trim().max(500).optional(),
  licenseNumber: z.string().trim().max(100).optional(), taxId: z.string().trim().max(50).optional(),
  businessLicenseUrl: z.union([z.literal(''), z.url().max(1000)]).optional(), description: z.string().trim().max(5000).optional(),
  website: z.union([z.literal(''), z.url().max(300)]).optional(),
}).strict();
const createBody = workplaceApplicationBody.extend({ requestId: z.string().uuid() });
const joinBody = z.object({ code: z.string().trim().min(12).max(24) }).strict();
const approve = z.object({ roleId: z.string().uuid() }).strict();
const ipLimit = createRateLimiter({ windowMs: 15 * 60000, limit: 30 });
const userLimit = rateLimit({ windowMs: 15 * 60000, limit: 20, keyGenerator: req => userActor(req).userId,
  skip: () => isTest, standardHeaders: 'draft-7', legacyHeaders: false, handler: (_req, _res, next) => next(AppError.tooManyRequests()) });

// No AgencyContext required: a verified account may not have any workplace yet.
export const workplaceCreationRouter = Router();
workplaceCreationRouter.post('/', requireAuth, ipLimit, userLimit, validate({ body: createBody }), async (req,res) =>
  sendOk(res, await workplacesService.create(userActor(req).userId, createBody.parse(req.body)), 201));
export const joinRequestRouter = Router();
joinRequestRouter.post('/', requireAuth, ipLimit, userLimit, validate({ body: joinBody }), async (req,res) =>
  sendOk(res, await workplacesService.request(userActor(req).userId, joinBody.parse(req.body).code), 201));
joinRequestRouter.post('/:id/cancel', requireAuth, validate({ params: id, body: empty }), async (req,res) =>
  sendOk(res, await workplacesService.cancel(userActor(req).userId, id.parse(req.params).id)));
export const personalWorkplaceRouter = Router();
personalWorkplaceRouter.get('/me/agency-join-requests', requireAuth, validate({ query: page }), async (req,res) =>
  sendOk(res, await workplacesService.mine(userActor(req).userId, page.parse(req.query).page)));

export const workplaceTeamRouter = Router();
workplaceTeamRouter.use(resolveAgencyContext, requireAgencyPermission('agency:context-view'));
const owner = requireAgencyPermission('agency:permissions-manage');
workplaceTeamRouter.get('/application', owner, async (req,res) => sendOk(res, await workplacesService.application(agencyContext(req))));
workplaceTeamRouter.put('/application', owner, validate({ body: workplaceApplicationBody }), async (req,res) =>
  sendOk(res, await workplacesService.saveApplication(agencyContext(req), workplaceApplicationBody.parse(req.body))));
workplaceTeamRouter.post('/application/submit', owner, validate({ body: workplaceApplicationBody }), async (req,res) =>
  sendOk(res, await workplacesService.saveApplication(agencyContext(req), workplaceApplicationBody.parse(req.body), true)));
workplaceTeamRouter.get('/join-codes/current', owner, async (req,res) => sendOk(res, await workplacesService.currentCode(agencyContext(req))));
workplaceTeamRouter.post('/join-codes', owner, ipLimit, validate({ body: empty }), async (req,res) => sendOk(res, await workplacesService.rotateCode(agencyContext(req)), 201));
workplaceTeamRouter.post('/join-codes/:id/revoke', owner, validate({ params: id, body: empty }), async (req,res) => sendOk(res, await workplacesService.revokeCode(agencyContext(req), id.parse(req.params).id)));
workplaceTeamRouter.get('/join-requests', requireAgencyPermission('agency:team-view'), validate({ query: page }), async (req,res) => sendOk(res, await workplacesService.queue(agencyContext(req), page.parse(req.query).page)));
workplaceTeamRouter.post('/join-requests/:id/approve', owner, validate({ params: id, body: approve }), async (req,res) => sendOk(res, await workplacesService.review(agencyContext(req), id.parse(req.params).id, approve.parse(req.body).roleId)));
workplaceTeamRouter.post('/join-requests/:id/reject', owner, validate({ params: id, body: empty }), async (req,res) => sendOk(res, await workplacesService.review(agencyContext(req), id.parse(req.params).id)));
