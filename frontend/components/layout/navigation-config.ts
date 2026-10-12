export type AppRole = 'PUBLIC' | 'TRAVELER' | 'AGENCY' | 'TOUR_GUIDE' | 'MODERATOR' | 'SUPER_ADMIN';

export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  description?: string;
  children?: NavigationItem[];
}

export const navigationByRole: Record<AppRole, NavigationItem[]> = {
  PUBLIC: [
    {
      label: 'Khám phá',
      href: '/tours',
      icon: 'explore',
    },
    { label: 'Hỗ trợ', href: '/support' },
  ],
  TRAVELER: [
    {
      label: 'Khám phá',
      href: '/tours',
      icon: 'explore',
    },
    { label: 'Hỗ trợ', href: '/support' },
  ],
  AGENCY: [
    { label: 'Tổng quan', href: '/agency', icon: 'dashboard' },
    { label: 'Quản lý tour', href: '/agency/tours', icon: 'tour' },
    { label: 'Đơn đặt chỗ', href: '/agency/bookings', icon: 'receipt_long' },
  ],
  TOUR_GUIDE: [
    { label: 'Lịch trình', href: '/guide', icon: 'calendar_month' },
    { label: 'Tour nhận dẫn', href: '/guide/tours', icon: 'flag' },
  ],
  MODERATOR: [
    { label: 'Kiểm duyệt', href: '/moderator', icon: 'verified' },
    { label: 'Báo cáo vi phạm', href: '/moderator/reports', icon: 'report' },
  ],
  SUPER_ADMIN: [
    { label: 'Hệ thống', href: '/super-admin', icon: 'admin_panel_settings' },
    { label: 'Người dùng', href: '/super-admin/users', icon: 'group' },
  ],
};
