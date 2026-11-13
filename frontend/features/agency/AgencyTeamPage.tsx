'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { Modal } from '@/components/ui/Modal';
import styles from './AgencyTeamPage.module.css';
import { agencyContextApi, useAgencyContext } from './agencyContext';
import { ownerControlPermissions, permissionLabels } from './permissionLabels';
import { AgencyJoinPanel } from './AgencyJoinPanel';
import type { JoinCode } from './workplacesApi';
import { useTeamMembersQuery, useTeamRolesQuery, useTeamPermissionsQuery, useTeamInvitationsQuery, useSaveTeamRoleMutation,
  useSaveMemberAccessMutation, useChangeTeamMemberMutation, useInviteTeamMemberMutation, useRevokeTeamInvitationMutation,
  type TeamMember, type TeamRole, type PermissionOverride } from './teamApi';

const button = 'min-h-11 rounded-xl bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
const secondary = 'min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-teal-700';
const field = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-2 focus:outline-teal-700';
function errorMessage(error: unknown) {
  const message = (error as { data?: { error?: { message?: string }; message?: string } })?.data;
  return message?.error?.message ?? message?.message ?? 'Không lưu được thay đổi. Kiểm tra quyền truy cập và thử lại.';
}
const statusLabels = { ACTIVE: 'Đang hoạt động', SUSPENDED: 'Tạm đình chỉ', REMOVED: 'Đã gỡ khỏi doanh nghiệp' };
const invitationStatusLabels: Record<string, string> = { PENDING: 'Đang chờ', ACCEPTED: 'Đã chấp nhận', REVOKED: 'Đã thu hồi', EXPIRED: 'Đã hết hạn' };
const permissionGroupLabels: Record<string, string> = { agency: 'Doanh nghiệp', team: 'Thành viên và phân quyền', bookings: 'Booking và khách hàng', finance: 'Tài chính', tour: 'Tour và lịch khởi hành', promotion: 'Khuyến mãi', complaint: 'Khiếu nại', review: 'Đánh giá', premium: 'Premium' };
function permissionGroup(permission: string) {
  if (permission.startsWith('agency:team-') || permission === 'agency:permissions-manage') return 'team';
  if (permission.includes('booking') || permission === 'agency:export-customers') return 'bookings';
  if (permission === 'agency:finance-view') return 'finance';
  if (permission.startsWith('tour:') || permission.startsWith('agency:tour-')) return 'tour';
  return permission.split(':')[0];
}
function canManageMember(member: TeamMember, actorMemberId: string, isPrimaryOwner: boolean, hasPermission: boolean) {
  return hasPermission && member.id !== actorMemberId && !member.isPrimaryOwner && (member.role !== 'OWNER' || isPrimaryOwner);
}
function memberDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Chưa có thông tin';
  return new Date(value).toLocaleDateString('vi-VN');
}
function MemberIdentity({ member }: { member: TeamMember }) {
  const initials = member.user.fullName.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toLocaleUpperCase('vi');
  return <div className="flex min-w-0 items-center gap-4">
    <div aria-hidden="true" className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-lg font-semibold text-teal-800">
      {initials}{member.user.avatarUrl && <img src={member.user.avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} />}
    </div>
    <div className="min-w-0"><h3 className="break-words text-lg font-semibold text-slate-900">{member.user.fullName}</h3><p className="mt-1 break-all text-sm text-slate-600">{member.user.email}</p></div>
  </div>;
}

