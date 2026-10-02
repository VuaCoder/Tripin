import { SystemSettingModel, type SystemSettingDocument } from './system-settings.model';

export class SystemSettingsRepository {
  findByKey(key: string): Promise<SystemSettingDocument | null> {
    return SystemSettingModel.findOne({ key }).exec();
  }

  findByKeys(keys: string[]): Promise<SystemSettingDocument[]> {
    return SystemSettingModel.find({ key: { $in: keys } }).exec();
  }

  /** `updatedBy` is omitted by the seed script (no user is acting). */
  upsert(key: string, value: unknown, updatedBy?: string): Promise<SystemSettingDocument | null> {
    return SystemSettingModel.findOneAndUpdate(
      { key },
      { $set: { value, ...(updatedBy ? { updatedBy } : {}) } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).exec();
  }
}

export const systemSettingsRepository = new SystemSettingsRepository();
