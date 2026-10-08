'use client';

import { useEffect, useRef, useState } from 'react';
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

type AccountMenuItem = {
  label: string;
  href: string;
  icon: string;
};

function accountMenuForRole(role: AppRole): AccountMenuItem[] {
  if (role === 'TRAVELER') {
    return [
      {
        label: 'Hồ sơ cá nhân',
        href: '/traveler/profile',
        icon: 'person',
      },
      {
        label: 'Bảo mật & 2FA',
        href: '/traveler/settings/security',
        icon: 'shield_lock',
      },
    ];
  }

  return [{ label: 'Tổng quan', href: homeForRole(role), icon: 'dashboard' }];
}

export function Header({ role }: { role?: AppRole }) {
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const logout = useLogout();
  const pathname = usePathname();
  const isHome = pathname === '/home';
  const [isScrolled, setIsScrolled] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHome) {
      setIsScrolled(true);
      return;
    }

    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen]);

  const isTransparent = isHome && !isScrolled;
  const effectiveRole: AppRole = role || (isAuthenticated && user?.role ? (user.role as AppRole) : 'PUBLIC');
  const items = navigationByRole[effectiveRole] || navigationByRole.PUBLIC;
  const accountMenuItems = accountMenuForRole(effectiveRole);

  return (
    <header
      className={cn(
        'sticky top-0 left-0 right-0 z-50 transition-all duration-300',
        isTransparent
          ? 'bg-transparent border-transparent'
          : 'bg-white/85 backdrop-blur-xl shadow-[0_4px_20px_rgba(8,126,139,0.06)] border-b border-white/60',
      )}
    >
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href={isAuthenticated && user ? homeForRole(user.role) : '/'}
            aria-label="Tripri Trang chủ"
            className="flex items-center"
          >
            <Image
              src="/images/tripri-logo.png"
              alt="Tripri - Du lịch theo cách của bạn"
              width={160}
              height={44}
              priority
              className={cn(
                'h-9 w-auto object-contain transition-all duration-300',
                isTransparent ? 'brightness-0 invert' : '',
              )}
            />
          </Link>
          <div className="hidden md:block">
            <Navigation items={items} isTransparent={isTransparent} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                aria-expanded={accountMenuOpen}
                aria-controls="account-menu"
                onClick={() => setAccountMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-2.5 py-1.5 text-left shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-white shadow-sm">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </span>
                <span className="hidden min-w-0 lg:flex lg:flex-col">
                  <span className="truncate text-xs font-bold leading-tight text-slate-900">
                    {user.fullName || user.email}
                  </span>
                  <span className="text-[10px] font-semibold uppercase text-primary-container">{user.role}</span>
                </span>
                <span
                  className={cn(
                    'material-symbols-outlined hidden text-[18px] text-slate-500 transition-transform sm:block',
                    accountMenuOpen ? 'rotate-180' : '',
                  )}
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>

              {accountMenuOpen && (
                <div
                  id="account-menu"
                  className="absolute right-0 top-[calc(100%+0.625rem)] w-56 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/15"
                >
                  <div className="p-1.5">
                    {accountMenuItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-surface-container-low"
                      >
                        <span className="material-symbols-outlined text-[19px] text-primary-container">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <span className="material-symbols-outlined text-[19px]">logout</span>
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={cn(
                  'inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
                  isTransparent ? 'text-white hover:bg-white/20' : 'text-primary hover:bg-surface-container hover:text-on-surface',
                )}
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className={cn(
                  'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-md transition-colors',
                  isTransparent
                    ? 'bg-white text-primary hover:bg-white/90'
                    : 'bg-primary-container text-on-primary shadow-primary-container/20 hover:bg-primary hover:shadow-lg',
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
