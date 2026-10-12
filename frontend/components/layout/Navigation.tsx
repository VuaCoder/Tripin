'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavigationItem } from './navigation-config';
import { cn } from '../ui/cn';

export function Navigation({ items, onNavigate, isTransparent }: { items: NavigationItem[]; onNavigate?: () => void; isTransparent?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng chính" className="flex items-center gap-1 lg:gap-2">
      {items.map((item) => {
        const childActive = item.children?.some(
          (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
        );
        const active = Boolean(
          pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(`${item.href}/`)) ||
          childActive,
        );

        // Dropdown item (e.g. Khám phá)
        if (item.children && item.children.length > 0) {
          return (
            <div key={item.label} className="relative group">
              <button
                type="button"
                className={cn(
                  'font-medium text-sm transition-colors py-2 px-3.5 rounded-xl flex items-center gap-1',
                  isTransparent
                    ? (active ? 'text-white bg-white/20 font-bold' : 'text-white/85 hover:bg-white/10 hover:text-white')
                    : (active ? 'text-primary-container font-bold hover:bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'),
                )}
              >
                <span>{item.label}</span>
                <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:rotate-180">
                  expand_more
                </span>
              </button>
              <div className="absolute top-full left-0 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100 py-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 mt-1">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors rounded-xl mx-1"
                  >
                    {child.icon && (
                      <span className="material-symbols-outlined text-primary-container text-[20px]">
                        {child.icon}
                      </span>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{child.label}</div>
                      {child.description && (
                        <div className="text-xs text-slate-500">{child.description}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        }

        // Special Badge Item (e.g. "Tạo chuyến đi riêng")
        if (item.badge) {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-secondary-container/40 hover:bg-secondary-container px-3.5 py-1.5 rounded-xl transition-colors border border-secondary-container/70 shadow-sm"
            >
              {item.icon && (
                <span className="material-symbols-outlined text-[18px] text-primary-container">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </Link>
          );
        }

        // Standard Link
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container',
              isTransparent
                ? (active ? 'bg-white/20 text-white font-bold' : 'text-white/85 hover:bg-white/10 hover:text-white font-medium')
                : (active ? 'text-primary-container font-bold hover:bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'),
            )}
          >
            {item.icon && (
              <span className={cn('material-symbols-outlined text-[18px]', active && !isTransparent ? 'text-primary-container' : 'text-current opacity-80')} aria-hidden="true">
                {item.icon}
              </span>
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
