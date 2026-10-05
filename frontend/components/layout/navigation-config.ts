export type AppRole = 'PUBLIC' | 'TRAVELER' | 'AGENCY' | 'TOUR_GUIDE' | 'MODERATOR' | 'SUPER_ADMIN';

export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  children?: NavigationItem[];
}

export const navigationByRole: Record<AppRole, NavigationItem[]> = {
  PUBLIC: [
    { label: 'Trang chủ', href: '/' },
    {
      label: 'Khám phá',
      href: '/explore',
      icon: 'explore',
      children: [
        { label: 'Tour & Trải nghiệm', href: '/explore?type=tour', icon: 'tour' },
        { label: 'Khách sạn & Resort', href: '/explore?type=hotel', icon: 'hotel' },
        { label: 'Vé xe & Di chuyển', href: '/explore?type=transport', icon: 'directions_car' },
        { label: 'Vé vui chơi & Show', href: '/explore?type=activity', icon: 'attractions' },
      ],
    },
    { label: 'Tạo chuyến đi riêng', href: '/custom-trip', icon: 'auto_awesome', badge: 'AI' },
    { label: 'Hỗ trợ', href: '/support' },
  ],
  TRAVELER: [
    { label: 'Tổng quan', href: '/traveler', icon: 'dashboard' },
    { label: 'Đặt chỗ của tôi', href: '/traveler/bookings', icon: 'event' },
    { label: 'Khám phá tour', href: '/explore', icon: 'travel_explore' },
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
