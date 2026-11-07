import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, type DbExecutor } from '../../config/database';
import { requireSuperAdmin, requirePermission, userActor } from '../../middlewares/authorize';
import { validate, validated } from '../../middlewares/validate';
import { PERMISSIONS } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { sendOk } from '../../utils/api-response';
import { writeAudit } from '../audit/audit.writer';
import { enqueueMail, kickMailOutbox } from '../notifications/mail-outbox';
import { usersRepository } from './users.repository';
import { toPrivateUserDto } from './users.mapper';
import { passwordSchema } from '../auth/auth.validation';
import { idParamsSchema } from '../../utils/id';
import { env } from '../../config/env';

const inviteBody = z.object({ email: z.email().max(254).transform((v) => v.toLowerCase()), fullName: z.string().trim().min(2).max(120) }).strict();
const activateBody = z.object({ token: z.string().min(32).max(200), password: passwordSchema }).strict();
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

async function queueInvitation(tx: DbExecutor, user: { id: string; email: string }): Promise<void> {
  const token = randomBytes(32).toString('hex');
  await tx.staffInvitation.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });
  const invitation = await tx.staffInvitation.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 86_400_000) } });
  const base = (env.CLIENT_URL.split(',')[0] ?? 'http://localhost:3000').replace(/\/$/, '');
  await enqueueMail(tx, `staff-invite:${user.id}:${invitation.id}`, user.email, 'Lời mời nhân viên TripRI', `Thiết lập mật khẩu trong 24 giờ: ${base}/staff/activate?token=${token}`);
}

export const staffRouter = Router();
staffRouter.use(requireSuperAdmin, requirePermission(PERMISSIONS.USER_ASSIGN_PERMISSIONS));
staffRouter.post('/invite', validate({ body: inviteBody }), async (req, res) => {
  const body = validated<z.infer<typeof inviteBody>>(req).body;
  const actor = userActor(req);
  const user = await prisma.$transaction(async (tx) => {
    // Inviting existing accounts would silently escalate them before consent; use assign-access instead.
    if (await tx.user.findUnique({ where: { email: body.email } })) throw AppError.conflict('Account already exists; use access management');
    const user = await tx.user.create({ data: { ...body, role: 'MODERATOR', status: 'PENDING_VERIFICATION', staffStatus: 'INVITED' }, include: { agencyProfile: true, guideProfile: true } });
    await queueInvitation(tx, user);
    await writeAudit(tx, { actorId: actor.userId, actorRole: actor.role, action: 'user.access_assigned', targetType: 'user', targetId: user.id, metadata: { before: null, after: { role: 'MODERATOR', staffStatus: 'INVITED' } } });
    return user;
  });
  kickMailOutbox();
  sendOk(res, toPrivateUserDto(user), 201);
});

staffRouter.post('/:id/reinvite', validate({ params: idParamsSchema, body: z.object({}).strict() }), async (req, res) => {
  const { params } = validated<unknown, unknown, { id: string }>(req);
  const actor = userActor(req);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(54821)`;
    const user = await tx.user.findUnique({ where: { id: params.id } });
    if (!user || user.role !== 'MODERATOR' || user.staffStatus !== 'INVITED') throw AppError.badRequest('Only invited staff can receive a new activation link');
    await queueInvitation(tx, user);
    await writeAudit(tx, { actorId: actor.userId, actorRole: actor.role, action: 'user.access_assigned', targetType: 'user', targetId: user.id, metadata: { before: { staffStatus: 'INVITED' }, after: { staffStatus: 'INVITED' }, reason: 'Activation invitation resent; previous invitation revoked' } });
  });
  kickMailOutbox();
  sendOk(res, { invited: true });
});

staffRouter.post('/:id/disable', validate({ params: idParamsSchema, body: z.object({ reason: z.string().trim().min(10).max(1000) }).strict() }), async (req, res) => {
  const { params, body } = validated<{ reason: string }, unknown, { id: string }>(req);
  const target = await usersRepository.findById(params.id);
  if (!target || !['MODERATOR', 'SUPER_ADMIN'].includes(target.role)) throw AppError.notFound('Staff member not found');
  const actor = userActor(req);
  const updated = await usersRepository.changeAccess(actor, params.id, { staffStatus: 'DISABLED' }, body.reason);
  sendOk(res, toPrivateUserDto(updated));
});

export const staffActivationRouter = Router();
staffActivationRouter.post('/activate', validate({ body: activateBody }), async (req, res) => {
  const body = validated<z.infer<typeof activateBody>>(req).body;
  const passwordHash = await bcrypt.hash(body.password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(54821)`;
    const invite = await tx.staffInvitation.findUnique({ where: { tokenHash: hash(body.token) } });
    if (!invite || invite.consumedAt || invite.expiresAt <= new Date()) throw AppError.badRequest('Invitation is invalid or expired');
    const invitedUser = await tx.user.findUnique({ where: { id: invite.userId } });
    if (!invitedUser || invitedUser.staffStatus !== 'INVITED' || invitedUser.role !== 'MODERATOR') throw AppError.badRequest('Invitation is no longer active');
    const consumed = await tx.staffInvitation.updateMany({ where: { id: invite.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    if (!consumed.count) throw AppError.conflict('Invitation already used');
    await tx.user.update({ where: { id: invite.userId, staffStatus: 'INVITED', role: 'MODERATOR' }, data: { passwordHash, status: 'ACTIVE', staffStatus: 'ACTIVE', emailVerifiedAt: new Date(), tokenVersion: { increment: 1 } } });
    await writeAudit(tx, { actorId: invite.userId, actorRole: 'MODERATOR', action: 'user.access_assigned', targetType: 'user', targetId: invite.userId, metadata: { before: { staffStatus: 'INVITED' }, after: { staffStatus: 'ACTIVE' }, reason: 'Invitation accepted after proving email ownership' } });
  });
  sendOk(res, { activated: true });
});
