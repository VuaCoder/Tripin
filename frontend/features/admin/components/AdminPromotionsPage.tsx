'use client';
import { useState } from 'react';
import { Button, FormField, Input, Modal, Pagination } from '@/components/ui';
import { EmptyState } from '@/components/shared';
import { PromotionFormDialog } from '@/features/promotions/PromotionFormDialog';
import { buildCreatePayload, buildUpdatePatch } from '@/features/promotions/payload';
import type { PromotionFormValues } from '@/features/promotions/validation';
import { useGetAdminPromotionsQuery, useLazyGetAdminPromotionQuery, useCreateAdminPromotionMutation, useUpdateAdminPromotionMutation } from '../api/adminApi';
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
  const query = useGetAdminPromotionsQuery({ ...filters, page, limit: 10, ...(filter === 'all' ? {} : { isActive: filter === 'true' }) }, { skip: !ready, refetchOnMountOrArgChange: true });
  const [detail, detailState] = useLazyGetAdminPromotionQuery();
  const [create, createState] = useCreateAdminPromotionMutation();
  const [update, updateState] = useUpdateAdminPromotionMutation();
  const busy = createState.isLoading || updateState.isLoading;
  const [dialog, setDialog] = useState<{ promotion: Promotion | null } | null>(null);
  const [toggle, setToggle] = useState<Promotion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [denied, setDenied] = useState<unknown>();
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
  if (!ready) return null;
  return <AdminFrame title="Khuyến mãi nền tảng" description="Mã giảm giá áp dụng trên toàn nền tảng. Mỗi booking dùng một mã; chỉ có thể bật/tắt, không xóa khuyến mãi." error={denied || query.error} loading={!query.currentData} refreshing={query.isFetching && !!query.currentData} onRefresh={() => void query.refetch()}>
    <Feedback error={!dialog && !toggle ? error : null} success={success} />
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-bold text-slate-700">Khuyến mãi <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-normal text-slate-500">{query.currentData?.meta.total ?? 0} kết quả</span></h2><Button disabled={busy || query.isFetching || detailState.isFetching} onClick={() => { setError(null); setSuccess(null); setDialog({ promotion: null }); }}>Tạo khuyến mãi</Button></div>
    <form className={`${toolbar} sm:grid-cols-2 xl:grid-cols-3`} noValidate onSubmit={(e) => { e.preventDefault(); const found = dateSelectionError(dates); setError(found); if (found) return; setFilters({ q: search.trim() || undefined, discountType: kind as ListPromotionsArgs['discountType'] || undefined, ...dateSelectionQuery(dates) }); setPage(1); setSuccess(null); }}>
      <FormField label="Mã hoặc tên khuyến mãi" htmlFor="promotion-search"><Input id="promotion-search" placeholder="VD: SUMMER20" value={search} maxLength={100} disabled={busy} onChange={(e) => setSearch(e.target.value)} /></FormField>
      <FormField label="Trạng thái khuyến mãi" htmlFor="promotion-status"><select id="promotion-status" aria-label="Lọc khuyến mãi" value={filter} className={control} disabled={busy} onChange={(e) => { setFilter(e.target.value); setPage(1); setSuccess(null); }}><option value="all">Tất cả trạng thái</option><option value="true">Đang bật</option><option value="false">Đã tắt</option></select></FormField>
      <FormField label="Loại giảm giá" htmlFor="promotion-kind"><select id="promotion-kind" className={control} value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}><option value="">Tất cả loại</option><option value="PERCENT">Phần trăm (%)</option><option value="FIXED">Số tiền cố định</option></select></FormField>
      <AdminDateFields prefix="promotion-filter" value={dates} onChange={setDates} disabled={busy} />
      <div className="flex gap-2"><Button type="submit" disabled={busy}>Áp dụng bộ lọc</Button><Button variant="ghost" disabled={busy} onClick={() => { setSearch(''); setKind(''); setDates({ from: '', to: '' }); setFilter('all'); setFilters({}); setPage(1); setError(null); }}>Đặt lại</Button></div>
      <p className="text-xs text-slate-400 sm:col-span-2 xl:col-span-3">Khoảng ngày tìm các khuyến mãi có thời gian áp dụng giao với khoảng đã chọn, theo giờ Việt Nam.</p>
    </form>
    {detailState.isFetching && <p role="status">Đang tải chi tiết khuyến mãi...</p>}
    <ul className="space-y-3">{query.currentData?.items.map((p) => <li className={panel} key={p.id}><div className="flex flex-wrap justify-between gap-4"><div><h2 className="font-bold">{p.code} · {p.title}</h2><p className="mt-1 text-sm">{p.description}</p><p className="mt-1 text-sm">{p.discountType === 'PERCENT' ? `${p.discountValue}%` : money(p.discountValue)}{p.maxDiscountAmount !== undefined && ` · Giảm tối đa ${money(p.maxDiscountAmount)}`} · Đơn tối thiểu {money(p.minOrderAmount)}</p><p className="mt-1 text-sm text-slate-600">{timestamp(p.startsAt)} → {timestamp(p.endsAt)}</p><p className="mt-1 text-sm">Đã dùng {p.usedCount}/{p.usageLimit ?? 'không giới hạn'} · {!p.isActive ? 'Đã tắt' : p.isRunning ? 'Đang chạy' : 'Ngoài thời gian áp dụng'}</p></div><div className="flex items-start gap-2"><Button variant="outline" disabled={busy || detailState.isFetching || query.isFetching} onClick={() => void edit(p.id)}>Sửa {p.code}</Button><Button variant="ghost" disabled={busy || detailState.isFetching || query.isFetching} onClick={() => { setError(null); setSuccess(null); setToggle(p); }}>{p.isActive ? 'Tắt' : 'Bật'} {p.code}</Button></div></div></li>)}</ul>
    {query.currentData?.items.length === 0 && <EmptyState title="Không có khuyến mãi phù hợp" description="Thay bộ lọc hoặc tạo khuyến mãi nền tảng mới." />}
    {query.currentData && <Pagination currentPage={page} totalPages={query.currentData.meta.totalPages} totalItems={query.currentData.meta.total} pageSize={10} showInfo disabled={query.isFetching || busy} onPageChange={setPage} />}
    {dialog && <PromotionFormDialog open promotion={dialog.promotion} isSubmitting={busy} serverError={error} onClose={() => { if (!busy) setDialog(null); }} onSubmit={(values) => void save(values)} />}
    <Modal open={!!toggle} title="Xác nhận trạng thái khuyến mãi" closeOnBackdrop={!busy} onClose={() => { if (!busy) setToggle(null); }}><Feedback error={error} /><p>{toggle?.isActive ? 'Tắt' : 'Bật'} mã {toggle?.code} trên toàn nền tảng?</p><div className="mt-4 flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setToggle(null)}>Hủy</Button><Button loading={busy} onClick={() => void changeStatus()}>Xác nhận</Button></div></Modal>
  </AdminFrame>;
}
