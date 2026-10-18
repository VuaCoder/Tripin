'use client';
import { useState } from 'react';
import { PERMISSIONS, PERSISTED_ROLES, ROLE_PERMISSIONS, USER_STATUS, type PersistedRole, type Permission } from '@travel-platform/constants';
import { Button, FormField, Input, Modal, Pagination } from '@/components/ui';
import { EmptyState } from '@/components/shared';
import { useGetAdminUsersQuery, useAssignAdminAccessMutation } from '../api/adminApi';
import type { AdminUser, AccessInput, UsersArgs } from '../types';
import { AdminFrame, Feedback, adminError, control, forbidden, panel, toolbar, useAdminSession } from './AdminUi';
import { AdminDateFields } from './AdminDateFields';
import { dateSelectionError, dateSelectionQuery, type DateSelection } from '../utils/filters';

const adminPermissions: readonly Permission[] = [PERMISSIONS.ADMIN_DASHBOARD_VIEW, PERMISSIONS.USER_ASSIGN_PERMISSIONS, PERMISSIONS.COMMISSION_CONFIGURE, PERMISSIONS.PROMOTION_PLATFORM_MANAGE, PERMISSIONS.CATEGORY_CONFIGURE, PERMISSIONS.POLICY_CONFIGURE, PERMISSIONS.AUDIT_LOG_VIEW];
function AccessForm({ target, busy, error, onSave, onClose }: { target: AdminUser; busy: boolean; error: string | null; onSave: (body: AccessInput) => void; onClose: () => void }) {
  const [role, setRole] = useState<PersistedRole>(target.role);
  const [extra, setExtra] = useState<Permission[]>(target.extraPermissions);
  const [review, setReview] = useState(false);
  const defaults = ROLE_PERMISSIONS[role];
  const effective = Array.from(new Set([...defaults, ...extra])).filter((p) => role === 'SUPER_ADMIN' || !adminPermissions.includes(p));
  return <Modal open title={`Phân quyền: ${target.fullName}`} className="max-h-[90vh] max-w-3xl overflow-y-auto" closeOnBackdrop={!busy} onClose={onClose}>
    <Feedback error={error} />
    <p className="mb-4 break-all text-sm text-slate-600">{target.email} · {target.status}</p>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (busy) return; if (!review) setReview(true); else onSave({ id: target.id, role, extraPermissions: extra }); }}>
      {review ? <div className="space-y-3"><h3 className="font-bold">Xác nhận thay đổi quyền</h3><p>Vai trò: {target.role} → {role}</p><p className="break-words text-sm">Quyền cộng thêm sau khi lưu: {extra.join(', ') || 'Không có'}</p><p className="text-sm">Thay đổi có hiệu lực ở request kế tiếp. Quyền mặc định của role không thể bỏ riêng lẻ.</p></div> : <>
        <FormField label="Vai trò" htmlFor="access-role"><select id="access-role" className={control} value={role} onChange={(e) => setRole(e.target.value as PersistedRole)}>{PERSISTED_ROLES.map((r) => <option key={r}>{r}</option>)}</select></FormField>
        <details><summary className="cursor-pointer text-sm font-semibold">Quyền mặc định ({defaults.length})</summary><p className="mt-2 break-words text-xs text-slate-600">{defaults.join(', ')}</p></details>
        <fieldset><legend className="mb-2 font-semibold">Quyền cộng thêm</legend><p className="mb-3 text-xs text-slate-600">Quyền quản trị chỉ có hiệu lực với role SUPER_ADMIN. Gỡ toàn bộ lựa chọn sẽ lưu danh sách rỗng.</p><div className="grid gap-2 sm:grid-cols-2">{Object.values(PERMISSIONS).map((permission) => <label key={permission} className="flex items-start gap-2 rounded-lg border p-2 text-xs"><input type="checkbox" checked={extra.includes(permission)} onChange={(e) => setExtra((current) => e.target.checked ? [...current, permission] : current.filter((p) => p !== permission))} /><span className="break-all">{permission}{adminPermissions.includes(permission) && ' (Super Admin)'}</span></label>)}</div></fieldset>
        <details><summary className="cursor-pointer text-sm font-semibold">Quyền sau thay đổi ({effective.length})</summary><p className="mt-2 break-words text-xs">{effective.join(', ')}</p></details>
      </>}
      <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={review ? () => setReview(false) : onClose}>{review ? 'Quay lại' : 'Hủy'}</Button><Button type="submit" loading={busy}>{review ? 'Xác nhận phân quyền' : 'Xem lại thay đổi'}</Button></div>
    </form>
  </Modal>;
}
export function AdminUsersPage() {
  const { ready, user } = useAdminSession();
  const [args, setArgs] = useState<UsersArgs>({ page: 1, limit: 10 });
  const [search, setSearch] = useState('');
  const [dates, setDates] = useState<DateSelection>({ from: '', to: '' });
  const query = useGetAdminUsersQuery(args, { skip: !ready, refetchOnMountOrArgChange: true });
  const [save, { isLoading }] = useAssignAdminAccessMutation();
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [denied, setDenied] = useState<unknown>();
  const assign = async (body: AccessInput) => {
    if (isLoading) return; setError(null); setSuccess(null);
    try { const updated = await save(body).unwrap(); setTarget(null); setSuccess(`Đã lưu quyền cho ${updated.fullName}.`); } catch (e) { setError(adminError(e)); if (forbidden(e)) setDenied(e); }
  };
  if (!ready) return null;
  return <AdminFrame title="Người dùng và phân quyền" description="Quản lý role và quyền cộng thêm. Không thể tự đổi quyền hoặc hạ quyền Super Admin hoạt động cuối cùng." error={denied || query.error} loading={!query.currentData} refreshing={query.isFetching && !!query.currentData} onRefresh={() => void query.refetch()}>
    <Feedback error={!target ? error : null} success={success} />
    <form className={`${toolbar} sm:grid-cols-2 xl:grid-cols-3`} noValidate onSubmit={(e) => { e.preventDefault(); const found = dateSelectionError(dates); setError(found); if (found) return; setArgs({ ...args, from: undefined, to: undefined, ...dateSelectionQuery(dates), page: 1, q: search.trim() || undefined }); setSuccess(null); }}>
      <FormField label="Tên hoặc email" htmlFor="user-search"><Input id="user-search" value={search} maxLength={100} onChange={(e) => setSearch(e.target.value)} /></FormField>
      <FormField label="Lọc vai trò" htmlFor="user-role"><select id="user-role" className={control} value={args.role ?? ''} onChange={(e) => { setArgs({ ...args, page: 1, role: e.target.value as PersistedRole || undefined }); setSuccess(null); }}><option value="">Tất cả vai trò</option>{PERSISTED_ROLES.map((r) => <option key={r}>{r}</option>)}</select></FormField>
      <FormField label="Lọc trạng thái" htmlFor="user-status"><select id="user-status" className={control} value={args.status ?? ''} onChange={(e) => { setArgs({ ...args, page: 1, status: e.target.value as UsersArgs['status'] || undefined }); setSuccess(null); }}><option value="">Tất cả trạng thái</option>{Object.values(USER_STATUS).map((s) => <option key={s}>{s}</option>)}</select></FormField>
      <AdminDateFields prefix="users" value={dates} onChange={setDates} disabled={isLoading} />
      <div className="flex flex-wrap items-center gap-2"><Button type="submit" disabled={isLoading}>Tìm người dùng</Button><Button variant="ghost" onClick={() => { setArgs({ page: 1, limit: 10 }); setSearch(''); setDates({ from: '', to: '' }); setError(null); setSuccess(null); }}>Đặt lại</Button></div>
      <p className="text-xs text-slate-400 sm:col-span-2 xl:col-span-3">Tìm trên toàn bộ danh sách · Khoảng ngày lọc theo ngày tạo tài khoản, giờ Việt Nam.</p>
    </form>
    <section className={`${panel} !p-0 overflow-hidden`}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold">Danh sách người dùng</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{query.currentData?.meta.total ?? 0} tài khoản</span></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3 font-medium">Người dùng</th><th className="px-4 py-3 font-medium">Vai trò</th><th className="px-4 py-3 font-medium">Trạng thái</th><th className="px-4 py-3 font-medium">Ngày tạo</th><th className="px-5 py-3 text-right font-medium">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{query.currentData?.items.map((u) => <tr key={u.id} className="transition hover:bg-slate-50/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">{u.fullName.split(' ').filter(Boolean).slice(-2).map((name) => name[0]).join('')}</span><div><h3 className="font-semibold text-slate-800">{u.fullName}</h3><p className="mt-1 text-xs text-slate-400">{u.email}</p></div></div></td><td className="px-4 py-4"><p className="text-xs font-medium text-slate-600">{u.role}</p><p className="mt-1 text-[11px] text-slate-400">{u.extraPermissions.length} quyền cộng thêm</p></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${u.status === 'ACTIVE' ? 'bg-teal-50 text-teal-700' : u.status === 'BANNED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{u.status === 'ACTIVE' ? 'Hoạt động' : u.status === 'BANNED' ? 'Đã khóa' : 'Chờ xác minh'}</span></td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td><td className="px-5 py-4 text-right"><Button variant="outline" size="sm" disabled={u.id === user?.id || isLoading || query.isFetching} onClick={() => { setError(null); setSuccess(null); setTarget(u); }}>{u.id === user?.id ? 'Tài khoản của bạn' : `Phân quyền ${u.fullName}`}</Button></td></tr>)}</tbody></table></div></section>
    {query.currentData?.items.length === 0 && <EmptyState title="Không tìm thấy người dùng" description="Hãy thay đổi tên, email hoặc bộ lọc." />}
    {query.currentData && <Pagination currentPage={args.page} totalPages={query.currentData.meta.totalPages} totalItems={query.currentData.meta.total} pageSize={10} showInfo disabled={isLoading || query.isFetching} onPageChange={(page) => setArgs({ ...args, page })} />}
    {target && <AccessForm target={target} busy={isLoading} error={error} onSave={(body) => void assign(body)} onClose={() => { if (!isLoading) setTarget(null); }} />}
  </AdminFrame>;
}
