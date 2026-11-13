'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { AppRole } from './navigation-config';
import { navigationByRole } from './navigation-config';
import { Navigation } from './Navigation';
import { MobileNavigation } from './MobileNavigation';
import { Container } from './Container';
import { useAppSelector } from '@/store/hooks';
import { selectUser, selectRole, selectIsAuthenticated, useLogout } from '@/features/auth';
import { homeForRole } from '@/features/auth/utils/roles';
import { notificationHref } from '@/features/custom-tours/links';
import { Dropdown } from '@/components/shared/Dropdown';
import { OwnPremiumIdentity, PremiumStatusText, useOwnPremium } from '@/features/premium/PremiumIdentity';
import { AgencyRightSidebar } from '@/features/agency/components/AgencyRightSidebar';
import { ModeratorSidebar } from '@/features/moderation/components/ModeratorSidebar';
import { AdminSidebar } from '@/features/admin';
import { cn } from '../ui/cn';

import { useConversationsQuery } from '@/features/chat/api';
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} from '@/features/notifications/api/notificationsApi';

type AccountMenuItem = {
  label: string;
  href: string;
  icon: string;
};

interface LocalNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string;
  iconBg: string;
  time: string;
  href: string;
  isRead: boolean;
}

function accountMenuForRole(role: AppRole): AccountMenuItem[] {
  if (role === 'PUBLIC') {
    return [];
  }

  if (role === 'TRAVELER') {
    return [
      {
        label: 'Danh sách yêu thích',
        href: '/settings/wishlist',
        icon: 'favorite',
      },
      {
        label: 'Chuyến đi',
        href: '/settings/history',
        icon: 'confirmation_number',
      },
      {
        label: 'Hồ sơ',
        href: '/settings/profile',
        icon: 'person',
      },
    ];
  }

  return [{ label: 'Tổng quan', href: homeForRole(role), icon: 'dashboard' }];
}

