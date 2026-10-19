import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AgencyRightSidebar } from '../components/AgencyRightSidebar';
import { AgencyPartnerSettings } from '../components/AgencyPartnerSettings';
import { Header } from '@/components/layout/Header';
import type { UserProfile } from '@/features/auth/types';

const mockUpdateMe = vi.fn();
const mockRemoveAvatar = vi.fn();
const mockLogout = vi.fn();
const mockPush = vi.fn();

vi.mock('../notifications', () => ({
  useAgencyNotifications: () => ({ count: 3, connected: true, latest: '' }),
  useAgencyNotificationsQuery: () => ({ currentData: { data: [{ id: 'n1', title: 'Tour đã được duyệt', body: 'Thông báo từ backend', isRead: false, createdAt: '2026-10-16T00:00:00Z' }], meta: { page: 1, totalPages: 1, total: 1 } }, refetch: vi.fn() }),
  useReadAgencyNotificationMutation: () => [vi.fn(), {}],
  useReadAllAgencyNotificationsMutation: () => [vi.fn(), {}],
  useDeleteAgencyNotificationMutation: () => [vi.fn(), {}],
}));

vi.mock('@/features/chat/api', () => ({
  useConversationsQuery: () => ({ data: { data: [] } }),
}));

vi.mock('@/features/notifications/api/notificationsApi', () => ({
  useGetNotificationsQuery: () => ({ data: { data: [] } }),
  useGetUnreadCountQuery: () => ({ data: { data: { count: 0 } } }),
  useMarkNotificationAsReadMutation: () => [vi.fn()],
  useMarkAllNotificationsAsReadMutation: () => [vi.fn()],
}));

const mockUser: UserProfile = {
  id: 'agency-user-1',
  email: 'agency@tripri.vn',
  fullName: 'Hoàng Phúc Travel',
  phone: '0901234567',
  role: 'AGENCY',
  status: 'ACTIVE',
  permissions: ['agency:dashboard', 'agency:bookings-view', 'tour:update-own'],
  extraPermissions: [],
  twoFactorEnabled: false,
  createdAt: '2026-01-01T00:00:00Z',
  agencyProfile: {
    companyName: 'Công ty Du lịch Hoàng Phúc',
    address: '123 Nguyễn Huệ, Q1, TP.HCM',
    website: 'https://hoangphuctravel.vn',
    licenseNumber: 'GP-79-1234',
    description: 'Chuyên tour nghỉ dưỡng cao cấp',
    verificationStatus: 'VERIFIED',
  },
};

vi.mock('next/navigation', () => ({
  usePathname: () => '/agency',
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/store/hooks', () => ({
  useAppSelector: () => mockUser,
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/features/auth', () => ({
  selectUser: () => mockUser,
  selectIsAuthenticated: () => true,
  useLogout: () => mockLogout,
  setUser: vi.fn(),
  homeForRole: () => '/agency',
}));

vi.mock('@/features/traveler-account/api/profileApi', () => ({
  useUpdateMeMutation: () => [mockUpdateMe, { isLoading: false }],
  useRemoveAvatarMutation: () => [mockRemoveAvatar, { isLoading: false }],
}));

