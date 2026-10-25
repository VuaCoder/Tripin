import { Router, type RequestHandler, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  createImageUploadSignature,
  verifyImageUpload,
} from '../../integrations/cloudinary';
import {
  requireAuth,
  requireSuperAdmin,
  requirePermission,
  userActor,
} from '../../middlewares/authorize';
import { PERMISSIONS } from '@travel-platform/constants';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/app-error';
import { sendOk, sendCreated, sendPaginated } from '../../utils/api-response';
import { paginationQuerySchema, buildPage } from '../../utils/pagination';
import { prisma } from '../../config/database';
import { auditService, AUDIT_ACTIONS } from '../audit';
import { premiumRepository as repo } from './premium.repository';
import { premiumService } from './premium.service';
import {
  contributionBody,
  decisionBody,
  guideProfileBody,
  planBody,
  refundBody,
} from './premium.validation';

const id = (value: unknown) => z.string().uuid().parse(value);
const paramsSchema = z.object({ id: z.string().uuid() });
const subscribeSchema = z.object({ planId: z.string().uuid() }).strict();
const publishSchema = z.object({ published: z.boolean() }).strict();
const flagSchema = z
  .object({
    audience: z.enum(['TRAVELER', 'TOUR_GUIDE']),
    enabled: z.boolean(),
  })
  .strict();
const contributionDecisionSchema = z
  .object({ status: z.enum(['APPROVED', 'REJECTED']) })
  .strict();
const completeImageSchema = z
  .object({ slot: z.string().uuid(), publicId: z.string().max(300) })
  .strict();
const role =
  (expected: string): RequestHandler =>
  (req, _res, next) => {
    if (userActor(req).role !== expected) return next(AppError.forbidden());
    next();
  };
const log = (
  actorId: string,
  action: string,
  targetId?: string,
  details?: Record<string, unknown>,
) =>
  auditService.record({
    actorId,
    actorRole: 'SUPER_ADMIN',
    action: AUDIT_ACTIONS.PREMIUM_CHANGED,
    targetType: 'Premium',
    targetId,
    metadata: { operation: action, ...details },
  });

