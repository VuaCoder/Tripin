'use client';

import React, { useRef, useState } from 'react';
import { Users } from 'lucide-react';
import {
  AgencyDenied,
  AgencyError,
  AgencyLoading,
  agencyButton,
  agencyInput,
  agencyPanel,
  useAgencyPermission,
} from '@/features/agency/AgencyCommon';
import {
  type AgencyMember,
  type AgencyMemberRole,
  useAgencyMembersQuery,
  useInviteAgencyMemberMutation,
  useUpdateAgencyMemberMutation,
} from '@/features/agency/agencyTeamApi';
import { useAppSelector } from '@/store/hooks';
import { selectActiveAgency, selectUser } from '@/features/auth/store/authSlice';
import { agencyNotice } from '@/features/agency/agencyNotice';

const ROLE_NAMES: Record<AgencyMemberRole, string> = {
  OWNER: 'Đại lý sở hữu',
  MANAGER: 'Quản lý',
  STAFF: 'Nhân viên',
  ACCOUNTANT: 'Kế toán',
};

const STATUS_NAMES: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  SUSPENDED: 'Tạm khóa',
  REMOVED: 'Đã xóa',
};

const INVITABLE_ROLES: AgencyMemberRole[] = ['MANAGER', 'STAFF', 'ACCOUNTANT'];
const CHANGEABLE_ROLES: AgencyMemberRole[] = ['MANAGER', 'STAFF', 'ACCOUNTANT'];

function avatarUrl(member: AgencyMember): string | undefined {
  return member.user?.avatarUrl ?? undefined;
}