describe('AgencyRightSidebar & Partner Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMe.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: { ...mockUser, fullName: 'Tên Mới' } }),
    });
    mockRemoveAvatar.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: { ...mockUser, avatarUrl: undefined } }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders collapsed sidebar by default with expand trigger and navigation links', () => {
    render(<AgencyRightSidebar initialExpanded={false} />);
    
    // Check expand button exists
    const expandBtn = screen.getByRole('button', { name: 'Mở rộng thanh bên' });
    expect(expandBtn).toBeDefined();
    expect(expandBtn.querySelector('svg')?.classList.contains('lucide-panel-left-open')).toBe(true);
    expect(expandBtn.textContent).toBe('');

    // Check direct settings & commission triggers exist separately
    expect(screen.queryByRole('link', { name: /^Hồ sơ đối tác$/ })).toBeNull();
    expect(screen.getByRole('img', { name: 'Logo Tripri' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Chiết khấu hoa hồng' }).getAttribute('href')).toBe('/agency/settings/commission');
    expect(screen.queryByRole('link', { name: 'Tạo tour mới' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Thông báo, 3 chưa đọc' }).getAttribute('href')).toBe('/agency/notifications');
  });

  it('expands sidebar when expand button is clicked', () => {
    render(<AgencyRightSidebar initialExpanded={false} />);
    const expandBtn = screen.getByRole('button', { name: 'Mở rộng thanh bên' });
    fireEvent.click(expandBtn);
    expect(screen.getByRole('button', { name: 'Ghim mở thanh bên' }).querySelector('svg')?.classList.contains('lucide-panel-left-open')).toBe(true);

    // Now expanded: Đối tác Tripri header and tabs should be visible
    expect(screen.getByText('Đối tác Tripri')).toBeDefined();
    expect(screen.getByText('Vận hành')).toBeDefined();
    expect(screen.getByText('Sản phẩm')).toBeDefined();
    expect(screen.getByText('Đối tác')).toBeDefined();
  });

  it('pins only after clicking while expanded and preserves the pin on pointer leave', () => {
    render(<AgencyRightSidebar />);
    const sidebar = screen.getByLabelText('Điều hướng đối tác');
    fireEvent.pointerEnter(sidebar, { pointerType: 'mouse' });
    expect(sidebar.getAttribute('data-pinned')).toBe('false');
    expect(sidebar.querySelector('.lucide-panel-left-close')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ghim mở thanh bên' }));
    fireEvent.pointerLeave(sidebar, { pointerType: 'mouse' });
    expect(sidebar.getAttribute('data-expanded')).toBe('true');
    expect(sidebar.getAttribute('data-pinned')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ghim và thu gọn thanh bên' }));
    expect(sidebar.getAttribute('data-expanded')).toBe('false');
  });

  it('clears search with its icon and opens the real notifications inbox without navigation', () => {
    render(<AgencyRightSidebar initialExpanded />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'tour' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tìm kiếm' }));
    expect((input as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(screen.getByLabelText('Command K')).toBeDefined();
    fireEvent.click(screen.getByRole('link', { name: 'Thông báo, 3 chưa đọc' }));
    expect(screen.getByRole('dialog', { name: 'Thông báo Agency' })).toBeDefined();
    expect(screen.getByText('Tour đã được duyệt')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Xoá thông báo' })).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('expands on hover, collapses on leave and keeps the logo mounted', () => {
    render(<AgencyRightSidebar />);
    const sidebar = screen.getByLabelText('Điều hướng đối tác');
    fireEvent.pointerEnter(sidebar, { pointerType: 'mouse' });
    expect(sidebar.getAttribute('data-expanded')).toBe('true');
    expect(screen.queryByText('Mức chiết khấu thoả thuận')).toBeNull();
    fireEvent.pointerLeave(sidebar, { pointerType: 'mouse' });
    expect(sidebar.getAttribute('data-expanded')).toBe('false');
    expect(screen.getByRole('img', { name: 'Logo Tripri' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh bên' }));
    fireEvent.keyDown(sidebar, { key: 'Escape' });
    expect(sidebar.getAttribute('data-expanded')).toBe('false');
  });

  it('opens and focuses search with Ctrl+K or Meta+K, then searches without Vietnamese accents', () => {
    render(<AgencyRightSidebar />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByRole('searchbox', { name: 'Tìm chức năng' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'don dat cho' } });
    expect(screen.getByRole('link', { name: 'Đơn đặt chỗ' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Quản lý tour' })).toBeNull();
    fireEvent.submit(screen.getByRole('search', { name: 'Tìm chức năng' }));
    expect(mockPush).toHaveBeenCalledWith('/agency/bookings');
    expect(screen.getByLabelText('Điều hướng đối tác').getAttribute('data-expanded')).toBe('false');
    fireEvent.keyDown(window, { key: 'K', metaKey: true });
    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('does not reveal restricted features through search and explains no results', () => {
    render(<AgencyRightSidebar initialExpanded />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tao tour' } });
    expect(screen.queryByRole('link', { name: 'Tạo tour mới' })).toBeNull();
    expect(screen.getByText('Không tìm thấy chức năng phù hợp.')).toBeDefined();
    fireEvent.submit(screen.getByRole('search'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('places toggle alongside brand and the notification bell alongside the company name', () => {
    render(<AgencyRightSidebar initialExpanded />);
    const brand = screen.getByText('Đối tác Tripri');
    expect(brand.closest('header')?.contains(screen.getByRole('button', { name: 'Ghim mở thanh bên' }))).toBe(true);
    const profile = screen.getByRole('link', { name: 'Hồ sơ đối tác: Công ty Du lịch Hoàng Phúc' });
    expect(profile.textContent).toContain('Công ty Du lịch Hoàng Phúc');
    expect(profile.parentElement?.contains(screen.getByRole('link', { name: 'Thông báo, 3 chưa đọc' }))).toBe(true);
  });

  it('allows switching to Partner Settings and adjusting commission percentage', async () => {
    render(<AgencyPartnerSettings />);

    // Verify Settings heading & commission section
    expect(screen.getByText('Cài đặt Đối tác')).toBeDefined();
    expect(screen.getByText('Mức chiết khấu thoả thuận')).toBeDefined();

    // Click a preset button (e.g. 15%)
    const preset15 = screen.getByRole('button', { name: '15%' });
    fireEvent.click(preset15);

    // Verify save button works
    const saveCommissionBtn = screen.getByText('Lưu mức chiết khấu này');
    fireEvent.click(saveCommissionBtn);
    expect(screen.getByText('Đã lưu mức chiết khấu!')).toBeDefined();
  });

  it('allows viewing and editing partner personal info', async () => {
    render(<AgencyPartnerSettings />);

    // Switch to profile tab
    fireEvent.click(screen.getByRole('button', { name: /Hồ sơ Đối tác/ }));

    // Should display partner profile information
    expect(screen.getAllByText('Công ty Du lịch Hoàng Phúc').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hoàng Phúc Travel').length).toBeGreaterThan(0);
    expect(screen.getByText('123 Nguyễn Huệ, Q1, TP.HCM')).toBeDefined();

    // Click Edit button
    const editBtn = screen.getByText('Sửa');
    fireEvent.click(editBtn);

    // Form inputs should now be visible
    const nameInput = screen.getByDisplayValue('Hoàng Phúc Travel');
    fireEvent.change(nameInput, { target: { value: 'Công Ty Mới' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: 'Lưu thông tin' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Công Ty Mới',
        })
      );
    });
  });

  it('allows opening delete / clear personal info modal', () => {
    render(<AgencyPartnerSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Hồ sơ Đối tác/ }));

    const deleteBtn = screen.getByText('Xoá');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Xoá thông tin cá nhân')).toBeDefined();
    expect(screen.getByText('Xoá SĐT')).toBeDefined();
    expect(screen.getByText('Xoá Địa chỉ')).toBeDefined();
    expect(screen.getByText('Xoá Website')).toBeDefined();
  });

  it('Header component renders AgencyRightSidebar when effectiveRole is AGENCY', () => {
    const { container } = render(<Header role="AGENCY" />);
    // The standard horizontal top header (h-20 max-w-[1600px]) should NOT be rendered
    expect(container.querySelector('.h-20')).toBeNull();
    // Instead the right sidebar is rendered
    expect(screen.getByLabelText('Điều hướng đối tác')).toBeDefined();
  });
});