export const premiumRouter = Router();
premiumRouter.get(
  '/plans',
  validate({
    query: z.object({
      audience: z.enum(['TRAVELER', 'TOUR_GUIDE']).optional(),
    }),
  }),
  async (req, res) => {
    const audience = z
      .enum(['TRAVELER', 'TOUR_GUIDE'])
      .parse(req.query.audience ?? 'TRAVELER');
    const flag = await prisma.systemSetting.findUnique({
      where: { key: `premium.enabled.${audience}` },
    });
    const plans = (
      flag?.value === true ? await repo.plans(audience) : []
    ).filter((plan) =>
      plan.premiumVouchers.every(
        (v) =>
          v.contribution.acceptingNew &&
          v.contribution.status === 'APPROVED' &&
          v.contribution.capacity - v.contribution.reserved >= v.quantity,
      ),
    );
    sendOk(
      res,
      plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        audience: p.audience,
        version: p.version,
        price: p.price,
        durationDays: p.durationDays,
        benefits: p.benefits,
        vouchers: p.premiumVouchers.map((v) => ({
          quantity: v.quantity,
          title: v.contribution.title,
          tourIds: v.contribution.tourIds,
          discountType: v.contribution.discountType,
          discountValue: v.contribution.discountValue,
          maxDiscountAmount: v.contribution.maxDiscountAmount,
          minOrderAmount: v.contribution.minOrderAmount,
        })),
      })),
    );
  },
);
premiumRouter.get(
  '/guides/:id',
  validate({ params: paramsSchema }),
  async (req, res) => {
    const userId = id(req.params.id);
    const user = await prisma.user.findFirst({
      where: { id: userId, role: 'TOUR_GUIDE', status: 'ACTIVE' },
    });
    if (!user) throw AppError.notFound();
    const active = (await repo.status(userId)).active;
    sendOk(res, {
      active,
      profile: active ? await repo.guideProfile(userId) : null,
    });
  },
);
premiumRouter.use(requireAuth, requirePermission(PERMISSIONS.PROFILE_VIEW_OWN));
premiumRouter.get('/me', async (req, res) =>
  sendOk(res, await repo.status(userActor(req).userId)),
);
premiumRouter.get(
  '/me/history',
  validate({ query: paginationQuerySchema }),
  async (req, res) => {
    const query = paginationQuerySchema.parse(req.query);
    const result = await repo.history(
      userActor(req).userId,
      query.page,
      query.limit,
    );
    const page = buildPage(result.items, result.total, query);
    sendPaginated(res, page.items, page.meta);
  },
);
premiumRouter.get(
  '/subscriptions/:id',
  validate({ params: paramsSchema }),
  async (req, res) => {
    const subscription = await prisma.subscription.findUnique({
      where: {
        id: id(req.params.id),
        userId: userActor(req).userId,
        isPremium: true,
      },
      include: { premiumRefund: true },
    });
    if (!subscription) throw AppError.notFound();
    sendOk(res, subscription);
  },
);
premiumRouter.get('/me/vouchers', async (req, res) => {
  const userId = userActor(req).userId;
  await repo.grantDue(new Date(), userId);
  sendOk(res, await repo.vouchers(userId));
});
premiumRouter.post(
  '/subscribe',
  requirePermission(PERMISSIONS.PREMIUM_SUBSCRIBE),
  validate({ body: subscribeSchema }),
  async (req, res) =>
    sendCreated(
      res,
      await premiumService.subscribe(
        userActor(req).userId,
        id(
          z.object({ planId: z.string().uuid() }).strict().parse(req.body)
            .planId,
        ),
      ),
    ),
);
premiumRouter.post(
  '/subscriptions/:id/refunds',
  validate({ params: paramsSchema, body: refundBody }),
  async (req, res) =>
    sendCreated(
      res,
      await repo.requestRefund(
        userActor(req).userId,
        id(req.params.id),
        refundBody.parse(req.body).reason,
      ),
    ),
);
premiumRouter.get('/guide/profile', role('TOUR_GUIDE'), async (req, res) =>
  sendOk(res, await repo.guideProfile(userActor(req).userId)),
);
premiumRouter.post(
  '/guide/images/signature',
  role('TOUR_GUIDE'),
  async (req, res) => {
    const userId = userActor(req).userId;
    await premiumService.requireGuide(userId);
    const slot = randomUUID();
    sendOk(res, {
      slot,
      upload: createImageUploadSignature('premiumImage', `${userId}/${slot}`),
    });
  },
);
premiumRouter.post(
  '/guide/images/complete',
  role('TOUR_GUIDE'),
  validate({ body: completeImageSchema }),
  async (req, res) => {
    const userId = userActor(req).userId;
    await premiumService.requireGuide(userId);
    const body = z
      .object({ slot: z.string().uuid(), publicId: z.string().max(300) })
      .strict()
      .parse(req.body);
    sendOk(
      res,
      await verifyImageUpload(
        'premiumImage',
        `${userId}/${body.slot}`,
        body.publicId,
      ),
    );
  },
);
premiumRouter.put(
  '/guide/profile',
  role('TOUR_GUIDE'),
  validate({ body: guideProfileBody }),
  async (req, res) => {
    const userId = userActor(req).userId;
    await premiumService.requireGuide(userId);
    sendOk(
      res,
      await repo.saveGuideProfile(userId, guideProfileBody.parse(req.body)),
    );
  },
);
premiumRouter.get('/guide/analytics', role('TOUR_GUIDE'), async (req, res) => {
  const userId = userActor(req).userId;
  await premiumService.requireGuide(userId);
  sendOk(res, await repo.analytics(userId));
});

export const agencyPremiumRouter = Router();
agencyPremiumRouter.use(
  requireAuth,
  role('AGENCY'),
  requirePermission(PERMISSIONS.PREMIUM_CONTRIBUTE),
);
agencyPremiumRouter.get('/contributions', async (req, res) =>
  sendOk(res, await repo.contributions(userActor(req).userId)),
);
agencyPremiumRouter.post(
  '/contributions',
  validate({ body: contributionBody }),
  async (req, res) =>
    sendCreated(
      res,
      await repo.contribute(
        userActor(req).userId,
        contributionBody.parse(req.body),
      ),
    ),
);
agencyPremiumRouter.post(
  '/contributions/:id/stop',
  validate({ params: paramsSchema }),
  async (req, res) => {
    await repo.stopContribution(id(req.params.id), userActor(req).userId);
    sendOk(res, { stopped: true });
  },
);
agencyPremiumRouter.get('/usage', async (req, res) => {
  const contributions = await repo.contributions(userActor(req).userId);
  const ids = contributions.map((c) => c.id);
  const usage = await prisma.premiumVoucher.groupBy({
    by: ['contributionId'],
    where: { contributionId: { in: ids }, bookingId: { not: null } },
    _count: true,
  });
  sendOk(
    res,
    contributions.map((c) => ({
      id: c.id,
      title: c.title,
      capacity: c.capacity,
      committed: c.reserved,
      used: usage.find((u) => u.contributionId === c.id)?._count ?? 0,
    })),
  );
});

