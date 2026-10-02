import type { PersistedRole } from '@travel-platform/constants';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { systemSettingsRepository, type SystemSettingsRepository } from './system-settings.repository';
import type { SystemSettingDocument } from './system-settings.model';
import {
  DEFAULT_COMMISSION_BPS,
  DEFAULT_POLICIES,
  POLICY_KEYS,
  SETTING_KEYS,
  type CommissionDto,
  type PolicyDto,
  type PolicyKey,
  type PolicyParamValue,
} from './system-settings.types';

type Actor = { userId: string; role: PersistedRole };
const updatedAtOf = (doc: SystemSettingDocument | null | undefined) =>
  (doc as unknown as { updatedAt?: Date } | null | undefined)?.updatedAt?.toISOString();

export class SystemSettingsService {
  constructor(
    private readonly settings: Pick<SystemSettingsRepository, 'findByKey' | 'findByKeys' | 'upsert'> = systemSettingsRepository,
    private readonly audit: Pick<AuditService, 'record'> = auditService,
  ) {}

  // -------------------------------------------------------- Commission

  /** Basis points; the value money calculations must use (read at booking time and snapshotted on the booking). */
  async getCommissionBps(): Promise<number> {
    const doc = await this.settings.findByKey(SETTING_KEYS.COMMISSION);
    return (doc?.value as { rateBps?: number } | undefined)?.rateBps ?? DEFAULT_COMMISSION_BPS;
  }

  async getCommission(): Promise<CommissionDto> {
    const doc = await this.settings.findByKey(SETTING_KEYS.COMMISSION);
    const rateBps = (doc?.value as { rateBps?: number } | undefined)?.rateBps ?? DEFAULT_COMMISSION_BPS;
    return { ratePercent: rateBps / 100, rateBps, updatedAt: updatedAtOf(doc) };
  }

  /** Use case "Set platform commission rates". Applies to bookings created AFTER the change. */
  async setCommission(actor: Actor, ratePercent: number): Promise<CommissionDto> {
    const before = await this.getCommissionBps();
    const rateBps = Math.round(ratePercent * 100);
    const doc = await this.settings.upsert(SETTING_KEYS.COMMISSION, { rateBps }, actor.userId);
    await this.audit.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.COMMISSION_UPDATED,
      targetType: 'setting',
      targetId: SETTING_KEYS.COMMISSION,
      metadata: { fromBps: before, toBps: rateBps },
    });
    return { ratePercent: rateBps / 100, rateBps, updatedAt: updatedAtOf(doc) };
  }

  // ---------------------------------------------------------- Policies

  /** Public list of every policy (defaults filled in for those never edited). */
  async listPolicies(): Promise<PolicyDto[]> {
    const docs = await this.settings.findByKeys(POLICY_KEYS.map(SETTING_KEYS.policy));
    const byKey = new Map(docs.map((doc) => [doc.key, doc]));
    return POLICY_KEYS.map((key) => this.toDto(key, byKey.get(SETTING_KEYS.policy(key))));
  }

  async getPolicy(key: PolicyKey): Promise<PolicyDto> {
    return this.toDto(key, await this.settings.findByKey(SETTING_KEYS.policy(key)));
  }

  /** Typed numeric knob for other modules, e.g. `getPolicyNumber('cancellation', 'cancellationWindowHours')`. */
  async getPolicyNumber(key: PolicyKey, param: string): Promise<number | undefined> {
    const value = (await this.getPolicy(key)).params[param];
    return typeof value === 'number' ? value : undefined;
  }

  /** Use case "Configure System Policies". Replaces the whole policy document. */
  async setPolicy(
    actor: Actor,
    key: PolicyKey,
    input: { title: string; content: string; params?: Record<string, PolicyParamValue> },
  ): Promise<PolicyDto> {
    const value = { title: input.title, content: input.content, params: input.params ?? {} };
    const doc = await this.settings.upsert(SETTING_KEYS.policy(key), value, actor.userId);
    await this.audit.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.POLICY_UPDATED,
      targetType: 'setting',
      targetId: SETTING_KEYS.policy(key),
      metadata: { title: input.title, params: value.params },
    });
    return this.toDto(key, doc);
  }

  private toDto(key: PolicyKey, doc: SystemSettingDocument | null | undefined): PolicyDto {
    const defaults = DEFAULT_POLICIES[key];
    const stored = doc?.value as Partial<Pick<PolicyDto, 'title' | 'content' | 'params'>> | undefined;
    return {
      key,
      title: stored?.title ?? defaults.title,
      content: stored?.content ?? defaults.content,
      // Stored params override the defaults key by key, so a default knob survives until it is explicitly set.
      params: { ...defaults.params, ...(stored?.params ?? {}) },
      updatedAt: updatedAtOf(doc),
    };
  }
}

export const systemSettingsService = new SystemSettingsService();
