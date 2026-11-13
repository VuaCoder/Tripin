'use client';

import { FormSelect } from '@/components/ui/FormSelect';
import { useEffect, useState } from 'react';
import {
  Ticket,
  Layers,
  Zap,
  Wallet,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  DollarSign,
  Tag,
  SlidersHorizontal,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { Button, FormField, Input, Modal, cn } from '@/components/ui';
import { formatCurrencyVndInput } from '@/lib/travel-format';
import type { AgencyPromotion, DiscountType, PromotionApplyType, PromotionCodeType } from '../agency-promotions/types';
import { validatePromotionForm, type PromotionFormErrors, type PromotionFormValues } from './validation';
import { handlePromotionCodeChange, handlePromotionCodeKeyDown } from './codeHelper';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant -> value of an `<input type="datetime-local">` in the browser's timezone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type SelectedPromoType = 'SHARED' | 'UNIQUE_BATCH' | 'AUTO_APPLY' | 'COLLECTABLE';
type FormStep = 1 | 2 | 3;

const FORM_STEPS: { id: FormStep; label: string; fields: (keyof PromotionFormValues)[] }[] = [
  { id: 1, label: 'Thông tin voucher', fields: ['code', 'title', 'description'] },
  { id: 2, label: 'Mức giảm', fields: ['discountValue', 'maxDiscountAmount', 'minOrderAmount', 'usageLimit', 'usageLimitPerUser'] },
  { id: 3, label: 'Thời hạn và điều kiện', fields: ['startsAt', 'endsAt', 'minParticipants', 'daysInAdvance'] },
];

export interface PromoTypeMeta {
  id: SelectedPromoType;
  applyType: PromotionApplyType;
  codeType: PromotionCodeType;
  title: string;
  description: string;
  Icon: LucideIcon;
}

export const PROMO_TYPES_CONFIG: Record<SelectedPromoType, PromoTypeMeta> = {
  SHARED: {
    id: 'SHARED',
    applyType: 'CODE',
    codeType: 'SHARED',
    title: 'Voucher mã dùng chung',
    description: 'Khách nhập mã khi đặt tour',
    Icon: Ticket,
  },
  UNIQUE_BATCH: {
    id: 'UNIQUE_BATCH',
    applyType: 'CODE',
    codeType: 'UNIQUE_BATCH',
    title: 'Voucher mã riêng',
    description: 'Tạo nhiều mã riêng, mỗi mã dùng một lần',
    Icon: Layers,
  },
  AUTO_APPLY: {
    id: 'AUTO_APPLY',
    applyType: 'AUTO_APPLY',
    codeType: 'SHARED',
    title: 'Tự động giảm giá',
    description: 'Tự áp dụng khi đơn hàng đủ điều kiện',
    Icon: Zap,
  },
  COLLECTABLE: {
    id: 'COLLECTABLE',
    applyType: 'COLLECTABLE',
    codeType: 'SHARED',
    title: 'Voucher lưu vào ví',
    description: 'Khách lưu voucher vào ví trước khi đặt tour',
    Icon: Wallet,
  },
};

export function getPromoTypeFromPromotion(p: AgencyPromotion): SelectedPromoType {
  if (p.applyType === 'AUTO_APPLY') return 'AUTO_APPLY';
  if (p.applyType === 'COLLECTABLE') return 'COLLECTABLE';
  if (p.codeType === 'UNIQUE_BATCH') return 'UNIQUE_BATCH';
  return 'SHARED';
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
  isPremium: false,
});

export const valuesFromPromotion = (p: AgencyPromotion): PromotionFormValues => ({
  applyType: p.applyType ?? 'CODE',
  codeType: p.codeType ?? 'SHARED',
  code: p.code ?? '',
  title: p.title,
  description: (p.description ?? '').replace(/^\[PREMIUM\]\s*/i, ''),
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
  isPremium: Boolean(p.description?.includes('[PREMIUM]') || p.title?.toLowerCase().includes('premium') || (p as any).scope === 'PREMIUM'),
});

export interface PromotionFormDialogProps {
  open: boolean;
  /** null = create a new promotion, otherwise edit this one. */
  promotion: AgencyPromotion | null;
  /** Pre-selected type if user selected from an external menu */
  initialType?: SelectedPromoType | null;
  isSubmitting: boolean;
  /** Message returned by the backend for the last submit; keeps the dialog open. */
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (values: PromotionFormValues) => void;
}

const selectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

