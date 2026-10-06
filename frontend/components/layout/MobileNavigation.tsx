'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { NavigationItem } from './navigation-config';
import { useAppSelector } from '@/store/hooks';
import { selectUser, selectIsAuthenticated, useLogout } from '@/features/auth';
import { homeForRole } from '@/features/auth/utils/roles';

export function MobileNavigation({ items }: { items: NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const logout = useLogout();

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? 'Đóng menu' : 'Mở menu'}
        onClick={() => setOpen((value) => !value)}
        className="rounded-xl p-2 text-on-surface hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
      >
        <span className="material-symbols-outlined text-2xl" aria-hidden="true">
          {open ? 'close' : 'menu'}
        </span>
      </button>

      {open && (
        <div
          id="mobile-navigation"
          className="absolute inset-x-0 top-full border-t border-surface-container/60 bg-white/95 backdrop-blur-xl p-4 shadow-xl z-50 animate-fadeInScale"
        >
          {/* Navigation Links */}
          <div className="flex flex-col gap-1 mb-4">
            {items.map((item) => {
              if (item.children && item.children.length > 0) {
                return (
                  <div key={item.label} className="py-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-3 py-1 block">
                      {item.label}
                    </span>
                    <div className="pl-2 flex flex-col gap-1 mt-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
                        >
                          {child.icon && (
                            <span className="material-symbols-outlined text-primary-container text-[20px]">
                              {child.icon}
                            </span>
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
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
                >
                  {item.icon && (
                    <span className="material-symbols-outlined text-primary-container text-[20px]">
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary-container text-primary-container">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Mobile Auth Actions */}
          <div className="pt-3 border-t border-surface-container flex flex-col gap-2">
            <Link
              href="/custom-trip"
              onClick={() => setOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-secondary-container/60 text-primary hover:bg-secondary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Tạo chuyến đi riêng với AI</span>
            </Link>

            {isAuthenticated && user ? (
              <div className="flex flex-col gap-2 mt-1">
                <Link
                  href={homeForRole(user.role)}
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low border border-surface-container"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-900">{user.fullName || user.email}</span>
                    <span className="text-[10px] text-primary-container font-semibold uppercase">{user.role}</span>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 ml-auto text-lg">chevron_right</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold border border-surface-container text-on-surface hover:bg-surface-container-low text-center"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold bg-primary-container text-on-primary hover:bg-primary shadow-sm text-center"
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
