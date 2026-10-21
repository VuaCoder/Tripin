'use client';

import { useEffect, useState } from 'react';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { formatCurrencyVndInput } from '@/lib/travel-format';
import type { AgencyPromotion, DiscountType } from '../agency-promotions/types';
import { validatePromotionForm, type PromotionFormErrors, type PromotionFormValues } from './validation';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant -> value of an `<input type="datetime-local">` in the browser's timezone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyValues = (): PromotionFormValues => ({
  applyType: 'CODE',
  codeType: 'SHARED',
  code: '',
  title: '',
  description: '',
  discountType: 'PERCENT',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  minParticipants: '',
  daysInAdvance: '',
  firstBookingOnly: false,
  usageLimitPerUser: '1',
  startsAt: '',
  endsAt: '',
  usageLimit: '',
});

export const valuesFromPromotion = (p: AgencyPromotion): PromotionFormValues => ({
  applyType: p.applyType ?? 'CODE',
  codeType: p.codeType ?? 'SHARED',
  code: p.code ?? '',
  title: p.title,
  description: p.description ?? '',
  discountType: p.discountType,
  discountValue: String(p.discountValue),
  maxDiscountAmount: p.maxDiscountAmount != null ? String(p.maxDiscountAmount) : '',
  minOrderAmount: String(p.minOrderAmount),
  minParticipants: p.minParticipants != null ? String(p.minParticipants) : '',
  daysInAdvance: p.daysInAdvance != null ? String(p.daysInAdvance) : '',
  firstBookingOnly: Boolean(p.firstBookingOnly),
  usageLimitPerUser: String(p.usageLimitPerUser ?? 1),
  startsAt: toLocalInput(p.startsAt),
  endsAt: toLocalInput(p.endsAt),
  usageLimit: p.usageLimit != null ? String(p.usageLimit) : '',
});

interface PromotionFormDialogProps {
  open: boolean;
  /** null = create a new promotion, otherwise edit this one. */
  promotion: AgencyPromotion | null;
  isSubmitting: boolean;
  /** Message returned by the backend for the last submit; keeps the dialog open. */
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (values: PromotionFormValues) => void;
}

const selectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

