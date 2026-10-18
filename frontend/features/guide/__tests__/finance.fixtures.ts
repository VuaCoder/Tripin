import type {
  GuideSubscription,
  SubscriptionPlan,
  Earning,
} from '../types/finance';

export const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };
export const plan: SubscriptionPlan = {
  id: 'plan-1',
  code: 'PRO',
  name: 'Guide Pro',
  price: 199000,
  durationDays: 30,
  benefits: ['Hỗ trợ ưu tiên'],
};
export const subscription: GuideSubscription = {
  id: 'sub-1',
  plan: { id: plan.id, code: plan.code, name: plan.name },
  price: 199000,
  durationDays: 30,
  status: 'PENDING_PAYMENT',
  createdAt: '2026-10-01T00:00:00Z',
};
export const earning: Earning = {
  id: 'earn-1',
  bookingId: 'booking-1',
  bookingCode: 'BK001',
  tour: { id: 'tour-1', title: 'Hạ Long' },
  amount: 250000,
  earnedAt: '2026-10-01T17:00:00Z',
};
export const queryResult = (currentData?: unknown, extras = {}) => ({
  currentData,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: () => Promise.resolve(),
  ...extras,
});
