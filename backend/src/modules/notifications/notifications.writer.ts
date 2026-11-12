import type { DbExecutor } from '../../config/database';
import type { NotifyInput } from './notifications.types';
import { enqueueMail } from './mail-outbox';
import { canReceiveAgencyNotification } from './notifications.policy';

/** Same agency lock as team mutations: fanout and revocation serialize. */
export async function writeAgencyNotification(tx: DbExecutor, agencyId: string, input: NotifyInput, email = true) {
  await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id = ${agencyId}::uuid FOR UPDATE`;
  const members = await tx.agencyMember.findMany({ where: { agencyId, status: 'ACTIVE', user: { status: 'ACTIVE' } } });
  const rows = [];
  for (const member of members) {
    if (!canReceiveAgencyNotification(member.role, input.type)) continue;
    const notification = await tx.notification.create({ data: {
      userId: member.userId, agencyId, type: input.type, title: input.title, body: input.body,
      ...(input.data ? { data: input.data } : {}),
    } });
    rows.push(notification);
    if (email) {
      const contact = await tx.user.findUnique({ where: { id: member.userId }, select: { email: true } });
      if (contact?.email) await enqueueMail(tx, `agency-notification:${agencyId}:${member.userId}:${notification.id}`,
        contact.email, input.emailSubject ?? input.title, input.emailText ?? input.body);
    }
  }
  return rows;
}

/** Persist notification and retryable email with the business mutation's transaction. */
export async function writeNotification(tx: DbExecutor, userId: string, input: NotifyInput): Promise<void> {
  const notification = await tx.notification.create({ data: { userId, type: input.type, title: input.title, body: input.body, ...(input.data ? { data: input.data } : {}) } });
  const contact = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (contact?.email) {
    const subject = input.emailSubject ?? input.title;
    const text = input.emailText ?? input.body;
    await enqueueMail(tx, `notification:${notification.id}`, contact.email, subject, text);
  }
}
