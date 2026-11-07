import { prisma, type DbExecutor } from '../../config/database';
import { mailProvider } from '../../integrations/mail';
import { logger } from '../../utils/logger';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';

const encryptionKey = () => createHash('sha256').update(`tripri:mail-outbox:v1:${env.JWT_ACCESS_SECRET}`).digest();
function encodeMailBody(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return 'v1:' + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}
export function decodeMailBody(encoded: string): string {
  if (!encoded.startsWith('v1:')) throw new Error('Unsupported outbox payload version');
  const payload = Buffer.from(encoded.slice(3), 'base64');
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), payload.subarray(0, 12));
  cipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([cipher.update(payload.subarray(28)), cipher.final()]).toString('utf8');
}

export async function enqueueMail(tx: DbExecutor, dedupKey: string, recipient: string, subject: string, text: string) {
  await tx.mailOutbox.upsert({ where: { dedupKey }, create: { dedupKey, recipient, subject, text: encodeMailBody(text) }, update: {} });
}

/** Best-effort immediate delivery; the maintenance worker retries durable pending rows. */
export function kickMailOutbox(): void {
  void flushMailOutbox().catch((error) => logger.error('Outbox worker unavailable', { message: (error as Error).message }));
}

/** Lease prevents concurrent workers sending the same row. Failed deliveries remain retryable. */
export async function flushMailOutbox(): Promise<void> {
  const rows = await prisma.mailOutbox.findMany({ where: { sentAt: null, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, orderBy: { createdAt: 'asc' }, take: 25 });
  for (const row of rows) {
    const claimed = await prisma.mailOutbox.updateMany({ where: { id: row.id, sentAt: null, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { leaseUntil: new Date(Date.now() + 300_000), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      await mailProvider.send({ to: row.recipient, subject: row.subject, text: decodeMailBody(row.text) });
      await prisma.mailOutbox.update({ where: { id: row.id }, data: { sentAt: new Date(), leaseUntil: null } });
    } catch (error) {
      logger.error('Outbox delivery failed', { id: row.id, message: (error as Error).message });
    }
  }
}
