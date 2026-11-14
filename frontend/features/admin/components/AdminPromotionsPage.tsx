'use client';
import { FormSelect } from '@/components/ui/FormSelect';
import { useEffect, useState } from 'react';
import { Edit3, Power, Archive, ArchiveRestore, Plus, Search, RotateCcw } from 'lucide-react';
import { Button, FormField, Input, Modal, Pagination } from '@/components/ui';
import { EmptyState } from '@/components/shared';
import { PromotionFormDialog } from '@/features/promotions/PromotionFormDialog';
import { PromotionBatchModal } from '@/features/promotions/PromotionBatchModal';
import { buildCreatePayload, buildUpdatePatch } from '@/features/promotions/payload';
import type { PromotionFormValues } from '@/features/promotions/validation';
import { useGetAdminPromotionsQuery, useLazyGetAdminPromotionQuery, useCreateAdminPromotionMutation, useUpdateAdminPromotionMutation, useGenerateAdminBatchMutation, useLazyGetAdminBatchQuery } from '../api/adminApi';
import type { Promotion, ListPromotionsArgs } from '../types';
import type { DiscountType, PromotionApplyType } from '@/features/agency-promotions/types';
import { AdminFrame, Feedback, adminError, control, forbidden, money, panel, toolbar, useAdminSession } from './AdminUi';
import { AdminPromotionsSkeleton, Shimmer } from './AdminSkeletons';

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa xác định';
  const day = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${day} lúc ${time}`;
};

const DISCOUNT_LABEL: Record<DiscountType, string> = { PERCENT: 'Theo %', FIXED: 'Theo số tiền' };
const APPLY_LABEL: Record<PromotionApplyType, string> = { CODE: 'Nhập mã', AUTO_APPLY: 'Tự động', COLLECTABLE: 'Voucher trong ví' };
const CODE_LABEL: Record<string, string> = { SHARED: 'Chung', UNIQUE_BATCH: 'Mã lô' };

export function AdminPromotionsPage() {
  const { ready } = useAdminSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [discountFilter, setDiscountFilter] = useState('all');
  const [applyFilter, setApplyFilter] = useState('all');
  const [filters, setFilters] = useState<ListPromotionsArgs>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = search.trim() || undefined;
      setFilters((current) => current.q === q ? current : { ...current, q });
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const listArgs: ListPromotionsArgs = {
    ...filters,
    page,
    limit: 10,
    ...(statusFilter === 'all' ? {} : statusFilter === 'archived'
      ? { isArchived: true }
      : { isArchived: false, isActive: statusFilter === 'true' }),
    ...(discountFilter === 'all' ? {} : { discountType: discountFilter as DiscountType }),
    ...(applyFilter === 'all' ? {} : { applyType: applyFilter as PromotionApplyType }),
  };
  const query = useGetAdminPromotionsQuery(listArgs, { skip: !ready, refetchOnMountOrArgChange: true });
  const [detail, detailState] = useLazyGetAdminPromotionQuery();
  const [create, createState] = useCreateAdminPromotionMutation();
  const [update, updateState] = useUpdateAdminPromotionMutation();
  const busy = createState.isLoading || updateState.isLoading;
  const [dialog, setDialog] = useState<{ promotion: Promotion | null } | null>(null);
  const [toggle, setToggle] = useState<Promotion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [denied, setDenied] = useState<unknown>();
  const [generateBatch, { isLoading: isGeneratingBatch }] = useGenerateAdminBatchMutation();
  const [fetchBatch, batchState] = useLazyGetAdminBatchQuery();
  const [batchModal, setBatchModal] = useState<{ promotion: Promotion } | null>(null);
  const [batchPage, setBatchPage] = useState(1);
  const openBatchModal = async (promotion: Promotion, page = 1) => {
    setBatchModal({ promotion });
    setBatchPage(page);
    await fetchBatch({ id: promotion.id, page, limit: 20 }, false);
  };
  const handleGenerateBatch = async (count: number, prefix: string) => {
    if (!batchModal) return;
    await generateBatch({ id: batchModal.promotion.id, count, prefix: prefix || undefined }).unwrap();
    setBatchPage(1);
    await fetchBatch({ id: batchModal.promotion.id, page: 1, limit: 20 }, false);
    void query.refetch();
  };
  const fail = (e: unknown) => { setError(adminError(e)); if (forbidden(e)) setDenied(e); };
  const edit = async (id: string) => {
    setError(null); setSuccess(null);
    try { const promotion = await detail(id, false).unwrap(); setDialog({ promotion }); } catch (e) { fail(e); }
  };
  const save = async (values: PromotionFormValues) => {
    if (busy) return; setError(null); setSuccess(null);
    try {
      if (dialog?.promotion) {
        const patch = buildUpdatePatch(values, dialog.promotion);
        if (!Object.keys(patch).length) { setError('Bạn chưa thay đổi thông tin nào.'); return; }
        await update({ id: dialog.promotion.id, patch }).unwrap();
      } else await create(buildCreatePayload(values)).unwrap();
      setDialog(null); setSuccess('Đã lưu voucher nền tảng.');
    } catch (e) { fail(e); }
  };
  const changeStatus = async () => {
    if (!toggle || busy) return; setError(null); setSuccess(null);
    try { await update({ id: toggle.id, patch: { isActive: !toggle.isActive } }).unwrap(); setToggle(null); setSuccess('Đã cập nhật trạng thái voucher.'); } catch (e) { fail(e); }
  };
  const toggleArchive = async (p: Promotion) => {
    if (busy) return; setError(null); setSuccess(null);
    try {
      const next = !p.isArchived;
      await update({ id: p.id, patch: { isArchived: next, ...(next ? { isActive: false } : {}) } }).unwrap();
      setSuccess(next ? 'Đã lưu trữ voucher.' : 'Đã khôi phục voucher.');
    } catch (e) { fail(e); }
  };
  const resetFilters = () => {
    setPage(1); setSearch(''); setStatusFilter('all'); setDiscountFilter('all'); setApplyFilter('all'); setFilters({}); setSuccess(null);
  };
  if (!ready) return null;
  return <AdminFrame
    title="Voucher nền tảng"
    actions={
      <Button
        disabled={busy || query.isFetching || detailState.isFetching}
        onClick={() => { setError(null); setSuccess(null); setDialog({ promotion: null }); }}
        className="flex items-center gap-1.5"
      >
        <Plus size={16} /> Tạo voucher
      </Button>
    }
    error={denied || query.error}
    loading={!query.currentData}
    loadingSkeleton={<AdminPromotionsSkeleton />}
    refreshing={query.isFetching && !!query.currentData}
    onRefresh={() => query.refetch()}
  >
    <Feedback error={!dialog && !toggle ? error : null} success={success} />
    <section className={`${toolbar} grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]`} aria-label="Tìm voucher">
      <FormField label="Mã hoặc tên voucher" htmlFor="promotion-search" className="min-w-0">
        <div className="relative">
          <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input id="promotion-search" className="pl-10" placeholder="Ví dụ: SUMMER20" value={search} maxLength={100} disabled={busy} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </FormField>
      <FormField label="Trạng thái" htmlFor="promotion-status"><FormSelect id="promotion-status" value={statusFilter} className={control} disabled={busy} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setSuccess(null); }}><option value="all">Tất cả</option><option value="true">Đang bật</option><option value="false">Đã tắt</option><option value="archived">Đã lưu trữ</option></FormSelect></FormField>
      <FormField label="Kiểu giảm giá" htmlFor="promotion-discount"><FormSelect id="promotion-discount" value={discountFilter} className={control} disabled={busy} onChange={(e) => { setDiscountFilter(e.target.value); setPage(1); setSuccess(null); }}><option value="all">Tất cả kiểu</option><option value="PERCENT">Theo %</option><option value="FIXED">Theo số tiền</option></FormSelect></FormField>
      <FormField label="Cách áp dụng" htmlFor="promotion-apply"><FormSelect id="promotion-apply" value={applyFilter} className={control} disabled={busy} onChange={(e) => { setApplyFilter(e.target.value); setPage(1); setSuccess(null); }}><option value="all">Tất cả cách</option><option value="CODE">Nhập mã</option><option value="AUTO_APPLY">Tự động</option><option value="COLLECTABLE">Voucher trong ví</option></FormSelect></FormField>
      <div className="flex items-end">
        <Button variant="ghost" onClick={resetFilters} className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap sm:w-auto"><RotateCcw size={15} /> Đặt lại</Button>
      </div>
    </section>
    {detailState.isFetching && <div role="status" aria-label="Đang tải chi tiết khuyến mãi" className={`${panel} space-y-3`}><span className="sr-only">Đang tải chi tiết khuyến mãi</span><Shimmer className="h-5 w-48" /><Shimmer className="h-4 w-full" /><Shimmer className="h-20 w-full" /></div>}
    <section className={`${panel} !p-0 overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-bold text-slate-900">Danh sách voucher</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Voucher</th>
              <th className="px-4 py-3 font-medium">Mã</th>
              <th className="px-4 py-3 font-medium">Giảm giá</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Thời hạn</th>
              <th className="px-4 py-3 font-medium">Lượt dùng</th>
              <th className="px-5 py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.currentData?.items.map((p) => (
              <tr key={p.id} className={`transition hover:bg-slate-50/60 ${p.isArchived ? 'bg-amber-50/30' : ''}`}>
                <td className="px-5 py-3.5 align-middle">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold leading-5 text-slate-900">{p.title}</h3>
                    <p className="mt-0.5 truncate text-xs leading-5 text-slate-600">{APPLY_LABEL[p.applyType] ?? p.applyType} · {CODE_LABEL[p.codeType] ?? p.codeType}</p>
                  </div>
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <span className="inline-flex max-w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-900">{p.code ?? (p.applyType === 'COLLECTABLE' ? 'Trong ví' : 'Tự động')}</span>
                </td>
                <td className="px-4 py-3.5 align-middle text-xs font-medium text-slate-900">
                  <span className="line-clamp-2 leading-5">{p.discountType === 'PERCENT' ? `Giảm ${p.discountValue}%${p.maxDiscountAmount ? `, tối đa ${money(p.maxDiscountAmount)}` : ''}` : `Giảm ${money(p.discountValue)}`}</span>
                  <span className="block text-[11px] leading-5 text-slate-500">{DISCOUNT_LABEL[p.discountType]}</span>
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <span className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-[10px] font-semibold ${p.isArchived ? 'bg-amber-100 text-amber-800' : p.isActive ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>{p.isArchived ? 'Đã lưu trữ' : p.isActive ? (p.isRunning ? 'Đang áp dụng' : 'Đã bật') : 'Đã tắt'}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">{APPLY_LABEL[p.applyType] ?? p.applyType}</span>
                </td>
                <td className="px-4 py-3.5 align-middle text-xs leading-5 text-slate-600">
                  <span className="block whitespace-nowrap">Từ {formatDateTime(p.startsAt)}</span>
                  <span className="block whitespace-nowrap">Đến {formatDateTime(p.endsAt)}</span>
                </td>
                <td className="px-4 py-3.5 align-middle whitespace-nowrap text-xs font-medium text-slate-600">
                  {p.usedCount} <span className="text-slate-400">/</span> {p.usageLimit ?? '∞'}
                </td>
                <td className="px-5 py-3.5 align-middle">
                  <div className="flex min-h-11 flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                    {p.codeType === 'UNIQUE_BATCH' && <Button variant="outline" size="sm" title="Quản lý mã" aria-label={`Quản lý mã ${p.code ?? p.title}`} disabled={busy} onClick={() => void openBatchModal(p)} className="!size-9 !min-h-9 !p-0"><Archive size={15} /><span className="sr-only">Quản lý mã</span></Button>}
                    <Button variant="outline" size="sm" title="Sửa" aria-label={`Sửa ${p.code ?? p.title}`} disabled={busy || detailState.isFetching || query.isFetching} onClick={() => void edit(p.id)} className="!size-9 !min-h-9 !p-0"><Edit3 size={15} /><span className="sr-only">Sửa</span></Button>
                    {!p.isArchived && <Button variant="outline" size="sm" title={p.isActive ? 'Tắt' : 'Bật'} aria-label={`${p.isActive ? 'Tắt' : 'Bật'} ${p.code ?? p.title}`} disabled={busy || detailState.isFetching || query.isFetching} className={`!size-9 !min-h-9 !p-0 ${p.isActive ? 'text-rose-700 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'}`} onClick={() => { setError(null); setSuccess(null); setToggle(p); }}><Power size={15} /><span className="sr-only">{p.isActive ? 'Tắt' : 'Bật'}</span></Button>}
                    <Button variant="outline" size="sm" title={p.isArchived ? 'Khôi phục voucher' : 'Lưu trữ voucher'} aria-label={p.isArchived ? 'Khôi phục voucher' : 'Lưu trữ voucher'} disabled={busy || detailState.isFetching || query.isFetching} className="!size-9 !min-h-9 !p-0 text-slate-600" onClick={() => void toggleArchive(p)}>{p.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}<span className="sr-only">{p.isArchived ? 'Khôi phục voucher' : 'Lưu trữ voucher'}</span></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.currentData?.items.length === 0 && <div className="p-8"><EmptyState title="Không tìm thấy voucher" description="Hãy thay đổi từ khóa, bộ lọc hoặc tạo voucher mới." /></div>}
      </div>
    </section>
    {query.currentData && <Pagination currentPage={page} totalPages={query.currentData.meta.totalPages} totalItems={query.currentData.meta.total} pageSize={10} showInfo={false} disabled={query.isFetching || busy} onPageChange={setPage} />}
    {dialog && <PromotionFormDialog open promotion={dialog.promotion} initialType={dialog.promotion ? null : 'SHARED'} isSubmitting={busy} serverError={error} onClose={() => { if (!busy) setDialog(null); }} onSubmit={(values) => void save(values)} />}
    {batchModal && <PromotionBatchModal open promotionId={batchModal.promotion.id} promotionTitle={batchModal.promotion.title} isGenerating={isGeneratingBatch} isLoading={batchState.isFetching} codes={batchState.data?.items ?? []} total={batchState.data?.meta.total ?? 0} page={batchPage} onPageChange={(nextPage) => void openBatchModal(batchModal.promotion, nextPage)} onGenerate={handleGenerateBatch} onClose={() => setBatchModal(null)} />}
    <Modal open={!!toggle} title="Xác nhận trạng thái voucher" closeOnBackdrop={!busy} onClose={() => { if (!busy) setToggle(null); }}><Feedback error={error} /><p>{toggle?.isActive ? 'Tắt' : 'Bật'} voucher {toggle?.code ?? toggle?.title} trên toàn nền tảng?</p><div className="mt-4 flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setToggle(null)}>Hủy</Button><Button loading={busy} onClick={() => void changeStatus()}>Xác nhận</Button></div></Modal>
  </AdminFrame>;
}
