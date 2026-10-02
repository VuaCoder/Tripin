import type { DiscountType, PromotionScope } from '@travel-platform/constants';
import type { PromotionDocument } from './promotions.model';
import { isRunning } from './promotions.policy';
import type { PromotionDto } from './promotions.types';

export function toPromotionDto(promotion: PromotionDocument): PromotionDto {
  return {
    id: promotion.id,
    scope: promotion.scope as PromotionScope,
    ownerId: promotion.ownerId ? String(promotion.ownerId) : undefined,
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
