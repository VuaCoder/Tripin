'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useLogoutMutation } from '@/features/auth/api/authApi';
import { clearCredentials } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { agencyContextApi } from './agencyContext';
import { useAcceptTeamInvitationMutation } from './teamApi';

export function AgencyInvitationAcceptPage() {
  const token = useSearchParams().get('token') ?? '';
  const status = useAppSelector(state => state.auth.status);
  const user = useAppSelector(state => state.auth.user);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [logout, logoutState] = useLogoutMutation();
  const [accept, request] = useAcceptTeamInvitationMutation();
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const valid = /^[a-f0-9]{64}$/.test(token);
  const next = '/agency/invitations/accept?token=' + encodeURIComponent(token);
  async function submit() {
    setError('');
    try {
      await accept(token).unwrap();
      const refresh = dispatch(agencyContextApi.endpoints.agencyMemberships.initiate(undefined, { forceRefetch: true }));
      try { await refresh.unwrap(); } finally { refresh.unsubscribe(); }
      setDone(true);
      // The secret is no longer useful; remove it from browser history after acceptance.
      window.history.replaceState(null, '', '/agency/invitations/accept');
    } catch { setError('Không thể nhận lời mời. Kiểm tra đúng email đã xác minh; lời mời có thể đã hết hạn, bị thu hồi hoặc bạn đã là thành viên.'); }
  }
  return <main className="mx-auto max-w-xl space-y-5 p-6 text-slate-900 sm:py-16">
    <h1 className="text-3xl font-bold">Lời mời tham gia doanh nghiệp</h1>
    {done ? <><p role="status">Đã tham gia doanh nghiệp. Tài khoản cá nhân của bạn được giữ nguyên.</p><Link className="font-semibold text-teal-800 underline" href="/workplaces">Mở Nơi làm việc</Link></>
      : !valid ? <p role="alert">Liên kết không hợp lệ. Hãy mở đầy đủ liên kết trong email hoặc nhờ người mời gửi lại.</p>
      : status === 'idle' ? <p role="status">Đang kiểm tra phiên đăng nhập…</p>
      : status !== 'authenticated' ? <><p>Dùng đúng email nhận lời mời để đăng nhập hoặc tạo tài khoản.</p><Link className="block font-semibold text-teal-800 underline" href={'/agency/login?next=' + encodeURIComponent(next)}>Đăng nhập để tiếp tục</Link><Link className="block font-semibold text-teal-800 underline" href={'/agency/register?next=' + encodeURIComponent(next)}>Tạo tài khoản để nhận lời mời</Link></>
      : <><p>Bạn đang dùng email <strong className="break-all">{user?.email}</strong>. Hãy chấp nhận bằng đúng email được mời.</p>
        {error && <p role="alert" className="text-red-800">{error}</p>}
        <button className="min-h-11 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" disabled={request.isLoading || logoutState.isLoading} onClick={() => void submit()}>{request.isLoading ? 'Đang chấp nhận…' : 'Chấp nhận lời mời'}</button>
        <button className="block min-h-11 font-semibold text-teal-800 underline" disabled={request.isLoading || logoutState.isLoading} onClick={async () => { setError(''); try { await logout().unwrap(); dispatch(clearCredentials()); router.replace('/agency/login?next=' + encodeURIComponent(next)); } catch { setError('Chưa đổi tài khoản được. Vui lòng thử lại.'); } }}>{logoutState.isLoading ? 'Đang chuyển…' : 'Dùng tài khoản khác'}</button></>}
  </main>;
}
