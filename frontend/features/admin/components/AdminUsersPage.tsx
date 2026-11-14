'use client';
import { FormSelect } from '@/components/ui/FormSelect';
import { DeleteUserAction, InviteStaff, UserLifecycleAction } from './StaffActions';
import { useEffect, useState } from 'react';
import {
  PERSISTED_ROLES,
  USER_STATUS,
  type PersistedRole,
} from '@travel-platform/constants';
import { Button, FormField, Input, Modal, Pagination } from '@/components/ui';
import { EmptyState } from '@/components/shared';
import { useGetAdminUsersQuery, useAssignAdminAccessMutation } from '../api/adminApi';
import type { AdminUser, AccessInput, UsersArgs } from '../types';
import { AdminFrame, Feedback, adminError, control, forbidden, panel, toolbar, useAdminSession } from './AdminUi';
import { AdminUsersSkeleton } from './AdminSkeletons';
import { formatSmartDate } from '@/lib/travel-format';
import {
  ShieldCheck,
  UserCog,
  Search,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';

export const ROLE_DISPLAY: Record<PersistedRole, string> = {
  TRAVELER: 'Khách du lịch',
  TOUR_GUIDE: 'Hướng dẫn viên',
  AGENCY: 'Công ty du lịch',
  MODERATOR: 'Kiểm duyệt viên',
  SUPER_ADMIN: 'Quản trị viên cấp cao',
};

export const STATUS_DISPLAY: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  PENDING_VERIFICATION: 'Chờ xác minh',
  BANNED: 'Đã bị khóa',
};

/**
 * Modal Đổi vai trò người dùng tinh gọn:
 * Quản trị viên chỉ cần chọn vai trò mới cho tài khoản và lưu.
 */
