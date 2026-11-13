'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearCredentials } from '@/features/auth/store/authSlice';
import { useLogoutMutation } from '@/features/auth/api/authApi';
import { baseApi } from '@/store/api/baseApi';
import styles from './Workplace.module.css';

export function WorkplaceFrame({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  const status = useAppSelector(s => s.auth.status);
  const user = useAppSelector(s => s.auth.user);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [logout, state] = useLogoutMutation();
  const [error, setError] = useState('');
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/agency/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
  }, [status, router]);
  return <main className={styles.page}>
    <header className={styles.topbar}>
      <Link className={styles.brand} href="/workplaces" aria-label="Tripri Partner — Nơi làm việc"><img src="/images/tripri-logo.png" alt="Tripri" /><span>PARTNER</span></Link>
      {status === 'authenticated' && <div className={styles.account}><span title={user?.email}>{user?.email}</span><button type="button" data-workplace-leave disabled={state.isLoading} className={styles.actions} onClick={async () => {
        setError('');
        try { await logout().unwrap(); dispatch(clearCredentials()); dispatch(baseApi.util.resetApiState()); router.replace('/agency/login'); }
        catch { setError('Chưa đăng xuất được. Vui lòng thử lại.'); }
      }}><LogOut size={16} aria-hidden="true" />{state.isLoading ? 'Đang đăng xuất…' : 'Đăng xuất'}</button></div>}
    </header>
    <div className={`${styles.content} ${narrow ? styles.narrow : ''}`}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {status === 'authenticated' ? children : <p role="status" className={styles.description}>Đang kiểm tra phiên đăng nhập…</p>}
    </div>
  </main>;
}
