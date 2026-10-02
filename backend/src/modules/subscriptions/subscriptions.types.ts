import type { TransitionMap } from '../../utils/state-machine';
import type { CheckoutDto } from '../payments';

export const SUBSCRIPTION_STATUS = {
  /** Created, waiting for the payment. */
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  /** Never paid (abandoned). */
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

const S = SUBSCRIPTION_STATUS;
/** CANCELLED -> ACTIVE exists for the "customer paid after we gave up" case: money received always wins. */
export const SUBSCRIPTION_TRANSITIONS: TransitionMap<SubscriptionStatus> = {
  [S.PENDING_PAYMENT]: [S.ACTIVE, S.CANCELLED],
  [S.CANCELLED]: [S.ACTIVE],
  [S.ACTIVE]: [S.EXPIRED],
};

export const SUBSCRIPTION_POLICY = {
  /** Payment window of a new subscription (kept equal to the booking one). */
  PAYMENT_WINDOW_MINUTES: 30,
  MAINTENANCE_BATCH: 100,
} as const;

export interface PlanDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  benefits: string[];
}

export interface SubscriptionDto {
  id: string;
  plan: { id: string; code: string; name: string };
  price: number;
  durationDays: number;
  status: SubscriptionStatus;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

export interface SubscribeResultDto {
  subscription: SubscriptionDto;
  checkout: CheckoutDto;
}

export interface CurrentSubscriptionDto {
  active: boolean;
  subscription: SubscriptionDto | null;
}

export interface ListSubscriptionsQuery {
  page: number;
  limit: number;
}