function RoleChangeModal({
  target,
  busy,
  error,
  onSave,
  onClose,
}: {
  target: AdminUser;
  busy: boolean;
  error: string | null;
  onSave: (body: AccessInput) => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<PersistedRole>(target.role);

  return (
    <Modal
      open
      title="Đổi vai trò người dùng"
      className="max-w-md"
      closeOnBackdrop={!busy}
      onClose={onClose}
    >
      <Feedback error={error} />
      <div className="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 border border-slate-100">
        <p className="text-sm font-semibold text-slate-800">{target.fullName}</p>
        <p className="text-xs text-slate-500">{target.email}</p>
        <p className="text-xs text-slate-600 pt-1">
          Vai trò hiện tại: <span className="font-semibold text-teal-800">{ROLE_DISPLAY[target.role] ?? target.role}</span>
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          onSave({ id: target.id, role, extraPermissions: [], revokedPermissions: [] });
        }}
      >
        <FormField label="Chọn vai trò mới" htmlFor="change-user-role">
          <FormSelect
            id="change-user-role"
            className={control}
            value={role}
            onChange={(e) => setRole(e.target.value as PersistedRole)}
          >
            {PERSISTED_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_DISPLAY[r]}
              </option>
            ))}
          </FormSelect>
        </FormField>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={busy}>
            Lưu vai trò
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminUsersPage() {
  const { ready, user } = useAdminSession();
  const [args, setArgs] = useState<UsersArgs>({ page: 1, limit: 10, order: 'desc' });
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const query = useGetAdminUsersQuery(args, { skip: !ready, refetchOnMountOrArgChange: true });
  const [save, { isLoading }] = useAssignAdminAccessMutation();
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [denied, setDenied] = useState<unknown>();

  useEffect(() => {
    setArgs((current) => (current.order === order ? current : { ...current, page: 1, order }));
  }, [order]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = search.trim() || undefined;
      setArgs((current) => current.q === q && current.page === 1 ? current : { ...current, page: 1, q });
      setSuccess(null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const assign = async (body: AccessInput) => {
    if (isLoading) return;
    setError(null);
    setSuccess(null);
    try {
      const updated = await save(body).unwrap();
      setTarget(null);
      setSuccess(`Đã cập nhật vai trò cho ${updated.fullName}.`);
    } catch (e) {
      setError(adminError(e));
      if (forbidden(e)) setDenied(e);
    }
  };

  if (!ready) return null;

  return (
    <AdminFrame
      title="Tài khoản người dùng"
      actions={<InviteStaff />}
      error={denied || query.error}
      loading={!query.currentData}
      loadingSkeleton={<AdminUsersSkeleton />}
      refreshing={query.isFetching && !!query.currentData}
      onRefresh={() => query.refetch()}
    >
      <Feedback error={!target ? error : null} success={success} />
      <section className={`${toolbar} grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]`} aria-label="Lọc người dùng">
        <FormField label="Tìm người dùng" htmlFor="user-search" className="min-w-0">
          <div className="relative">
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              id="user-search"
              className="pl-10"
              value={search}
              maxLength={100}
              placeholder="Nhập tên hoặc email..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </FormField>
        <FormField label="Lọc vai trò" htmlFor="user-role">
          <FormSelect
            id="user-role"
            className={control}
            value={args.role ?? ''}
            onChange={(e) => {
              setArgs({
                ...args,
                page: 1,
                role: (e.target.value as PersistedRole) || undefined,
              });
              setSuccess(null);
            }}
          >
            <option value="">Tất cả vai trò</option>
            {PERSISTED_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_DISPLAY[r]}
              </option>
            ))}
          </FormSelect>
        </FormField>
        <FormField label="Lọc trạng thái" htmlFor="user-status">
          <FormSelect
            id="user-status"
            className={control}
            value={args.status ?? ''}
            onChange={(e) => {
              setArgs({
                ...args,
                page: 1,
                status: (e.target.value as UsersArgs['status']) || undefined,
              });
              setSuccess(null);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.values(USER_STATUS).map((s) => (
              <option key={s} value={s}>
                {STATUS_DISPLAY[s] ?? s}
              </option>
            ))}
          </FormSelect>
        </FormField>
      </section>

      <section className={`${panel} !p-0 overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">Danh sách người dùng</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[33%]" />
              <col className="w-[17%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[27%]" />
            </colgroup>
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Người dùng</th>
                <th className="px-4 py-3 font-medium">Vai trò</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => setOrder((cur) => (cur === 'desc' ? 'asc' : 'desc'))}
                    className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-700 transition"
                    aria-label={order === 'desc' ? 'Ngày tạo: mới nhất trước. Bấm để đảo thứ tự.' : 'Ngày tạo: cũ nhất trước. Bấm để đảo thứ tự.'}
                    aria-sort={order === 'desc' ? 'descending' : 'ascending'}
                  >
                    Ngày tạo
                    {order === 'desc'
                      ? <ArrowDown size={13} className="text-teal-600" />
                      : <ArrowUp size={13} className="text-teal-600" />}
                  </button>
                </th>
                <th className="px-5 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.currentData?.items.map((u) => (
                <tr key={u.id} className="transition hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 align-middle">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">
                        {u.fullName
                          .split(' ')
                          .filter(Boolean)
                          .slice(-2)
                          .map((name) => name[0])
                          .join('')}
                      </span>
                      <div className="min-w-0 py-0.5">
                        <h3 className="truncate font-semibold leading-5 text-slate-900">{u.fullName}</h3>
                        <p className="mt-0.5 truncate text-xs leading-5 text-slate-600">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex min-h-11 flex-col justify-center gap-0.5">
                      <p className="text-xs font-semibold leading-5 text-slate-900">{ROLE_DISPLAY[u.role] ?? u.role}</p>
                      {['MODERATOR', 'SUPER_ADMIN'].includes(u.role) && u.staffStatus && (
                        <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] leading-4 text-slate-600">
                          {{ INVITED: 'Chờ kích hoạt', ACTIVE: 'Đang làm việc', DISABLED: 'Đã vô hiệu hóa' }[u.staffStatus] ?? u.staffStatus}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        u.status === 'ACTIVE'
                          ? 'bg-teal-50 text-teal-700'
                          : u.status === 'BANNED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {STATUS_DISPLAY[u.status] ?? u.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-middle text-xs font-medium text-slate-600">
                    {formatSmartDate(u.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 align-middle">
                    <div className="flex min-h-11 flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        title={u.id === user?.id ? 'Tài khoản của bạn' : 'Đổi vai trò'}
                        aria-label={u.id === user?.id ? 'Tài khoản của bạn' : 'Đổi vai trò'}
                        className={u.id === user?.id ? 'max-w-full' : '!size-9 !min-h-9 !p-0'}
                        disabled={u.id === user?.id || isLoading || query.isFetching}
                        onClick={() => {
                          setError(null);
                          setSuccess(null);
                          setTarget(u);
                        }}
                      >
                        {u.id === user?.id ? (
                          <><ShieldCheck size={15} /><span className="sr-only">Tài khoản của bạn</span></>
                        ) : (
                          <><UserCog size={15} /><span className="sr-only">Đổi vai trò</span></>
                        )}
                      </Button>
                      {u.id !== user?.id && <UserLifecycleAction target={u} iconOnly />}
                      {u.id !== user?.id && <DeleteUserAction target={u} iconOnly />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {query.currentData?.items.length === 0 && (
        <EmptyState title="Không tìm thấy người dùng" description="Hãy thay đổi tên, email hoặc bộ lọc." />
      )}
      {query.currentData && (
        <Pagination
          currentPage={args.page}
          totalPages={query.currentData.meta.totalPages}
          totalItems={query.currentData.meta.total}
          pageSize={10}
          showInfo={false}
          disabled={isLoading || query.isFetching}
          onPageChange={(page) => setArgs({ ...args, page })}
        />
      )}
      {target && (
        <RoleChangeModal
          target={target}
          busy={isLoading}
          error={error}
          onSave={(body) => void assign(body)}
          onClose={() => {
            if (!isLoading) setTarget(null);
          }}
        />
      )}
    </AdminFrame>
  );
}
