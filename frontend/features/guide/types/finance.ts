import type { CheckoutDto } from '@/features/payment/types/payment.types';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface ApiResult<T> {
  success: boolean;
  data: T;
}
export interface PageResponse<T> extends ApiResult<T[]> {
  meta: PageMeta;
}
export interface PageResult<T> {
  items: T[];
  meta: PageMeta;
}
export interface Paging {
  page?: number;
  limit?: number;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  benefits: string[];
}
export type SubscriptionStatus =
  'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export interface GuideSubscription {
  id: string;
  plan: { id: string; code: string; name: string };
  price: number;
  durationDays: number;
  status: SubscriptionStatus;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}
export interface CurrentSubscription {
  active: boolean;
  subscription: GuideSubscription | null;
}
export interface SubscribeResult {
  subscription: GuideSubscription;
  checkout: CheckoutDto;
}
export interface Earning {
  id: string;
  bookingId: string;
  bookingCode: string;
  tour: { id: string; title: string };
  amount: number;
  earnedAt: string;
}
export interface EarningsSummary {
  totalAmount: number;
  count: number;
  byMonth: { month: string; totalAmount: number; count: number }[];
}
export interface EarningsRange {
  from?: string;
  to?: string;
}
