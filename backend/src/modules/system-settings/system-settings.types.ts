/** Keys of the editable policy documents ("Configure System Policies"). Add a key here to add a policy. */
export const POLICY_KEYS = ['cancellation', 'refund', 'terms', 'privacy'] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

export type PolicyParamValue = number | string | boolean;

export interface PolicyDto {
  key: PolicyKey;
  title: string;
  /** Human readable text (markdown) shown to users. */
  content: string;
  /** Machine readable knobs consumed by other modules, e.g. cancellation.cancellationWindowHours. */
  params: Record<string, PolicyParamValue>;
  updatedAt?: string;
}

export interface CommissionDto {
  /** Share of each paid booking kept by the platform, in percent (0–100, max 2 decimals). */
  ratePercent: number;
  /** Same value in basis points (1% = 100) — what money calculations use, to avoid float errors. */
  rateBps: number;
  updatedAt?: string;
}

export const SETTING_KEYS = {
  COMMISSION: 'commission',
  policy: (key: PolicyKey) => `policy:${key}`,
} as const;

/** Used until a SUPER_ADMIN saves a value. Commission defaults to 0 on purpose: the owner must set the real rate. */
export const DEFAULT_COMMISSION_BPS = 0;

export const DEFAULT_POLICIES: Record<PolicyKey, Pick<PolicyDto, 'title' | 'content' | 'params'>> = {
  cancellation: {
    title: 'Cancellation policy',
    content: '',
    // Hours before departure after which a CONFIRMED booking can no longer be cancelled by the traveler.
    params: { cancellationWindowHours: 24 },
  },
  refund: { title: 'Refund policy', content: '', params: {} },
  terms: { title: 'Terms of service', content: '', params: {} },
  privacy: { title: 'Privacy policy', content: '', params: {} },
};
