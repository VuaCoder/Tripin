import { describe, expect, it, vi } from 'vitest';
import { ROLES } from '@travel-platform/constants';
import { SystemSettingsService } from '../system-settings.service';

const admin = { userId: 's1', role: ROLES.SUPER_ADMIN } as const;

function make(store: Record<string, unknown> = {}) {
  const repo = {
    findByKey: vi.fn(async (key: string) => (key in store ? { key, value: store[key], updatedAt: new Date('2026-01-01') } : null)),
    findByKeys: vi.fn(async (keys: string[]) =>
      keys.filter((k) => k in store).map((key) => ({ key, value: store[key], updatedAt: new Date('2026-01-01') })),
    ),
    upsert: vi.fn(async (key: string, value: unknown) => {
      store[key] = value;
      return { key, value, updatedAt: new Date('2026-02-02') };
    }),
  };
  const audit = { record: vi.fn(async () => undefined) };
  return { service: new SystemSettingsService(repo as never, audit), repo, audit, store };
}

describe('commission', () => {
  it('defaults to 0 until the super admin sets it', async () => {
    expect(await make().service.getCommissionBps()).toBe(0);
  });

  it('stores basis points (no float drift) and audits the change', async () => {
    const { service, audit, store } = make({ commission: { rateBps: 500 } });
    const result = await service.setCommission(admin, 12.34);
    expect(store.commission).toEqual({ rateBps: 1234 });
    expect(result).toMatchObject({ ratePercent: 12.34, rateBps: 1234 });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'settings.commission_updated', metadata: { fromBps: 500, toBps: 1234 } }),
    );
  });
});

describe('policies', () => {
  it('lists every policy with defaults, including the cancellation window knob', async () => {
    const policies = await make().service.listPolicies();
    expect(policies.map((p) => p.key)).toEqual(['cancellation', 'refund', 'terms', 'privacy']);
    expect(policies[0]!.params.cancellationWindowHours).toBe(24);
  });

  it('saves a policy and merges stored params over defaults', async () => {
    const { service, audit } = make();
    await service.setPolicy(admin, 'cancellation', { title: 'Cancel', content: 'text', params: { cancellationWindowHours: 48 } });
    expect(await service.getPolicyNumber('cancellation', 'cancellationWindowHours')).toBe(48);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'settings.policy_updated' }));
  });

  it('returns undefined for a non-numeric or missing knob', async () => {
    expect(await make().service.getPolicyNumber('refund', 'nothing')).toBeUndefined();
  });
});
