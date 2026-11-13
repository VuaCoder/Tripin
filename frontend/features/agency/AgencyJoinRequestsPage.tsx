'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAgencyContext } from './agencyContext';
import { useTeamRolesQuery } from './teamApi';
import { useReviewJoinRequestMutation, useTeamJoinRequestsQuery, workplaceError } from './workplacesApi';
import { agencyButton, agencyInput } from './AgencyCommon';

export function AgencyJoinRequestsPage() {
  const agency = useAgencyContext();
  const owner = agency?.memberRole === 'OWNER';
  const [page, setPage] = useState(1);
  const [roleIds, setRoleIds] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{ id: string; roleId?: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requests = useTeamJoinRequestsQuery({ agencyId: agency?.agencyId ?? '', page }, { skip: !owner, pollingInterval: 15000 });
  const roles = useTeamRolesQuery(agency?.agencyId ?? '', { skip: !owner });
  const [review, reviewing] = useReviewJoinRequestMutation();
  useEffect(() => { setPage(1); setRoleIds({}); setConfirmation(null); }, [agency?.agencyId]);
  if (!agency || !owner) return <main className="mx-auto max-w-5xl p-6"><p role="alert">Chỉ chủ doanh nghiệp mới có thể xem và xử lý yêu cầu tham gia.</p><Link className="mt-4 inline-block underline" href="/agency/team">Quay lại đội ngũ</Link></main>;
  const eligible = roles.currentData?.filter(r => r.systemRole !== 'OWNER' && r.permissions.every(p => agency.permissions.includes(p))) ?? [];
  const busy = reviewing.isLoading;
  async function submitReview() {
    if (!confirmation) return;
    setError(''); setNotice('');
    try {
      await review(confirmation).unwrap();
      setConfirmation(null);
      await Promise.all([requests.refetch(), roles.refetch()]);
      setNotice('Đã xử lý yêu cầu tham gia.');
    } catch (e) { setError(workplaceError(e)); }
  }
  return <main className="mx-auto max-w-5xl space-y-6 p-4 text-slate-900 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold tracking-tight">Yêu cầu tham gia</h1><p className="mt-2 text-slate-600">Xem thông tin người đăng ký, chọn role rồi duyệt hoặc từ chối.</p></div>
      <Link className={agencyButton} href="/agency/team">Quay lại thành viên</Link>
    </header>
    {notice && <p role="status" className="rounded-lg bg-teal-50 p-3 text-teal-900">{notice}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {requests.isLoading || roles.isLoading ? <p role="status">Đang tải yêu cầu…</p> : requests.isError || roles.isError ? <p role="alert">Không tải được yêu cầu hoặc danh sách role. <button className="underline" onClick={() => { void requests.refetch(); void roles.refetch(); }}>Thử lại</button></p> : !requests.currentData?.length ? <section className="rounded-xl bg-white p-6"><h2 className="font-semibold">Chưa có yêu cầu đang chờ</h2><p className="mt-1 text-sm text-slate-600">Khi nhân viên gửi yêu cầu bằng mã tham gia, yêu cầu sẽ xuất hiện tại đây.</p></section> : <>
      <ul className="divide-y divide-slate-200 rounded-xl bg-white px-5">{requests.currentData.map(request => <li key={request.id} className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)_auto] md:items-center">
        <div className="min-w-0"><p className="font-semibold">{request.user?.fullName ?? 'Tài khoản Tripin'}</p><p className="break-all text-sm text-slate-600">{request.user?.email ?? 'Không có email'}</p><p className="mt-1 text-xs text-slate-500">Gửi lúc {new Date(request.createdAt).toLocaleString('vi-VN')}</p></div>
        <label className="block space-y-1 text-sm">Vai trò khi duyệt<select aria-label={`Vai trò cho ${request.user?.fullName ?? 'thành viên'}`} className={agencyInput} disabled={busy} value={roleIds[request.id] ?? ''} onChange={event => setRoleIds({ ...roleIds, [request.id]: event.target.value })}><option value="">Chọn vai trò</option>{eligible.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
        <div className="flex flex-wrap gap-2"><button className={agencyButton} disabled={busy || !roleIds[request.id]} onClick={() => setConfirmation({ id: request.id, roleId: roleIds[request.id] })}>Duyệt</button><button className={agencyButton} disabled={busy} onClick={() => setConfirmation({ id: request.id })}>Từ chối</button></div>
      </li>)}</ul>
      <div className="flex items-center gap-3"><button className={agencyButton} disabled={page <= 1 || requests.isFetching} onClick={() => setPage(page - 1)}>Trang trước</button><span aria-live="polite">Trang {page}</span><button className={agencyButton} disabled={(requests.currentData?.length ?? 0) < 20 || requests.isFetching} onClick={() => setPage(page + 1)}>Trang sau</button></div>
    </>}
    {confirmation && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4" role="group" aria-label="Xác nhận xử lý yêu cầu"><p>{confirmation.roleId ? `Duyệt yêu cầu với role ${eligible.find(role => role.id === confirmation.roleId)?.name}?` : 'Từ chối yêu cầu tham gia này?'}</p><div className="flex gap-2"><button className={agencyButton} disabled={busy} onClick={() => void submitReview()}>Xác nhận</button><button className={agencyButton} disabled={busy} onClick={() => setConfirmation(null)}>Hủy</button></div></div>}
  </main>;
}
