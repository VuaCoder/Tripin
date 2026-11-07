import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@travel-platform/constants';
import { requireAuth, requirePermission, requireSuperAdmin, userActor } from '../../middlewares/authorize';
import { validate, validated } from '../../middlewares/validate';
import { prisma } from '../../config/database';
import { sendOk } from '../../utils/api-response';
import { AppError } from '../../utils/app-error';
import { policyKeyParams } from './system-settings.validation';
import { systemSettingsRepository } from './system-settings.repository';
import { systemSettingsService } from './system-settings.service';

export const policyHistoryRouter = Router();
policyHistoryRouter.use(requireSuperAdmin, requirePermission(PERMISSIONS.POLICY_CONFIGURE));
policyHistoryRouter.get('/:key/history', validate({ params: policyKeyParams }), async (req, res) => {
  const { params } = validated<unknown, unknown, z.infer<typeof policyKeyParams>>(req);
  sendOk(res, await systemSettingsRepository.history(params.key));
});
const rollback = z.object({ versionId: z.uuid(), expectedVersion: z.number().int().nonnegative(), reason: z.string().trim().min(10).max(1000) }).strict();
policyHistoryRouter.post('/:key/rollback', validate({ params: policyKeyParams, body: rollback }), async (req, res) => {
  const { params, body } = validated<z.infer<typeof rollback>, unknown, z.infer<typeof policyKeyParams>>(req);
  const version = await prisma.policyVersion.findUnique({ where: { id: body.versionId } });
  if (!version || version.key !== params.key) throw AppError.notFound('Policy version not found');
  const input = version.value as { title: string; content: string; params: Record<string, number | string | boolean> };
  sendOk(res, await systemSettingsService.setPolicy(userActor(req), params.key, { ...input, expectedVersion: body.expectedVersion, reason: body.reason, rollbackOf: version.id }));
});

export const policyAcceptanceRouter = Router();
const accept = z.object({ policyVersionId: z.uuid() }).strict();
policyAcceptanceRouter.post('/accept', requireAuth, validate({ body: accept }), async (req, res) => {
  const body = validated<z.infer<typeof accept>>(req).body;
  const version = await prisma.policyVersion.findUnique({ where: { id: body.policyVersionId } });
  if (!version || !['terms', 'privacy'].includes(version.key) || version.effectiveFrom > new Date() || !(version.value as { content?: string }).content?.trim()) throw AppError.badRequest('Policy version is not available for acceptance');
  const userId = userActor(req).userId;
  sendOk(res, await prisma.policyAcceptance.upsert({ where: { userId_policyVersionId: { userId, policyVersionId: version.id } }, create: { userId, policyVersionId: version.id }, update: {} }));
});
