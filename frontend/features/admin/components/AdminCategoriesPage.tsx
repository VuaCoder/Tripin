'use client';
import { FormSelect } from '@/components/ui/FormSelect';
import { useState } from 'react';
import { Edit3, Power, Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/shared';
import { Button, FormField, Input, Modal, ViewModeToggle } from '@/components/ui';
import { useGetAdminCategoriesQuery, useCreateAdminCategoryMutation, useUpdateAdminCategoryMutation, useDeactivateAdminCategoryMutation } from '../api/adminApi';
import type { Category, CategoryInput } from '../types';
import { categoryError } from '../validation';
import { AdminFrame, Feedback, adminError, control, forbidden, panel, toolbar, useAdminSession } from './AdminUi';
import { normalizedSearch } from '../utils/filters';
import { AdminCategoriesSkeleton } from './AdminSkeletons';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('order-asc');
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

  const visible = (query.currentData ?? []).filter((c) =>
    normalizedSearch(`${c.name} ${c.slug} ${c.description ?? ''}`).includes(normalizedSearch(search)) &&
    (status === 'all' || c.isActive === (status === 'active'))
  ).sort((a, b) => {
    if (sort === 'order-desc') return b.sortOrder - a.sortOrder || a.name.localeCompare(b.name, 'vi');
    if (sort === 'name-asc' || sort === 'name') return a.name.localeCompare(b.name, 'vi');
    if (sort === 'name-desc') return b.name.localeCompare(a.name, 'vi');
    if (sort === 'active-first') return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || a.sortOrder - b.sortOrder;
    if (sort === 'inactive-first') return (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0) || a.sortOrder - b.sortOrder;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi');
  });

  if (!ready) return null;

  return (
    <AdminFrame
      title="Danh mục tour"
      actions={
        <Button
          disabled={busy || query.isFetching}
          onClick={() => { setError(null); setSuccess(null); setDialog({ category: null }); }}
          className="flex items-center gap-1.5"
          aria-label="Thêm mới"
        >
          <Plus size={16} />
          <span>Thêm mới</span>
        </Button>
      }
      error={denied || query.error}
      loading={!query.currentData}
      loadingSkeleton={<AdminCategoriesSkeleton viewMode={viewMode} />}
      refreshing={query.isFetching && !!query.currentData}
      onRefresh={() => query.refetch()}
    >
      <Feedback error={!dialog && !toggle ? error : null} success={success} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Hiển thị <strong className="text-slate-800">{visible.length}</strong> / {query.currentData?.length ?? 0} danh mục
        </p>
        <ViewModeToggle value={viewMode} onChange={setViewMode} size="sm" />
      </div>

      <div className={`${toolbar} sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]`}>
        <FormField label="Tìm danh mục" htmlFor="category-search" className="min-w-0">
          <div className="relative">
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              id="category-search"
              className="pl-10"
              placeholder="Tên, slug hoặc mô tả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </FormField>
        <FormField label="Trạng thái danh mục" htmlFor="category-status">
          <FormSelect id="category-status" className={control} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã vô hiệu hóa</option>
          </FormSelect>
        </FormField>
        <FormField label="Sắp xếp danh mục" htmlFor="category-sort">
          <FormSelect id="category-sort" className={control} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="order-asc">Thứ tự hiển thị (Tăng dần)</option>
            <option value="order-desc">Thứ tự hiển thị (Giảm dần)</option>
            <option value="name-asc">Tên (A → Z)</option>
            <option value="name-desc">Tên (Z → A)</option>
            <option value="active-first">Đang hoạt động trước</option>
            <option value="inactive-first">Đã vô hiệu hóa trước</option>
          </FormSelect>
        </FormField>
      </div>

      {visible.length > 0 && (
        viewMode === 'grid' ? (
          <ul className="grid gap-4 xl:grid-cols-2">
            {visible.map((c) => (
              <li className={panel} key={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words font-bold text-slate-800">{c.name}</h2>
                    <p className="mt-1 text-xs text-slate-400">{c.slug} · Thứ tự {c.sortOrder}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${c.isActive ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                  </span>
                </div>
                <p className="mt-4 min-h-10 break-words text-sm leading-6 text-slate-500">{c.description || 'Chưa có mô tả.'}</p>
                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Sửa ${c.name}`}
                    title={`Sửa ${c.name}`}
                    disabled={busy || query.isFetching}
                    onClick={() => { setError(null); setSuccess(null); setDialog({ category: c }); }}
                    className="flex items-center gap-1.5"
                  >
                    <Edit3 size={15} />
                    <span className="sr-only">Sửa {c.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={c.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                    title={c.isActive ? 'Vô hiệu hóa (Tắt)' : 'Kích hoạt lại (Bật)'}
                    disabled={busy || query.isFetching}
                    className={c.isActive ? 'text-rose-600 hover:bg-rose-50' : 'text-teal-600 hover:bg-teal-50'}
                    onClick={() => { setError(null); setSuccess(null); setToggle(c); }}
                  >
                    <Power size={16} />
                    <span className="sr-only">{c.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className={`${panel} !p-0 overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[32%]" />
                  <col className="w-[20%]" />
                  <col className="w-[12%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Tên danh mục</th>
                    <th className="px-4 py-3 font-medium">Slug</th>
                    <th className="px-4 py-3 font-medium">Thứ tự</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                    <th className="px-5 py-3 text-right font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((c) => (
                    <tr key={c.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 align-middle">
                        <div>
                          <span className="font-semibold text-slate-900">{c.name}</span>
                          {c.description && <p className="line-clamp-1 text-xs text-slate-500 mt-0.5">{c.description}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-xs text-slate-500 font-mono">
                        {c.slug}
                      </td>
                      <td className="px-4 py-3.5 align-middle text-sm font-medium text-slate-700">
                        {c.sortOrder}
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.isActive ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                          {c.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 align-middle text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Sửa ${c.name}`}
                            title={`Sửa ${c.name}`}
                            disabled={busy || query.isFetching}
                            onClick={() => { setError(null); setSuccess(null); setDialog({ category: c }); }}
                            className="flex items-center gap-1.5"
                          >
                            <Edit3 size={14} />
                            <span className="sr-only">Sửa {c.name}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={c.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                            title={c.isActive ? 'Vô hiệu hóa (Tắt)' : 'Kích hoạt lại (Bật)'}
                            disabled={busy || query.isFetching}
                            className={c.isActive ? 'text-rose-600 hover:bg-rose-50' : 'text-teal-600 hover:bg-teal-50'}
                            onClick={() => { setError(null); setSuccess(null); setToggle(c); }}
                          >
                            <Power size={15} />
                            <span className="sr-only">{c.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {visible.length === 0 && (
        <EmptyState
          title={query.currentData?.length ? 'Không có danh mục phù hợp' : 'Chưa có danh mục'}
          description="Thay đổi bộ lọc hoặc tạo danh mục mới để phân loại tour."
        />
      )}

      {dialog && (
        <CategoryForm
          category={dialog.category}
          busy={busy}
          serverError={error}
          onSave={(body) => void save(body)}
          onClose={() => { if (!busy) setDialog(null); }}
        />
      )}

      <Modal
        open={!!toggle}
        title="Xác nhận trạng thái danh mục"
        closeOnBackdrop={!busy}
        onClose={() => { if (!busy) setToggle(null); }}
      >
        <Feedback error={error} />
        <p>{toggle?.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'} danh mục {toggle?.name}?</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="ghost" disabled={busy} onClick={() => setToggle(null)}>Hủy</Button>
          <Button loading={busy} onClick={() => void changeStatus()}>Xác nhận</Button>
        </div>
      </Modal>
    </AdminFrame>
  );
}
