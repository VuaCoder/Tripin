// Public surface of promotions. `bookings` uses `promotionsService.redeem / release / preview`.
export { agencyPromotionsRouter, adminPromotionsRouter, promotionsRouter } from './promotions.routes';
export { promotionsService, PromotionsService } from './promotions.service';
export { computeDiscount } from './promotions.policy';
export type { AppliedPromotion, PromotionDto } from './promotions.types';
