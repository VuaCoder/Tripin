'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { AppRole } from './navigation-config';
import { navigationByRole } from './navigation-config';
import { Navigation } from './Navigation';
import { MobileNavigation } from './MobileNavigation';
import { useAppSelector } from '@/store/hooks';
import { selectUser, selectIsAuthenticated, useLogout } from '@/features/auth';
import { homeForRole } from '@/features/auth/utils/roles';
import { cn } from '../ui/cn';

export function Header({ role }: { role?: AppRole }) {
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const logout = useLogout();
  const pathname = usePathname();
  const isHome = pathname === '/home';
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setIsScrolled(true);
      return;
    }
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  const isTransparent = isHome && !isScrolled;

  // If role is passed directly, use it; otherwise detect from user session or fallback to PUBLIC
  const effectiveRole: AppRole = role || (isAuthenticated && user?.role ? (user.role as AppRole) : 'PUBLIC');
  const items = navigationByRole[effectiveRole] || navigationByRole.PUBLIC;

  return (
    <header
      className={cn(
        'sticky top-0 left-0 right-0 z-50 transition-all duration-300',
        isTransparent
          ? 'bg-transparent border-transparent'
          : 'bg-white/85 backdrop-blur-xl shadow-[0_4px_20px_rgba(8,126,139,0.06)] border-b border-white/60'
      )}
    >
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
              className={cn(
                "h-9 w-auto object-contain transition-all duration-300",
                isTransparent ? "brightness-0 invert" : ""
              )}
            />
          </Link>
          <div className="hidden md:block">
            <Navigation items={items} isTransparent={isTransparent} />
          </div>
        </div>

        {/* Right Actions & Auth Integration */}
        <div className="flex items-center gap-3">
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
                  <span className={cn("text-xs font-bold leading-tight", isTransparent ? "text-white" : "text-slate-900")}>
                    {user.fullName || user.email}
                  </span>
                  <span className={cn("text-[10px] font-semibold uppercase", isTransparent ? "text-white/80" : "text-primary-container")}>
                    {user.role}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={logout}
                title="Đăng xuất"
                className={cn("p-2 rounded-xl transition-colors",
                  isTransparent ? "text-white/80 hover:text-white hover:bg-white/20" : "text-slate-500 hover:text-red-600 hover:bg-red-50"
                )}
                aria-label="Đăng xuất"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={cn(
                  "inline-flex items-center justify-center text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors",
                  isTransparent
                    ? "text-white hover:bg-white/20"
                    : "text-primary hover:text-on-surface hover:bg-surface-container"
                )}
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className={cn(
                  "inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-md",
                  isTransparent
                    ? "text-primary bg-white hover:bg-white/90"
                    : "text-on-primary bg-primary-container hover:bg-primary shadow-primary-container/20 hover:shadow-lg"
                )}
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
