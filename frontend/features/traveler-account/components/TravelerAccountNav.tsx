'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Hồ sơ cá nhân', href: '/traveler/profile', icon: 'person' },
  { name: 'Bảo mật & 2FA', href: '/traveler/settings/security', icon: 'shield_lock' },
];

export function TravelerAccountNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Cài đặt tài khoản"
      className="flex gap-2 overflow-x-auto rounded-2xl border border-surface-container bg-white p-2 shadow-sm lg:flex-col lg:overflow-visible"
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container ${
              isActive
                ? 'bg-primary-container text-on-primary shadow-sm shadow-primary-container/20'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{item.icon}</span>
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
