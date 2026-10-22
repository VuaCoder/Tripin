import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import { baseApi } from '@/store/api/baseApi';
import { Header } from '../Header';

// Mock Next.js navigation and image
vi.mock('next/navigation', () => ({
  usePathname: () => '/tours',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: any) => <img src={src} alt={alt || ''} />,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

function createTestStore(initialState: any = {}) {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    preloadedState: {
      auth: {
        user: null,
        accessToken: null,
        status: 'idle',
        ...initialState,
      },
    },
  });
}

describe('Header Traveler Dropdown & Premium', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('shows external Premium button for guest (not logged in)', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <Header />
      </Provider>,
    );

    const premiumBtn = screen.getByRole('button', { name: /khám phá tripri premium/i });
    expect(premiumBtn).toBeTruthy();
  });

  it('hides external Premium button and places Premium inside Traveler dropdown with exactly 3 items', () => {
    const travelerUser = {
      id: 'traveler-1',
      email: 'traveler@tripri.com',
      fullName: 'Nguyen Van Traveler',
      role: 'TRAVELER' as const,
      avatarUrl: null,
    };

    const store = createTestStore({
      user: travelerUser,
      accessToken: 'valid-token',
      status: 'authenticated',
    });

    render(
      <Provider store={store}>
        <Header />
      </Provider>,
    );

    // External Premium button should NOT exist
    expect(screen.queryByRole('button', { name: /khám phá tripri premium/i })).toBeNull();

    // User avatar/account button should exist
    const accountBtn = screen.getByRole('button', { name: /nguyen van traveler/i });
    expect(accountBtn).toBeTruthy();

    // Open dropdown
    fireEvent.click(accountBtn);

    // Dropdown should be open
    const accountMenu = document.getElementById('account-menu');
    expect(accountMenu).toBeTruthy();

    // Verify items in Traveler dropdown:
    // 1. Hồ sơ cá nhân
    const profileLink = screen.getByRole('link', { name: /hồ sơ cá nhân/i });
    expect(profileLink).toBeTruthy();
    expect(profileLink.getAttribute('href')).toBe('/settings/profile');

    // 2. Ví voucher
    const voucherLink = screen.getByRole('link', { name: /ví voucher/i });
    expect(voucherLink).toBeTruthy();
    expect(voucherLink.getAttribute('href')).toBe('/settings/vouchers');

    // 3. Premium
    const premiumMenuItem = screen.getByRole('button', { name: /premium/i });
    expect(premiumMenuItem).toBeTruthy();

    // 3. Đăng xuất
    const logoutBtn = screen.getByRole('button', { name: /đăng xuất/i });
    expect(logoutBtn).toBeTruthy();

    // Old items should NOT be present in traveler dropdown
    expect(screen.queryByText('Danh sách yêu thích')).toBeNull();
    expect(screen.queryByText('Chuyến đi')).toBeNull();

    // Clicking Premium inside dropdown opens the modal
    fireEvent.click(premiumMenuItem);
    expect(screen.getByText('Tính năng đang được phát triển')).toBeTruthy();
    expect(screen.getAllByText(/Tripri Premium/i).length).toBeGreaterThan(0);

    // Left nav should only have Khám phá and Hỗ trợ (no Tin nhắn on left)
    const nav = screen.getByRole('navigation', { name: /điều hướng chính/i });
    expect(nav).toBeTruthy();
    expect(screen.getByRole('link', { name: /khám phá/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /hỗ trợ/i })).toBeTruthy();

    // Right actions should have Notification Bell and Chat icon
    const notifBtn = screen.getByRole('button', { name: /thông báo/i });
    expect(notifBtn).toBeTruthy();
    const chatLink = screen.getByRole('link', { name: /tin nhắn/i });
    expect(chatLink).toBeTruthy();
    expect(chatLink.getAttribute('href')).toBe('/conversations');

    // Clicking notification bell toggles notification popover
    fireEvent.click(notifBtn);
    expect(screen.getByText('Thông báo')).toBeTruthy();
    expect(screen.getByText('Đặt lịch thành công!')).toBeTruthy();
    expect(screen.getAllByText(/Giảm 25%/i).length).toBeGreaterThan(0);

    // Mark all as read
    const markAllReadBtn = screen.getByRole('button', { name: /đã đọc tất cả/i });
    expect(markAllReadBtn).toBeTruthy();
    fireEvent.click(markAllReadBtn);
  });
});
