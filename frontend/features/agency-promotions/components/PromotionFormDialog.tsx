'use client';

import { useEffect, useState } from 'react';
import { Button, FormField, Input, Modal } from '@/components/ui';
import type { AgencyPromotion, DiscountType } from '../types';
import { validatePromotionForm, type PromotionFormErrors, type PromotionFormValues } from '../validation';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant -> value of an `<input type="datetime-local">` in the browser's timezone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyValues = (): PromotionFormValues => ({
  code: '',
  title: '',
  description: '',
  discountType: 'PERCENT',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  startsAt: '',
  endsAt: '',
  usageLimit: '',
});

export const valuesFromPromotion = (p: AgencyPromotion): PromotionFormValues => ({
  code: p.code,
  title: p.title,
  description: p.description ?? '',
  discountType: p.discountType,
  discountValue: String(p.discountValue),
  maxDiscountAmount: p.maxDiscountAmount != null ? String(p.maxDiscountAmount) : '',
  minOrderAmount: String(p.minOrderAmount),
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

  const set = <K extends keyof PromotionFormValues>(key: K, value: PromotionFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  // Once redeemed, the discount value can no longer change (backend rule PROMOTION_IN_USE).
  const valueLocked = isEdit && promotion.usedCount > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validatePromotionForm(values, { mode: isEdit ? 'edit' : 'create' });
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

          <FormField label="Loại giảm giá" htmlFor="promo-type" required hint={isEdit ? 'Không thể đổi loại sau khi tạo.' : undefined}>
            <select
              id="promo-type"
              className={selectClass}
              value={values.discountType}
              disabled={isEdit || isSubmitting}
              onChange={(e) => set('discountType', e.target.value as DiscountType)}
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
              type="number"
              inputMode="numeric"
              value={values.discountValue}
              disabled={valueLocked || isSubmitting}
              invalid={Boolean(errors.discountValue)}
              onChange={(e) => set('discountValue', e.target.value)}
            />
          </FormField>

          {values.discountType === 'PERCENT' && (
            <FormField label="Giảm tối đa (₫)" htmlFor="promo-max" error={errors.maxDiscountAmount}>
              <Input
                id="promo-max"
                type="number"
                inputMode="numeric"
                value={values.maxDiscountAmount}
                disabled={isSubmitting}
                invalid={Boolean(errors.maxDiscountAmount)}
                onChange={(e) => set('maxDiscountAmount', e.target.value)}
              />
            </FormField>
          )}

          <FormField label="Đơn tối thiểu (₫)" htmlFor="promo-min" error={errors.minOrderAmount}>
            <Input
              id="promo-min"
              type="number"
              inputMode="numeric"
              value={values.minOrderAmount}
              disabled={isSubmitting}
              invalid={Boolean(errors.minOrderAmount)}
              onChange={(e) => set('minOrderAmount', e.target.value)}
            />
          </FormField>

          <FormField
            label="Giới hạn lượt dùng"
            htmlFor="promo-limit"
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
              onChange={(e) => set('usageLimit', e.target.value)}
            />
          </FormField>

          <FormField label="Bắt đầu" htmlFor="promo-starts" required error={errors.startsAt}>
            <Input id="promo-starts" type="datetime-local" value={values.startsAt} disabled={isSubmitting} invalid={Boolean(errors.startsAt)} onChange={(e) => set('startsAt', e.target.value)} />
          </FormField>

          <FormField label="Kết thúc" htmlFor="promo-ends" required error={errors.endsAt}>
            <Input id="promo-ends" type="datetime-local" value={values.endsAt} disabled={isSubmitting} invalid={Boolean(errors.endsAt)} onChange={(e) => set('endsAt', e.target.value)} />
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
