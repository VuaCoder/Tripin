'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/shared';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { useGetAdminCategoriesQuery, useCreateAdminCategoryMutation, useUpdateAdminCategoryMutation, useDeactivateAdminCategoryMutation } from '../api/adminApi';
import type { Category, CategoryInput } from '../types';
import { categoryError } from '../validation';
import { AdminFrame, Feedback, adminError, control, forbidden, panel, toolbar, useAdminSession } from './AdminUi';
import { normalizedSearch } from '../utils/filters';

function CategoryForm({ category, busy, serverError, onSave, onClose }: { category: Category | null; busy: boolean; serverError: string | null; onSave: (body: CategoryInput) => void; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [order, setOrder] = useState(String(category?.sortOrder ?? 0));
  const [error, setError] = useState<string | null>(null);
  return <Modal open title={category ? 'Chỉnh sửa danh mục' : 'Tạo danh mục'} onClose={onClose} closeOnBackdrop={!busy}>
    <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); const found = categoryError(name, description, order); setError(found); if (!found && !busy) onSave({ name: name.trim(), description: description.trim(), sortOrder: Number(order) }); }}>
      <Feedback error={error || serverError} />
      <FormField label="Tên danh mục" htmlFor="category-name" required><Input id="category-name" value={name} maxLength={80} disabled={busy} onChange={(e) => setName(e.target.value)} /></FormField>
      <FormField label="Mô tả" htmlFor="category-description"><textarea id="category-description" className={control} value={description} maxLength={1000} disabled={busy} onChange={(e) => setDescription(e.target.value)} /></FormField>
      <FormField label="Thứ tự" htmlFor="category-order"><Input id="category-order" inputMode="numeric" value={order} disabled={busy} onChange={(e) => setOrder(e.target.value)} /></FormField>
      <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" loading={busy}>Lưu danh mục</Button></div>
    </form>
  </Modal>;
}
export function AdminCategoriesPage() {
  const { ready } = useAdminSession();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('order');
  const query = useGetAdminCategoriesQuery(undefined, { skip: !ready, refetchOnMountOrArgChange: true });
  const [create, createState] = useCreateAdminCategoryMutation();
  const [update, updateState] = useUpdateAdminCategoryMutation();
  const [deactivate, deleteState] = useDeactivateAdminCategoryMutation();
  const busy = createState.isLoading || updateState.isLoading || deleteState.isLoading;
  const [dialog, setDialog] = useState<{ category: Category | null } | null>(null);
  const [toggle, setToggle] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [denied, setDenied] = useState<unknown>();
  const fail = (e: unknown) => { setError(adminError(e)); if (forbidden(e)) setDenied(e); };
  const save = async (body: CategoryInput) => {
    if (busy) return; setError(null); setSuccess(null);
    try { if (dialog?.category) await update({ id: dialog.category.id, patch: body }).unwrap(); else await create(body).unwrap(); setDialog(null); setSuccess('Đã lưu danh mục.'); } catch (e) { fail(e); }
  };
  const changeStatus = async () => {
    if (!toggle || busy) return; setError(null); setSuccess(null);
    try { if (toggle.isActive) await deactivate(toggle.id).unwrap(); else await update({ id: toggle.id, patch: { isActive: true } }).unwrap(); setToggle(null); setSuccess('Đã cập nhật trạng thái danh mục.'); } catch (e) { fail(e); }
  };
  const visible = (query.currentData ?? []).filter((c) => normalizedSearch(`${c.name} ${c.slug} ${c.description ?? ''}`).includes(normalizedSearch(search)) && (status === 'all' || c.isActive === (status === 'active')))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'vi') : a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'));
  if (!ready) return null;
  return <AdminFrame title="Danh mục tour" description="Vô hiệu hóa danh mục sẽ ẩn khỏi danh sách công khai và giữ liên kết tour hiện có." error={denied || query.error} loading={!query.currentData} refreshing={query.isFetching && !!query.currentData} onRefresh={() => void query.refetch()}>
    <Feedback error={!dialog && !toggle ? error : null} success={success} />
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Hiển thị <strong className="text-slate-800">{visible.length}</strong> / {query.currentData?.length ?? 0} danh mục</p><Button disabled={busy || query.isFetching} onClick={() => { setError(null); setSuccess(null); setDialog({ category: null }); }}>Tạo danh mục</Button></div>
    <div className={`${toolbar} sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto]`}>
      <FormField label="Tìm danh mục" htmlFor="category-search"><Input id="category-search" placeholder="Tên, slug hoặc mô tả..." value={search} onChange={(e) => setSearch(e.target.value)} /></FormField>
      <FormField label="Trạng thái danh mục" htmlFor="category-status"><select id="category-status" className={control} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Tất cả</option><option value="active">Đang hoạt động</option><option value="inactive">Đã vô hiệu hóa</option></select></FormField>
      <FormField label="Sắp xếp danh mục" htmlFor="category-sort"><select id="category-sort" className={control} value={sort} onChange={(e) => setSort(e.target.value)}><option value="order">Thứ tự hiển thị</option><option value="name">Tên A–Z</option></select></FormField>
      <Button variant="ghost" onClick={() => { setSearch(''); setStatus('all'); setSort('order'); }}>Đặt lại</Button>
    </div>
    <ul className="grid gap-4 xl:grid-cols-2">{visible.map((c) => <li className={panel} key={c.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-bold text-slate-800">{c.name}</h2><p className="mt-1 text-xs text-slate-400">{c.slug} · Thứ tự {c.sortOrder}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${c.isActive ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>{c.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</span></div><p className="mt-4 min-h-10 break-words text-sm leading-6 text-slate-500">{c.description || 'Chưa có mô tả.'}</p><div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="outline" size="sm" disabled={busy || query.isFetching} onClick={() => { setError(null); setSuccess(null); setDialog({ category: c }); }}>Sửa {c.name}</Button><Button variant="ghost" size="sm" disabled={busy || query.isFetching} onClick={() => { setError(null); setSuccess(null); setToggle(c); }}>{c.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'}</Button></div></li>)}</ul>
    {visible.length === 0 && <EmptyState title={query.currentData?.length ? 'Không có danh mục phù hợp' : 'Chưa có danh mục'} description="Thay đổi bộ lọc hoặc tạo danh mục mới để phân loại tour." />}
    {dialog && <CategoryForm category={dialog.category} busy={busy} serverError={error} onSave={(body) => void save(body)} onClose={() => { if (!busy) setDialog(null); }} />}
    <Modal open={!!toggle} title="Xác nhận trạng thái danh mục" closeOnBackdrop={!busy} onClose={() => { if (!busy) setToggle(null); }}><Feedback error={error} /><p>{toggle?.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'} danh mục {toggle?.name}?</p><div className="mt-4 flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setToggle(null)}>Hủy</Button><Button loading={busy} onClick={() => void changeStatus()}>Xác nhận</Button></div></Modal>
  </AdminFrame>;
}
