'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agencyAuthApi } from './api';
import type { AgencyUser } from './types';

export function AgencyPortalLanding() {
  const router = useRouter();
  const [user, setUser] = useState<AgencyUser | null>(null);

  useEffect(() => {
    let active = true;
    agencyAuthApi.refreshSession()
      .then((session) => {
        if (!active) return;
        if (session.user.role !== 'AGENCY') {
          router.replace('/agency/login');
          return;
        }
        setUser(session.user);
      })
      .catch(() => {
        if (active) router.replace('/agency/login');
      });
    return () => { active = false; };
  }, [router]);

  const logout = async () => {
    await agencyAuthApi.logout().catch(() => undefined);
    router.replace('/agency/login');
  };

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5faff] px-4 text-brand-teal">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-brand-teal" />
          <p className="mt-4 text-sm font-semibold">Đang xác thực phiên Agency...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5faff] px-4 py-16 text-slate-900 sm:px-6">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-cyan-100 bg-white shadow-xl shadow-cyan-900/10">
        <div className="bg-gradient-to-r from-brand-tealDark to-brand-teal p-8 text-white sm:p-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Tripri Partner</p>
              <h1 className="mt-3 font-jakarta text-3xl font-extrabold sm:text-4xl">Xin chào, {user.fullName}</h1>
            </div>
            <button onClick={logout} className="shrink-0 rounded-xl border border-white/30 px-4 py-2 text-xs font-bold transition hover:bg-white/10">Đăng xuất</button>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-cyan-50/90">Bạn đã đăng nhập thành công bằng tài khoản Agency <strong>{user.email}</strong>.</p>
        </div>
        <div className="p-8 sm:p-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            <strong>Hồ sơ đã được gửi xét duyệt.</strong> Phase tiếp theo sẽ bổ sung trang quản lý Profile và thiết lập 2FA trên phiên đăng nhập hiện tại.
          </div>
          <Link href="/" className="mt-7 inline-flex h-11 items-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition hover:border-brand-teal hover:text-brand-teal">Về trang chủ</Link>
        </div>
      </section>
    </main>
  );
}