export function Header({ role }: { role?: AppRole }) {
  const user = useAppSelector(selectUser);
  const authRole = useAppSelector(selectRole);
  const router = useRouter();
  const premium = useOwnPremium(user?.id);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const logout = useLogout();
  const pathname = usePathname();
  const isHome = pathname === '/home';
  const [isScrolled, setIsScrolled] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);


  // Tin nhắn: Đếm số lượng tin nhắn chưa đọc
  const { data: conversationsData } = useConversationsQuery(1, { skip: !isAuthenticated });
  const unreadChatCount = conversationsData?.data?.reduce((total, conv) => total + (conv.unreadCount || 0), 0) || 0;

  // Thông báo: chỉ lấy từ API (không dùng dữ liệu mẫu)
  const {
    data: apiNotifications,
    isError: isNotificationsError,
    refetch: refetchNotifications,
  } = useGetNotificationsQuery(1, { skip: !isAuthenticated });
  const [markAllReadApi] = useMarkAllNotificationsAsReadMutation();
  const [markOneReadApi] = useMarkNotificationAsReadMutation();
  const [notificationsList, setNotificationsList] = useState<LocalNotification[]>([]);

  // Cập nhật khi API trả về (kể cả mảng rỗng) hoặc khi lỗi
  useEffect(() => {
    if (isNotificationsError) {
      setNotificationsList([]);
      return;
    }
    if (apiNotifications?.data !== undefined) {
      const mapped: LocalNotification[] = apiNotifications.data.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        icon: item.type.includes('BOOKING') ? 'check_circle' : item.type.includes('PROMOTION') ? 'local_offer' : 'notifications',
        iconBg: item.type.includes('BOOKING') ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
        time: new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        href: notificationHref(item, authRole) ?? (item.type.includes('BOOKING') ? '/settings/history' : '/tours'),
        isRead: item.isRead,
      }));
      setNotificationsList(mapped);
    }
  }, [apiNotifications, isNotificationsError, authRole]);

  const unreadNotifCount = notificationsList.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    setNotificationsList((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllReadApi().unwrap();
    } catch {
      // ignore
    }
  };

  const handleReadNotification = async (id: string) => {
    setNotificationsList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setNotificationOpen(false);
    try {
      await markOneReadApi(id).unwrap();
    } catch {
      // ignore
    }
  };


  useEffect(() => {
    if (!isHome) {
      setIsScrolled(true);
      return;
    }

    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  const isTransparent = isHome && !isScrolled;
  const effectiveRole: AppRole = role || (isAuthenticated && user?.role ? (user.role as AppRole) : 'PUBLIC');

  if (effectiveRole === 'AGENCY') {
    return <AgencyRightSidebar />;
  }
  if (effectiveRole === 'MODERATOR') {
    return <ModeratorSidebar />;
  }
  if (effectiveRole === 'SUPER_ADMIN') {
    return <AdminSidebar />;
  }

  const items = (navigationByRole[effectiveRole] || navigationByRole.PUBLIC).filter((item) => !item.permission || user?.permissions.includes(item.permission));
  const accountMenuItems = accountMenuForRole(effectiveRole);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 left-0 right-0 z-50 transition-all duration-300',
          isTransparent
            ? 'bg-transparent border-transparent'
            : 'bg-white/95 backdrop-blur-md shadow-md border-b border-slate-200/80',
        )}
      >
      <Container className="flex h-20 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            href={isAuthenticated && user ? homeForRole(user.role) : '/home'}
            aria-label="Tripri Trang chủ"
            className="flex items-center"
          >
            <Image
              src="/images/tripri-logo.png"
              alt="Tripri - Du lịch theo cách của bạn"
              width={160}
              height={44}
              priority
              className={cn(
                'h-9 w-auto object-contain transition-all duration-300',
                isTransparent ? 'brightness-0 invert' : '',
              )}
            />
          </Link>
          <div className="hidden md:block">
            <Navigation items={items} isTransparent={isTransparent} />
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Active Premium badge in Header (Only when user has active subscription) */}
          {premium.premium?.active && (
            <Link
              href="/premium"
              aria-label="Tài khoản Premium"
              className={cn(
                'group flex items-center gap-2.5 rounded-2xl border px-3 py-1.5 transition-all shadow-2xs hover:shadow-sm cursor-pointer',
                isTransparent
                  ? 'border-amber-400/50 bg-slate-900/40 text-white backdrop-blur-md hover:bg-slate-900/60'
                  : 'border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/70 text-slate-900 hover:border-amber-400',
              )}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-2xs">
                <span
                  className="material-symbols-outlined text-[16px] leading-none"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  workspace_premium
                </span>
              </span>
              <div className="flex flex-col text-left leading-tight">
                <span className={cn('text-xs font-extrabold', isTransparent ? 'text-amber-300' : 'text-amber-950')}>
                  Premium
                </span>
                <span className={cn('text-[10px] font-medium', isTransparent ? 'text-slate-200' : 'text-slate-600')}>
                  Hoạt động đến {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(premium.premium.endsAt!))}
                </span>
              </div>
            </Link>
          )}

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Nút Chuông thông báo 🔔 sử dụng Ant Design Dropdown */}
              <Dropdown
                open={notificationOpen}
                onOpenChange={(open) => {
                  setNotificationOpen(open);
                  if (open) setAccountMenuOpen(false);
                }}
                trigger={['click']}
                placement="bottomRight"
                popupContent={
                  <div
                    id="notification-menu"
                    className="w-80 sm:w-96 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xl shadow-slate-900/15 text-slate-800"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">Thông báo</span>
                        {unreadNotifCount > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">
                            {unreadNotifCount} mới
                          </span>
                        )}
                      </div>
                      {unreadNotifCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="flex items-center gap-1 text-xs font-semibold text-primary-container hover:underline cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">done_all</span>
                          Đã đọc tất cả
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto ant-scrollbar divide-y divide-slate-100 my-1">
                      {notificationsList.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          {isNotificationsError ? (
                            <>
                              <span className="material-symbols-outlined mx-auto mb-1 block text-3xl text-slate-300">
                                notifications_off
                              </span>
                              <p className="mb-3">Không tải được thông báo</p>
                              <button
                                type="button"
                                onClick={() => void refetchNotifications()}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
                              >
                                Thử lại
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined mx-auto mb-1 block text-3xl text-slate-300">
                                notifications_none
                              </span>
                              Bạn chưa có thông báo nào
                            </>
                          )}
                        </div>
                      ) : (
                        notificationsList.map((item) => (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => handleReadNotification(item.id)}
                            className={cn(
                              'flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-slate-50 cursor-pointer',
                              !item.isRead ? 'bg-slate-50/70' : 'opacity-80',
                            )}
                          >
                            <span
                              className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                                item.iconBg,
                              )}
                            >
                              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                                {!item.isRead && <span className="size-2 rounded-full bg-primary-container shrink-0" />}
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">{item.body}</p>
                              <span className="text-[10px] text-slate-400 mt-1 block">{item.time}</span>
                            </div>
                          </Link>
                        ))
                      )}
                      {effectiveRole === 'TOUR_GUIDE' && <Link href="/premium" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-amber-800 hover:bg-amber-50"><span className="material-symbols-outlined text-[19px]" aria-hidden="true">workspace_premium</span>{premium.premium?.active ? <PremiumStatusText status={premium.premium} /> : <span className="font-bold">Premium</span>}</Link>}
                      {premium.isError && ['TRAVELER','TOUR_GUIDE'].includes(effectiveRole) && <div className="p-2"><PremiumStatusText error onRetry={() => void premium.refetch()} /></div>}
                    </div>
                  </div>
                }
              >
                <button
                  type="button"
                  aria-label="Thông báo"
                  title="Thông báo"
                  className={cn(
                    'relative flex size-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container cursor-pointer',
                    isTransparent
                      ? 'text-white hover:bg-white/15'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <span className="material-symbols-outlined text-[22px]">notifications</span>
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </span>
                  )}
                </button>
              </Dropdown>

              {/* Nút Bong bóng chat / Tin nhắn 💬 */}
              <Link
                href="/conversations"
                aria-label="Tin nhắn"
                title="Tin nhắn"
                className={cn(
                  'relative flex size-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container cursor-pointer',
                  isTransparent
                    ? 'text-white hover:bg-white/15'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <span className="material-symbols-outlined text-[22px]">chat</span>
                {unreadChatCount > 0 && (
                  <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </Link>

              {/* Nút Tài khoản người dùng sử dụng Ant Design Dropdown */}
              <Dropdown
                open={accountMenuOpen}
                onOpenChange={(open) => {
                  setAccountMenuOpen(open);
                  if (open) setNotificationOpen(false);
                }}
                trigger={['click']}
                placement="bottomRight"
                popupContent={
                  <div
                    id="account-menu"
                    className="w-56 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/15"
                  >
                    <div className="p-1.5">
                      {effectiveRole === 'TRAVELER' ? (
                        <>
                          <Link
                            href="/settings/profile"
                            onClick={() => setAccountMenuOpen(false)}
                            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-surface-container-low"
                          >
                            <span className="material-symbols-outlined text-[19px] text-primary-container">person</span>
                            <span>Hồ sơ cá nhân</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setAccountMenuOpen(false);
                              router.push('/premium');
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 cursor-pointer"
                          >
                            <span
                              className="material-symbols-outlined text-[19px] text-amber-500"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              workspace_premium
                            </span>
                            <span className="flex-1">{premium.premium?.active ? <PremiumStatusText status={premium.premium} /> : <span className="font-bold">Premium</span>}</span>
                            <span className="material-symbols-outlined text-[14px] text-amber-500">auto_awesome</span>
                          </button>
                        </>
                      ) : (
                        accountMenuItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setAccountMenuOpen(false)}
                            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-surface-container-low"
                          >
                            <span className="material-symbols-outlined text-[19px] text-primary-container">{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        ))
                      )}
                    </div>
                    <div className="border-t border-slate-100 p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[19px]">logout</span>
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                }
              >
                <button
                  type="button"
                  aria-expanded={accountMenuOpen}
                  aria-controls="account-menu"
                  className={cn(
                    'flex items-center gap-2 rounded-full px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container cursor-pointer',
                    isTransparent
                      ? 'text-white hover:bg-white/15'
                      : 'text-slate-800 hover:bg-slate-100',
                  )}
                >
                  <OwnPremiumIdentity userId={user.id} url={user.avatarUrl} name={user.fullName || user.email} size="sm" showStatus={false} />
                  <span className={cn('hidden max-w-[140px] truncate text-sm font-semibold leading-tight sm:block', isTransparent ? 'text-white' : 'text-slate-900')}>
                    {user.fullName || user.email}
                  </span>
                  <span
                    className={cn(
                      'material-symbols-outlined hidden text-[18px] transition-transform sm:block',
                      isTransparent ? 'text-white/80' : 'text-slate-500',
                      accountMenuOpen ? 'rotate-180' : '',
                    )}
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </button>
              </Dropdown>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={cn(
                  'inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
                  isTransparent ? 'text-white hover:bg-white/20' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className={cn(
                  'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-md transition-colors',
                  isTransparent
                    ? 'bg-white text-primary hover:bg-white/90'
                    : 'bg-primary-container text-white shadow-primary-container/20 hover:bg-primary hover:shadow-lg',
                )}
              >
                Đăng ký
              </Link>
            </div>
          )}

          <MobileNavigation items={items} onOpenPremium={() => router.push('/premium')} />
        </div>
      </Container>
    </header>

  </>
);
}
