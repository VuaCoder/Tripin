import type { PlanRecord, SubscriptionRecord } from './subscriptions.repository';
import type { PlanDto, SubscriptionDto, SubscriptionStatus } from './subscriptions.types';

export function toPlanDto(plan: PlanRecord): PlanDto {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description ?? undefined,
    price: plan.price,
    durationDays: plan.durationDays,
    benefits: plan.benefits,
  };
}

export function toSubscriptionDto(subscription: SubscriptionRecord): SubscriptionDto {
  return {
    id: subscription.id,
    plan: { id: subscription.planId, code: subscription.planCode, name: subscription.planName },
    price: subscription.price,
    durationDays: subscription.durationDays,
    status: subscription.status as SubscriptionStatus,
    startsAt: subscription.startsAt?.toISOString(),
    endsAt: subscription.endsAt?.toISOString(),
    createdAt: subscription.createdAt.toISOString(),
  };
}
