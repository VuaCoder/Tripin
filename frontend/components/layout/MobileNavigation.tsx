'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { NavigationItem } from './navigation-config';
import { useAppSelector } from '@/store/hooks';
import { selectUser, selectIsAuthenticated, useLogout } from '@/features/auth';
import { homeForRole } from '@/features/auth/utils/roles';

export function MobileNavigation({ items }: { items: NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const logout = useLogout();

  const accountLinks = user?.role === 'TRAVELER'
    ? [
        { label: 'Hồ sơ cá nhân', href: '/traveler/profile', icon: 'person' },
        { label: 'Bảo mật & 2FA', href: '/traveler/settings/security', icon: 'shield_lock' },
      ]
    : user
      ? [{ label: 'Tổng quan', href: homeForRole(user.role), icon: 'dashboard' }]
      : [];

  const closeMenu = () => {
    setOpen(false);
    setAccountOpen(false);
  };

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? 'Đóng menu' : 'Mở menu'}
        onClick={() => setOpen((value) => !value)}
        className="rounded-xl p-2 text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
      >
        <span className="material-symbols-outlined text-2xl" aria-hidden="true">
          {open ? 'close' : 'menu'}
        </span>
      </button>

      {open && (
        <div
          id="mobile-navigation"
          className="absolute inset-x-0 top-full z-50 animate-fadeInScale border-t border-surface-container/60 bg-white/95 p-4 shadow-xl backdrop-blur-xl"
        >
          <div className="mb-4 flex flex-col gap-1">
            {items.map((item) => {
              if (item.children && item.children.length > 0) {
                return (
                  <div key={item.label} className="py-1">
                    <span className="block px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      {item.label}
                    </span>
                    <div className="mt-1 flex flex-col gap-1 pl-2">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={closeMenu}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
                        >
                          {child.icon && (
                            <span className="material-symbols-outlined text-[20px] text-primary-container">{child.icon}</span>
                          )}
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
                >
                  {item.icon && (
                    <span className="material-symbols-outlined text-[20px] text-primary-container">{item.icon}</span>
                  )}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase text-primary-container">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 border-t border-surface-container pt-3">
            <Link
              href="/custom-trip"
              onClick={closeMenu}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-container/60 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary-container"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Tạo chuyến đi riêng với AI</span>
            </Link>

            {isAuthenticated && user ? (
              <div className="mt-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setAccountOpen((value) => !value)}
                  aria-expanded={accountOpen}
                  className="flex w-full items-center gap-3 rounded-xl border border-surface-container bg-surface-container-low p-2.5 text-left"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-white shadow-sm">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-xs font-bold text-slate-900">{user.fullName || user.email}</span>
                    <span className="text-[10px] font-semibold uppercase text-primary-container">{user.role}</span>
                  </span>
                  <span className={`material-symbols-outlined text-lg text-slate-400 transition-transform ${accountOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {accountOpen && (
                  <div className="rounded-xl border border-surface-container bg-white p-1.5">
                    {accountLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMenu}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-surface-container-low"
                      >
                        <span className="material-symbols-outlined text-[19px] text-primary-container">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    logout();
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="flex items-center justify-center rounded-xl border border-surface-container py-2.5 text-center text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  onClick={closeMenu}
                  className="flex items-center justify-center rounded-xl bg-primary-container py-2.5 text-center text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