export function AgencyTeamPage() {
  const canView = useAgencyPermission('agency:team-view');
  const canInvite = useAgencyPermission('agency:team-invite');
  const canManage = useAgencyPermission('agency:team-manage');

  const { data: members = [], isLoading, isError, refetch } = useAgencyMembersQuery(undefined, { skip: !canView });

  // Actor is the current signed-in user (the active OWNER when team-manage is granted).
  const actorRole = useAppSelector(selectActiveAgency)?.memberRole ?? null;
  const actorUserId = useAppSelector(selectUser)?.id;

  // OWNER may invite MANAGER/STAFF/ACCOUNTANT; a MANAGER may only invite STAFF (server enforces too).
  const inviteableRoles: AgencyMemberRole[] = actorRole === 'MANAGER' ? ['STAFF'] : INVITABLE_ROLES;

  const [showInvite, setShowInvite] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [invite, { isLoading: inviting }] = useInviteAgencyMemberMutation();
  const [updateMember, { isLoading: updating }] = useUpdateAgencyMemberMutation();

  const inviteEmailRef = useRef<HTMLInputElement>(null);
  const inviteRoleRef = useRef<HTMLSelectElement>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  if (!canView) return <AgencyDenied />;

  const runManage = async (memberId: string, payload: { role?: AgencyMemberRole; status?: string }) => {
    if (!canManage) return;
    setNotice(null);
    try {
      await updateMember({ id: memberId, role: payload.role as AgencyMemberRole | undefined, status: payload.status as 'ACTIVE' | 'SUSPENDED' | 'REMOVED' | undefined }).unwrap();
      setNotice('Đã cập nhật thành viên.');
      agencyNotice.success('Đã cập nhật thành viên.');
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      const message = apiErr?.data?.message || 'Cập nhật không thành công. Vui lòng thử lại.';
      setNotice(message);
      agencyNotice.error(message);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    const email = inviteEmailRef.current?.value.trim() ?? '';
    const role = (inviteRoleRef.current?.value ?? 'STAFF') as Exclude<AgencyMemberRole, 'OWNER'>;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Vui lòng nhập email hợp lệ.');
      return;
    }
    try {
      await invite({ email, role }).unwrap();
      setShowInvite(false);
      setNotice('Đã gửi lời mời tham gia.');
      agencyNotice.success('Đã gửi lời mời tham gia đội ngũ.');
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setInviteError(apiErr?.data?.message || 'Không thể gửi lời mời. Vui lòng kiểm tra email hoặc thử lại.');
    }
  };

  const table = (
    <div className={`${agencyPanel} overflow-x-auto`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Bảng thành viên</h2>
            <p className="text-xs text-slate-500">{members.length} thành viên trong đối tác</p>
          </div>
        </div>
        {canInvite && (
          <button type="button" onClick={() => { setShowInvite(true); setInviteError(null); }} className={`${agencyButton} border-teal-600 text-teal-700 hover:bg-teal-50`}>
            + Mời thành viên
          </button>
        )}
      </div>

      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <th className="py-2.5 pr-4 font-semibold">Thành viên</th>
            <th className="py-2.5 pr-4 font-semibold">Vai trò</th>
            <th className="py-2.5 pr-4 font-semibold">Trạng thái</th>
            <th className="py-2.5 font-semibold">Ngày tham gia</th>
            {canManage && <th className="py-2.5 pl-4 text-right font-semibold">Quản lý</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const name = member.user?.fullName?.trim() || `Thành viên (${member.userId.slice(0, 8)})`;
            const email = member.user?.email?.trim();
            const date = member.joinedAt ?? member.createdAt;
            return (
              <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 overflow-hidden">
                      {avatarUrl(member) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl(member)} alt="" className="h-full w-full object-cover" />
                      ) : name.charAt(0).toLocaleUpperCase('vi')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{name}</p>
                      {email ? <p className="truncate text-xs text-slate-500">{email}</p> : <p className="truncate text-xs text-slate-400">{member.userId}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                    member.role === 'OWNER' ? 'bg-teal-50 text-teal-700' :
                    member.role === 'MANAGER' ? 'bg-indigo-50 text-indigo-700' :
                    member.role === 'ACCOUNTANT' ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>{ROLE_NAMES[member.role]}</span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                    member.status === 'ACTIVE' ? 'text-emerald-700' :
                    member.status === 'SUSPENDED' ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    <span className={`size-2 rounded-full ${
                      member.status === 'ACTIVE' ? 'bg-emerald-500' :
                      member.status === 'SUSPENDED' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    {STATUS_NAMES[member.status] ?? member.status}
                  </span>
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {date ? new Date(date).toLocaleDateString('vi-VN') : '—'}
                </td>
                {canManage && (
                  <td className="py-3 pl-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <select
                        aria-label={`Đổi vai trò ${name}`}
                        value={member.role}
                        disabled={updating || actorUserId === member.userId}
                        onChange={(e) => runManage(member.id, { role: e.target.value as AgencyMemberRole })}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >
                        {CHANGEABLE_ROLES.map((role) => (
                          <option key={role} value={role}>{ROLE_NAMES[role]}</option>
                        ))}
                        {member.role === 'OWNER' && <option value="OWNER">{ROLE_NAMES.OWNER}</option>}
                      </select>
                      {member.status !== 'SUSPENDED' && member.status !== 'REMOVED' && actorUserId !== member.userId && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => runManage(member.id, { status: 'SUSPENDED' })}
                          className="rounded-lg border border-amber-300 px-2 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Tạm khóa
                        </button>
                      )}
                      {member.status !== 'REMOVED' && actorUserId !== member.userId && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => runManage(member.id, { status: 'REMOVED' })}
                          className="rounded-lg border border-red-300 px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Loại
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
          {members.length === 0 && (
            <tr>
              <td colSpan={canManage ? 5 : 4} className="py-8 text-center text-sm text-slate-500">
                Chưa có thành viên nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {notice && <p role="status" className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{notice}</p>}
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Bảng thành viên</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Quản lý đội ngũ và lời mời tham gia đối tác
          </p>
        </div>
      </div>

      {isLoading ? <AgencyLoading /> : isError ? <AgencyError message="Không tải được danh sách thành viên." retry={refetch} /> : table}

      {showInvite && canInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onClick={() => setShowInvite(false)}>
          <form role="dialog" aria-label="Mời thành viên" onSubmit={handleInvite}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Mời thành viên</h3>
              <p className="text-xs text-slate-500">Gửi lời mời qua email để tham gia đối tác.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600" htmlFor="invite-email">Email:</label>
              <input ref={inviteEmailRef} id="invite-email" type="email" required placeholder="email@vidu.vn" className={agencyInput} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600" htmlFor="invite-role">Vai trò:</label>
              <select ref={inviteRoleRef} id="invite-role" defaultValue="STAFF"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                {inviteableRoles.map((role) => (
                  <option key={role} value={role}>{ROLE_NAMES[role]}</option>
                ))}
              </select>
              {actorRole === 'MANAGER' && (
                <p className="mt-1 text-xs text-slate-500">Quản lý chỉ có thể mời nhân viên.</p>
              )}
            </div>
            {inviteError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{inviteError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowInvite(false)} className={agencyButton}>Hủy</button>
              <button type="submit" disabled={inviting} className={`${agencyButton} border-teal-600 bg-teal-600 text-white hover:bg-teal-700`}>
                {inviting ? 'Đang gửi…' : 'Gửi lời mời'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
