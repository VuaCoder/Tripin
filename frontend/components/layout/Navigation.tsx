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
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));

        // Dropdown item (e.g. Khám phá)
        if (item.children && item.children.length > 0) {
          return (
            <div key={item.label} className="relative group">
              <button
                type="button"
                className={cn(
                  'font-medium text-sm transition-colors py-2 px-3 rounded-xl flex items-center gap-1 group-hover:bg-surface-container/20',
                  isTransparent ? 'text-white/90 hover:text-white' : 'text-on-surface hover:text-primary',
                  active && (isTransparent ? 'text-white bg-white/10 font-semibold' : 'text-primary bg-surface-container/60 font-semibold'),
                )}
              >
                <span>{item.label}</span>
                <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:rotate-180">
                  expand_more
                </span>
              </button>
              <div className="absolute top-full left-0 w-64 bg-surface-container-lowest/95 backdrop-blur-xl rounded-2xl shadow-xl border border-surface-container/60 py-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 mt-1">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low transition-colors rounded-xl mx-1"
                  >
                    {child.icon && (
                      <span className="material-symbols-outlined text-primary-container text-[20px]">
                        {child.icon}
                      </span>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-on-surface">{child.label}</div>
                      <div className="text-xs text-on-surface-variant">Dịch vụ tuyển chọn</div>
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
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container',
              isTransparent
                ? 'text-white/90 hover:bg-white/10 hover:text-white'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
              active && (isTransparent ? 'bg-white/20 text-white font-semibold' : 'bg-surface-container text-primary font-semibold'),
            )}
          >
            {item.icon && (
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
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
