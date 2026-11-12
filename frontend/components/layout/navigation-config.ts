export type AppRole = 'PUBLIC' | 'TRAVELER' | 'AGENCY' | 'TOUR_GUIDE' | 'MODERATOR' | 'SUPER_ADMIN';

export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  description?: string;
  children?: NavigationItem[];
  permission?: string;
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
  ],
  TRAVELER: [
    {
      label: 'Khám phá',
      href: '/tours',
    },
    { label: 'Bảng giá', href: '/premium' },
  ],
  AGENCY: [
    { label: 'Tổng quan', href: '/agency', icon: 'dashboard' },
    { label: 'Quản lý tour', href: '/agency/tours', icon: 'tour' },
    { label: 'Đơn đặt chỗ', href: '/agency/bookings', icon: 'receipt_long' },
    { label: 'Khuyến mãi & Voucher', href: '/agency/promotions', icon: 'sell' },
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
    { label: 'Kiểm duyệt', href: '/moderator', permission: 'moderation:dashboard', icon: 'verified' },
    { label: 'Duyệt tour', href: '/moderator/tours', permission: 'tour:list-all', icon: 'tour' },
    { label: 'Xác minh agency', href: '/moderator/agencies', permission: 'agency:verify', icon: 'domain_verification' },
    { label: 'Báo cáo vi phạm', href: '/moderator/reports', permission: 'dispute:resolve', icon: 'report' },
    { label: 'Tranh chấp & CSAT', href: '/moderator/complaints', permission: 'dispute:resolve', icon: 'shield_person' },
    { label: 'Kiểm duyệt đánh giá', href: '/moderator/reviews', permission: 'review:moderate', icon: 'reviews' },
    { label: 'Khiếu nại hỗ trợ', href: '/moderator/support-tickets', permission: 'complaint:handle', icon: 'support_agent' },
  ],
  SUPER_ADMIN: [
    { label: 'Audit log', href: '/super-admin/audit-logs', icon: 'history' },
    { label: 'Premium', href: '/super-admin/premium', icon: 'workspace_premium' },
    { label: 'Hệ thống', href: '/super-admin', icon: 'admin_panel_settings' },
    { label: 'Người dùng', href: '/super-admin/users', icon: 'group' },
    { label: 'Đối tác Agency', href: '/super-admin/agencies', icon: 'corporate_fare' },
    { label: 'Báo cáo vi phạm', href: '/super-admin/reports', icon: 'flag' },
    { label: 'Cấu hình hệ thống', href: '/super-admin/settings', icon: 'settings' },
  ],
};