export const adminPremiumRouter = Router();
adminPremiumRouter.use(
  requireAuth,
  requireSuperAdmin,
  requirePermission(PERMISSIONS.PREMIUM_MANAGE),
);
adminPremiumRouter.get('/operations', async (_req, res) =>
  sendOk(res, await repo.operations()),
);
adminPremiumRouter.get('/plans', async (_req, res) =>
  sendOk(res, await repo.plans('TRAVELER', true)),
);
adminPremiumRouter.post(
  '/plans',
  validate({ body: planBody }),
  async (req, res) => {
    const plan = await repo.createPlan(planBody.parse(req.body));
    await log(userActor(req).userId, 'plan.created', plan.id);
    sendCreated(res, plan);
  },
);
adminPremiumRouter.patch(
  '/plans/:id',
  validate({ params: paramsSchema, body: publishSchema }),
  async (req, res) => {
    const { published } = z
      .object({ published: z.boolean() })
      .strict()
      .parse(req.body);
    const plan = await repo.publishPlan(id(req.params.id), published);
    await log(userActor(req).userId, 'plan.published', plan.id, { published });
    sendOk(res, plan);
  },
);
adminPremiumRouter.get('/flags', async (_req, res) =>
  sendOk(
    res,
    await prisma.systemSetting.findMany({
      where: {
        key: { in: ['premium.enabled.TRAVELER', 'premium.enabled.TOUR_GUIDE'] },
      },
    }),
  ),
);
adminPremiumRouter.put(
  '/flags',
  validate({ body: flagSchema }),
  async (req, res) => {
    const { audience, enabled } = z
      .object({
        audience: z.enum(['TRAVELER', 'TOUR_GUIDE']),
        enabled: z.boolean(),
      })
      .strict()
      .parse(req.body);
    const key = `premium.enabled.${audience}`;
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: enabled, updatedById: userActor(req).userId },
      update: { value: enabled, updatedById: userActor(req).userId },
    });
    await log(userActor(req).userId, 'flag.updated', undefined, {
      audience,
      enabled,
    });
    sendOk(res, { audience, enabled });
  },
);
adminPremiumRouter.get('/contributions', async (_req, res) =>
  sendOk(res, await repo.contributions()),
);
adminPremiumRouter.patch(
  '/contributions/:id',
  validate({ params: paramsSchema, body: contributionDecisionSchema }),
  async (req, res) => {
    const { status } = z
      .object({ status: z.enum(['APPROVED', 'REJECTED']) })
      .strict()
      .parse(req.body);
    const result = await repo.decideContribution(id(req.params.id), status);
    await log(userActor(req).userId, 'contribution.decided', result.id, {
      status,
    });
    sendOk(res, result);
  },
);
adminPremiumRouter.get('/refunds', async (_req, res) =>
  sendOk(res, await repo.refunds()),
);
adminPremiumRouter.patch(
  '/refunds/:id',
  validate({ params: paramsSchema, body: decisionBody }),
  async (req, res) => {
    const body = decisionBody.parse(req.body);
    const result = await repo.decideRefund(
      id(req.params.id),
      userActor(req).userId,
      body.action,
      body.note,
      body.transferReference,
    );
    await log(userActor(req).userId, 'refund.' + body.action, result.id);
    sendOk(res, result);
  },
);

const premiumErrors: ErrorRequestHandler = (error, _req, _res, next) => {
  if (error instanceof z.ZodError)
    return next(
      AppError.badRequest('Dữ liệu Premium không hợp lệ', error.flatten()),
    );
  if (error?.code === 'P2025') return next(AppError.notFound());
  next(error);
};
premiumRouter.use(premiumErrors);
agencyPremiumRouter.use(premiumErrors);
adminPremiumRouter.use(premiumErrors);
