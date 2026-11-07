import type { DbExecutor } from '../../config/database';
import type { NotifyInput } from './notifications.types';
import { enqueueMail } from './mail-outbox';

/** Persist notification and retryable email with the business mutation's transaction. */
export async function writeNotification(tx: DbExecutor, userId: string, input: NotifyInput): Promise<void> {
  const notification = await tx.notification.create({ data: { userId, type: input.type, title: input.title, body: input.body, ...(input.data ? { data: input.data } : {}) } });
  const contact = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (contact?.email) await enqueueMail(tx, `notification:${notification.id}`, contact.email, input.title, input.body);
}
