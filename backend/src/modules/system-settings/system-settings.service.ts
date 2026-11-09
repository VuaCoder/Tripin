import type { PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { auditService, type AuditService } from '../audit';
import { systemSettingsRepository, type SystemSettingsRepository } from './system-settings.repository';
import type { SystemSettingRecord } from './system-settings.repository';
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
const updatedAtOf = (doc: SystemSettingRecord | null | undefined) =>
  (doc as unknown as { updatedAt?: Date } | null | undefined)?.updatedAt?.toISOString();

export class SystemSettingsService {
  constructor(
    private readonly settings: Pick<SystemSettingsRepository, 'findByKey' | 'findByKeys' | 'upsert' | 'saveRevision' | 'effectivePolicy'> = systemSettingsRepository,
    _audit: Pick<AuditService, 'record'> = auditService,
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
    return { ratePercent: rateBps / 100, rateBps, version: doc?.version ?? 0, updatedAt: updatedAtOf(doc) };
  }

  /** Use case "Set platform commission rates". Applies to bookings created AFTER the change. */
  async setCommission(actor: Actor, ratePercent: number, expectedVersion = 0): Promise<CommissionDto> {
    const rateBps = Math.round(ratePercent * 100);
    const doc = await this.settings.saveRevision(SETTING_KEYS.COMMISSION, { rateBps }, actor, expectedVersion, 'Commission configuration updated');
    return { ratePercent: rateBps / 100, rateBps, version: doc.version, updatedAt: updatedAtOf(doc) };
  }

  // ---------------------------------------------------------- Policies

  /** Public list of every policy (defaults filled in for those never edited). */
  async listPolicies(): Promise<PolicyDto[]> {
    return Promise.all(POLICY_KEYS.map((key) => this.getPolicy(key)));
  }

  async getPolicy(key: PolicyKey): Promise<PolicyDto> {
    const [doc, active] = await Promise.all([this.settings.findByKey(SETTING_KEYS.policy(key)), this.settings.effectivePolicy(key)]);
    const dto = this.toDto(key, active ? { ...doc, value: active.value } as SystemSettingRecord : doc);
    return { ...dto, version: doc?.version ?? 0, policyVersionId: active?.id, activeVersion: active?.versionNumber ?? 0 };
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
    input: { title: string; content: string; params?: Record<string, PolicyParamValue>; expectedVersion?: number; reason?: string; effectiveFrom?: string; rollbackOf?: string },
  ): Promise<PolicyDto> {
    const windowHours = input.params?.cancellationWindowHours;
    if (key === 'cancellation' && windowHours !== undefined &&
      (typeof windowHours !== 'number' || !Number.isFinite(windowHours) || windowHours < 0)) {
      throw AppError.badRequest('cancellationWindowHours must be a finite non-negative number');
    }
    if (key === 'moderation') {
      for (const name of ['slaHours', 'escalationSlaHours']) {
        const value = input.params?.[name];
        if (value !== undefined && (typeof value !== 'number' || value <= 0 || value > 8760)) throw AppError.badRequest('SLA hours must be positive and at most one year');
      }
    }
    const value = { title: input.title, content: input.content, params: { ...DEFAULT_POLICIES[key].params, ...input.params } };
    await this.settings.saveRevision(SETTING_KEYS.policy(key), value, actor, input.expectedVersion ?? 0, input.reason ?? 'Policy configuration updated', {
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined, rollbackOf: input.rollbackOf, baseline: DEFAULT_POLICIES[key],
    });
    return this.getPolicy(key);
  }

  private toDto(key: PolicyKey, doc: SystemSettingRecord | null | undefined): PolicyDto {
    const defaults = DEFAULT_POLICIES[key];
    const stored = doc?.value as Partial<Pick<PolicyDto, 'title' | 'content' | 'params'>> | undefined;
    return {
      key,
      title: stored?.title ?? defaults.title,
      content: stored?.content ?? defaults.content,
      // Stored params override the defaults key by key, so a default knob survives until it is explicitly set.
      params: { ...defaults.params, ...(stored?.params ?? {}) },
      version: doc?.version ?? 0,
      updatedAt: updatedAtOf(doc),
    };
  }
}

export const systemSettingsService = new SystemSettingsService();
