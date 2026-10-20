import type { AgencyPromotion, CreatePromotionInput, UpdatePromotionInput } from '../agency-promotions/types';
import type { PromotionFormValues } from './validation';
import { toLocalInput } from './PromotionFormDialog';

const optionalInt = (value: string): number | undefined => (value.trim() === '' ? undefined : Number(value));
const iso = (local: string) => new Date(local).toISOString();

export function buildCreatePayload(values: PromotionFormValues): CreatePromotionInput {
  const isPercent = values.discountType === 'PERCENT';
  const description = values.description.trim();
  return {
    code: values.code.trim().toUpperCase(),
    title: values.title.trim(),
    ...(description ? { description } : {}),
    discountType: values.discountType,
    discountValue: Number(values.discountValue),
    ...(isPercent && values.maxDiscountAmount.trim() ? { maxDiscountAmount: Number(values.maxDiscountAmount) } : {}),
    ...(optionalInt(values.minOrderAmount) !== undefined ? { minOrderAmount: Number(values.minOrderAmount) } : {}),
    startsAt: iso(values.startsAt),
    endsAt: iso(values.endsAt),
    ...(optionalInt(values.usageLimit) !== undefined ? { usageLimit: Number(values.usageLimit) } : {}),
  };
}

/** Only the fields that actually changed are sent; the backend rejects an empty patch. */
export function buildUpdatePatch(values: PromotionFormValues, original: AgencyPromotion): UpdatePromotionInput['patch'] {
  const patch: UpdatePromotionInput['patch'] = {};
  if (values.title.trim() !== original.title) patch.title = values.title.trim();
  if (values.description.trim() !== (original.description ?? '')) {
    patch.description = values.description.trim();
  }
  if (original.usedCount === 0 && Number(values.discountValue) !== original.discountValue) {
    patch.discountValue = Number(values.discountValue);
  }
  const max = optionalInt(values.maxDiscountAmount);
  if (max !== undefined && max !== original.maxDiscountAmount) patch.maxDiscountAmount = max;
  const min = optionalInt(values.minOrderAmount);
  if (min !== undefined && min !== original.minOrderAmount) patch.minOrderAmount = min;
  const limit = optionalInt(values.usageLimit);
  if (limit !== undefined && limit !== original.usageLimit) patch.usageLimit = limit;
  // The inputs have minute precision, so compare the local minute rather than the exact instant.
  if (values.startsAt !== toLocalInput(original.startsAt)) patch.startsAt = iso(values.startsAt);
  if (values.endsAt !== toLocalInput(original.endsAt)) patch.endsAt = iso(values.endsAt);
  return patch;
}
