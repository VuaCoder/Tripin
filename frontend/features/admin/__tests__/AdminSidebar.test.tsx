import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AdminSidebar } from '../components/AdminSidebar';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { setCredentials } from '@/features/auth/store/authSlice';
import { baseApi } from '@/store/api/baseApi';
import type { UserProfile } from '@/features/auth/types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/super-admin',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
const socketMocks = vi.hoisted(() => ({ handlers: {} as Record<string, (payload?: unknown) => void> }));
vi.mock('socket.io-client', () => ({ io: () => {
  const socket = {
    on: (event: string, handler: (payload?: unknown) => void) => { socketMocks.handlers[event] = handler; return socket; },
    removeAllListeners: vi.fn(), disconnect: vi.fn(),
  };
  return socket;
} }));

vi.mock('@/features/notifications/api/notificationsApi', () => ({
  useGetNotificationsQuery: () => ({
    data: { data: [], meta: { page: 1, totalPages: 1, total: 0 } },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useGetUnreadCountQuery: () => ({ data: 2 }),
  useMarkAllNotificationsAsReadMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() }), { isLoading: false }],
  useMarkNotificationAsReadMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() })],
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  socketMocks.handlers = {};
});

function makeStore(userRole = 'SUPER_ADMIN') {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (gDM) => gDM().concat(baseApi.middleware),
  });
  store.dispatch(
    setCredentials({
      user: {
        id: 'admin-1',
        email: 'admin@tripri.com',
        role: userRole,
        fullName: 'Super Admin Test',
      } as UserProfile,
      accessToken: 'admin-token',
    })
  );
  return store;
}

describe('AdminSidebar', () => {
  it('renders sidebar with navigation items and notification button in account row', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <AdminSidebar initialExpanded={true} />
      </Provider>
    );

    expect(screen.getByRole('complementary', { name: 'Điều hướng quản trị' })).toBeTruthy();
    expect(screen.getByText('Tổng quan')).toBeTruthy();
    expect(screen.getByText('Lịch sử hoạt động')).toBeTruthy();
    expect(screen.getByText('Tài khoản người dùng')).toBeTruthy();
    expect(screen.getByText('Danh mục tour')).toBeTruthy();
    expect(screen.getByText('Khuyến mãi')).toBeTruthy();
    expect(screen.getByText('Phí dịch vụ')).toBeTruthy();
    expect(screen.getByText('Chính sách & điều khoản')).toBeTruthy();

    // Verify Notification button
    const notifBtn = screen.getByRole('button', { name: /Thông báo/i });
    expect(notifBtn).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    // Notification click opens popover
    fireEvent.click(notifBtn);
    expect(screen.getByRole('dialog', { name: 'Thông báo quản trị' })).toBeTruthy();

    const toggleBtn = screen.getByRole('button', { name: 'Thu gọn thanh bên' });
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: 'Mở rộng thanh bên' })).toBeTruthy();
  });

  it('filters navigation items based on search query', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <AdminSidebar initialExpanded={true} />
      </Provider>
    );

    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'dich vu' } });

    expect(screen.getByText('Phí dịch vụ')).toBeTruthy();
    expect(screen.queryByText('Lịch sử hoạt động')).toBeNull();
  });

  it('shows a development notification mock for visual review', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const store = makeStore();
    render(<Provider store={store}><AdminSidebar initialExpanded /></Provider>);
    fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo thông báo mẫu' }));
    expect(screen.getByText('Yêu cầu mới từ người dùng')).toBeTruthy();
  });

  it('opens the notification popup immediately when a realtime request event arrives', () => {
    const store = makeStore();
    render(<Provider store={store}><AdminSidebar initialExpanded /></Provider>);
    expect(screen.queryByRole('dialog', { name: 'Thông báo quản trị' })).toBeNull();
    act(() => socketMocks.handlers['notification:new']?.({ id: 'request-1' }));
    expect(screen.getByRole('dialog', { name: 'Thông báo quản trị' })).toBeTruthy();
  });
});
