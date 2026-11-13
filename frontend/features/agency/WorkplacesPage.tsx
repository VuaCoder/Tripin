'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '@/store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, Copy, Search, Users } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAgency } from '@/features/auth/store/authSlice';
import { authNextPath } from '@/features/auth/utils/safeNextPath';
import { agencyContextApi, useAgencyMembershipsQuery } from './agencyContext';
import { WorkplaceFrame } from './WorkplaceFrame';
import { workplaceHome } from './workplaceHome';
import { JoinWorkplaceDialog } from './JoinWorkplaceDialog';
import { workplacesApi, useMyJoinRequestsQuery, useCancelJoinRequestMutation, useMyAgencyInvitationsQuery, useAcceptPersonalInvitationMutation, workplaceError, type PersonalInvitation, type JoinRequest } from './workplacesApi';
import styles from './Workplace.module.css';

export { WorkplaceFrame } from './WorkplaceFrame';
export { CreateWorkplacePage } from './WorkplaceWizard';

const verificationLabels: Record<string, string> = { VERIFIED: 'Đã xác minh', UNVERIFIED: 'Chưa hoàn tất hồ sơ', PENDING: 'Chờ xác minh', REJECTED: 'Cần sửa hồ sơ', INFORMATION_REQUESTED: 'Cần bổ sung hồ sơ' };
const roleLabels: Record<string, string> = { OWNER: 'Owner', owner: 'Owner', co_owner: 'Co_Owner', MANAGER: 'Quản lý', STAFF: 'Nhân viên', ACCOUNTANT: 'Kế toán', 'Agency Owner': 'Owner', 'Agency Manager': 'Quản lý', 'Agency Staff': 'Nhân viên', 'Agency Accountant': 'Kế toán' };
const requestLabels: Record<string, string> = { PENDING: 'Đang chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối', CANCELLED: 'Đã hủy' };

