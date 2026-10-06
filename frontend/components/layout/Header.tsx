'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { AppRole } from './navigation-config';
import { navigationByRole } from './navigation-config';
import { Navigation } from './Navigation';
import { MobileNavigation } from './MobileNavigation';
import { useAppSelector } from '@/store/hooks';
import { selectUser, selectIsAuthenticated, useLogout } from '@/features/auth';
import { homeForRole } from '@/features/auth/utils/roles';

export function Header({ role }: { role?: AppRole }) {
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const logout = useLogout();

  // If role is passed directly, use it; otherwise detect from user session or fallback to PUBLIC
  const effectiveRole: AppRole = role || (isAuthenticated && user?.role ? (user.role as AppRole) : 'PUBLIC');
  const items = navigationByRole[effectiveRole] || navigationByRole.PUBLIC;

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl shadow-[0_4px_20px_rgba(8,126,139,0.06)] border-b border-white/60">
      <div className="h-20 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo & Desktop Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="Tripri Trang chủ" className="flex items-center">
            <Image
              src="/images/tripri-logo.png"
              alt="Tripri - Du lịch theo cách của bạn"
              width={160}
              height={44}
              priority
              className="h-9 w-auto object-contain"
            />
          </Link>
          <div className="hidden md:block">
            <Navigation items={items} />
          </div>
        </div>

        {/* Right Actions & Auth Integration */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden sm:flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-xl hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">language</span>
            <span>VNĐ | Tiếng Việt</span>
          </button>

          {/* Conditional Auth State */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <Link
                href={homeForRole(user.role)}
                className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {user.fullName || user.email}
                  </span>
                  <span className="text-[10px] text-primary-container font-semibold uppercase">
                    {user.role}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={logout}
                title="Đăng xuất"
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                aria-label="Đăng xuất"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center text-sm font-semibold text-primary hover:text-on-surface px-3.5 py-2 rounded-xl hover:bg-surface-container transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center text-sm font-semibold text-on-primary bg-primary-container hover:bg-primary px-4 py-2 rounded-xl transition-colors shadow-md hover:shadow-lg shadow-primary-container/20"
              >
                Đăng ký
              </Link>
            </div>
          )}

          <MobileNavigation items={items} />
        </div>
      </div>
    </header>
  );
}
