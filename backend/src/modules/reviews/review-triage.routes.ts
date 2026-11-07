import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission, userActor } from '../../middlewares/authorize';
import { validate, validated } from '../../middlewares/validate';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema, buildPage, type PageRequest } from '../../utils/pagination';
import { sendOk, sendPaginated } from '../../utils/api-response';
import { reviewTriageRepository } from './review-triage.repository';

const decision = z.object({ keep: z.boolean(), reason: z.string().trim().min(3).max(1000), contentVersion: z.string().regex(/^[a-f0-9]{64}$/), reportIds: z.array(idSchema).min(1).max(100).refine((ids) => new Set(ids).size === ids.length) }).strict();
export const reviewTriageRouter = Router();
reviewTriageRouter.use(requirePermission(PERMISSIONS.REVIEW_MODERATE, PERMISSIONS.DISPUTE_RESOLVE));
reviewTriageRouter.get('/', validate({ query: paginationQuerySchema }), async (req, res) => {
  const { query } = validated<unknown, PageRequest>(req);
  const result = await reviewTriageRepository.list(query);
  const page = buildPage(result.items, result.total, query);
  sendPaginated(res, page.items, page.meta);
});
reviewTriageRouter.post('/:id/decision', validate({ params: idParamsSchema, body: decision }), async (req, res) => {
  const { params, body } = validated<z.infer<typeof decision>, unknown, { id: string }>(req);
  const actor = userActor(req);
  sendOk(res, await reviewTriageRepository.decide({ userId: actor.userId, role: actor.role }, params.id, body));
});
