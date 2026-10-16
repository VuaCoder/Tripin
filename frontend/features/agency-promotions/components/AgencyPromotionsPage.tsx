'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import {
  useCreateAgencyPromotionMutation,
  useGetAgencyPromotionsQuery,
  useUpdateAgencyPromotionMutation,
} from '../api/agencyPromotionsApi';
import type { AgencyPromotion, CreatePromotionInput, UpdatePromotionInput } from '../types';
import { PROMOTION_ERROR_MESSAGES, type PromotionFormValues } from '../validation';
import { PromotionFormDialog, toLocalInput } from './PromotionFormDialog';

const PAGE_SIZE = 10;
type ActiveFilter = 'all' | 'true' | 'false';

const vnd = new Intl.NumberFormat('vi-VN');
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

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
  if (values.description.trim() !== (original.description ?? '') && values.description.trim()) {
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

const statusBadge = (p: AgencyPromotion) => {
  if (!p.isActive) return { label: 'Đã tắt', className: 'bg-slate-100 text-slate-600' };
  if (p.isRunning) return { label: 'Đang chạy', className: 'bg-emerald-50 text-emerald-700' };
  return new Date(p.startsAt) > new Date()
    ? { label: 'Sắp diễn ra', className: 'bg-blue-50 text-blue-700' }
    : { label: 'Hết hạn', className: 'bg-amber-50 text-amber-700' };
};

const discountLabel = (p: AgencyPromotion) =>
  p.discountType === 'PERCENT'
    ? `${p.discountValue}%${p.maxDiscountAmount ? ` (tối đa ${vnd.format(p.maxDiscountAmount)} ₫)` : ''}`
    : `${vnd.format(p.discountValue)} ₫`;

/** Use case "Upload Promotions" for the logged-in Agency. */
export function AgencyPromotionsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ActiveFilter>('all');
  const { data, isLoading, isFetching, isError, refetch } = useGetAgencyPromotionsQuery({
    page,
    limit: PAGE_SIZE,
    ...(filter === 'all' ? {} : { isActive: filter === 'true' }),
  });
  const [createPromotion, { isLoading: isCreating }] = useCreateAgencyPromotionMutation();
  const [updatePromotion, { isLoading: isUpdating }] = useUpdateAgencyPromotionMutation();

  const [dialog, setDialog] = useState<{ promotion: AgencyPromotion | null } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const errorMessage = (err: unknown) => {
    const code = getApiErrorCode(err);
    return (code && PROMOTION_ERROR_MESSAGES[code]) || getApiErrorMessage(err, 'Không thể lưu khuyến mãi lúc này. Vui lòng thử lại.');
  };

  const openDialog = (promotion: AgencyPromotion | null) => {
    setServerError(null);
    setDialog({ promotion });
  };

  const handleSubmit = async (values: PromotionFormValues) => {
    const original = dialog?.promotion ?? null;
    setServerError(null);
    try {
      if (original) {
        const patch = buildUpdatePatch(values, original);
        if (Object.keys(patch).length === 0) {
          setServerError('Bạn chưa thay đổi thông tin nào.');
          return;
        }
        await updatePromotion({ id: original.id, patch }).unwrap();
        setFeedback({ message: 'Đã cập nhật khuyến mãi.', type: 'success' });
      } else {
        await createPromotion(buildCreatePayload(values)).unwrap();
        setFeedback({ message: 'Đã tạo khuyến mãi mới.', type: 'success' });
      }
      setDialog(null);
    } catch (err: unknown) {
      // Nothing is reported as saved: the dialog stays open with the backend's reason.
      setServerError(errorMessage(err));
    }
  };

  const handleToggle = async (promotion: AgencyPromotion) => {
    setTogglingId(promotion.id);
    try {
      await updatePromotion({ id: promotion.id, patch: { isActive: !promotion.isActive } }).unwrap();
      setFeedback({ message: promotion.isActive ? 'Đã tắt khuyến mãi.' : 'Đã bật khuyến mãi.', type: 'success' });
    } catch (err: unknown) {
      setFeedback({ message: errorMessage(err), type: 'error' });
      void refetch();
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Khuyến mãi của đại lý</h1>
          <p className="mt-1 text-sm text-slate-500">Tạo mã giảm giá áp dụng cho các tour của bạn. Khuyến mãi không thể xóa, chỉ có thể tắt.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Lọc theo trạng thái"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as ActiveFilter);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">Tất cả</option>
            <option value="true">Đang bật</option>
            <option value="false">Đã tắt</option>
          </select>
          <button
            type="button"
            onClick={() => openDialog(null)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-container/20 transition-colors hover:bg-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            Tạo khuyến mãi
          </button>
        </div>
      </header>

      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-semibold ${
            feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Đóng thông báo" className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Đang tải danh sách khuyến mãi..." />
      ) : isError ? (
        <ErrorState title="Không thể tải khuyến mãi" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <EmptyState
            title="Chưa có khuyến mãi nào"
            description="Tạo mã giảm giá đầu tiên để thu hút du khách đặt tour của bạn."
            actionLabel="Tạo khuyến mãi"
            onAction={() => openDialog(null)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {data.items.map((p) => {
              const badge = statusBadge(p);
              return (
                <li key={p.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">{p.code}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.className}`}>{badge.label}</span>
                      </div>
                      <p className="mt-2 font-bold text-slate-900">{p.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Giảm {discountLabel(p)} · Đơn tối thiểu {vnd.format(p.minOrderAmount)} ₫ · Đã dùng {p.usedCount}
                        {p.usageLimit != null ? `/${p.usageLimit}` : ''} lượt
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {dateTime.format(new Date(p.startsAt))} → {dateTime.format(new Date(p.endsAt))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={togglingId === p.id}
                        onClick={() => void handleToggle(p)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {p.isActive ? 'Tắt' : 'Bật'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openDialog(p)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Chỉnh sửa
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
              <span>
                Trang {data.meta.page} / {data.meta.totalPages} (Tổng {data.meta.total} khuyến mãi)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={data.meta.page <= 1 || isFetching}
                  onClick={() => setPage((c) => Math.max(1, c - 1))}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={data.meta.page >= data.meta.totalPages || isFetching}
                  onClick={() => setPage((c) => c + 1)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <PromotionFormDialog
        open={dialog !== null}
        promotion={dialog?.promotion ?? null}
        isSubmitting={isCreating || isUpdating}
        serverError={serverError}
        onClose={() => setDialog(null)}
        onSubmit={(values) => void handleSubmit(values)}
      />
    </div>
  );
}
