'use client';

import { useState } from 'react';
import {
  Plus,
  Search,
  X,
  Ticket,
  Zap,
  Wallet,
  Layers,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Tag,
  Calendar,
  RotateCcw,
  QrCode,
  PauseCircle,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { AntSelect, Modal, type AntSelectOption } from '@/components/ui';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import {
  useCreateAgencyPromotionMutation,
  useGetAgencyPromotionsQuery,
  useUpdateAgencyPromotionMutation,
  useGenerateAgencyBatchMutation,
  useLazyGetAgencyBatchQuery,
} from '../api/agencyPromotionsApi';
import type { AgencyPromotion, DiscountType, ListPromotionsArgs } from '../types';
import { PROMOTION_ERROR_MESSAGES, type PromotionFormValues } from '../validation';
import { PromotionFormDialog, type SelectedPromoType } from './PromotionFormDialog';
import { PromotionBatchModal } from '../../promotions/PromotionBatchModal';

const PAGE_SIZE = 10;
type StatusFilter = 'all' | 'true' | 'false' | 'archived';
type TypeFilter = 'all' | 'SHARED' | 'UNIQUE_BATCH' | 'AUTO_APPLY' | 'COLLECTABLE';

const vnd = new Intl.NumberFormat('vi-VN');
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export { buildCreatePayload, buildUpdatePatch } from '../../promotions/payload';
import { buildCreatePayload, buildUpdatePatch } from '../../promotions/payload';

const statusBadge = (p: AgencyPromotion) => {
  if (p.isArchived) return { label: 'Đã lưu trữ', className: 'bg-amber-100/90 text-amber-800 border border-amber-300/80 font-bold', dot: 'bg-amber-600' };
  if (!p.isActive) return { label: 'Đã tắt', className: 'bg-slate-200 text-slate-700 border border-slate-300 font-bold', dot: 'bg-slate-500' };
  if (p.isRunning) return { label: 'Đang chạy', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold', dot: 'bg-emerald-500' };
  return new Date(p.startsAt) > new Date()
    ? { label: 'Sắp diễn ra', className: 'bg-sky-50 text-sky-700 border border-sky-200/60 font-semibold', dot: 'bg-sky-500' }
    : { label: 'Hết hạn', className: 'bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold', dot: 'bg-rose-500' };
};

const discountLabel = (p: AgencyPromotion) =>
  p.discountType === 'PERCENT'
    ? `${p.discountValue}%${p.maxDiscountAmount ? ` (tối đa ${vnd.format(p.maxDiscountAmount)} ₫)` : ''}`
    : `${vnd.format(p.discountValue)} ₫`;

/** Use case "Upload Promotions" for the logged-in Agency with modern Search, Filters and Creation Wizard. */
export function AgencyPromotionsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [discountTypeFilter, setDiscountTypeFilter] = useState<'all' | DiscountType>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Build query args
  const queryArgs: ListPromotionsArgs = {
    page,
    limit: PAGE_SIZE,
    ...(activeSearch ? { q: activeSearch } : {}),
    ...(statusFilter === 'archived'
      ? { isArchived: true }
      : {
          isArchived: false,
          ...(statusFilter !== 'all' ? { isActive: statusFilter === 'true' } : {}),
        }),
    ...(typeFilter === 'SHARED' ? { applyType: 'CODE', codeType: 'SHARED' } : {}),
    ...(typeFilter === 'UNIQUE_BATCH' ? { applyType: 'CODE', codeType: 'UNIQUE_BATCH' } : {}),
    ...(typeFilter === 'AUTO_APPLY' ? { applyType: 'AUTO_APPLY' } : {}),
    ...(typeFilter === 'COLLECTABLE' ? { applyType: 'COLLECTABLE' } : {}),
    ...(discountTypeFilter !== 'all' ? { discountType: discountTypeFilter } : {}),
  };

  const { data, isLoading, isFetching, isError, refetch } = useGetAgencyPromotionsQuery(queryArgs);
  const [createPromotion, { isLoading: isCreating }] = useCreateAgencyPromotionMutation();
  const [updatePromotion, { isLoading: isUpdating }] = useUpdateAgencyPromotionMutation();

  const [dialog, setDialog] = useState<{ promotion: AgencyPromotion | null; initialType?: SelectedPromoType | null } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmArchiveModal, setConfirmArchiveModal] = useState<{
    promotion: AgencyPromotion;
    action: 'archive' | 'unarchive';
  } | null>(null);

  const [generateBatch, { isLoading: isGeneratingBatch }] = useGenerateAgencyBatchMutation();
  const [fetchBatch, batchState] = useLazyGetAgencyBatchQuery();
  const [batchModal, setBatchModal] = useState<{ promotion: AgencyPromotion } | null>(null);
  const [batchPage, setBatchPage] = useState(1);

  const openBatchModal = async (promotion: AgencyPromotion, pageNum = 1) => {
    setBatchModal({ promotion });
    setBatchPage(pageNum);
    await fetchBatch({ id: promotion.id, page: pageNum, limit: 20 }, false);
  };

  const handleGenerateBatch = async (count: number, prefix: string) => {
    if (!batchModal) return;
    await generateBatch({ id: batchModal.promotion.id, count, prefix: prefix || undefined }).unwrap();
    setBatchPage(1);
    await fetchBatch({ id: batchModal.promotion.id, page: 1, limit: 20 }, false);
    void refetch();
  };

  const errorMessage = (err: unknown) => {
    const code = getApiErrorCode(err);
    return (code && PROMOTION_ERROR_MESSAGES[code]) || getApiErrorMessage(err, 'Không thể lưu khuyến mãi lúc này. Vui lòng thử lại.');
  };

  const openDialog = (promotion: AgencyPromotion | null, initialType?: SelectedPromoType | null) => {
    setServerError(null);
    setDialog({ promotion, initialType });
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

  const handleArchive = async (promotion: AgencyPromotion) => {
    setTogglingId(promotion.id);
    try {
      const nextArchived = !promotion.isArchived;
      await updatePromotion({
        id: promotion.id,
        patch: {
          isArchived: nextArchived,
          ...(nextArchived ? { isActive: false } : {}),
        },
      }).unwrap();
      setFeedback({
        message: nextArchived ? 'Đã chuyển khuyến mãi vào mục lưu trữ.' : 'Đã khôi phục khuyến mãi từ mục lưu trữ.',
        type: 'success',
      });
    } catch (err: unknown) {
      setFeedback({ message: errorMessage(err), type: 'error' });
      void refetch();
    } finally {
      setTogglingId(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setActiveSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDiscountTypeFilter('all');
    setPage(1);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const hasActiveFilters = Boolean(
    activeSearch || statusFilter !== 'all' || typeFilter !== 'all' || discountTypeFilter !== 'all'
  );

  const typeFilterOptions: AntSelectOption<TypeFilter>[] = [
    {
      value: 'all',
      label: (
        <span className="flex items-center gap-2">
          <Tag className="size-4 text-slate-400 shrink-0" />
          <span>Tất cả hình thức</span>
        </span>
      ),
    },
    {
      value: 'SHARED',
      label: (
        <span className="flex items-center gap-2">
          <Ticket className="size-4 text-slate-500 shrink-0" />
          <span>Public Promo Code</span>
        </span>
      ),
    },
    {
      value: 'UNIQUE_BATCH',
      label: (
        <span className="flex items-center gap-2">
          <Layers className="size-4 text-slate-500 shrink-0" />
          <span>Unique Code Batch</span>
        </span>
      ),
    },
    {
      value: 'AUTO_APPLY',
      label: (
        <span className="flex items-center gap-2">
          <Zap className="size-4 text-slate-500 shrink-0" />
          <span>Auto-Apply Discount</span>
        </span>
      ),
    },
    {
      value: 'COLLECTABLE',
      label: (
        <span className="flex items-center gap-2">
          <Wallet className="size-4 text-slate-500 shrink-0" />
          <span>Collectable Voucher</span>
        </span>
      ),
    },
  ];

  const statusFilterOptions: AntSelectOption<StatusFilter>[] = [
    {
      value: 'all',
      label: (
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-slate-300 shrink-0" />
          <span>Tất cả trạng thái</span>
        </span>
      ),
    },
    {
      value: 'true',
      label: (
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
          <span>Đang hoạt động</span>
        </span>
      ),
    },
    {
      value: 'false',
      label: (
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-slate-400 shrink-0" />
          <span>Đã tắt</span>
        </span>
      ),
    },
    {
      value: 'archived',
      label: (
        <span className="flex items-center gap-2">
          <Archive className="size-3.5 text-amber-600 shrink-0" />
          <span>Đã lưu trữ</span>
        </span>
      ),
    },
  ];

  const discountTypeFilterOptions: AntSelectOption<'all' | DiscountType>[] = [
    {
      value: 'all',
      label: (
        <span className="flex items-center gap-2">
          <span className="text-slate-400 font-bold text-xs shrink-0">±</span>
          <span>Tất cả loại giảm</span>
        </span>
      ),
    },
    {
      value: 'PERCENT',
      label: (
        <span className="flex items-center gap-2">
          <span className="text-slate-600 font-bold text-xs shrink-0">%</span>
          <span>Phần trăm (%)</span>
        </span>
      ),
    },
    {
      value: 'FIXED',
      label: (
        <span className="flex items-center gap-2">
          <span className="text-slate-600 font-bold text-xs shrink-0">₫</span>
          <span>Số tiền cố định (₫)</span>
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header & Main Call to Action */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Khuyến mãi của đại lý</h1>
            {data && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                {data.meta.total}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý mã ưu đãi, voucher và khuyến mãi tự động áp dụng cho các tour của bạn.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openDialog(null)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-container/20 transition-all hover:bg-primary hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
        >
          <Plus className="size-4" />
          Tạo khuyến mãi
        </button>
      </header>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-semibold transition-all ${
            feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="size-4.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="size-4.5 shrink-0 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Đóng thông báo" className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOOLBAR: SEARCH & FILTERS (CLEAN, COHESIVE, HIGH TASTE)                    */}
      {/* ========================================================================= */}
      <div className="space-y-3.5 rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
        {/* Quick Filter Pills (Cohesive, neutral with solid active state) */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3 text-xs">
          <span className="text-slate-400 font-semibold mr-1">Lọc nhanh:</span>

          <button
            type="button"
            onClick={() => {
              setTypeFilter('all');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/90 hover:text-slate-900 font-medium'
            }`}
          >
            Tất cả
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter('SHARED');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors cursor-pointer ${
              typeFilter === 'SHARED'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/90 hover:text-slate-900 font-medium'
            }`}
          >
            <Ticket className="size-3.5" />
            Public Promo Code
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter('AUTO_APPLY');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors cursor-pointer ${
              typeFilter === 'AUTO_APPLY'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/90 hover:text-slate-900 font-medium'
            }`}
          >
            <Zap className="size-3.5" />
            Auto-Apply
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter('COLLECTABLE');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors cursor-pointer ${
              typeFilter === 'COLLECTABLE'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/90 hover:text-slate-900 font-medium'
            }`}
          >
            <Wallet className="size-3.5" />
            Collectable Voucher
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter('UNIQUE_BATCH');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors cursor-pointer ${
              typeFilter === 'UNIQUE_BATCH'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/90 hover:text-slate-900 font-medium'
            }`}
          >
            <Layers className="size-3.5" />
            Unique Code Batch
          </button>
        </div>

        {/* Detailed Search & Filter Selectors (Spacious, prominent and elegant) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[260px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo mã hoặc tiêu đề khuyến mãi..."
              className="h-11 sm:h-12 w-full rounded-2xl border border-slate-200/90 bg-white pl-11 pr-11 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs outline-none transition hover:border-slate-300 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer rounded-full hover:bg-slate-100 transition"
              >
                <X className="size-4" />
              </button>
            )}
          </form>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Hình thức áp dụng */}
            <AntSelect
              aria-label="Lọc theo hình thức"
              value={typeFilter}
              onChange={(val) => {
                setTypeFilter(val as TypeFilter);
                setPage(1);
              }}
              options={typeFilterOptions}
              size="large"
              className="flex-1 sm:flex-initial min-w-[180px]"
              triggerClassName={typeFilter !== 'all' ? 'border-brand-teal/60 bg-teal-50/20 text-teal-900 font-semibold' : ''}
            />

            {/* Trạng thái */}
            <AntSelect
              aria-label="Lọc theo trạng thái"
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val as StatusFilter);
                setPage(1);
              }}
              options={statusFilterOptions}
              size="large"
              className="flex-1 sm:flex-initial min-w-[160px]"
              triggerClassName={statusFilter !== 'all' ? 'border-brand-teal/60 bg-teal-50/20 text-teal-900 font-semibold' : ''}
            />

            {/* Loại giảm giá */}
            <AntSelect
              aria-label="Lọc theo loại giảm giá"
              value={discountTypeFilter}
              onChange={(val) => {
                setDiscountTypeFilter(val as 'all' | DiscountType);
                setPage(1);
              }}
              options={discountTypeFilterOptions}
              size="large"
              placement="right"
              className="flex-1 sm:flex-initial min-w-[165px]"
              triggerClassName={discountTypeFilter !== 'all' ? 'border-brand-teal/60 bg-teal-50/20 text-teal-900 font-semibold' : ''}
            />
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-500">Đang lọc:</span>

            {activeSearch && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200/60 px-2.5 py-1 text-teal-800 font-medium">
                Từ khóa: "{activeSearch}"
                <button type="button" onClick={handleClearSearch} className="text-teal-600 hover:text-teal-900 cursor-pointer">
                  <X className="size-3" />
                </button>
              </span>
            )}

            {typeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200/80 px-2.5 py-1 text-slate-700 font-medium">
                Hình thức: {typeFilter === 'SHARED' ? 'Public Promo Code' : typeFilter === 'UNIQUE_BATCH' ? 'Unique Code Batch' : typeFilter === 'AUTO_APPLY' ? 'Auto-Apply' : 'Collectable Voucher'}
                <button type="button" onClick={() => setTypeFilter('all')} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="size-3" />
                </button>
              </span>
            )}

            {statusFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium ${
                statusFilter === 'archived' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-100 border-slate-200/80 text-slate-700'
              }`}>
                Trạng thái: {statusFilter === 'archived' ? 'Đã lưu trữ' : statusFilter === 'true' ? 'Đang hoạt động' : 'Đã tắt'}
                <button type="button" onClick={() => setStatusFilter('all')} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="size-3" />
                </button>
              </span>
            )}

            {discountTypeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200/80 px-2.5 py-1 text-slate-700 font-medium">
                Loại: {discountTypeFilter === 'PERCENT' ? 'Phần trăm' : 'Số tiền'}
                <button type="button" onClick={() => setDiscountTypeFilter('all')} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="size-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-brand-teal font-semibold hover:underline ml-auto cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PROMOTION LIST / STATES                                                   */}
      {/* ========================================================================= */}
      {isLoading ? (
        <LoadingState label="Đang tải danh sách khuyến mãi..." />
      ) : isError ? (
        <ErrorState
          title="Không thể tải khuyến mãi"
          message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
          onAction={() => void refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        hasActiveFilters ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-10 text-center shadow-xs">
            <Search className="size-8 text-slate-300 mx-auto" aria-hidden="true" />
            <h3 className="mt-2 text-base font-bold text-slate-900">Không tìm thấy khuyến mãi nào phù hợp</h3>
            <p className="mt-1 text-sm text-slate-500">
              Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh các tiêu chí bộ lọc ở trên.
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                Đặt lại bộ lọc
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <EmptyState
              title="Chưa có khuyến mãi nào"
              description="Tạo khuyến mãi đầu tiên để thu hút du khách đặt tour của bạn."
              actionLabel="Tạo khuyến mãi"
              onAction={() => openDialog(null)}
            />
          </div>
        )
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3.5">
            {data.items.map((p) => {
              const badge = statusBadge(p);
              const isArchived = p.isArchived;
              const isInactive = !p.isActive && !p.isArchived;

              return (
                <li
                  key={p.id}
                  className={`rounded-2xl p-5 transition-all ${
                    isArchived
                      ? 'border-2 border-dashed border-amber-300/80 bg-amber-50/20 shadow-none opacity-80 hover:opacity-100'
                      : isInactive
                      ? 'border-2 border-dashed border-slate-300 bg-slate-100/70 shadow-none opacity-90 hover:opacity-100 hover:border-slate-400'
                      : 'border border-slate-200/80 bg-white shadow-xs hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Badge row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {p.code ? (
                          <div
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs font-bold transition-colors ${
                              isArchived
                                ? 'bg-amber-100/80 text-amber-900 border border-amber-300/80 line-through'
                                : isInactive
                                ? 'bg-slate-200 text-slate-700 border border-slate-300'
                                : 'bg-slate-900 text-white shadow-2xs'
                            }`}
                          >
                            <span>{p.code}</span>
                            <button
                              type="button"
                              onClick={() => copyCode(p.code!)}
                              title="Sao chép mã"
                              className={`transition-colors cursor-pointer ${
                                isArchived
                                  ? 'text-amber-700 hover:text-amber-950'
                                  : isInactive
                                  ? 'text-slate-500 hover:text-slate-800'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {copiedCode === p.code ? (
                                <Check className="size-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold ${
                              isArchived
                                ? 'bg-amber-50/80 border-amber-200 text-amber-800 line-through'
                                : isInactive
                                ? 'bg-slate-200/90 border-slate-300 text-slate-600'
                                : 'bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            {p.applyType === 'AUTO_APPLY' ? (
                              <>
                                <Zap className={`size-3 ${isInactive || isArchived ? 'text-slate-500' : 'text-brand-teal'}`} />
                                Auto-Apply
                              </>
                            ) : (
                              <>
                                <Wallet className={`size-3 ${isInactive || isArchived ? 'text-slate-500' : 'text-brand-teal'}`} />
                                Collectable Voucher
                              </>
                            )}
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                          <span className={`size-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>

                        {p.applyType === 'AUTO_APPLY' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            <Zap className="size-3 text-brand-teal" />
                            Auto-Apply
                          </span>
                        )}
                        {p.applyType === 'COLLECTABLE' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            <Wallet className="size-3 text-brand-teal" />
                            Collectable Voucher
                          </span>
                        )}
                        {p.codeType === 'UNIQUE_BATCH' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            <Layers className="size-3 text-slate-500" />
                            Unique Code Batch
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3
                          className={`text-base font-bold transition-colors ${
                            isArchived ? 'text-slate-500 italic' : isInactive ? 'text-slate-600' : 'text-slate-900'
                          }`}
                        >
                          {p.title}
                          {isArchived && <span className="ml-2 text-xs font-semibold text-amber-700 not-italic">(Đã lưu trữ)</span>}
                          {isInactive && <span className="ml-2 text-xs font-semibold text-slate-500">(Tạm ngưng)</span>}
                        </h3>
                        {p.description && (
                          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {p.description}
                          </p>
                        )}
                      </div>

                      {/* Metrics bar */}
                      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-0.5 ${isInactive || isArchived ? 'text-slate-500' : 'text-slate-600'}`}>
                        <span className={`font-semibold flex items-center gap-1.5 ${isInactive || isArchived ? 'text-slate-700' : 'text-slate-900'}`}>
                          <Tag className={`size-3.5 ${isInactive || isArchived ? 'text-slate-400' : 'text-brand-teal'}`} />
                          Giảm {discountLabel(p)}
                        </span>
                        <span>·</span>
                        <span>
                          Đơn tối thiểu {vnd.format(p.minOrderAmount)} ₫
                        </span>
                        <span>·</span>
                        <span>
                          Đã dùng {p.usedCount}{p.usageLimit != null ? `/${p.usageLimit}` : ''} lượt
                        </span>
                      </div>

                      {/* Extra conditions */}
                      {(p.minParticipants || p.daysInAdvance || p.firstBookingOnly || (p.usageLimitPerUser && p.usageLimitPerUser > 1)) && (
                        <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-medium text-slate-600">
                          {p.minParticipants && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5">
                              Tối thiểu {p.minParticipants} khách
                            </span>
                          )}
                          {p.daysInAdvance && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5">
                              Đặt trước {p.daysInAdvance} ngày
                            </span>
                          )}
                          {p.firstBookingOnly && (
                            <span className="rounded-md bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 border border-emerald-100">
                              Chỉ áp dụng đơn đầu tiên
                            </span>
                          )}
                          {p.usageLimitPerUser && p.usageLimitPerUser > 1 && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5">
                              Tối đa {p.usageLimitPerUser} lần / khách
                            </span>
                          )}
                        </div>
                      )}

                      {/* Date Range */}
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                        <Calendar className="size-3.5 text-slate-400" />
                        {dateTime.format(new Date(p.startsAt))} → {dateTime.format(new Date(p.endsAt))}
                      </p>
                    </div>

                    {/* Actions column */}
                    <div className="flex flex-wrap items-center gap-2 self-start">
                      {p.codeType === 'UNIQUE_BATCH' && (
                        <button
                          type="button"
                          onClick={() => void openBatchModal(p)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
                        >
                          <QrCode className="size-3.5 text-brand-teal" />
                          Quản lý lô mã
                        </button>
                      )}

                      {isArchived ? (
                        <button
                          type="button"
                          disabled={togglingId === p.id}
                          onClick={() => setConfirmArchiveModal({ promotion: p, action: 'unarchive' })}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <ArchiveRestore className="size-3.5 text-amber-700" />
                          {togglingId === p.id ? 'Đang lưu…' : 'Bỏ lưu trữ'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={togglingId === p.id}
                            onClick={() => void handleToggle(p)}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer shadow-2xs ${
                              p.isActive
                                ? 'border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100 hover:border-rose-300'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 font-bold'
                            } disabled:opacity-50`}
                          >
                            {togglingId === p.id ? 'Đang lưu…' : p.isActive ? 'Tắt' : 'Bật'}
                          </button>

                          <button
                            type="button"
                            disabled={togglingId === p.id}
                            onClick={() => setConfirmArchiveModal({ promotion: p, action: 'archive' })}
                            title="Lưu trữ khuyến mãi"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Archive className="size-3.5 text-slate-400" />
                            Lưu trữ
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => openDialog(p)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Chỉnh sửa
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 text-xs text-slate-600">
              <span>
                Trang {data.meta.page} / {data.meta.totalPages} (Tổng {data.meta.total} khuyến mãi)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={data.meta.page <= 1 || isFetching}
                  onClick={() => setPage((c) => Math.max(1, c - 1))}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={data.meta.page >= data.meta.totalPages || isFetching}
                  onClick={() => setPage((c) => c + 1)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Dialog: Step 1 (Visual Type Picker) -> Step 2 (Tailored Form) */}
      <PromotionFormDialog
        open={dialog !== null}
        promotion={dialog?.promotion ?? null}
        initialType={dialog?.initialType ?? null}
        isSubmitting={isCreating || isUpdating}
        serverError={serverError}
        onClose={() => setDialog(null)}
        onSubmit={(values) => void handleSubmit(values)}
      />

      {/* Batch Modal for Unique Codes */}
      {batchModal && (
        <PromotionBatchModal
          open={true}
          promotionId={batchModal.promotion.id}
          promotionTitle={batchModal.promotion.title}
          isGenerating={isGeneratingBatch}
          isLoading={batchState.isFetching}
          codes={batchState.data?.items ?? []}
          total={batchState.data?.meta.total ?? 0}
          page={batchPage}
          onPageChange={(nextPage) => void openBatchModal(batchModal.promotion, nextPage)}
          onGenerate={handleGenerateBatch}
          onClose={() => setBatchModal(null)}
        />
      )}

      {/* Archive / Restore Confirmation Modal */}
      {confirmArchiveModal && (
        <Modal
          open={Boolean(confirmArchiveModal)}
          onClose={() => setConfirmArchiveModal(null)}
          title={confirmArchiveModal.action === 'archive' ? 'Xác nhận lưu trữ khuyến mãi' : 'Khôi phục khuyến mãi'}
          className="max-w-md"
          footer={
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmArchiveModal(null)}
                disabled={Boolean(togglingId)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={Boolean(togglingId)}
                onClick={async () => {
                  const target = confirmArchiveModal.promotion;
                  setConfirmArchiveModal(null);
                  await handleArchive(target);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer disabled:opacity-50 ${
                  confirmArchiveModal.action === 'archive'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {confirmArchiveModal.action === 'archive' ? 'Xác nhận lưu trữ' : 'Khôi phục ngay'}
              </button>
            </div>
          }
        >
          <div className="space-y-3.5 py-1">
            {/* Voucher preview card */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
                  confirmArchiveModal.action === 'archive'
                    ? 'border-amber-200/80 bg-amber-50 text-amber-600'
                    : 'border-emerald-200/80 bg-emerald-50 text-emerald-600'
                }`}
              >
                {confirmArchiveModal.action === 'archive' ? (
                  <Archive className="size-5" />
                ) : (
                  <ArchiveRestore className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {confirmArchiveModal.promotion.title}
                </h4>
                <div className="mt-1 flex items-center gap-2">
                  {confirmArchiveModal.promotion.code ? (
                    <span className="inline-block rounded-md border border-slate-200/90 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 shadow-2xs">
                      Mã: {confirmArchiveModal.promotion.code}
                    </span>
                  ) : (
                    <span className="inline-block rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {confirmArchiveModal.promotion.applyType === 'AUTO_APPLY' ? 'Auto-Apply' : 'Collectable Voucher'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Short & friendly note */}
            <p className="text-xs text-slate-500 leading-relaxed px-0.5">
              {confirmArchiveModal.action === 'archive'
                ? 'Khuyến mãi sẽ tạm ngưng và chuyển vào mục Lưu trữ.'
                : 'Khuyến mãi sẽ được chuyển ra khỏi mục lưu trữ để bạn tiếp tục áp dụng.'}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
