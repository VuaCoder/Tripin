'use client';
import { useState } from 'react';
import { Button, FormField, Input, Modal, Pagination } from '@/components/ui';
import { EmptyState } from '@/components/shared';
import { PromotionFormDialog } from '@/features/promotions/PromotionFormDialog';
import { PromotionBatchModal } from '@/features/promotions/PromotionBatchModal';
import { buildCreatePayload, buildUpdatePatch } from '@/features/promotions/payload';
import type { PromotionFormValues } from '@/features/promotions/validation';
import { useGetAdminPromotionsQuery, useLazyGetAdminPromotionQuery, useCreateAdminPromotionMutation, useUpdateAdminPromotionMutation, useGenerateAdminBatchMutation, useLazyGetAdminBatchQuery } from '../api/adminApi';
import type { Promotion, ListPromotionsArgs } from '../types';
import { AdminFrame, Feedback, adminError, control, forbidden, money, panel, timestamp, toolbar, useAdminSession } from './AdminUi';
import { AdminDateFields } from './AdminDateFields';
import { dateSelectionError, dateSelectionQuery, type DateSelection } from '../utils/filters';

export function AdminPromotionsPage() {
  const { ready } = useAdminSession();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [dates, setDates] = useState<DateSelection>({ from: '', to: '' });
  const [filters, setFilters] = useState<ListPromotionsArgs>({});
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
      setDialog(null); setSuccess('Đã lưu khuyến mãi nền tảng.');
    } catch (e) { fail(e); }
  };
  const changeStatus = async () => {
    if (!toggle || busy) return; setError(null); setSuccess(null);
    try { await update({ id: toggle.id, patch: { isActive: !toggle.isActive } }).unwrap(); setToggle(null); setSuccess('Đã cập nhật trạng thái khuyến mãi.'); } catch (e) { fail(e); }
  };
  const toggleArchive = async (p: Promotion) => {
    if (busy) return; setError(null); setSuccess(null);
    try {
      const next = !p.isArchived;
      await update({ id: p.id, patch: { isArchived: next, ...(next ? { isActive: false } : {}) } }).unwrap();
      setSuccess(next ? 'Đã lưu trữ khuyến mãi.' : 'Đã khôi phục khuyến mãi.');
    } catch (e) { fail(e); }
  };
  if (!ready) return null;
  return <AdminFrame title="Khuyến mãi nền tảng" description="Mã giảm giá áp dụng trên toàn nền tảng. Mỗi booking dùng một mã; chỉ có thể bật/tắt, không xóa khuyến mãi." error={denied || query.error} loading={!query.currentData} refreshing={query.isFetching && !!query.currentData} onRefresh={() => void query.refetch()}>
    <Feedback error={!dialog && !toggle ? error : null} success={success} />
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-bold text-slate-700">Khuyến mãi <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-normal text-slate-500">{query.currentData?.meta.total ?? 0} kết quả</span></h2><Button disabled={busy || query.isFetching || detailState.isFetching} onClick={() => { setError(null); setSuccess(null); setDialog({ promotion: null }); }}>Tạo khuyến mãi</Button></div>
    <form className={`${toolbar} sm:grid-cols-2 xl:grid-cols-3`} noValidate onSubmit={(e) => { e.preventDefault(); const found = dateSelectionError(dates); setError(found); if (found) return; setFilters({ q: search.trim() || undefined, discountType: kind as ListPromotionsArgs['discountType'] || undefined, ...dateSelectionQuery(dates) }); setPage(1); setSuccess(null); }}>
      <FormField label="Mã hoặc tên khuyến mãi" htmlFor="promotion-search"><Input id="promotion-search" placeholder="VD: SUMMER20" value={search} maxLength={100} disabled={busy} onChange={(e) => setSearch(e.target.value)} /></FormField>
      <FormField label="Trạng thái khuyến mãi" htmlFor="promotion-status"><select id="promotion-status" aria-label="Lọc khuyến mãi" value={filter} className={control} disabled={busy} onChange={(e) => { setFilter(e.target.value); setPage(1); setSuccess(null); }}><option value="all">Tất cả trạng thái</option><option value="true">Đang bật</option><option value="false">Đã tắt</option><option value="archived">Đã lưu trữ</option></select></FormField>
      <FormField label="Loại giảm giá" htmlFor="promotion-kind"><select id="promotion-kind" className={control} value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}><option value="">Tất cả loại</option><option value="PERCENT">Phần trăm (%)</option><option value="FIXED">Số tiền cố định</option></select></FormField>
      <AdminDateFields prefix="promotion-filter" value={dates} onChange={setDates} disabled={busy} />
      <div className="flex gap-2"><Button type="submit" disabled={busy}>Áp dụng bộ lọc</Button><Button variant="ghost" disabled={busy} onClick={() => { setSearch(''); setKind(''); setDates({ from: '', to: '' }); setFilter('all'); setFilters({}); setPage(1); setError(null); }}>Đặt lại</Button></div>
      <p className="text-xs text-slate-400 sm:col-span-2 xl:col-span-3">Khoảng ngày tìm các khuyến mãi có thời gian áp dụng giao với khoảng đã chọn, theo giờ Việt Nam.</p>
    </form>
    {detailState.isFetching && <p role="status">Đang tải chi tiết khuyến mãi...</p>}
    <ul className="space-y-3">{query.currentData?.items.map((p) => <li className={`${panel} ${p.isArchived ? 'border-dashed border-amber-300 bg-amber-50/20' : !p.isActive ? 'border-dashed border-slate-300 bg-slate-50/70' : ''}`} key={p.id}><div className="flex flex-wrap justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className={`font-bold ${p.isArchived ? 'text-slate-500 italic' : !p.isActive ? 'text-slate-600' : ''}`}>{p.code ?? '(Tự động / Lô mã)'} · {p.title}</h2>{p.isArchived && <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Đã lưu trữ</span>}{p.applyType === 'AUTO_APPLY' && <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Tự động</span>}{p.applyType === 'COLLECTABLE' && <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Ví voucher</span>}{p.codeType === 'UNIQUE_BATCH' && <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Lô mã riêng</span>}</div><p className="mt-1 text-sm">{p.description}</p><p className="mt-1 text-sm">{p.discountType === 'PERCENT' ? `${p.discountValue}%` : money(p.discountValue)}{p.maxDiscountAmount !== undefined && ` · Giảm tối đa ${money(p.maxDiscountAmount)}`} · Đơn tối thiểu {money(p.minOrderAmount)}</p>{(p.minParticipants || p.daysInAdvance || p.firstBookingOnly || (p.usageLimitPerUser && p.usageLimitPerUser > 1)) && <div className="mt-1 flex flex-wrap gap-2 text-xs font-medium text-slate-600">{p.minParticipants && <span className="rounded bg-slate-100 px-1.5 py-0.5">Tối thiểu {p.minParticipants} khách</span>}{p.daysInAdvance && <span className="rounded bg-slate-100 px-1.5 py-0.5">Đặt trước {p.daysInAdvance} ngày</span>}{p.firstBookingOnly && <span className="rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5">Chỉ đơn đầu</span>}{p.usageLimitPerUser && p.usageLimitPerUser > 1 && <span className="rounded bg-slate-100 px-1.5 py-0.5">Tối đa {p.usageLimitPerUser} lần/khách</span>}</div>}<p className="mt-1 text-sm text-slate-600">{timestamp(p.startsAt)} → {timestamp(p.endsAt)}</p><p className="mt-1 text-sm">Đã dùng {p.usedCount}/{p.usageLimit ?? 'không giới hạn'} · {p.isArchived ? 'Đã lưu trữ' : !p.isActive ? 'Đã tắt' : p.isRunning ? 'Đang chạy' : 'Ngoài thời gian áp dụng'}</p></div><div className="flex flex-wrap items-start gap-2">{p.codeType === 'UNIQUE_BATCH' && <Button variant="outline" className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700" onClick={() => void openBatchModal(p)}>Lô mã</Button>}<Button variant="outline" disabled={busy || detailState.isFetching || query.isFetching} onClick={() => void edit(p.id)}>Sửa {p.code}</Button>{!p.isArchived && <Button variant="ghost" disabled={busy || detailState.isFetching || query.isFetching} className={p.isActive ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'} onClick={() => { setError(null); setSuccess(null); setToggle(p); }}>{p.isActive ? 'Tắt' : 'Bật'} {p.code}</Button>}<Button variant="ghost" disabled={busy || detailState.isFetching || query.isFetching} className={p.isArchived ? 'text-amber-700 hover:bg-amber-50' : 'text-slate-600 hover:bg-slate-100'} onClick={() => void toggleArchive(p)}>{p.isArchived ? 'Bỏ lưu trữ' : 'Lưu trữ'}</Button></div></div></li>)}</ul>
    {query.currentData?.items.length === 0 && <EmptyState title="Không có khuyến mãi phù hợp" description="Thay bộ lọc hoặc tạo khuyến mãi nền tảng mới." />}
    {query.currentData && <Pagination currentPage={page} totalPages={query.currentData.meta.totalPages} totalItems={query.currentData.meta.total} pageSize={10} showInfo disabled={query.isFetching || busy} onPageChange={setPage} />}
    {dialog && <PromotionFormDialog open promotion={dialog.promotion} isSubmitting={busy} serverError={error} onClose={() => { if (!busy) setDialog(null); }} onSubmit={(values) => void save(values)} />}
    {batchModal && <PromotionBatchModal open promotionId={batchModal.promotion.id} promotionTitle={batchModal.promotion.title} isGenerating={isGeneratingBatch} isLoading={batchState.isFetching} codes={batchState.data?.items ?? []} total={batchState.data?.meta.total ?? 0} page={batchPage} onPageChange={(nextPage) => void openBatchModal(batchModal.promotion, nextPage)} onGenerate={handleGenerateBatch} onClose={() => setBatchModal(null)} />}
    <Modal open={!!toggle} title="Xác nhận trạng thái khuyến mãi" closeOnBackdrop={!busy} onClose={() => { if (!busy) setToggle(null); }}><Feedback error={error} /><p>{toggle?.isActive ? 'Tắt' : 'Bật'} mã {toggle?.code} trên toàn nền tảng?</p><div className="mt-4 flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setToggle(null)}>Hủy</Button><Button loading={busy} onClick={() => void changeStatus()}>Xác nhận</Button></div></Modal>
  </AdminFrame>;
}
