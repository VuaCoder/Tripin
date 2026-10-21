import type { AgencyPromotion, DiscountType, PromotionApplyType, PromotionCodeType } from '../agency-promotions/types';

export interface PromotionFormValues {
  applyType: PromotionApplyType;
  codeType: PromotionCodeType;
  code: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
  minParticipants: string;
  daysInAdvance: string;
  firstBookingOnly: boolean;
  usageLimitPerUser: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
}

export type PromotionFormErrors = Partial<Record<keyof PromotionFormValues, string>>;

const CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;
const MAX_VND = 100_000_000_000;

/** null = empty, NaN = not an integer. Supports Vietnamese thousand separator dots e.g. "20.000", "100.000". */
const toInt = (value?: string): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    const n = Number(trimmed.replace(/\./g, ''));
    return Number.isInteger(n) ? n : Number.NaN;
  }
  const n = Number(trimmed);
  return Number.isInteger(n) ? n : Number.NaN;
};

/**
 * Mirrors `createPromotionBody` and the service rules of the backend so the agency gets instant feedback.
 * The backend stays the source of truth: it re-validates and its error is shown if it disagrees.
 */
export function validatePromotionForm(
  values: PromotionFormValues,
  options: { mode: 'create' | 'edit'; now?: Date; original?: AgencyPromotion } = { mode: 'create' },
): PromotionFormErrors {
  const errors: PromotionFormErrors = {};
  const now = options.now ?? new Date();

  const isCodeRequired = values.applyType === 'CODE' && values.codeType === 'SHARED';
  if (options.mode === 'create') {
    if (isCodeRequired && !CODE_PATTERN.test(values.code.trim().toUpperCase())) {
      errors.code = 'Mã gồm 3-30 ký tự: chữ, số, "-" hoặc "_".';
    } else if (values.code.trim() && !CODE_PATTERN.test(values.code.trim().toUpperCase())) {
      errors.code = 'Mã gồm 3-30 ký tự: chữ, số, "-" hoặc "_".';
    }
  }
  const titleLength = values.title.trim().length;
  if (titleLength < 3 || titleLength > 200) errors.title = 'Tiêu đề dài từ 3 đến 200 ký tự.';
  if (values.description.trim().length > 2000) errors.description = 'Mô tả tối đa 2000 ký tự.';

  const value = toInt(values.discountValue);
  if (value === null || Number.isNaN(value) || value < 1 || value > MAX_VND) {
    errors.discountValue = 'Giá trị giảm phải là số nguyên dương.';
  } else if (values.discountType === 'PERCENT' && value > 100) {
    errors.discountValue = 'Giảm theo phần trăm từ 1 đến 100.';
  }

  const minPart = toInt(values.minParticipants);
  if (minPart !== null && (Number.isNaN(minPart) || minPart < 1 || minPart > 10_000)) {
    errors.minParticipants = 'Số khách tối thiểu phải từ 1 người trở lên.';
  }

  const days = toInt(values.daysInAdvance);
  if (days !== null && (Number.isNaN(days) || days < 0 || days > 365)) {
    errors.daysInAdvance = 'Số ngày đặt trước phải từ 0 đến 365 ngày.';
  }

  const perUser = toInt(values.usageLimitPerUser);
  if (perUser !== null && (Number.isNaN(perUser) || perUser < 1 || perUser > 10_000)) {
    errors.usageLimitPerUser = 'Giới hạn dùng/khách phải là số nguyên dương.';
  }

  const max = toInt(values.maxDiscountAmount);
  if (max !== null) {
    if (values.discountType === 'FIXED') errors.maxDiscountAmount = 'Giảm tối đa chỉ áp dụng cho loại phần trăm.';
    else if (Number.isNaN(max) || max < 1 || max > MAX_VND) errors.maxDiscountAmount = 'Giảm tối đa phải là số nguyên dương.';
  }

  const min = toInt(values.minOrderAmount);
  if (min !== null && (Number.isNaN(min) || min < 0 || min > MAX_VND)) {
    errors.minOrderAmount = 'Đơn tối thiểu phải là số nguyên không âm.';
  }

  const limit = toInt(values.usageLimit);
  if (limit !== null && (Number.isNaN(limit) || limit < 1 || limit > 10_000_000)) {
    errors.usageLimit = 'Giới hạn lượt dùng phải là số nguyên dương.';
  }

  const starts = values.startsAt ? new Date(values.startsAt) : null;
  const ends = values.endsAt ? new Date(values.endsAt) : null;
  const startsOk = starts !== null && !Number.isNaN(starts.getTime());
  const endsOk = ends !== null && !Number.isNaN(ends.getTime());
  if (values.startsAt && !startsOk) errors.startsAt = 'Thời điểm bắt đầu không hợp lệ.';
  if (values.endsAt && !endsOk) errors.endsAt = 'Thời điểm kết thúc không hợp lệ.';
  if (startsOk && endsOk) {
    if (ends <= starts) errors.endsAt = 'Thời điểm kết thúc phải sau thời điểm bắt đầu.';
    else if (options.mode === 'create' && ends <= now) errors.endsAt = 'Khuyến mãi mới phải kết thúc trong tương lai.';
  } else if (endsOk && !startsOk) {
    if (options.mode === 'create' && ends <= now) errors.endsAt = 'Khuyến mãi mới phải kết thúc trong tương lai.';
  }

  if (options.original) {
    const original = options.original;
    if (limit !== null && limit < original.usedCount) errors.usageLimit = 'Giới hạn không được thấp hơn số lượt đã dùng.';
    // The current PATCH contract cannot clear these optional numeric fields.
    if (max === null && original.maxDiscountAmount !== undefined) errors.maxDiscountAmount = 'API chưa hỗ trợ bỏ mức giảm tối đa đã lưu. Hãy giữ hoặc nhập mức mới.';
    if (limit === null && original.usageLimit !== undefined) errors.usageLimit = 'API chưa hỗ trợ bỏ giới hạn đã lưu. Hãy giữ hoặc nhập giới hạn mới.';
    if (min === null) errors.minOrderAmount = 'Nhập 0 nếu không yêu cầu giá trị đơn tối thiểu.';
  }
  return errors;
}

/** Backend error codes -> Vietnamese messages; anything else falls back to the backend's own message. */
export const PROMOTION_ERROR_MESSAGES: Record<string, string> = {
  PROMOTION_CODE_EXISTS: 'Mã khuyến mãi này đã tồn tại. Hãy chọn mã khác.',
  PROMOTION_IN_USE: 'Khuyến mãi đã có người sử dụng nên không thể đổi giá trị giảm. Hãy tạo khuyến mãi mới.',
};
