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
    { label: 'Hỗ trợ', href: '/support' },
  ],
  TRAVELER: [
    {
      label: 'Khám phá',
      href: '/tours',
    },
    { label: 'Hỗ trợ', href: '/support' },
  ],
  AGENCY: [
    { label: 'Tổng quan', href: '/agency', icon: 'dashboard' },
    { label: 'Quản lý tour', href: '/agency/tours', icon: 'tour' },
    { label: 'Đơn đặt chỗ', href: '/agency/bookings', icon: 'receipt_long' },
    { label: 'Khuyến mãi', href: '/agency/promotions', icon: 'sell' },
    { label: 'Khiếu nại', href: '/agency/complaints', icon: 'report' },
  ],
  TOUR_GUIDE: [
    { label: 'Lịch trình', href: '/guide', icon: 'calendar_month' },
    { label: 'Tour nhận dẫn', href: '/guide/tours', icon: 'flag' },
    { label: 'Gói dịch vụ', href: '/guide/subscriptions', icon: 'workspace_premium' },
    { label: 'Thu nhập', href: '/guide/earnings', icon: 'payments' },
    { label: 'Hồ sơ', href: '/guide/profile', icon: 'person' },
  ],
  MODERATOR: [
    { label: 'Kiểm duyệt', href: '/moderator', icon: 'verified' },
    { label: 'Duyệt tour', href: '/moderator/tours', icon: 'tour' },
    { label: 'Xác minh agency', href: '/moderator/agencies', icon: 'domain_verification' },
    { label: 'Báo cáo vi phạm', href: '/moderator/reports', icon: 'report' },
  ],
  SUPER_ADMIN: [
    { label: 'Hệ thống', href: '/super-admin', icon: 'admin_panel_settings' },
    { label: 'Người dùng', href: '/super-admin/users', icon: 'group' },
    { label: 'Khuyến mãi nền tảng', href: '/super-admin/promotions', icon: 'sell' },
    { label: 'Hoa hồng nền tảng', href: '/super-admin/settings/commission', icon: 'payments' },
    { label: 'Danh mục tour', href: '/super-admin/categories', icon: 'category' },
    { label: 'Chính sách hệ thống', href: '/super-admin/policies', icon: 'policy' },
  ],
};