/** Create / edit form for "Upload Promotions". `code` and `discountType` are immutable once created. */
export function PromotionFormDialog({ open, promotion, isSubmitting, serverError, onClose, onSubmit }: PromotionFormDialogProps) {
  const isEdit = promotion !== null;
  const [values, setValues] = useState<PromotionFormValues>(emptyValues);
  const [errors, setErrors] = useState<PromotionFormErrors>({});

  useEffect(() => {
    if (open) {
      setValues(promotion ? valuesFromPromotion(promotion) : emptyValues());
      setErrors({});
    }
  }, [open, promotion]);

  const set = <K extends keyof PromotionFormValues>(key: K, value: PromotionFormValues[K]) => {
    const sanitized = typeof value === 'string' && ['discountValue', 'maxDiscountAmount', 'minOrderAmount', 'usageLimit'].includes(key)
      ? (value.replace(/[eE+-]/g, '') as PromotionFormValues[K])
      : value;
    setValues((current) => ({ ...current, [key]: sanitized }));
  };

  // Once redeemed, the discount value can no longer change (backend rule PROMOTION_IN_USE).
  const valueLocked = isEdit && promotion.usedCount > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validatePromotionForm(values, { mode: isEdit ? 'edit' : 'create', original: promotion ?? undefined });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop={!isSubmitting}
      title={isEdit ? 'Chỉnh sửa khuyến mãi' : 'Tạo khuyến mãi mới'}
      className="max-h-[90vh] max-w-2xl overflow-y-auto"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {serverError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Hình thức áp dụng" htmlFor="promo-apply-type" required hint={isEdit ? 'Không thể đổi hình thức sau khi tạo.' : undefined}>
            <select
              id="promo-apply-type"
              className={selectClass}
              value={values.applyType}
              disabled={isEdit || isSubmitting}
              onChange={(e) => {
                const nextApply = e.target.value as import('../agency-promotions/types').PromotionApplyType;
                setValues((prev) => ({
                  ...prev,
                  applyType: nextApply,
                }));
              }}
            >
              <option value="CODE">Mã nhập tay (Nhập khi đặt tour)</option>
              <option value="AUTO_APPLY">Tự động áp dụng (Khi đủ điều kiện)</option>
              <option value="COLLECTABLE">Thu thập vào ví (Lưu voucher)</option>
            </select>
          </FormField>

          {values.applyType === 'CODE' ? (
            <FormField label="Kiểu sinh mã" htmlFor="promo-code-type" required hint={isEdit ? 'Không thể đổi kiểu mã sau khi tạo.' : undefined}>
              <select
                id="promo-code-type"
                className={selectClass}
                value={values.codeType}
                disabled={isEdit || isSubmitting}
                onChange={(e) => {
                  const nextCodeType = e.target.value as import('../agency-promotions/types').PromotionCodeType;
                  setValues((prev) => ({
                    ...prev,
                    codeType: nextCodeType,
                  }));
                }}
              >
                <option value="SHARED">1 mã chung dùng cho tất cả</option>
                <option value="UNIQUE_BATCH">Tạo nhiều mã riêng (mỗi mã 1 lần)</option>
              </select>
            </FormField>
          ) : (
            <div className="flex flex-col justify-center rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">
                {values.applyType === 'AUTO_APPLY' ? '⚡ Khuyến mãi tự động' : '🎁 Voucher thu thập'}
              </span>
              <span>
                {values.applyType === 'AUTO_APPLY'
                  ? 'Hệ thống tự động kích hoạt mã khi khách đạt đủ điều kiện của tour.'
                  : 'Khách hàng có thể lưu voucher vào ví và chọn sử dụng khi thanh toán.'}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {values.applyType === 'CODE' && values.codeType === 'SHARED' ? (
            <FormField label="Mã khuyến mãi" htmlFor="promo-code" required error={errors.code} hint={isEdit ? 'Không thể đổi mã sau khi tạo.' : undefined}>
              <Input
                id="promo-code"
                value={values.code}
                disabled={isEdit || isSubmitting}
                invalid={Boolean(errors.code)}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="VD: HE2026"
              />
            </FormField>
          ) : (
            <FormField label="Mã định danh (Tuỳ chọn)" htmlFor="promo-code" error={errors.code} hint={values.codeType === 'UNIQUE_BATCH' ? 'Mã tiền tố chung, sau đó sinh các mã riêng.' : 'Hệ thống tự động tạo mã nếu để trống.'}>
              <Input
                id="promo-code"
                value={values.code}
                disabled={isEdit || isSubmitting}
                invalid={Boolean(errors.code)}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder={values.codeType === 'UNIQUE_BATCH' ? 'VD: VIP2026' : 'VD: AUTO-KM'}
              />
            </FormField>
          )}

          <FormField label="Loại giảm giá" htmlFor="promo-type" required hint={isEdit ? 'Không thể đổi loại sau khi tạo.' : undefined}>
            <select
              id="promo-type"
              className={selectClass}
              value={values.discountType}
              disabled={isEdit || isSubmitting}
              onChange={(e) => {
                const nextType = e.target.value as DiscountType;
                setValues((prev) => ({
                  ...prev,
                  discountType: nextType,
                  ...(nextType === 'FIXED' ? { maxDiscountAmount: '' } : {}),
                }));
              }}
            >
              <option value="PERCENT">Phần trăm (%)</option>
              <option value="FIXED">Số tiền cố định (₫)</option>
            </select>
          </FormField>
        </div>

        <FormField label="Tiêu đề" htmlFor="promo-title" required error={errors.title}>
          <Input id="promo-title" value={values.title} disabled={isSubmitting} invalid={Boolean(errors.title)} onChange={(e) => set('title', e.target.value)} />
        </FormField>

        <FormField label="Mô tả" htmlFor="promo-description" error={errors.description}>
          <textarea
            id="promo-description"
            rows={2}
            className={selectClass}
            value={values.description}
            disabled={isSubmitting}
            onChange={(e) => set('description', e.target.value)}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={values.discountType === 'PERCENT' ? 'Mức giảm (%)' : 'Mức giảm (₫)'}
            htmlFor="promo-value"
            required
            error={errors.discountValue}
            hint={valueLocked ? 'Đã có lượt sử dụng nên không thể đổi mức giảm.' : undefined}
          >
            <Input
              id="promo-value"
              type={values.discountType === 'PERCENT' ? 'number' : 'text'}
              inputMode="numeric"
              value={values.discountType === 'PERCENT' ? values.discountValue : formatCurrencyVndInput(values.discountValue)}
              disabled={valueLocked || isSubmitting}
              invalid={Boolean(errors.discountValue)}
              placeholder={values.discountType === 'PERCENT' ? 'Ví dụ: 10' : 'Ví dụ: 20.000'}
              onChange={(e) => {
                const val = values.discountType === 'PERCENT'
                  ? e.target.value.replace(/\D/g, '')
                  : e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                set('discountValue', val);
              }}
            />
          </FormField>

          {values.discountType === 'PERCENT' && (
            <FormField label="Giảm tối đa (₫)" htmlFor="promo-max" error={errors.maxDiscountAmount}>
              <Input
                id="promo-max"
                type="text"
                inputMode="numeric"
                value={formatCurrencyVndInput(values.maxDiscountAmount)}
                disabled={isSubmitting}
                invalid={Boolean(errors.maxDiscountAmount)}
                placeholder="Ví dụ: 50.000"
                onChange={(e) => set('maxDiscountAmount', e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
              />
            </FormField>
          )}

          <FormField label="Đơn tối thiểu (₫)" htmlFor="promo-min" error={errors.minOrderAmount}>
            <Input
              id="promo-min"
              type="text"
              inputMode="numeric"
              value={formatCurrencyVndInput(values.minOrderAmount)}
              disabled={isSubmitting}
              invalid={Boolean(errors.minOrderAmount)}
              placeholder="Ví dụ: 100.000"
              onChange={(e) => set('minOrderAmount', e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
            />
          </FormField>

          <FormField
            label="Giới hạn lượt dùng"
            htmlFor="promo-limit"
            className={values.discountType === 'PERCENT' ? undefined : 'sm:col-span-2'}
            error={errors.usageLimit}
            hint={isEdit && promotion.usedCount > 0 ? `Đã dùng ${promotion.usedCount} lượt, không thể đặt thấp hơn.` : 'Để trống nếu không giới hạn.'}
          >
            <Input
              id="promo-limit"
              type="number"
              inputMode="numeric"
              value={values.usageLimit}
              disabled={isSubmitting}
              invalid={Boolean(errors.usageLimit)}
              placeholder="Ví dụ: 100"
              onChange={(e) => set('usageLimit', e.target.value.replace(/\D/g, ''))}
            />
          </FormField>
        </div>

        {/* Điều kiện áp dụng nâng cao */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">tune</span>
            <span className="text-sm font-bold text-slate-800">Điều kiện áp dụng nâng cao (Tuỳ chọn)</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Số khách tối thiểu" htmlFor="promo-min-participants" error={errors.minParticipants} hint="VD: 3 (đoàn từ 3 khách)">
              <Input
                id="promo-min-participants"
                type="number"
                inputMode="numeric"
                value={values.minParticipants}
                disabled={isSubmitting}
                invalid={Boolean(errors.minParticipants)}
                placeholder="VD: 2"
                onChange={(e) => set('minParticipants', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>

            <FormField label="Đặt trước tối thiểu (ngày)" htmlFor="promo-days-advance" error={errors.daysInAdvance} hint="Early bird (VD: trước 7 ngày)">
              <Input
                id="promo-days-advance"
                type="number"
                inputMode="numeric"
                value={values.daysInAdvance}
                disabled={isSubmitting}
                invalid={Boolean(errors.daysInAdvance)}
                placeholder="VD: 7"
                onChange={(e) => set('daysInAdvance', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>

            <FormField label="Lượt dùng / khách" htmlFor="promo-user-limit" error={errors.usageLimitPerUser} hint="Số lần mỗi khách được dùng">
              <Input
                id="promo-user-limit"
                type="number"
                inputMode="numeric"
                value={values.usageLimitPerUser}
                disabled={isSubmitting}
                invalid={Boolean(errors.usageLimitPerUser)}
                placeholder="1"
                onChange={(e) => set('usageLimitPerUser', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 select-none pt-1">
            <input
              type="checkbox"
              checked={values.firstBookingOnly}
              disabled={isSubmitting}
              onChange={(e) => setValues((prev) => ({ ...prev, firstBookingOnly: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
            />
            <span className="font-medium">Chỉ áp dụng cho lần đặt tour đầu tiên (khách hàng mới)</span>
          </label>
        </div>

        {/* Thời gian áp dụng: Bắt đầu & Kết thúc luôn đi chung một hàng, không bắt buộc (Optional) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={
              <span>
                Bắt đầu <span className="text-xs font-normal text-slate-500">(Optional)</span>
              </span>
            }
            htmlFor="promo-starts"
            error={errors.startsAt}
            hint="Để trống để áp dụng ngay."
          >
            <Input
              id="promo-starts"
              type="datetime-local"
              value={values.startsAt}
              disabled={isSubmitting}
              invalid={Boolean(errors.startsAt)}
              onChange={(e) => set('startsAt', e.target.value)}
            />
          </FormField>

          <FormField
            label={
              <span>
                Kết thúc <span className="text-xs font-normal text-slate-500">(Optional)</span>
              </span>
            }
            htmlFor="promo-ends"
            error={errors.endsAt}
            hint="Để trống nếu không giới hạn ngày kết thúc."
          >
            <Input
              id="promo-ends"
              type="datetime-local"
              value={values.endsAt}
              disabled={isSubmitting}
              invalid={Boolean(errors.endsAt)}
              onChange={(e) => set('endsAt', e.target.value)}
            />
          </FormField>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="Đang lưu...">
            {isEdit ? 'Lưu thay đổi' : 'Tạo khuyến mãi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
