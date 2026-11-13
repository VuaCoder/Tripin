'use client';
import { FormSelect } from '@/components/ui/FormSelect';
import { useEffect, useState } from 'react';
import { Edit3, Power, Archive, ArchiveRestore, Plus } from 'lucide-react';
import { Button, FormField, Input, Modal, Pagination } from '@/components/ui';
import { EmptyState } from '@/components/shared';
import { PromotionFormDialog } from '@/features/promotions/PromotionFormDialog';
import { PromotionBatchModal } from '@/features/promotions/PromotionBatchModal';
import { buildCreatePayload, buildUpdatePatch } from '@/features/promotions/payload';
import type { PromotionFormValues } from '@/features/promotions/validation';
import { useGetAdminPromotionsQuery, useLazyGetAdminPromotionQuery, useCreateAdminPromotionMutation, useUpdateAdminPromotionMutation, useGenerateAdminBatchMutation, useLazyGetAdminBatchQuery } from '../api/adminApi';
import type { Promotion, ListPromotionsArgs } from '../types';
import { AdminFrame, Feedback, adminError, control, forbidden, money, panel, useAdminSession } from './AdminUi';
import { AdminPromotionsSkeleton, Shimmer } from './AdminSkeletons';

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa xác định';
  const day = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${day} lúc ${time}`;
};

export function AdminPromotionsPage() {
  const { ready } = useAdminSession();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListPromotionsArgs>({});
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = search.trim() || undefined;
      setFilters((current) => current.q === q ? current : { ...current, q });
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = useGetAdminPromotionsQuery({
    ...filters,
    page,
    limit: 10,
    ...(filter === 'archived'
      ? { isArchived: true }
      : {
          isArchived: false,
          ...(filter === 'all' ? {} : { isActive: filter === 'true' }),
        }),
  }, { skip: !ready, refetchOnMountOrArgChange: true });
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
    <section className={`${panel} grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px]`} aria-label="Tìm voucher">
      <FormField label="Mã hoặc tên voucher" htmlFor="promotion-search"><Input id="promotion-search" placeholder="Ví dụ: SUMMER20" value={search} maxLength={100} disabled={busy} onChange={(e) => setSearch(e.target.value)} /></FormField>
      <FormField label="Trạng thái" htmlFor="promotion-status"><FormSelect id="promotion-status" value={filter} className={control} disabled={busy} onChange={(e) => { setFilter(e.target.value); setPage(1); setSuccess(null); }}><option value="all">Tất cả</option><option value="true">Đang bật</option><option value="false">Đã tắt</option><option value="archived">Đã lưu trữ</option></FormSelect></FormField>
    </section>
    {detailState.isFetching && <div role="status" aria-label="Đang tải chi tiết khuyến mãi" className={`${panel} space-y-3`}><span className="sr-only">Đang tải chi tiết khuyến mãi</span><Shimmer className="h-5 w-48" /><Shimmer className="h-4 w-full" /><Shimmer className="h-20 w-full" /></div>}
    <ul className="space-y-3">{query.currentData?.items.map((p) => <li className={`${panel} ${p.isArchived ? 'border-dashed border-amber-300 bg-amber-50/20' : !p.isActive ? 'border-dashed border-slate-300 bg-slate-50/70' : ''}`} key={p.id}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-900">{p.title}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.isArchived ? 'bg-amber-100 text-amber-800' : p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{p.isArchived ? 'Đã lưu trữ' : p.isActive ? (p.isRunning ? 'Đang áp dụng' : 'Đã bật') : 'Đã tắt'}</span></div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600"><span><strong className="text-slate-900">{p.code ?? (p.applyType === 'COLLECTABLE' ? 'Voucher trong ví' : 'Tự động')}</strong></span><span>{p.discountType === 'PERCENT' ? `Giảm ${p.discountValue}%${p.maxDiscountAmount ? `, tối đa ${money(p.maxDiscountAmount)}` : ''}` : `Giảm ${money(p.discountValue)}`}</span><span>Đơn từ {money(p.minOrderAmount)}</span></div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span><span className="font-medium text-slate-500">Thời hạn:</span> {formatDateTime(p.startsAt)} – {formatDateTime(p.endsAt)}</span><span><span className="font-medium text-slate-500">Lượt dùng:</span> {p.usedCount} / {p.usageLimit ?? 'Không giới hạn'}</span></div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {p.codeType === 'UNIQUE_BATCH' && <Button variant="outline" size="sm" disabled={busy} onClick={() => void openBatchModal(p)}>Quản lý mã</Button>}
          <Button variant="outline" size="sm" aria-label={`Sửa ${p.code ?? p.title}`} disabled={busy || detailState.isFetching || query.isFetching} onClick={() => void edit(p.id)} className="flex items-center gap-1.5"><Edit3 size={14} /> Sửa</Button>
          {!p.isArchived && <Button variant="outline" size="sm" disabled={busy || detailState.isFetching || query.isFetching} className={`flex items-center gap-1.5 ${p.isActive ? 'text-rose-700 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'}`} onClick={() => { setError(null); setSuccess(null); setToggle(p); }}><Power size={14} /> {p.isActive ? 'Tắt' : 'Bật'}</Button>}
          <Button variant="outline" size="sm" aria-label={p.isArchived ? 'Khôi phục voucher' : 'Lưu trữ voucher'} disabled={busy || detailState.isFetching || query.isFetching} className="flex items-center gap-1.5 text-slate-600" onClick={() => void toggleArchive(p)}>{p.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />} {p.isArchived ? 'Khôi phục' : 'Lưu trữ'}</Button>
        </div>
      </div>
    </li>)}</ul>
    {query.currentData?.items.length === 0 && <EmptyState title="Chưa có voucher phù hợp" description="Thử từ khóa khác hoặc tạo voucher mới." />}
    {query.currentData && <Pagination currentPage={page} totalPages={query.currentData.meta.totalPages} totalItems={query.currentData.meta.total} pageSize={10} showInfo={false} disabled={query.isFetching || busy} onPageChange={setPage} />}
    {dialog && <PromotionFormDialog open promotion={dialog.promotion} initialType={dialog.promotion ? null : 'SHARED'} isSubmitting={busy} serverError={error} onClose={() => { if (!busy) setDialog(null); }} onSubmit={(values) => void save(values)} />}
    {batchModal && <PromotionBatchModal open promotionId={batchModal.promotion.id} promotionTitle={batchModal.promotion.title} isGenerating={isGeneratingBatch} isLoading={batchState.isFetching} codes={batchState.data?.items ?? []} total={batchState.data?.meta.total ?? 0} page={batchPage} onPageChange={(nextPage) => void openBatchModal(batchModal.promotion, nextPage)} onGenerate={handleGenerateBatch} onClose={() => setBatchModal(null)} />}
    <Modal open={!!toggle} title="Xác nhận trạng thái voucher" closeOnBackdrop={!busy} onClose={() => { if (!busy) setToggle(null); }}><Feedback error={error} /><p>{toggle?.isActive ? 'Tắt' : 'Bật'} voucher {toggle?.code ?? toggle?.title} trên toàn nền tảng?</p><div className="mt-4 flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setToggle(null)}>Hủy</Button><Button loading={busy} onClick={() => void changeStatus()}>Xác nhận</Button></div></Modal>
  </AdminFrame>;
}