export function WorkplacesPage({ nextPath, openJoin = false }: { nextPath?: string; openJoin?: boolean }) {
  const status = useAppSelector(s => s.auth.status);
  const user = useAppSelector(s => s.auth.user);
  const agencies = useAgencyMembershipsQuery(undefined, { skip: status !== 'authenticated', pollingInterval: 15000, refetchOnFocus: true, refetchOnReconnect: true, refetchOnMountOrArgChange: true });
  const [page, setPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);
  const invitations = useMyAgencyInvitationsQuery(invitePage, { skip: status !== 'authenticated', pollingInterval: 15000, refetchOnFocus: true, refetchOnReconnect: true });
  const [acceptInvitation] = useAcceptPersonalInvitationMutation();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const acceptLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const identity = useRef({ userId: user?.id, version: 0 });
  if (identity.current.userId !== user?.id) identity.current = { userId: user?.id, version: identity.current.version + 1 };
  const store = useStore();
  const requests = useMyJoinRequestsQuery(page, { skip: status !== 'authenticated', pollingInterval: 15000, refetchOnFocus: true });
  const [cancel, cancelling] = useCancelJoinRequestMutation();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showJoin, setShowJoin] = useState(openJoin);
  const joinTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (openJoin) setShowJoin(true); }, [openJoin]);
  useEffect(() => { acceptLock.current = false; setAcceptingId(null); setError(''); setNotice(''); setInvitePage(1); }, [user?.id]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'memberships' | 'invitations' | 'requests'>('memberships');
  const dispatch = useAppDispatch();
  const router = useRouter();
  const closeJoin = (submitted = false) => {
    setShowJoin(false);
    if (openJoin) router.replace('/workplaces' + (nextPath ? '?next=' + encodeURIComponent(nextPath) : ''));
    setTimeout(() => { if (submitted) document.getElementById('requests-tab')?.focus(); else joinTrigger.current?.focus(); }, 0);
  };
  const submittedJoin = (request: JoinRequest) => {
    closeJoin(true); setError(''); setNotice(`Đã gửi yêu cầu tới ${request.agency.companyName ?? 'doanh nghiệp'}. Vui lòng chờ duyệt.`);
    setPage(1); setTab('requests');
    void dispatch(workplacesApi.endpoints.myJoinRequests.initiate(1, { forceRefetch: true, subscribe: false }));
  };
  const rows = agencies.currentData ?? [];
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const filtered = rows.filter(a => normalize(a.companyName ?? '').includes(normalize(search)));
  const showRequests = Boolean(requests.currentData?.length || page > 1 || requests.isError || tab === 'requests');
  const tabs = ['memberships', 'invitations', ...(showRequests ? ['requests'] : [])] as const;
  const tabIds = { memberships: 'workplaces-tab', invitations: 'invitations-tab', requests: 'requests-tab' };
  const accept = async (invitation: PersonalInvitation) => {
    if (acceptLock.current) return;
    acceptLock.current = true; setAcceptingId(invitation.id); setError(''); setNotice('');
    const actor = user?.id;
    const version = identity.current.version;
    const stillHere = () => mounted.current && identity.current.version === version && (store.getState() as RootState).auth.user?.id === actor;
    try {
      await acceptInvitation(invitation.id).unwrap();
      if (!stillHere()) return;
      setNotice(`Bạn đã tham gia ${invitation.agency.companyName ?? 'doanh nghiệp'}.`);
      setTab('memberships');
      document.getElementById('workplaces-tab')?.focus();
      // Membership updates may reset all private queries through agencyEpoch.
      // Refresh personal data afterwards; never reuse a stale refetch handle.
      try { await dispatch(agencyContextApi.endpoints.agencyMemberships.initiate(undefined, { forceRefetch: true, subscribe: false })).unwrap(); }
      catch { if (stillHere()) setError('Đã chấp nhận lời mời nhưng chưa tải được doanh nghiệp. Bấm Thử lại ở danh sách bên dưới.'); }
      if (!stillHere()) return;
      await Promise.allSettled([
        dispatch(workplacesApi.endpoints.myAgencyInvitations.initiate(invitePage, { forceRefetch: true, subscribe: false })).unwrap(),
        dispatch(workplacesApi.endpoints.myJoinRequests.initiate(page, { forceRefetch: true, subscribe: false })).unwrap(),
      ]);
    } catch (e) {
      if (stillHere()) {
        setError(workplaceError(e));
        void dispatch(workplacesApi.endpoints.myAgencyInvitations.initiate(invitePage, { forceRefetch: true, subscribe: false }));
      }
    } finally {
      if (stillHere()) { acceptLock.current = false; setAcceptingId(null); }
    }
  };
  return <WorkplaceFrame>
    <header className={styles.heading}><div><h1 className={styles.title}>Chọn nơi làm việc</h1><p className={styles.description}>Mỗi doanh nghiệp có dữ liệu và quyền truy cập riêng.</p></div>
      <div className={styles.actions}><button ref={joinTrigger} type="button" className={styles.button} onClick={() => setShowJoin(true)}>Nhập mã mời</button><Link className={styles.primary} href="/workplaces/new"><Building2 size={17} aria-hidden="true" />Tạo doanh nghiệp</Link></div>
    </header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.tabs} role="tablist" aria-label="Nơi làm việc, lời mời và yêu cầu" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = tabs.indexOf(tab);
      const target = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length] as typeof tab;
      setTab(target); document.getElementById(tabIds[target])?.focus();
    }}>
      <button id="workplaces-tab" role="tab" tabIndex={tab === 'memberships' ? 0 : -1} aria-selected={tab === 'memberships'} aria-controls="workplaces-panel" className={styles.tab + (tab === 'memberships' ? ' ' + styles.activeTab : '')} onClick={() => setTab('memberships')}>Doanh nghiệp{agencies.isSuccess ? ' (' + rows.length + ')' : ''}</button>
      <button id="invitations-tab" role="tab" tabIndex={tab === 'invitations' ? 0 : -1} aria-selected={tab === 'invitations'} aria-controls="invitations-panel" className={styles.tab + (tab === 'invitations' ? ' ' + styles.activeTab : '')} onClick={() => setTab('invitations')}>Lời mời của tôi{invitations.isSuccess && invitations.currentData ? ` (${invitations.currentData.total})` : ''}</button>
      {showRequests && <button id="requests-tab" role="tab" tabIndex={tab === 'requests' ? 0 : -1} aria-selected={tab === 'requests'} aria-controls="requests-panel" className={styles.tab + (tab === 'requests' ? ' ' + styles.activeTab : '')} onClick={() => setTab('requests')}>Yêu cầu đã gửi</button>}
    </div>
    {tab === 'memberships' ? <section id="workplaces-panel" role="tabpanel" aria-labelledby="workplaces-tab">
      <div className={styles.search}><Search size={19} aria-hidden="true" /><input className={styles.input} aria-label="Tìm doanh nghiệp" placeholder="Tìm doanh nghiệp…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      {agencies.isLoading ? <p role="status" className={styles.description}>Đang tải doanh nghiệp…</p> : agencies.isError ? <div role="alert" className={styles.error}>Không tải được nơi làm việc. <button className={styles.textButton} onClick={() => void agencies.refetch()}>Thử lại</button></div>
        : !rows.length ? <div className={styles.empty}><Building2 size={38} aria-hidden="true" /><h2>Bạn chưa có nơi làm việc nào</h2><p>Gửi email <strong>{user?.email}</strong> cho người quản lý để nhận lời mời. Bạn cũng có thể nhập mã mời hoặc tạo doanh nghiệp mới.</p>
          <div className={styles.actions}><button className={styles.button} onClick={async () => { try { if (user?.email) { await navigator.clipboard.writeText(user.email); setNotice('Đã sao chép email.'); } } catch { setError('Không sao chép được. Bạn có thể chọn email ở trên để sao chép thủ công.'); } }}><Copy size={16} aria-hidden="true" />Sao chép email của tôi</button></div></div>
        : !filtered.length ? <div className={styles.empty}><Search size={32} aria-hidden="true" /><h2>Không tìm thấy doanh nghiệp</h2><p>Thử một tên khác hoặc xóa từ khóa để xem tất cả.</p><button className={styles.textButton} onClick={() => setSearch('')}>Xóa tìm kiếm</button></div>
        : <ul className={styles.list}>{filtered.map(a => <li key={a.agencyId} className={styles.row}>
          <div className={styles.company}><span className={styles.avatar} aria-hidden="true">{(a.companyName ?? 'D').slice(0,1).toUpperCase()}</span><h3>{a.companyName || 'Doanh nghiệp'}</h3></div>
          <span className={styles.meta}>{roleLabels[a.roleName ?? a.memberRole] ?? a.roleName ?? a.memberRole}</span>
          <span className={styles.badge + (a.verificationStatus !== 'VERIFIED' ? ' ' + styles.pending : '')}>{verificationLabels[a.verificationStatus] ?? 'Đang cập nhật'}</span>
          <button className={styles.button} onClick={() => { dispatch(selectAgency(a.agencyId)); const target = authNextPath(nextPath ?? null, workplaceHome(a)); router.push(target); }}>Mở doanh nghiệp<span className="sr-only"> {a.companyName}</span><ArrowRight size={16} aria-hidden="true" /></button>
        </li>)}</ul>}
    </section> : tab === 'invitations' ? <section id="invitations-panel" role="tabpanel" aria-labelledby="invitations-tab">
      <p className={styles.invitationHelp}>Lời mời được gửi đến <strong>{user?.email}</strong>. Chấp nhận để tham gia doanh nghiệp với vai trò được chỉ định.</p>
      {invitations.isLoading ? <p role="status">Đang tải lời mời…</p> : invitations.isError ? <div role="alert" className={styles.error}>Không tải được lời mời. <button className={styles.textButton} onClick={() => void invitations.refetch()}>Thử lại</button></div>
        : !invitations.currentData?.items?.length ? <div className={styles.empty}><h2>{invitePage > 1 ? 'Không còn lời mời ở trang này' : 'Bạn chưa có lời mời nào'}</h2><p>Người quản lý có thể mời bạn bằng email {user?.email}.</p></div>
        : <ul className={styles.list}>{invitations.currentData.items.map(inv => <li key={inv.id} className={`${styles.row} ${styles.invitationRow}`}>
          <div className={styles.company}><span className={styles.avatar} aria-hidden="true"><Building2 size={20} /></span><h3>{inv.agency.companyName ?? 'Doanh nghiệp'}</h3></div>
          <span className={styles.meta}>{roleLabels[inv.roleName] ?? inv.roleName}</span>
          <span className={styles.meta}>Hết hạn <time dateTime={inv.expiresAt}>{new Date(inv.expiresAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</time></span>
          <button className={styles.primary} disabled={acceptingId !== null} onClick={() => void accept(inv)}>{acceptingId === inv.id ? 'Đang tham gia…' : 'Chấp nhận lời mời'}<span className="sr-only"> {inv.agency.companyName}</span></button>
        </li>)}</ul>}
      {(invitePage > 1 || (invitations.currentData?.total ?? 0) > 20) && <div className={styles.footer}><button className={styles.button} disabled={invitePage === 1 || invitations.isFetching || acceptingId !== null} onClick={() => setInvitePage(invitePage - 1)}>Trang trước</button><span className={styles.meta}>Trang {invitePage}</span><button className={styles.button} disabled={!invitations.currentData || invitePage * 20 >= invitations.currentData.total || invitations.isFetching || acceptingId !== null} onClick={() => setInvitePage(invitePage + 1)}>Trang sau</button></div>}
    </section> : <section id="requests-panel" role="tabpanel" aria-labelledby="requests-tab">
      {requests.isLoading ? <p role="status">Đang tải yêu cầu…</p> : requests.isError ? <div role="alert" className={styles.error}>Không tải được yêu cầu. <button className={styles.textButton} onClick={() => void requests.refetch()}>Thử lại</button></div>
        : !requests.currentData?.length ? <div className={styles.empty}><h2>Chưa có yêu cầu ở trang này</h2></div> : <ul className={styles.list}>{requests.currentData.map(r => <li key={r.id} className={styles.row}><div className={styles.company}><span className={styles.avatar} aria-hidden="true"><Users size={20} /></span><h3>{r.agency.companyName}</h3></div><span className={styles.meta}>{new Date(r.createdAt).toLocaleDateString('vi-VN')}</span><span className={styles.badge + (r.status === 'PENDING' ? ' ' + styles.pending : '')}>{requestLabels[r.status] ?? r.status}</span>{r.status === 'PENDING' && <button className={styles.button} disabled={cancelling.isLoading} onClick={async () => { setError(''); try { await cancel(r.id).unwrap(); await requests.refetch(); } catch (e) { setError(workplaceError(e)); } }}>Hủy yêu cầu</button>}</li>)}</ul>}
      {(page > 1 || (requests.currentData?.length ?? 0) >= 20) && <div className={styles.footer}><button className={styles.button} disabled={page === 1 || requests.isFetching} onClick={() => setPage(page - 1)}>Trang trước</button><span className={styles.meta}>Trang {page}</span><button className={styles.button} disabled={(requests.currentData?.length ?? 0) < 20 || requests.isFetching} onClick={() => setPage(page + 1)}>Trang sau</button></div>}
    </section>}
    {showJoin && <JoinWorkplaceDialog key={user?.id} onClose={() => closeJoin()} onSubmitted={submittedJoin} />}
  </WorkplaceFrame>;
}