export function AgencyTeamPage() {
  const agency = useAgencyContext();
  const dispatch = useAppDispatch();
  const agencyId = agency?.agencyId ?? '';
  const can = (p: string) => agency?.permissions.includes(p) ?? false;
  const members = useTeamMembersQuery(agencyId, { skip: !can('agency:team-view') });
  const roles = useTeamRolesQuery(agencyId, { skip: !can('agency:team-view') });
  const catalog = useTeamPermissionsQuery(agencyId, { skip: !can('agency:team-view') });
  const invitations = useTeamInvitationsQuery(agencyId, { skip: !can('agency:team-view') });
  const [saveRole] = useSaveTeamRoleMutation();
  const [saveAccess] = useSaveMemberAccessMutation();
  const [changeMember] = useChangeTeamMemberMutation();
  const [invite] = useInviteTeamMemberMutation();
  const [revoke] = useRevokeTeamInvitationMutation();
  const [tab, setTab] = useState<'members' | 'invitations' | 'roles'>('members');
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [joinCodeSecret, setJoinCodeSecret] = useState<{ agencyId: string; code: JoinCode } | null>(null);
  useEffect(() => { setJoinCodeSecret(null); }, [agencyId]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [showAccessEditor, setShowAccessEditor] = useState(false);
  const [confirmOwner, setConfirmOwner] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [roleDraft, setRoleDraft] = useState<{ id?: string; name: string; permissions: string[] } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [pendingStatus, setPendingStatus] = useState<{ member: TeamMember; status: TeamMember['status'] } | null>(null);
  const roleRows = roles.data ?? [];
  const permissions = catalog.data ?? [];
  const isOwner = agency?.memberRole === 'OWNER';
  const isPrimaryOwner = isOwner && agency?.isPrimaryOwner === true;

  async function perform(work: () => Promise<unknown>, message: string, returnToProfile = false) {
    setBusy(true); setError(''); setNotice('');
    try {
      await work(); if (!returnToProfile) setEditing(null); setRoleDraft(null); setPendingStatus(null); setShowInvite(false);
      const [updatedMembers] = await Promise.all([members.refetch().unwrap(), roles.refetch().unwrap(), invitations.refetch().unwrap()]);
      if (returnToProfile) {
        setEditing(current => updatedMembers.find(member => member.id === current?.id) ?? current);
        setShowAccessEditor(false); setConfirmOwner(false); setPermissionSearch('');
      }
      const refresh = dispatch(agencyContextApi.endpoints.agencyMemberships.initiate(undefined, { forceRefetch: true }));
      try { await refresh.unwrap(); } finally { refresh.unsubscribe(); }
      setNotice(message); return true;
    } catch (e) { setError(errorMessage(e)); return false; }
    finally { setBusy(false); }
  }
  function editMember(member: TeamMember) { setEditing(member); setRoleDraft(null); setRoleId(member.roleId); setOverrides([...member.overrides]); setPendingStatus(null); setShowAccessEditor(false); setConfirmOwner(false); setPermissionSearch(''); setError(''); }
  function openMemberAccess() {
    if (!editing) return;
    setRoleId(editing.roleId); setOverrides([...editing.overrides]); setConfirmOwner(false); setPendingStatus(null); setPermissionSearch(''); setError(''); setShowAccessEditor(true);
  }
  function closeMemberAccess() {
    if (busy) return;
    setShowAccessEditor(false); setConfirmOwner(false); setPermissionSearch(''); setError('');
  }
  function editRole(role?: TeamRole) {
    setEditing(null); setError('');
    setRoleDraft(role ? { id: role.id, name: role.name, permissions: role.permissions.filter(p => permissions.includes(p)) }
      : { name: '', permissions: ['agency:context-view'] });
  }
  function updateOverride(permission: string, effect: string) {
    setOverrides(current => [...current.filter(o => o.permission !== permission), ...(effect === 'INHERIT' ? [] : [{ permission, effect: effect as 'ALLOW' | 'DENY' }])]);
  }
  function toggleMemberPermission(permission: string, checked: boolean) {
    const roleHasPermission = roleRows.find(r => r.id === roleId)?.permissions.includes(permission) ?? false;
    updateOverride(permission, checked === roleHasPermission ? 'INHERIT' : checked ? 'ALLOW' : 'DENY');
  }
  if (!agency || !can('agency:team-view')) return <p role="alert" className="p-6">Bạn không có quyền xem thành viên của doanh nghiệp này.</p>;
  const loading = members.isLoading || roles.isLoading || catalog.isLoading || invitations.isLoading;
  const loadError = members.isError || roles.isError || catalog.isError || invitations.isError;
  const selectedRole = roleRows.find(r => r.id === roleId);
  const filteredPermissions = permissions.filter(permission => `${permissionLabels[permission] ?? permission} ${permission}`.toLocaleLowerCase('vi').includes(permissionSearch.trim().toLocaleLowerCase('vi')));
  const groupedPermissions = filteredPermissions.reduce<Record<string, string[]>>((groups, permission) => {
    const group = permissionGroup(permission);
    (groups[group] ??= []).push(permission);
    return groups;
  }, {});
  const invitationRows = invitations.data ?? [];
  const visibleMembers = (members.data ?? []).filter(member => member.status !== 'REMOVED');
  const canEditMemberAccess = Boolean(editing && canManageMember(editing, agency.memberId, isPrimaryOwner, can('agency:permissions-manage')));
  const canManageMemberStatus = Boolean(editing && canManageMember(editing, agency.memberId, isPrimaryOwner, can('agency:team-manage')));
  const canAddOwner = Boolean(editing && editing.status === 'ACTIVE' && editing.role !== 'OWNER' && isPrimaryOwner && canEditMemberAccess && canManageMemberStatus);
  const promotingOwner = Boolean(editing && editing.role !== 'OWNER' && selectedRole?.systemRole === 'OWNER');
  const demotingOwner = Boolean(editing?.role === 'OWNER' && selectedRole?.systemRole && selectedRole.systemRole !== 'OWNER');
  return <main className="mx-auto max-w-7xl space-y-7 p-4 text-slate-900 selection:bg-teal-100 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Thành viên & phân quyền</h1>
      <p className="mt-2 max-w-3xl text-slate-600">Quản lý đội ngũ của {agency.companyName}. Role là bộ quyền mặc định; mỗi thành viên có thể được cấp hoặc chặn quyền riêng.</p></div>
      {tab !== 'roles' && <div className="flex flex-wrap items-center gap-2">{isOwner && <button type="button" className={secondary} onClick={() => { setError(''); setShowJoinCode(true); }}>Mã mời</button>}{can('agency:team-invite') && <button type="button" className={button} onClick={() => { setError(''); setShowInvite(true); }}>Thêm thành viên</button>}</div>}</header>
    {notice && <p role="status" className="rounded-xl bg-teal-50 p-4 text-teal-900">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {loading ? <p role="status">Đang tải đội ngũ…</p> : loadError ? <div role="alert"><p>Không tải được đội ngũ. Chưa có thay đổi nào được thực hiện.</p>
      <button className={secondary + ' mt-3'} onClick={() => { void members.refetch(); void roles.refetch(); void catalog.refetch(); void invitations.refetch(); }}>Thử lại</button></div> : <>
    <div className="flex flex-wrap gap-2" aria-label="Nội dung quản lý đội ngũ">
      <button className={tab === 'members' ? button : secondary} aria-pressed={tab === 'members'} onClick={() => { setTab('members'); setRoleDraft(null); }}>Thành viên</button>
      <button className={tab === 'invitations' ? button : secondary} aria-pressed={tab === 'invitations'} onClick={() => { setTab('invitations'); setRoleDraft(null); setEditing(null); }}>Lời mời</button>
      {isOwner && <Link href="/agency/team/requests" className={secondary}>Yêu cầu tham gia</Link>}
      <button className={tab === 'roles' ? button : secondary} aria-pressed={tab === 'roles'} onClick={() => { setTab('roles'); setEditing(null); }}>Role & bộ quyền</button>
    </div>
    {tab !== 'roles' ? <>
      {tab === 'members' && <section aria-labelledby="members-heading"><h2 id="members-heading" className="mb-3 text-xl font-semibold">Đội ngũ hiện tại</h2>
        <ul className="divide-y divide-slate-200 rounded-xl bg-white px-5">
          {visibleMembers.map(member => {
            const isSelf = member.id === agency.memberId;
            const canManageMember = !isSelf && !member.isPrimaryOwner && (member.role !== 'OWNER' || isPrimaryOwner);
            const canEdit = canManageMember && (can('agency:permissions-manage') || can('agency:team-manage'));
            return <li key={member.id} className="grid min-w-0 grid-cols-1 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_12rem_9rem] sm:items-center sm:gap-4">
              <h3 className="truncate font-semibold">{member.user.fullName}{isSelf ? ' (bạn)' : ''}</h3>
              <p className="text-sm text-slate-700">{member.roleName}</p>
              <p className="text-sm text-slate-600">{statusLabels[member.status]}</p>
              <button disabled={busy} className={secondary + ' w-full whitespace-nowrap'} onClick={() => editMember(member)}>{canEdit ? 'Chỉnh sửa' : 'Xem thông tin'}<span className="sr-only"> {member.user.fullName}</span></button>
            </li>;
          })}
        </ul>
        {!visibleMembers.length && <p className="rounded-xl bg-white p-5 text-slate-600">Chưa có thành viên nào.</p>}
      </section>}
      {tab === 'invitations' && <section aria-labelledby="invitations-heading"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="invitations-heading" className="text-xl font-semibold">Lời mời đã gửi</h2><span className="text-sm text-slate-500">{invitationRows.filter(inv => inv.status === 'PENDING' && new Date(inv.expiresAt) > new Date()).length} đang chờ</span></div>
        <ul className="divide-y divide-slate-200 rounded-xl bg-white px-4">{invitationRows.map(inv => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={inv.id}>
          <div className="min-w-0"><p className="break-all font-medium">{inv.email}</p><p className="text-sm text-slate-600">{roleRows.find(r => r.id === inv.roleId)?.name ?? inv.role} · {invitationStatusLabels[inv.status === 'PENDING' && new Date(inv.expiresAt) <= new Date() ? 'EXPIRED' : inv.status] ?? inv.status}</p><p className="text-xs text-slate-500">Hết hạn {new Date(inv.expiresAt).toLocaleString('vi-VN')}</p></div>
          {inv.status === 'PENDING' && can('agency:team-manage') && <button className={secondary} disabled={busy} onClick={() => void perform(() => revoke(inv.id).unwrap(), 'Đã thu hồi lời mời.')}>Thu hồi</button>}
        </li>)}</ul>
        {!invitationRows.length && <p className="rounded-xl bg-white p-5 text-slate-600">Chưa có lời mời nào.</p>}
      </section>}
      {showJoinCode && <Modal open onClose={() => setShowJoinCode(false)} title="Mã mời tham gia" className="max-w-md"><AgencyJoinPanel active secret={joinCodeSecret?.agencyId === agencyId ? joinCodeSecret.code : null} onSecretChange={code => setJoinCodeSecret(code ? { agencyId, code } : null)} /></Modal>}
      {showInvite && <Modal open onClose={() => setShowInvite(false)} title="Thêm thành viên" className="max-w-2xl" contentClassName="space-y-5">
        <div><p className="font-semibold">Mời bằng email</p><p className="mt-1 text-sm text-slate-600">Lời mời có hiệu lực 24 giờ. Email chỉ thông báo; người nhận đăng nhập bằng đúng email đã xác minh và chấp nhận tại Chọn nơi làm việc → Lời mời của tôi.</p></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event: FormEvent) => { event.preventDefault(); const role = roleRows.find(r => r.id === inviteRoleId);
          const invitedRole = role?.systemRole ?? 'STAFF';
          if (role && invitedRole !== 'OWNER') void perform(() => invite({ email: inviteEmail, roleId: role.id, role: invitedRole }).unwrap(), 'Đã tạo lời mời. Hệ thống sẽ gửi email thông báo.').then(ok => { if (ok) setInviteEmail(''); }); }}>
          <label className="space-y-1">Email<input type="email" required maxLength={254} className={field} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></label>
          <label className="space-y-1">Role<select required className={field} value={inviteRoleId} onChange={e => setInviteRoleId(e.target.value)}><option value="">Chọn role</option>
            {roleRows.filter(r => r.systemRole !== 'OWNER' && r.permissions.every(p => can(p))).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <button className={button} disabled={busy || !inviteRoleId}>Gửi lời mời</button>
        </form>
      </Modal>}
      {editing && !showAccessEditor && <Modal key="member-profile" open onClose={() => { setEditing(null); setPendingStatus(null); setError(''); }} title="Hồ sơ nhân viên" className="max-w-2xl" contentClassName={`space-y-6 ${styles.modalBody}`}
        footer={<div className="flex justify-end"><button className={secondary} disabled={busy} onClick={() => { setEditing(null); setPendingStatus(null); }}>Đóng</button></div>}>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <section className="space-y-5" aria-label="Thông tin nhân viên">
            <MemberIdentity member={editing} />
            <div className="flex flex-wrap gap-2"><span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">{editing.roleName}</span><span className={`rounded-md px-2.5 py-1 text-xs font-medium ${editing.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{statusLabels[editing.status]}</span></div>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Số điện thoại</dt><dd className="mt-1 font-medium text-slate-900">{editing.user.phone || 'Chưa cập nhật'}</dd></div>
              <div><dt className="text-slate-500">Xác minh email</dt><dd className="mt-1 font-medium text-slate-900">{editing.user.emailVerifiedAt ? 'Đã xác minh' : editing.user.emailVerifiedAt === null ? 'Chưa xác minh' : 'Chưa có thông tin'}</dd></div>
              <div><dt className="text-slate-500">Ngày tham gia</dt><dd className="mt-1 font-medium text-slate-900">{memberDate(editing.createdAt)}</dd></div>
              <div><dt className="text-slate-500">Cập nhật gần nhất</dt><dd className="mt-1 font-medium text-slate-900">{memberDate(editing.updatedAt)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500">Doanh nghiệp</dt><dd className="mt-1 break-words font-medium text-slate-900">{agency.companyName}</dd></div>
            </dl>
          </section>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4" aria-labelledby="member-access-summary-heading">
            <div><h3 id="member-access-summary-heading" className="font-semibold">Quyền truy cập hiện tại</h3><p className="mt-1 text-sm text-slate-600">{editing.permissions.length} quyền · {editing.overrides.length} tùy chỉnh riêng</p></div>
            <button type="button" className={secondary} onClick={openMemberAccess}>{canEditMemberAccess ? 'Chỉnh sửa quyền' : 'Xem quyền'}</button>
          </section>
          {canManageMemberStatus && <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="member-status-heading">
          <h3 id="member-status-heading" className="font-semibold">Trạng thái thành viên</h3>
          <div className="flex flex-wrap gap-2">
            <button className={secondary} disabled={busy} onClick={() => setPendingStatus({ member: editing, status: editing.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}>
              {editing.status === 'ACTIVE' ? 'Đình chỉ thành viên' : editing.status === 'SUSPENDED' ? 'Kích hoạt thành viên' : 'Khôi phục thành viên'}
            </button>
            {editing.status !== 'REMOVED' && <button className={secondary} disabled={busy} onClick={() => setPendingStatus({ member: editing, status: 'REMOVED' })}>Gỡ khỏi doanh nghiệp</button>}
          </div>
          {pendingStatus?.member.id === editing.id && <div className="space-y-3 rounded-lg bg-slate-50 p-4" role="group" aria-label="Xác nhận thay đổi trạng thái">
            <p>Xác nhận chuyển {editing.user.fullName} sang “{statusLabels[pendingStatus.status]}”?</p>
            <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => void perform(() => changeMember({ id: editing.id, status: pendingStatus.status }).unwrap(), 'Đã cập nhật trạng thái thành viên.')}>Xác nhận</button><button className={secondary} disabled={busy} onClick={() => setPendingStatus(null)}>Hủy</button></div>
          </div>}
          </section>}
      </Modal>}
      {editing && showAccessEditor && <Modal key="member-access" open onClose={closeMemberAccess} closeOnBackdrop={!busy} title={canEditMemberAccess ? 'Chỉnh sửa phân quyền' : 'Quyền truy cập'} className="max-w-2xl" contentClassName={`space-y-6 ${styles.modalBody}`}
        footer={<div className="flex justify-end gap-3"><button className={secondary} disabled={busy} onClick={closeMemberAccess}>{canEditMemberAccess ? 'Hủy' : 'Đóng'}</button>{canEditMemberAccess && <button className={button} disabled={busy || !roleId || (promotingOwner && !canAddOwner) || (editing.role === 'OWNER' && !demotingOwner)} onClick={() => {
          if (promotingOwner) {
            if (!confirmOwner) { setConfirmOwner(true); return; }
            void perform(() => changeMember({ id: editing.id, role: 'OWNER' }).unwrap(), `Đã thêm ${editing.user.fullName} làm Co_Owner.`, true);
          } else if (demotingOwner && selectedRole?.systemRole && selectedRole.systemRole !== 'OWNER') {
            void perform(() => changeMember({ id: editing.id, role: selectedRole.systemRole as 'MANAGER' | 'STAFF' | 'ACCOUNTANT' }).unwrap(), 'Đã đổi vai trò Co_Owner.', true);
          } else void perform(() => saveAccess({ id: editing.id, roleId, overrides }).unwrap(), 'Đã lưu quyền thành viên.', true);
        }}>{busy ? 'Đang cập nhật…' : promotingOwner && confirmOwner ? 'Xác nhận thêm Co_Owner' : 'Cập nhật quyền'}</button>}</div>}>
        <div className="border-b border-slate-100 pb-5"><MemberIdentity member={editing} /></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <fieldset><legend className="mb-3 font-semibold">Vai trò</legend><div className="grid gap-2 sm:grid-cols-2">
          {roleRows.filter(role => !canEditMemberAccess ? role.id === editing.roleId : editing.role === 'OWNER' ? Boolean(role.systemRole) : role.systemRole !== 'OWNER' || canAddOwner).map(role => <label key={role.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:disabled]:cursor-default has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700">
            <input type="radio" name="member-role" value={role.id} checked={roleId === role.id} disabled={busy || !canEditMemberAccess} className="peer sr-only" onChange={() => { setRoleId(role.id); setOverrides([]); setConfirmOwner(false); }} />
            <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-transparent peer-checked:border-teal-700 peer-checked:bg-teal-700 peer-checked:text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
            <span className="text-sm font-medium">{role.systemRole === 'OWNER' ? editing.isPrimaryOwner ? 'Owner' : 'Co_Owner' : role.name}</span>
          </label>)}
        </div></fieldset>
        {promotingOwner && confirmOwner && <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Cấp toàn quyền quản lý cho <strong className="break-all">{editing.user.email}</strong>? Bạn vẫn là Owner và có thể hạ vai trò người này.</div>}
        <section className="space-y-4" aria-label="Quyền chi tiết">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Quyền chi tiết</h3>{canEditMemberAccess && !promotingOwner && editing.role !== 'OWNER' && <button type="button" className="min-h-11 text-sm font-medium text-teal-800 underline underline-offset-4" disabled={busy} onClick={() => setOverrides([])}>Đặt lại theo vai trò</button>}</div>
          <label className="block space-y-1">Tìm quyền<input type="search" className={field} placeholder="Tìm theo tên quyền…" value={permissionSearch} onChange={e => setPermissionSearch(e.target.value)} /></label>
          <div className="space-y-6" aria-label="Danh sách quyền chi tiết">
            {Object.entries(groupedPermissions).map(([group, groupPermissions]) => <fieldset key={group} className="min-w-0 border-t border-slate-200 pt-3">
              <legend className="pr-3 text-sm font-semibold text-slate-700">{permissionGroupLabels[group] ?? group}</legend>
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{groupPermissions.map(permission => {
                const override = overrides.find(item => item.permission === permission);
                const protectedPermission = permission === 'agency:context-view' || (editing.role === 'OWNER' && !demotingOwner && ownerControlPermissions.includes(permission));
                const effective = Boolean(protectedPermission || (override ? override.effect === 'ALLOW' : selectedRole?.permissions.includes(permission)));
                const cannotGrant = !effective && !can(permission);
                return <label key={permission} className="flex min-h-11 items-start gap-3 rounded-lg px-2 py-3 hover:bg-slate-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal-700">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-teal-700 disabled:cursor-not-allowed" aria-label={permissionLabels[permission] ?? permission} checked={effective} disabled={busy || !canEditMemberAccess || protectedPermission || cannotGrant || promotingOwner || editing.role === 'OWNER'} onChange={e => toggleMemberPermission(permission, e.target.checked)} />
                  <span className="min-w-0 text-sm leading-6">{permissionLabels[permission] ?? permission}</span></label>;
              })}</div>
            </fieldset>)}
            {!Object.keys(groupedPermissions).length && <p className="py-4 text-sm text-slate-600">Không tìm thấy quyền phù hợp.</p>}
          </div>
        </section>
      </Modal>}
    </> : <section className="space-y-4" aria-labelledby="roles-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="roles-heading" className="text-xl font-semibold">Bộ quyền của doanh nghiệp</h2>{can('agency:permissions-manage') && <button className={button} disabled={busy} onClick={() => editRole()}>Tạo role tùy chỉnh</button>}</div>
      <p className="max-w-3xl text-slate-600">Sửa một role sẽ cập nhật quyền kế thừa của mọi thành viên dùng role đó. Quyền riêng của từng người vẫn được giữ.</p>
      <ul className="divide-y divide-slate-200 rounded-xl bg-white px-5">{roleRows.map(role => <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-semibold">{role.name}</h3><p className="text-sm text-slate-600">{role.systemRole ? 'Role mặc định' : 'Role tùy chỉnh'} · {role.permissions.filter(p => permissions.includes(p)).length} quyền</p></div>
        {can('agency:permissions-manage') && role.id !== agency.roleId && role.systemRole !== agency.memberRole && (isOwner || role.systemRole !== 'OWNER') && <button className={secondary} disabled={busy} onClick={() => editRole(role)}>Sửa bộ quyền<span className="sr-only"> {role.name}</span></button>}</li>)}</ul>
      {roleDraft && <form className="space-y-4 rounded-xl bg-white p-5" onSubmit={event => { event.preventDefault(); void perform(() => saveRole(roleDraft).unwrap(), 'Đã lưu bộ quyền.'); }}>
        <h3 className="text-lg font-semibold">{roleDraft.id ? 'Chỉnh sửa role' : 'Role tùy chỉnh mới'}</h3>
        <label className="block max-w-lg space-y-1">Tên role<input required maxLength={80} className={field} value={roleDraft.name} onChange={e => setRoleDraft({ ...roleDraft, name: e.target.value })} /></label>
        <fieldset className="divide-y divide-slate-100"><legend className="mb-2 font-medium">Quyền được kế thừa</legend>{permissions.map(permission => {
          const locked = permission === 'agency:context-view' || (roleRows.find(r => r.id === roleDraft.id)?.systemRole === 'OWNER' && ownerControlPermissions.includes(permission));
          return <label key={permission} className="flex min-h-11 items-center gap-3 py-2"><input type="checkbox" className="h-5 w-5 accent-teal-700" checked={roleDraft.permissions.includes(permission)} disabled={busy || locked || (!can(permission) && !roleDraft.permissions.includes(permission))}
            onChange={e => setRoleDraft({ ...roleDraft, permissions: e.target.checked ? [...roleDraft.permissions, permission] : roleDraft.permissions.filter(p => p !== permission) })} /><span>{permissionLabels[permission] ?? permission}</span></label>;
        })}</fieldset>
        <div className="flex gap-2"><button className={button} disabled={busy}>Lưu bộ quyền</button><button type="button" className={secondary} disabled={busy} onClick={() => setRoleDraft(null)}>Hủy</button></div>
      </form>}
    </section>}
    </>}
  </main>;
}
