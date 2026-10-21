import type { DiscountType, PromotionApplyType, PromotionCodeType, PromotionScope } from '@travel-platform/constants';
import type { PromotionRecord } from './promotions.repository';
import { isRunning } from './promotions.policy';
import type { PromotionDto } from './promotions.types';

export function toPromotionDto(promotion: PromotionRecord): PromotionDto {
  return {
    id: promotion.id,
    scope: promotion.scope as PromotionScope,
    ownerId: promotion.ownerId ? promotion.ownerId : undefined,
    applyType: (promotion.applyType ?? 'CODE') as PromotionApplyType,
    codeType: (promotion.codeType ?? 'SHARED') as PromotionCodeType,
    code: promotion.code ?? undefined,
    title: promotion.title,
    description: promotion.description ?? undefined,
    discountType: promotion.discountType as DiscountType,
    discountValue: promotion.discountValue,
    maxDiscountAmount: promotion.maxDiscountAmount ?? undefined,
    minOrderAmount: promotion.minOrderAmount ?? 0,
    minParticipants: promotion.minParticipants ?? undefined,
    daysInAdvance: promotion.daysInAdvance ?? undefined,
    firstBookingOnly: promotion.firstBookingOnly ?? false,
    targetTourIds: promotion.targetTourIds ?? [],
    startsAt: promotion.startsAt.toISOString(),
    endsAt: promotion.endsAt.toISOString(),
    usageLimit: promotion.usageLimit ?? undefined,
    usageLimitPerUser: promotion.usageLimitPerUser ?? 1,
    usedCount: promotion.usedCount,
    isActive: promotion.isActive,
    isRunning: isRunning(promotion),
  };
}
