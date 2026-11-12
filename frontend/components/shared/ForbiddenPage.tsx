'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Compass, Lock, LogOut, ShieldAlert } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth/store/authSlice';
import { useLogout } from '@/features/auth/hooks/useLogout';

export interface ForbiddenPageProps {
  role?: string;
  allowedRoles?: string[];
  title?: string;
  description?: string;
}

export function ForbiddenPage({
  role,
  allowedRoles,
  title = 'Bạn không có quyền truy cập khu vực này',
  description,
}: ForbiddenPageProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const logout = useLogout();

  const isTraveler = (role || user?.role) === 'TRAVELER';
  const roleName = isTraveler ? 'Du khách (Traveler)' : (role || user?.role || 'Khách');

  const defaultDescription = isTraveler
    ? `Tài khoản hiện tại của bạn được xác thực với vai trò ${roleName}. Khu vực này được thiết lập dành riêng cho các Đối tác đại lý du lịch (Agency) chính thức của Tripri.`
    : 'Yêu cầu của bạn bị từ chối do không đủ quyền hạn bảo mật cần thiết để thao tác tại cổng quản trị này.';

  const handleLogoutAndSwitch = async () => {
    try {
      await logout();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Top mini header */}
      <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/home" className="flex items-center gap-2">
            <Image
              src="/images/tripri-logo.png"
              alt="Tripri"
              width={120}
              height={32}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Quay lại</span>
          </button>
        </div>
      </header>

      {/* Main 403 content card */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        {/* Glow badge & Icon */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 rounded-3xl bg-rose-500/10 blur-xl pointer-events-none" />
          <div className="relative flex size-24 items-center justify-center rounded-3xl border border-rose-200 bg-rose-50/90 text-rose-600 shadow-sm">
            <ShieldAlert size={48} strokeWidth={2.2} />
            <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-slate-900 text-white ring-2 ring-white">
              <Lock size={14} />
            </span>
          </div>
        </div>

        {/* 403 status chip */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50/80 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-rose-700">
          <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
          <span>Lỗi 403 · Quyền truy cập bị từ chối</span>
        </div>

        {/* Title & Description */}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          {title}
        </h1>

        <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
          {description || defaultDescription}
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/home"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition-all cursor-pointer"
          >
            <Compass size={18} />
            <span>Về trang chủ khám phá</span>
          </Link>

          <Link
            href="/agency/register"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            <Building2 size={18} className="text-teal-700" />
            <span>Đăng ký Đại lý lữ hành</span>
          </Link>
        </div>

        {/* Secondary helper info box */}
        <div className="mt-10 w-full max-w-xl rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-left text-xs text-slate-600">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-slate-800">Bạn đã có tài khoản Đối tác lữ hành?</p>
              <p className="mt-1 text-slate-500">
                Hãy đăng xuất khỏi tài khoản Du khách hiện tại để đăng nhập vào đúng cổng quản trị của bạn.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogoutAndSwitch}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span>Đổi tài khoản</span>
            </button>
          </div>
        </div>
      </main>

      {/* Mini footer */}
      <footer className="w-full border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Tripri. Hệ thống bảo mật và phân quyền truy cập đa tầng.</p>
      </footer>
    </div>
  );
}

export default ForbiddenPage;

