import { prisma, type Prisma } from '../../config/database';
import type { SystemSetting } from '../../generated/prisma/client';

export type SystemSettingRecord = SystemSetting;

export class SystemSettingsRepository {
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
