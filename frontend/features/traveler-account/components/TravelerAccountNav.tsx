'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Heart,
  CalendarCheck,
  TicketPercent,
  Flag,
  User,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { name: 'Ví voucher & Ưu đãi', href: '/settings/vouchers', Icon: TicketPercent },
  { name: 'Danh sách yêu thích', href: '/settings/wishlist', Icon: Heart },
  { name: 'Chuyến đi', href: '/settings/history', Icon: CalendarCheck },
  { name: 'Báo cáo của tôi', href: '/settings/reports', Icon: Flag },
  { name: 'Hồ sơ', href: '/settings/profile', Icon: User },
  { name: 'Bảo mật & 2FA', href: '/settings/profile/security', Icon: ShieldCheck },
];

export function TravelerAccountNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Cài đặt tài khoản"
      className="flex gap-2 overflow-x-auto rounded-2xl border border-surface-container bg-white p-2 shadow-sm lg:flex-col lg:overflow-visible"
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/settings/profile' && pathname.startsWith(item.href));
        const IconComponent = item.Icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container ${
              isActive
                ? 'bg-primary-container text-white shadow-sm shadow-primary-container/25'
                : 'text-slate-600 hover:bg-surface-container-low hover:text-primary-container'
            }`}
          >
            <IconComponent className="size-5 shrink-0" aria-hidden="true" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

