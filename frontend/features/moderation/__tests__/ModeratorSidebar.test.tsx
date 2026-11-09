import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModeratorSidebar } from '../components/ModeratorSidebar';

const mocks = vi.hoisted(() => ({
  user: {
    id: 'mod-1',
    fullName: 'Hoàng Phúc',
    email: 'mod@tripri.local',
    role: 'MODERATOR',
    permissions: [
      'moderation:dashboard',
      'tour:list-all',
      'agency:verify',
      'review:moderate',
      'dispute:resolve',
      'complaint:handle',
    ],
  },
  logout: vi.fn(),
  pathname: '/moderator',
  push: vi.fn(),
}));

vi.mock('@/store/hooks', () => ({
  useAppSelector: () => mocks.user,
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/features/agency/notifications', () => ({
  useAgencyNotifications: () => ({ count: 0, connected: true, latest: '' }),
}));

vi.mock('@/features/auth', () => ({
  selectUser: () => mocks.user,
  useLogout: () => mocks.logout,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}));

describe('ModeratorSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = '/moderator';
  });
  afterEach(cleanup);

  it('renders brand title and navigation links', () => {
    render(<ModeratorSidebar initialExpanded={true} />);
    expect(screen.getByText('Kiểm duyệt Tripri')).toBeTruthy();
    expect(screen.getByText('Tổng quan')).toBeTruthy();
    expect(screen.getByText('Duyệt tour')).toBeTruthy();
    expect(screen.getByText('Xác minh agency')).toBeTruthy();
    expect(screen.getByText('Kiểm duyệt đánh giá')).toBeTruthy();
    expect(screen.getByText('Báo cáo vi phạm')).toBeTruthy();
    expect(screen.getByText('Tranh chấp & CSAT')).toBeTruthy();
    expect(screen.getByText('Khiếu nại hỗ trợ')).toBeTruthy();
  });

  it('toggles collapse and expand on button click', () => {
    render(<ModeratorSidebar initialExpanded={true} />);
    const toggleBtn = screen.getByLabelText('Thu gọn thanh bên');
    fireEvent.click(toggleBtn);
    expect(screen.getByLabelText('Mở rộng thanh bên')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Mở rộng thanh bên'));
    expect(screen.getByLabelText('Thu gọn thanh bên')).toBeTruthy();
  });

  it('filters navigation items based on search query', () => {
    render(<ModeratorSidebar initialExpanded={true} />);
    const searchInput = screen.getByPlaceholderText('Tìm chức năng…');
    fireEvent.change(searchInput, { target: { value: 'agency' } });
    expect(screen.getByText('Xác minh agency')).toBeTruthy();
    expect(screen.queryByText('Duyệt tour')).toBeNull();
  });

  it('opens profile menu and calls logout', () => {
    render(<ModeratorSidebar initialExpanded={true} />);
    const profileLink = screen.getByTitle('Hoàng Phúc');
    fireEvent.click(profileLink);
    const logoutBtn = screen.getByText('Đăng xuất');
    fireEvent.click(logoutBtn);
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });
});