/**
 * Modern promotion wizard dialog:
 * Step 1: Visual card picker for promotion type (Shared code, Unique batch, Auto-apply, Collectable voucher).
 * Step 2: Spacious, balanced 2-column input form tailored to the chosen type.
 */
export function PromotionFormDialog({
  open,
  promotion,
  initialType,
  isSubmitting,
  serverError,
  onClose,
  onSubmit,
}: PromotionFormDialogProps) {
  const isEdit = promotion !== null;
  const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);
  const [formStep, setFormStep] = useState<FormStep>(1);
  const [selectedType, setSelectedType] = useState<SelectedPromoType>('SHARED');
  const [values, setValues] = useState<PromotionFormValues>(emptyValues);
  const [errors, setErrors] = useState<PromotionFormErrors>({});

  useEffect(() => {
    if (open) {
      if (promotion) {
        const derived = getPromoTypeFromPromotion(promotion);
        setSelectedType(derived);
        setValues(valuesFromPromotion(promotion));
        setStep(2);
        setFormStep(1);
      } else if (initialType) {
        setSelectedType(initialType);
        const cfg = PROMO_TYPES_CONFIG[initialType];
        setValues({
          ...emptyValues(),
          applyType: cfg.applyType,
          codeType: cfg.codeType,
        });
        setStep(2);
        setFormStep(1);
      } else {
        setStep(1);
        setFormStep(1);
        setValues(emptyValues());
      }
      setErrors({});
    }
  }, [open, promotion, initialType]);

  const set = <K extends keyof PromotionFormValues>(key: K, value: PromotionFormValues[K]) => {
    const sanitized =
      typeof value === 'string' && ['discountValue', 'maxDiscountAmount', 'minOrderAmount', 'usageLimit'].includes(key)
        ? (value.replace(/[eE+-]/g, '') as PromotionFormValues[K])
        : value;
    setValues((current) => ({ ...current, [key]: sanitized }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePromotionCodeChange(e, (val) => set('code', val));
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handlePromotionCodeKeyDown(e, (val) => set('code', val));
  };

  // Once redeemed, the discount value can no longer change (backend rule PROMOTION_IN_USE).
  const valueLocked = isEdit && promotion.usedCount > 0;

  const handleSelectType = (typeKey: SelectedPromoType) => {
    setSelectedType(typeKey);
    const cfg = PROMO_TYPES_CONFIG[typeKey];
    setValues((prev) => ({
      ...prev,
      applyType: cfg.applyType,
      codeType: cfg.codeType,
    }));
    setFormStep(1);
    setStep(2);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validatePromotionForm(values, { mode: isEdit ? 'edit' : 'create', original: promotion ?? undefined });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(values);
  };

  const continueForm = () => {
    const found = validatePromotionForm(values, { mode: isEdit ? 'edit' : 'create', original: promotion ?? undefined });
    const currentFields = FORM_STEPS.find((item) => item.id === formStep)!.fields;
    const currentErrors = Object.fromEntries(
      Object.entries(found).filter(([field]) => currentFields.includes(field as keyof PromotionFormValues)),
    ) as PromotionFormErrors;
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) return;
    setFormStep((current) => (current < 3 ? (current + 1) as FormStep : current));
  };

  const currentTypeConfig = PROMO_TYPES_CONFIG[selectedType] ?? PROMO_TYPES_CONFIG.SHARED;

  // =========================================================================
  // BƯỚC 1: CHỌN LOẠI PROMOTION MUỐN TẠO (VISUAL CARDS)
  // =========================================================================
  if (step === 1 && !isEdit) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        closeOnBackdrop={!isSubmitting}
        title="Chọn cách dùng voucher"
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {Object.values(PROMO_TYPES_CONFIG).map((cfg) => {
              const IconComp = cfg.Icon;
              return (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={() => handleSelectType(cfg.id)}
                  className="group flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-sm cursor-pointer"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-teal border border-teal-100/80 transition-colors group-hover:bg-brand-teal group-hover:text-white group-hover:border-transparent">
                    <IconComp className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-brand-teal transition-colors">
                      {cfg.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {cfg.description}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-teal" />
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">
              Chọn 1 hình thức để tiếp tục thiết lập
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy bỏ
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // =========================================================================
  // BƯỚC 2: NHẬP THÔNG TIN CHO LOẠI ĐÃ CHỌN (SPACIOUS 2-COLUMN BALANCED FORM)
  // =========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop={!isSubmitting}
      title={isEdit ? 'Chỉnh sửa voucher' : 'Tạo voucher'}
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {serverError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{serverError}</span>
          </div>
        )}

        <nav aria-label="Tiến độ biểu mẫu" className="grid grid-cols-3 border-b border-slate-200 pb-4">
          {FORM_STEPS.map((item) => {
            const completed = item.id < formStep;
            const current = item.id === formStep;
            return <button key={item.id} type="button" onClick={() => completed && setFormStep(item.id)} disabled={!completed || isSubmitting} aria-current={current ? 'step' : undefined} className={`flex min-w-0 items-center gap-2 border-b-2 px-1 pb-3 text-left text-xs font-semibold transition-colors sm:text-sm ${current ? 'border-teal-700 text-teal-800' : completed ? 'border-transparent text-slate-600 hover:text-teal-800' : 'border-transparent text-slate-400'}`}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${current ? 'bg-teal-700 text-white' : completed ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>{completed ? <Check size={14} /> : item.id}</span>
              <span className="truncate">{item.label}</span>
            </button>;
          })}
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white text-brand-teal border border-slate-200 shadow-2xs">
              <currentTypeConfig.Icon className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500">Hình thức voucher</span>
              <p className="text-sm font-bold text-slate-900">
                {currentTypeConfig.title}
              </p>
            </div>
          </div>
          {!isEdit && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <ArrowLeft className="size-3.5" />
              Chọn loại khác
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 1. THÔNG TIN CƠ BẢN                                                       */}
        {/* ========================================================================= */}
        {formStep === 1 && <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
            <Tag className="size-4.5 text-brand-teal" />
            <h3 className="text-sm font-bold text-slate-900">Thông tin cơ bản</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Đối tượng áp dụng" htmlFor="promo-audience" hint="Chọn nhóm khách có thể nhận ưu đãi.">
              <FormSelect id="promo-audience" className={`${selectClass} h-11 sm:h-12`} value={values.isPremium ? 'premium' : 'all'} disabled={isSubmitting} onChange={(e) => set('isPremium', e.target.value === 'premium')}>
                <option value="all">Tất cả khách hàng</option>
                <option value="premium">Khách hàng Premium</option>
              </FormSelect>
            </FormField>
            {selectedType === 'SHARED' ? (
              <FormField
                label="Mã khuyến mãi"
                htmlFor="promo-code"
                required
                error={errors.code}
                hint={isEdit ? 'Không thể đổi mã sau khi tạo.' : 'Mã để khách hàng nhập khi thanh toán (khoảng trắng tự chuyển thành _).'}
              >
                <Input
                  id="promo-code"
                  value={values.code}
                  disabled={isEdit || isSubmitting}
                  invalid={Boolean(errors.code)}
                  onChange={handleCodeChange}
                  onKeyDown={handleCodeKeyDown}
                  placeholder="VD: HE2026, SUMMER10..."
                  className="h-11 sm:h-12 font-mono font-bold tracking-wider"
                />
              </FormField>
            ) : selectedType === 'UNIQUE_BATCH' ? (
              <FormField
                label="Mã tiền tố (Prefix)"
                htmlFor="promo-code"
                error={errors.code}
                hint={isEdit ? 'Không thể đổi tiền tố sau khi tạo.' : 'Hệ thống sẽ sinh mã dạng VIP2026-XXXX (khoảng trắng tự chuyển thành _).'}
              >
                <Input
                  id="promo-code"
                  value={values.code}
                  disabled={isEdit || isSubmitting}
                  invalid={Boolean(errors.code)}
                  onChange={handleCodeChange}
                  onKeyDown={handleCodeKeyDown}
                  placeholder="VD: VIP2026"
                  className="h-11 sm:h-12 font-mono font-bold tracking-wider"
                />
              </FormField>
            ) : (
              <FormField
                label="Mã định danh (Tuỳ chọn)"
                htmlFor="promo-code"
                error={errors.code}
                hint={isEdit ? 'Mã định danh cố định.' : 'Tùy chọn: hệ thống tự sinh mã nếu để trống (khoảng trắng tự chuyển thành _).'}
              >
                <Input
                  id="promo-code"
                  value={values.code}
                  disabled={isEdit || isSubmitting}
                  invalid={Boolean(errors.code)}
                  onChange={handleCodeChange}
                  onKeyDown={handleCodeKeyDown}
                  placeholder={selectedType === 'AUTO_APPLY' ? 'VD: AUTO-KM' : 'VD: VOUCHER-HE'}
                  className="h-11 sm:h-12 font-mono"
                />
              </FormField>
            )}

            <FormField label="Tên voucher" htmlFor="promo-title" required error={errors.title}>
              <Input
                id="promo-title"
                value={values.title}
                disabled={isSubmitting}
                invalid={Boolean(errors.title)}
                onChange={(e) => set('title', e.target.value)}
                placeholder="VD: Khuyến mãi mùa hè rực rỡ 2026"
                className="h-11 sm:h-12 font-medium"
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Mô tả chi tiết" htmlFor="promo-description" error={errors.description}>
                <textarea
                  id="promo-description"
                  rows={2}
                  className={`${selectClass} min-h-[72px] resize-y`}
                  value={values.description}
                  disabled={isSubmitting}
                  placeholder="Mô tả ngắn gọn quyền lợi ưu đãi và hướng dẫn áp dụng cho khách hàng..."
                  onChange={(e) => set('description', e.target.value)}
                />
              </FormField>
            </div>
          </div>
        </section>}

        {/* ========================================================================= */}
        {/* 2. MỨC GIẢM GIÁ & NGÂN SÁCH                                               */}
        {/* ========================================================================= */}
        {formStep === 2 && <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
            <DollarSign className="size-4.5 text-brand-teal" />
            <h3 className="text-sm font-bold text-slate-900">Mức giảm và giới hạn lượt dùng</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Loại giảm giá" htmlFor="promo-type" required hint={isEdit ? 'Không thể đổi loại sau khi tạo.' : undefined}>
              <FormSelect
                id="promo-type"
                className={`${selectClass} h-11 sm:h-12 font-medium cursor-pointer`}
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
              </FormSelect>
            </FormField>

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
                placeholder={values.discountType === 'PERCENT' ? 'Ví dụ: 10' : 'Ví dụ: 50.000'}
                className="h-11 sm:h-12 font-semibold"
                onChange={(e) => {
                  const val = values.discountType === 'PERCENT'
                    ? e.target.value.replace(/\D/g, '')
                    : e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                  set('discountValue', val);
                }}
              />
            </FormField>

            {values.discountType === 'PERCENT' ? (
              <FormField label="Giảm tối đa (₫)" htmlFor="promo-max" error={errors.maxDiscountAmount} hint="Để trống nếu không giới hạn mức giảm tối đa.">
                <Input
                  id="promo-max"
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyVndInput(values.maxDiscountAmount)}
                  disabled={isSubmitting}
                  invalid={Boolean(errors.maxDiscountAmount)}
                  placeholder="Ví dụ: 100.000"
                  className="h-11 sm:h-12"
                  onChange={(e) => set('maxDiscountAmount', e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
                />
              </FormField>
            ) : (
              <FormField label="Giảm tối đa (₫)" htmlFor="promo-max" hint="Cố định bằng chính mức giảm đã điền.">
                <Input
                  id="promo-max"
                  disabled
                  value="Bằng mức giảm"
                  className="h-11 sm:h-12 bg-slate-100 text-slate-400 cursor-not-allowed"
                />
              </FormField>
            )}

            <FormField label="Đơn tối thiểu (₫)" htmlFor="promo-min" error={errors.minOrderAmount} hint="Đơn hàng đạt từ mức này trở lên mới áp dụng.">
              <Input
                id="promo-min"
                type="text"
                inputMode="numeric"
                value={formatCurrencyVndInput(values.minOrderAmount)}
                disabled={isSubmitting}
                invalid={Boolean(errors.minOrderAmount)}
                placeholder="Ví dụ: 200.000"
                className="h-11 sm:h-12"
                onChange={(e) => set('minOrderAmount', e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
              />
            </FormField>

            <FormField
              label="Giới hạn tổng lượt dùng"
              htmlFor="promo-limit"
              error={errors.usageLimit}
              hint={isEdit && promotion.usedCount > 0 ? `Đã dùng ${promotion.usedCount} lượt.` : 'Để trống: không giới hạn số lượt dùng.'}
            >
              <Input
                id="promo-limit"
                type="number"
                inputMode="numeric"
                value={values.usageLimit}
                disabled={isSubmitting}
                invalid={Boolean(errors.usageLimit)}
                placeholder="Ví dụ: 100"
                className="h-11 sm:h-12"
                onChange={(e) => set('usageLimit', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>

            <FormField label="Lượt dùng tối đa / khách" htmlFor="promo-user-limit" error={errors.usageLimitPerUser} hint="Số lần tối đa mỗi khách hàng được áp dụng.">
              <Input
                id="promo-user-limit"
                type="number"
                inputMode="numeric"
                value={values.usageLimitPerUser}
                disabled={isSubmitting}
                invalid={Boolean(errors.usageLimitPerUser)}
                placeholder="1"
                className="h-11 sm:h-12"
                onChange={(e) => set('usageLimitPerUser', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>
          </div>
        </section>}

        {/* ========================================================================= */}
        {/* 3. ĐIỀU KIỆN ÁP DỤNG & THỜI HẠN                                           */}
        {/* ========================================================================= */}
        {formStep === 3 && <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
            <SlidersHorizontal className="size-4.5 text-brand-teal" />
            <h3 className="text-sm font-bold text-slate-900">Thời hạn và điều kiện áp dụng</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Thời gian bắt đầu (Tùy chọn)"
              htmlFor="promo-starts"
              error={errors.startsAt}
              hint="Để trống để bắt đầu có hiệu lực ngay."
            >
              <Input
                id="promo-starts"
                type="datetime-local"
                value={values.startsAt}
                disabled={isSubmitting}
                invalid={Boolean(errors.startsAt)}
                className="h-11 sm:h-12"
                onChange={(e) => set('startsAt', e.target.value)}
              />
            </FormField>

            <FormField
              label="Thời gian kết thúc (Tùy chọn)"
              htmlFor="promo-ends"
              error={errors.endsAt}
              hint="Để trống nếu không giới hạn ngày hết hạn."
            >
              <Input
                id="promo-ends"
                type="datetime-local"
                value={values.endsAt}
                disabled={isSubmitting}
                invalid={Boolean(errors.endsAt)}
                className="h-11 sm:h-12"
                onChange={(e) => set('endsAt', e.target.value)}
              />
            </FormField>

            <FormField label="Số khách tối thiểu trong đoàn" htmlFor="promo-min-participants" error={errors.minParticipants} hint="VD: 3 (chỉ áp dụng cho đoàn từ 3 khách trở lên).">
              <Input
                id="promo-min-participants"
                type="number"
                inputMode="numeric"
                value={values.minParticipants}
                disabled={isSubmitting}
                invalid={Boolean(errors.minParticipants)}
                placeholder="Ví dụ: 2"
                className="h-11 sm:h-12"
                onChange={(e) => set('minParticipants', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>

            <FormField label="Đặt trước tối thiểu (ngày)" htmlFor="promo-days-advance" error={errors.daysInAdvance} hint="VD: 7 (áp dụng cho đơn đặt trước 7 ngày, Early bird).">
              <Input
                id="promo-days-advance"
                type="number"
                inputMode="numeric"
                value={values.daysInAdvance}
                disabled={isSubmitting}
                invalid={Boolean(errors.daysInAdvance)}
                placeholder="Ví dụ: 7"
                className="h-11 sm:h-12"
                onChange={(e) => set('daysInAdvance', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>

            <div className="md:col-span-2 pt-1">
              <label className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 cursor-pointer text-sm select-none hover:border-slate-300 transition-colors shadow-2xs">
                <input
                  type="checkbox"
                  checked={values.firstBookingOnly}
                  disabled={isSubmitting}
                  onChange={(e) => setValues((prev) => ({ ...prev, firstBookingOnly: e.target.checked }))}
                  className="size-4.5 rounded border-slate-300 text-brand-teal focus:ring-brand-teal cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-900 block">Chỉ áp dụng cho đơn đặt tour đầu tiên</span>
                  <span className="text-xs text-slate-500">Dành riêng cho khách hàng mới chưa từng có đơn đặt tour nào thành công.</span>
                </div>
              </label>
            </div>
          </div>
        </section>}

        {/* Nút hành động */}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:-mx-6 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
          {formStep > 1 && <Button type="button" variant="outline" onClick={() => setFormStep((current) => (current - 1) as FormStep)} disabled={isSubmitting} className="h-11 px-5"><ArrowLeft size={16} /> Quay lại</Button>}
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="h-11 px-5">
            Hủy
          </Button>
          </div>
          {formStep < 3
            ? <Button type="button" onClick={continueForm} disabled={isSubmitting} className="h-11 px-6">Tiếp theo <ArrowRight size={16} /></Button>
            : <Button type="submit" loading={isSubmitting} loadingLabel="Đang lưu..." className="h-11 px-7 font-bold">{isEdit ? 'Lưu thay đổi' : 'Tạo voucher'}</Button>}
        </div>
      </form>
    </Modal>
  );
}
