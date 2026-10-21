import type { AgencyPromotion, CreatePromotionInput, UpdatePromotionInput } from '../agency-promotions/types';
import type { PromotionFormValues } from './validation';
import { toLocalInput } from './PromotionFormDialog';

const parseFormInt = (value: string): number => {
  const trimmed = value.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    return Number(trimmed.replace(/\./g, ''));
  }
  return Number(trimmed);
};

const optionalInt = (value?: string): number | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return parseFormInt(trimmed);
};

const iso = (local: string) => new Date(local).toISOString();

export function buildCreatePayload(values: PromotionFormValues): CreatePromotionInput {
  const isPercent = values.discountType === 'PERCENT';
  const description = values.description?.trim();
  const now = new Date();
  const startsAt = values.startsAt ? iso(values.startsAt) : now.toISOString();
  const defaultEnd = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
  const endsAt = values.endsAt ? iso(values.endsAt) : defaultEnd.toISOString();
  const code = values.code?.trim().toUpperCase();

  return {
    applyType: values.applyType ?? 'CODE',
    codeType: values.codeType ?? 'SHARED',
    ...(code ? { code } : {}),
    title: values.title.trim(),
    ...(description ? { description } : {}),
    discountType: values.discountType,
    discountValue: parseFormInt(values.discountValue),
    ...(isPercent && values.maxDiscountAmount.trim() ? { maxDiscountAmount: parseFormInt(values.maxDiscountAmount) } : {}),
    ...(optionalInt(values.minOrderAmount) !== undefined ? { minOrderAmount: parseFormInt(values.minOrderAmount) } : {}),
    ...(optionalInt(values.minParticipants) !== undefined ? { minParticipants: parseFormInt(values.minParticipants) } : {}),
    ...(optionalInt(values.daysInAdvance) !== undefined ? { daysInAdvance: parseFormInt(values.daysInAdvance) } : {}),
    ...(values.firstBookingOnly ? { firstBookingOnly: true } : {}),
    ...(optionalInt(values.usageLimitPerUser) !== undefined ? { usageLimitPerUser: parseFormInt(values.usageLimitPerUser) } : {}),
    startsAt,
    endsAt,
    ...(optionalInt(values.usageLimit) !== undefined ? { usageLimit: parseFormInt(values.usageLimit) } : {}),
  };
}

/** Only the fields that actually changed are sent; the backend rejects an empty patch. */
export function buildUpdatePatch(values: PromotionFormValues, original: AgencyPromotion): UpdatePromotionInput['patch'] {
  const patch: UpdatePromotionInput['patch'] = {};
  if (values.title.trim() !== original.title) patch.title = values.title.trim();
  if (values.description.trim() !== (original.description ?? '')) {
    patch.description = values.description.trim();
  }
  if (original.usedCount === 0 && parseFormInt(values.discountValue) !== original.discountValue) {
    patch.discountValue = parseFormInt(values.discountValue);
  }
  const max = optionalInt(values.maxDiscountAmount);
  if (max !== undefined && max !== original.maxDiscountAmount) patch.maxDiscountAmount = max;
  const min = optionalInt(values.minOrderAmount);
  if (min !== undefined && min !== original.minOrderAmount) patch.minOrderAmount = min;
  const minPart = optionalInt(values.minParticipants);
  if (minPart !== undefined && minPart !== original.minParticipants) patch.minParticipants = minPart;
  const days = optionalInt(values.daysInAdvance);
  if (days !== undefined && days !== original.daysInAdvance) patch.daysInAdvance = days;
  if (values.firstBookingOnly !== undefined && values.firstBookingOnly !== Boolean(original.firstBookingOnly)) {
    patch.firstBookingOnly = values.firstBookingOnly;
  }
  const perUser = optionalInt(values.usageLimitPerUser);
  if (perUser !== undefined && perUser !== (original.usageLimitPerUser ?? 1)) patch.usageLimitPerUser = perUser;
  const limit = optionalInt(values.usageLimit);
  if (limit !== undefined && limit !== original.usageLimit) patch.usageLimit = limit;
  // The inputs have minute precision, so compare the local minute rather than the exact instant.
  if (values.startsAt && values.startsAt !== toLocalInput(original.startsAt)) patch.startsAt = iso(values.startsAt);
  if (values.endsAt && values.endsAt !== toLocalInput(original.endsAt)) patch.endsAt = iso(values.endsAt);
  return patch;
}
