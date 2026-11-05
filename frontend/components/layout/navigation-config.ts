export type AppRole = 'PUBLIC' | 'TRAVELER' | 'AGENCY' | 'TOUR_GUIDE' | 'MODERATOR' | 'SUPER_ADMIN';

export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  description?: string;
  children?: NavigationItem[];
}

/** Only the most specific matching destination is the current page. */
export function getActiveNavigationHref(pathname: string, items: NavigationItem[]): string | undefined {
  return items.flatMap((item) => [item, ...(item.children ?? [])])
    .filter((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export const navigationByRole: Record<AppRole, NavigationItem[]> = {
  PUBLIC: [
    {
      label: 'Khám phá',
      href: '/tours',
    },
    { label: 'Bảng giá', href: '/premium' },
    { label: 'Hỗ trợ', href: '/support' },
  ],
  TRAVELER: [
    {
      label: 'Khám phá',
      href: '/tours',
    },
    { label: 'Bảng giá', href: '/premium' },
    { label: 'Hỗ trợ', href: '/support' },
  ],
  AGENCY: [
    { label: 'Voucher Premium', href: '/agency/premium', icon: 'workspace_premium' },
    { label: 'Tổng quan', href: '/agency', icon: 'dashboard' },
    { label: 'Quản lý tour', href: '/agency/tours', icon: 'tour' },
    { label: 'Đơn đặt chỗ', href: '/agency/bookings', icon: 'receipt_long' },
    { label: 'Khuyến mãi', href: '/agency/promotions', icon: 'sell' },
    { label: 'Khiếu nại', href: '/agency/complaints', icon: 'report' },
    { label: 'Đánh giá', href: '/agency/reviews', icon: 'reviews' },
  ],
  TOUR_GUIDE: [
    { label: 'Tin nhắn', href: '/conversations', icon: 'chat' },
    { label: 'Lịch trình', href: '/guide', icon: 'calendar_month' },
    { label: 'Tour nhận dẫn', href: '/guide/tours', icon: 'flag' },
    { label: 'Premium', href: '/premium', icon: 'workspace_premium' },
    { label: 'Thu nhập', href: '/guide/earnings', icon: 'payments' },
    { label: 'Hồ sơ', href: '/guide/profile', icon: 'person' },
  ],
  MODERATOR: [
    { label: 'Tổng quan', href: '/moderator', icon: 'dashboard' },
    { label: 'Báo cáo', href: '/moderator/reports', icon: 'flag' },
    { label: 'Tour chờ duyệt', href: '/moderator/tours', icon: 'approval' },
    { label: 'Đánh giá', href: '/moderator/reviews', icon: 'rate_review' },
  ],
  SUPER_ADMIN: [
    { label: 'Tổng quan', href: '/super-admin', icon: 'dashboard' },
    { label: 'Người dùng', href: '/super-admin/users', icon: 'group' },
    { label: 'Đối tác Agency', href: '/super-admin/agencies', icon: 'corporate_fare' },
    { label: 'Báo cáo vi phạm', href: '/super-admin/reports', icon: 'flag' },
    { label: 'Cấu hình hệ thống', href: '/super-admin/settings', icon: 'settings' },
  ],
};
