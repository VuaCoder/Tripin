import type { DiscountType, PromotionScope } from '@travel-platform/constants';
import type { PromotionRecord } from './promotions.repository';
import { isRunning } from './promotions.policy';
import type { PromotionDto } from './promotions.types';

export function toPromotionDto(promotion: PromotionRecord): PromotionDto {
  return {
    id: promotion.id,
    scope: promotion.scope as PromotionScope,
    ownerId: promotion.ownerId ? promotion.ownerId : undefined,
    code: promotion.code,
    title: promotion.title,
    description: promotion.description ?? undefined,
    discountType: promotion.discountType as DiscountType,
    discountValue: promotion.discountValue,
    maxDiscountAmount: promotion.maxDiscountAmount ?? undefined,
    minOrderAmount: promotion.minOrderAmount ?? 0,
    startsAt: promotion.startsAt.toISOString(),
    endsAt: promotion.endsAt.toISOString(),
    usageLimit: promotion.usageLimit ?? undefined,
    usedCount: promotion.usedCount,
    isActive: promotion.isActive,
    isRunning: isRunning(promotion),
  };
}
