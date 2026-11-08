import type { DbExecutor, Prisma } from '../../config/database';
import type { AuditEntry } from './audit.types';

const secret = /password|token|secret|authorization|cookie|bankAccount/i;
export function redactAudit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAudit);
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    return Object.fromEntries(Object.entries(value).filter(([key, v]) => !secret.test(key) && v !== undefined)
      .map(([key, v]) => [key, redactAudit(v)]));
  }
  return value;
}

/** Must use the same executor as the mutation; intentionally propagates failures. */
export async function writeAudit(tx: DbExecutor, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({ data: { ...entry, metadata: redactAudit(entry.metadata ? { ...entry.metadata, reason: entry.metadata.reason ?? entry.metadata.note ?? entry.action } : undefined) as Prisma.InputJsonObject | undefined } });
}
