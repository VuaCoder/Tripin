'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { Modal } from '@/components/ui/Modal';
import { agencyContextApi, useAgencyContext } from './agencyContext';
import { ownerControlPermissions, permissionLabels } from './permissionLabels';
import { AgencyJoinPanel } from './AgencyJoinPanel';
import type { JoinCode } from './workplacesApi';
import { useTeamMembersQuery, useTeamRolesQuery, useTeamPermissionsQuery, useTeamInvitationsQuery, useSaveTeamRoleMutation,
  useSaveMemberAccessMutation, useChangeTeamMemberMutation, useInviteTeamMemberMutation, useRevokeTeamInvitationMutation,
  type TeamMember, type TeamRole, type PermissionOverride } from './teamApi';

const button = 'min-h-11 rounded-xl bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
const secondary = 'min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-teal-700';
const quiet = 'min-h-11 text-sm font-medium text-teal-800 underline underline-offset-4 disabled:opacity-50';
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
const draftOf = (member: TeamMember): Draft => ({ roleId: member.roleId, overrides: [...member.overrides] });
type Draft = { roleId: string; overrides: PermissionOverride[] };

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
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinCodeSecret, setJoinCodeSecret] = useState<{ agencyId: string; code: JoinCode } | null>(null);
  useEffect(() => { setJoinCodeSecret(null); }, [agencyId]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [confirmOwner, setConfirmOwner] = useState(false);
  const [statusPrompt, setStatusPrompt] = useState<{ memberId: string; status: TeamMember['status'] } | null>(null);
  const [roleDraft, setRoleDraft] = useState<{ id?: string; name: string; permissions: string[] } | null>(null);
  const [showRoles, setShowRoles] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const roleRows = roles.data ?? [];
  const permissions = catalog.data ?? [];
  const isOwner = agency?.memberRole === 'OWNER';
  const isPrimaryOwner = isOwner && agency?.isPrimaryOwner === true;

  async function perform(work: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      await work();
      await Promise.all([members.refetch().unwrap(), roles.refetch().unwrap(), invitations.refetch().unwrap()]);
      const refresh = dispatch(agencyContextApi.endpoints.agencyMemberships.initiate(undefined, { forceRefetch: true }));
      try { await refresh.unwrap(); } finally { refresh.unsubscribe(); }
      setNotice(message); return true;
    } catch (e) { setError(errorMessage(e)); return false; }
    finally { setBusy(false); }
  }
  const draftFor = (member: TeamMember) => drafts[member.id] ?? draftOf(member);
  function setDraft(member: TeamMember, next: Draft) {
    setDrafts(current => ({ ...current, [member.id]: next }));
  }
  function toggleMember(member: TeamMember) {
    setError(''); setStatusPrompt(null); setConfirmOwner(false);
    if (openId === member.id) { setOpenId(''); setDrafts(current => { const next = { ...current }; delete next[member.id]; return next; }); return; }
    setOpenId(member.id);
    setDrafts(current => ({ ...current, [member.id]: draftOf(member) }));
  }
  function toggleMemberPermission(member: TeamMember, permission: string, checked: boolean) {
    const draft = draftFor(member);
    const roleHasPermission = roleRows.find(r => r.id === draft.roleId)?.permissions.includes(permission) ?? false;
    const effect: 'INHERIT' | 'ALLOW' | 'DENY' = checked === roleHasPermission ? 'INHERIT' : checked ? 'ALLOW' : 'DENY';
    setDraft(member, { ...draft, overrides: [...draft.overrides.filter(o => o.permission !== permission), ...(effect === 'INHERIT' ? [] : [{ permission, effect }])] });
  }
  async function saveMember(member: TeamMember) {
    const draft = draftFor(member);
    const nextRole = roleRows.find(r => r.id === draft.roleId);
    const promotingOwner = member.role !== 'OWNER' && nextRole?.systemRole === 'OWNER';
    const demotingOwner = Boolean(member.role === 'OWNER' && nextRole?.systemRole && nextRole.systemRole !== 'OWNER');
    if (promotingOwner && !confirmOwner) { setConfirmOwner(true); return; }
    const work = promotingOwner ? () => changeMember({ id: member.id, role: 'OWNER' }).unwrap()
      : demotingOwner ? () => changeMember({ id: member.id, role: nextRole!.systemRole as 'MANAGER' | 'STAFF' | 'ACCOUNTANT' }).unwrap()
      : () => saveAccess({ id: member.id, roleId: draft.roleId, overrides: draft.overrides }).unwrap();
    const message = promotingOwner ? `Đã thêm ${member.user.fullName} làm Co_Owner.` : demotingOwner ? 'Đã đổi vai trò Co_Owner.' : 'Đã lưu quyền thành viên.';
    if (!await perform(work, message)) return;
    setOpenId(''); setConfirmOwner(false);
    setDrafts(current => { const next = { ...current }; delete next[member.id]; return next; });
  }
  function editRole(role?: TeamRole) {
    setError('');
    setRoleDraft(role ? { id: role.id, name: role.name, permissions: role.permissions.filter(p => permissions.includes(p)) }
      : { name: '', permissions: ['agency:context-view'] });
  }
  if (!agency || !can('agency:team-view')) return <p role="alert" className="p-6">Bạn không có quyền xem thành viên của doanh nghiệp này.</p>;
  const loading = members.isLoading || roles.isLoading || catalog.isLoading || invitations.isLoading;
  const loadError = members.isError || roles.isError || catalog.isError || invitations.isError;
  const groupedPermissions = permissions.reduce<Record<string, string[]>>((groups, permission) => {
    (groups[permissionGroup(permission)] ??= []).push(permission);
    return groups;
  }, {});
  const invitationRows = invitations.data ?? [];
  const visibleMembers = (members.data ?? []).filter(member => member.status !== 'REMOVED');
  const waitingInvitations = invitationRows.filter(inv => inv.status === 'PENDING' && new Date(inv.expiresAt) > new Date()).length;
  return <main className="mx-auto max-w-7xl space-y-7 p-4 text-slate-900 selection:bg-teal-100 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><h1 className="text-3xl font-bold tracking-tight">Thành viên & phân quyền</h1>
      <div className="flex flex-wrap items-center gap-2">{isOwner && <Link href="/agency/team/requests" className={secondary}>Yêu cầu tham gia</Link>}
        {isOwner && <button type="button" className={secondary} onClick={() => { setError(''); setShowJoinCode(true); }}>Mã mời</button>}</div></header>
    {notice && <p role="status" className="rounded-xl bg-teal-50 p-4 text-teal-900">{notice}</p>}
    {error && !openId && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {loading ? <p role="status">Đang tải đội ngũ…</p> : loadError ? <div role="alert"><p>Không tải được đội ngũ. Chưa có thay đổi nào được thực hiện.</p>
      <button className={secondary + ' mt-3'} onClick={() => { void members.refetch(); void roles.refetch(); void catalog.refetch(); void invitations.refetch(); }}>Thử lại</button></div> : <>
    {can('agency:team-invite') && <section aria-labelledby="invite-heading" className="rounded-xl bg-white p-5">
      <h2 id="invite-heading" className="text-xl font-semibold">Mời thành viên</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">Lời mời có hiệu lực 24 giờ. Người nhận đăng nhập bằng đúng email đã xác minh và chấp nhận tại Chọn nơi làm việc → Lời mời của tôi.</p>
      <form className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event: FormEvent) => { event.preventDefault(); setOpenId('');
        const role = roleRows.find(r => r.id === inviteRoleId);
        const invitedRole = role?.systemRole ?? 'STAFF';
        if (role && invitedRole !== 'OWNER') void perform(() => invite({ email: inviteEmail, roleId: role.id, role: invitedRole }).unwrap(), 'Đã tạo lời mời. Hệ thống sẽ gửi email thông báo.').then(ok => { if (ok) setInviteEmail(''); }); }}>
        <label className="space-y-1">Email<input type="email" required maxLength={254} className={field} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></label>
        <label className="space-y-1">Vai trò<select required className={field} value={inviteRoleId} onChange={e => setInviteRoleId(e.target.value)}><option value="">Chọn vai trò</option>
          {roleRows.filter(r => r.systemRole !== 'OWNER' && r.permissions.every(p => can(p))).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <button className={button} disabled={busy || !inviteRoleId}>Gửi lời mời</button>
      </form>
    </section>}
    <section aria-labelledby="members-heading" className="space-y-3">
      <h2 id="members-heading" className="text-xl font-semibold">Đội ngũ hiện tại</h2>
      <ul className="space-y-3">
        {visibleMembers.map(member => {
          const open = openId === member.id;
          const draft = draftFor(member);
          const canEditAccess = canManageMember(member, agency.memberId, isPrimaryOwner, can('agency:permissions-manage'));
          const canManageStatus = canManageMember(member, agency.memberId, isPrimaryOwner, can('agency:team-manage'));
          const selectedRole = roleRows.find(r => r.id === draft.roleId);
          const promotingOwner = member.role !== 'OWNER' && selectedRole?.systemRole === 'OWNER';
          const demotingOwner = Boolean(member.role === 'OWNER' && selectedRole?.systemRole && selectedRole.systemRole !== 'OWNER');
          const canAddOwner = member.status === 'ACTIVE' && member.role !== 'OWNER' && isPrimaryOwner && canEditAccess && canManageStatus;
          return <li key={member.id} className="rounded-xl bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-lg font-semibold">{member.user.fullName}{member.id === agency.memberId ? ' (bạn)' : ''}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">{member.roleName}</span>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${member.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{statusLabels[member.status]}</span>
                  <span className="text-sm text-slate-500">{member.permissions.length} quyền · {member.overrides.length} tùy chỉnh riêng</span>
                </div>
              </div>
              <button type="button" className={secondary} aria-expanded={open} aria-controls={`member-${member.id}`} disabled={busy} onClick={() => toggleMember(member)}>
                {canEditAccess || canManageStatus ? 'Phân quyền' : 'Xem quyền'}<span className="sr-only"> {member.user.fullName}</span></button>
            </div>
            {open && <section id={`member-${member.id}`} aria-label={`Phân quyền ${member.user.fullName}`} className="mt-5 space-y-5 border-t border-slate-100 pt-5">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500">Email</dt><dd className="mt-1 break-all font-medium text-slate-900">{member.user.email}</dd></div>
                <div><dt className="text-slate-500">Số điện thoại</dt><dd className="mt-1 font-medium text-slate-900">{member.user.phone || 'Chưa cập nhật'}</dd></div>
                <div><dt className="text-slate-500">Xác minh email</dt><dd className="mt-1 font-medium text-slate-900">{member.user.emailVerifiedAt ? 'Đã xác minh' : 'Chưa xác minh'}</dd></div>
                <div><dt className="text-slate-500">Ngày tham gia</dt><dd className="mt-1 font-medium text-slate-900">{memberDate(member.createdAt)}</dd></div>
              </dl>
              <fieldset><legend className="mb-3 font-semibold">Vai trò</legend><div className="grid gap-2 sm:grid-cols-2">
                {roleRows.filter(role => !canEditAccess ? role.id === member.roleId : member.role === 'OWNER' ? Boolean(role.systemRole) : role.systemRole !== 'OWNER' || canAddOwner).map(role => <label key={role.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:disabled]:cursor-default has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700">
                  <input type="radio" name={`member-role-${member.id}`} value={role.id} checked={draft.roleId === role.id} disabled={busy || !canEditAccess} className="peer sr-only" onChange={() => { setDraft(member, { roleId: role.id, overrides: [] }); setConfirmOwner(false); }} />
                  <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-transparent peer-checked:border-teal-700 peer-checked:bg-teal-700 peer-checked:text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                  <span className="text-sm font-medium">{role.systemRole === 'OWNER' ? member.isPrimaryOwner ? 'Owner' : 'Co_Owner' : role.name}</span>
                </label>)}
              </div></fieldset>
              {promotingOwner && confirmOwner && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Cấp toàn quyền quản lý cho <strong className="break-all">{member.user.email}</strong>? Bạn vẫn là Owner và có thể hạ vai trò người này.</p>}
              <div className="space-y-3" role="group" aria-label="Quyền chi tiết">
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Quyền chi tiết</h4>
                  {canEditAccess && !promotingOwner && member.role !== 'OWNER' && <button type="button" className={quiet} disabled={busy} onClick={() => setDraft(member, { ...draft, overrides: [] })}>Đặt lại theo vai trò</button>}</div>
                {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
                {Object.entries(groupedPermissions).map(([group, groupPermissions]) => <fieldset key={group} className="min-w-0 border-t border-slate-200 pt-3">
                  <legend className="pr-3 text-sm font-semibold text-slate-700">{permissionGroupLabels[group] ?? group}</legend>
                  <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{groupPermissions.map(permission => {
                    const override = draft.overrides.find(item => item.permission === permission);
                    const protectedPermission = permission === 'agency:context-view' || (member.role === 'OWNER' && !demotingOwner && ownerControlPermissions.includes(permission));
                    const effective = Boolean(protectedPermission || (override ? override.effect === 'ALLOW' : selectedRole?.permissions.includes(permission)));
                    const cannotGrant = !effective && !can(permission);
                    return <label key={permission} className="flex min-h-11 items-start gap-3 rounded-lg px-2 py-3 hover:bg-slate-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal-700">
                      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-teal-700 disabled:cursor-not-allowed" aria-label={permissionLabels[permission] ?? permission} checked={effective} disabled={busy || !canEditAccess || protectedPermission || cannotGrant || promotingOwner || member.role === 'OWNER'} onChange={e => toggleMemberPermission(member, permission, e.target.checked)} />
                      <span className="min-w-0 text-sm leading-6">{permissionLabels[permission] ?? permission}</span></label>;
                  })}</div>
                </fieldset>)}
              </div>
              <div className="flex flex-wrap gap-2">
                {canEditAccess && <button className={button} disabled={busy || !draft.roleId || (promotingOwner && !canAddOwner) || (member.role === 'OWNER' && !demotingOwner)} onClick={() => void saveMember(member)}>
                  {busy ? 'Đang cập nhật…' : promotingOwner && confirmOwner ? 'Xác nhận thêm Co_Owner' : 'Lưu thay đổi'}</button>}
                <button className={secondary} disabled={busy} onClick={() => toggleMember(member)}>{canEditAccess ? 'Hủy' : 'Đóng'}</button>
              </div>
              {canManageStatus && <div className="space-y-3 border-t border-slate-100 pt-4" role="group" aria-label="Trạng thái thành viên">
                <h4 className="font-semibold">Trạng thái thành viên</h4>
                <div className="flex flex-wrap gap-2">
                  <button className={secondary} disabled={busy} onClick={() => setStatusPrompt({ memberId: member.id, status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}>
                    {member.status === 'ACTIVE' ? 'Đình chỉ thành viên' : member.status === 'SUSPENDED' ? 'Kích hoạt thành viên' : 'Khôi phục thành viên'}</button>
                  {member.status !== 'REMOVED' && <button className={secondary} disabled={busy} onClick={() => setStatusPrompt({ memberId: member.id, status: 'REMOVED' })}>Gỡ khỏi doanh nghiệp</button>}
                </div>
                {statusPrompt?.memberId === member.id && <div className="space-y-3 rounded-lg bg-slate-50 p-4" role="group" aria-label="Xác nhận thay đổi trạng thái">
                  <p>Xác nhận chuyển {member.user.fullName} sang “{statusLabels[statusPrompt.status]}”?</p>
                  <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => void perform(() => changeMember({ id: member.id, status: statusPrompt.status }).unwrap(), 'Đã cập nhật trạng thái thành viên.').then(ok => { if (ok) { setStatusPrompt(null); setOpenId(''); } })}>Xác nhận</button>
                    <button className={secondary} disabled={busy} onClick={() => setStatusPrompt(null)}>Hủy</button></div>
                </div>}
              </div>}
            </section>}
          </li>;
        })}
      </ul>
      {!visibleMembers.length && <p className="rounded-xl bg-white p-5 text-slate-600">Chưa có thành viên nào.</p>}
    </section>
    <section aria-labelledby="invitations-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="invitations-heading" className="text-xl font-semibold">Lời mời đã gửi</h2><span className="text-sm text-slate-500">{waitingInvitations} đang chờ</span></div>
      <ul className="divide-y divide-slate-200 rounded-xl bg-white px-4">{invitationRows.map(inv => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={inv.id}>
        <div className="min-w-0"><p className="break-all font-medium">{inv.email}</p><p className="text-sm text-slate-600">{roleRows.find(r => r.id === inv.roleId)?.name ?? inv.role} · {invitationStatusLabels[inv.status === 'PENDING' && new Date(inv.expiresAt) <= new Date() ? 'EXPIRED' : inv.status] ?? inv.status}</p><p className="text-xs text-slate-500">Hết hạn {new Date(inv.expiresAt).toLocaleString('vi-VN')}</p></div>
        {inv.status === 'PENDING' && can('agency:team-manage') && <button className={secondary} disabled={busy} onClick={() => { setOpenId(''); void perform(() => revoke(inv.id).unwrap(), 'Đã thu hồi lời mời.'); }}>Thu hồi</button>}
      </li>)}</ul>
      {!invitationRows.length && <p className="rounded-xl bg-white p-5 text-slate-600">Chưa có lời mời nào.</p>}
    </section>
    <section className="rounded-xl bg-white p-5">
      <button type="button" className="text-xl font-semibold" aria-expanded={showRoles} onClick={() => setShowRoles(current => !current)}>Role & bộ quyền</button>
      {showRoles && <>
      <p className="mt-3 max-w-3xl text-slate-600">Sửa một role sẽ cập nhật quyền kế thừa của mọi thành viên dùng role đó. Quyền riêng của từng người vẫn được giữ.</p>
      {can('agency:permissions-manage') && <button className={button + ' mt-3'} disabled={busy} onClick={() => editRole()}>Tạo role tùy chỉnh</button>}
      <ul className="mt-3 divide-y divide-slate-200">{roleRows.map(role => <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-semibold">{role.name}</h3><p className="text-sm text-slate-600">{role.systemRole ? 'Role mặc định' : 'Role tùy chỉnh'} · {role.permissions.filter(p => permissions.includes(p)).length} quyền</p></div>
        {can('agency:permissions-manage') && role.id !== agency.roleId && role.systemRole !== agency.memberRole && (isOwner || role.systemRole !== 'OWNER') && <button className={secondary} disabled={busy} onClick={() => editRole(role)}>Sửa bộ quyền<span className="sr-only"> {role.name}</span></button>}</li>)}</ul>
      {roleDraft && <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); setOpenId(''); void perform(() => saveRole(roleDraft).unwrap(), 'Đã lưu bộ quyền.').then(ok => { if (ok) setRoleDraft(null); }); }}>
        <h3 className="text-lg font-semibold">{roleDraft.id ? 'Chỉnh sửa role' : 'Role tùy chỉnh mới'}</h3>
        <label className="block max-w-lg space-y-1">Tên role<input required maxLength={80} className={field} value={roleDraft.name} onChange={e => setRoleDraft({ ...roleDraft, name: e.target.value })} /></label>
        <fieldset className="divide-y divide-slate-100"><legend className="mb-2 font-medium">Quyền được kế thừa</legend>{permissions.map(permission => {
          const locked = permission === 'agency:context-view' || (roleRows.find(r => r.id === roleDraft.id)?.systemRole === 'OWNER' && ownerControlPermissions.includes(permission));
          return <label key={permission} className="flex min-h-11 items-center gap-3 py-2"><input type="checkbox" className="h-5 w-5 accent-teal-700" checked={roleDraft.permissions.includes(permission)} disabled={busy || locked || (!can(permission) && !roleDraft.permissions.includes(permission))}
            onChange={e => setRoleDraft({ ...roleDraft, permissions: e.target.checked ? [...roleDraft.permissions, permission] : roleDraft.permissions.filter(p => p !== permission) })} /><span>{permissionLabels[permission] ?? permission}</span></label>;
        })}</fieldset>
        <div className="flex gap-2"><button className={button} disabled={busy}>Lưu bộ quyền</button><button type="button" className={secondary} disabled={busy} onClick={() => setRoleDraft(null)}>Hủy</button></div>
      </form>}
      </>}
    </section>
    </>}
    {showJoinCode && <Modal open onClose={() => setShowJoinCode(false)} title="Mã mời tham gia" className="max-w-md"><AgencyJoinPanel active secret={joinCodeSecret?.agencyId === agencyId ? joinCodeSecret.code : null} onSecretChange={code => setJoinCodeSecret(code ? { agencyId, code } : null)} /></Modal>}
  </main>;
}
