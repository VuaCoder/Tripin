import { prisma, type Prisma } from '../../config/database';
import type { SystemSetting } from '../../generated/prisma/client';
import { AppError } from '../../utils/app-error';
import { writeAudit } from '../audit/audit.writer';
import type { PersistedRole } from '@travel-platform/constants';

export type SystemSettingRecord = SystemSetting;

export class SystemSettingsRepository {
  async saveRevision(key: string, value: unknown, actor: { userId: string; role: PersistedRole }, expectedVersion: number, reason: string, options?: { effectiveFrom?: Date; rollbackOf?: string; baseline?: unknown }) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(54822)`;
      const before = await tx.systemSetting.findUnique({ where: { key } });
      if ((before?.version ?? 0) !== expectedVersion) throw AppError.conflict('Settings changed; reload before saving', 'SETTINGS_CONFLICT');
      const version = expectedVersion + 1;
      const json = value as Prisma.InputJsonValue;
      const doc = before
        ? await tx.systemSetting.update({ where: { key, version: expectedVersion }, data: { value: json, version, updatedById: actor.userId } })
        : await tx.systemSetting.create({ data: { key, value: json, version, updatedById: actor.userId } });
      if (key.startsWith('policy:')) {
        const policyKey = key.slice(7);
        const baseline = before?.value ?? options?.baseline;
        if (baseline && !(await tx.policyVersion.findFirst({ where: { key: policyKey } }))) {
          await tx.policyVersion.create({ data: { key: policyKey, versionNumber: 0, effectiveFrom: new Date(), reason: 'Initial policy baseline (historical effective date unknown)', value: baseline as Prisma.InputJsonValue, actorId: actor.userId } });
        }
        await tx.policyVersion.create({ data: { key: policyKey, versionNumber: version, effectiveFrom: options?.effectiveFrom ?? new Date(), reason, value: json, actorId: actor.userId, rollbackOf: options?.rollbackOf } });
      }
      await writeAudit(tx, { actorId: actor.userId, actorRole: actor.role, action: key.startsWith('policy:') ? 'settings.policy_updated' : 'settings.commission_updated', targetType: 'setting', targetId: key,
        metadata: { before: before?.value ?? options?.baseline ?? null, after: value, reason } });
      return doc;
    });
  }

  effectivePolicy(key: string, now = new Date()) {
    return prisma.policyVersion.findFirst({ where: { key, effectiveFrom: { lte: now } }, orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }] });
  }

  history(key: string) {
    return prisma.policyVersion.findMany({ where: { key }, orderBy: { versionNumber: 'desc' }, take: 100 });
  }

  findByKey(key: string): Promise<SystemSettingRecord | null> {
    return prisma.systemSetting.findUnique({ where: { key } });
  }

  findByKeys(keys: string[]): Promise<SystemSettingRecord[]> {
    return prisma.systemSetting.findMany({ where: { key: { in: keys } } });
  }

  /** `updatedBy` is omitted by the seed script (no user is acting). */
  upsert(key: string, value: unknown, updatedBy?: string): Promise<SystemSettingRecord | null> {
    const json = value as Prisma.InputJsonValue;
    return prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: json, updatedById: updatedBy },
      update: { value: json, ...(updatedBy ? { updatedById: updatedBy } : {}) },
    });
  }
}

export const systemSettingsRepository = new SystemSettingsRepository();
