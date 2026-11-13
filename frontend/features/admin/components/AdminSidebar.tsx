'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FolderTree,
  Ticket,
  BadgePercent,
  ShieldCheck,
  History,
  LogOut,
  PanelLeftOpen,
  PanelLeftClose,
  Search,
  X,
  Command,
  Home,
  Bell,
  MessageSquare,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser, useLogout } from '@/features/auth';
import { selectAccessToken } from '@/features/auth/store/authSlice';
import { baseApi } from '@/store/api/baseApi';
import { useGetUnreadCountQuery } from '@/features/notifications/api/notificationsApi';
import { AdminNotificationPopover } from './AdminNotificationPopover';
import styles from '@/features/agency/components/AgencySidebar.module.css';

interface AdminSidebarProps {
  initialExpanded?: boolean;
}

export function AdminSidebar({ initialExpanded = true }: AdminSidebarProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [query, setQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const focusSearch = useRef(false);
  const shortcut = '⌘K';
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();
  const logout = useLogout();
  const { data: unreadCount = 0 } = useGetUnreadCountQuery(undefined, {
    skip: !user,
    pollingInterval: 30_000,
  });
  let pathname = '';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    pathname = usePathname() || '';
  } catch {
    pathname = '';
  }
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }

  const adminName = user?.fullName?.trim() || 'Super Admin';
  const ToggleIcon = expanded ? PanelLeftClose : PanelLeftOpen;
  const closeMenu = () => {
    setExpanded(false);
    setQuery('');
    setShowProfileMenu(false);
    setShowNotificationModal(false);
  };
  const toggleLabel = expanded ? 'Thu gọn thanh bên' : 'Mở rộng thanh bên';

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN' || !token) return;
    const socket = io(new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').origin, {
      path: '/socket.io', auth: { token }, withCredentials: true, reconnection: true,
      reconnectionDelay: 1000, reconnectionDelayMax: 10000,
    });
    const sync = () => dispatch(baseApi.util.invalidateTags(['Notification']));
    socket.on('notification:new', () => {
      sync();
      setShowNotificationModal(true);
    });
    socket.on('connect', sync);
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [dispatch, token, user?.id, user?.role]);

  useEffect(() => {
    if (!showProfileMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!profileMenuRef.current?.contains(target) && !profileRef.current?.contains(target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showProfileMenu]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focusSearch.current = true;
        setExpanded(true);
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (expanded && focusSearch.current) {
      searchRef.current?.focus();
      focusSearch.current = false;
    }
  }, [expanded]);

  const groups = [
    {
      label: 'Theo dõi',
      items: [
        { href: '/super-admin', label: 'Tổng quan', icon: LayoutDashboard },
        { href: '/super-admin/audit-logs', label: 'Lịch sử hoạt động', icon: History },
        { href: '/super-admin/agency-chat', label: 'Nhắn tin', icon: MessageSquare },
      ],
    },
    {
      label: 'Quản lý nội dung',
      items: [
        { href: '/super-admin/users', label: 'Tài khoản người dùng', icon: Users },
        { href: '/super-admin/categories', label: 'Danh mục tour', icon: FolderTree },
        { href: '/super-admin/promotions', label: 'Khuyến mãi', icon: Ticket },
      ],
    },
    {
      label: 'Quy định & chi phí',
      items: [
        { href: '/super-admin/settings/commission', label: 'Phí dịch vụ', icon: BadgePercent },
        { href: '/super-admin/policies', label: 'Chính sách & điều khoản', icon: ShieldCheck },
      ],
    },
  ];

  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLocaleLowerCase('vi')
      .trim();
  const searchTerm = normalize(query);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !searchTerm || normalize(`${item.label} ${group.label}`).includes(searchTerm),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {expanded && (
        <button
          type="button"
          aria-label="Đóng menu điều hướng"
          className="fixed inset-0 z-40 bg-slate-950/30 sm:hidden"
          onClick={closeMenu}
        />
      )}
      <aside
        aria-label="Điều hướng quản trị"
        data-expanded={expanded}
        className={styles.sidebar}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            if (showProfileMenu) {
              setShowProfileMenu(false);
            } else {
              closeMenu();
              toggleRef.current?.focus();
            }
          }
        }}
      >
        <header className={styles.header}>
          <div className={styles.brand}>
            <svg className={styles.brandMark} role="img" aria-label="Logo Tripri" viewBox="0 0 70 70">
              <image href="/images/tripri-logo.svg" width="260" height="70" />
            </svg>
            <span className={styles.brandName}>
              <strong>Tripri Admin</strong>
              <small>Quản trị hệ thống</small>
            </span>
          </div>
          <button
            type="button"
            ref={toggleRef}
            className={styles.toggle}
            title={toggleLabel}
            aria-label={toggleLabel}
            aria-expanded={expanded}
            aria-pressed={expanded}
            onClick={() => {
              if (expanded) closeMenu();
              else setExpanded(true);
            }}
          >
            <ToggleIcon size={20} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.searchArea}>
          {!expanded && (
            <button
              type="button"
              className={styles.searchTrigger}
              aria-label="Tìm chức năng"
              title={`Tìm chức năng (${shortcut})`}
              onClick={() => {
                focusSearch.current = true;
                setExpanded(true);
              }}
            >
              <Search size={20} />
            </button>
          )}
          <form
            className={styles.searchForm}
            role="search"
            aria-label="Tìm chức năng"
            onSubmit={(event) => {
              event.preventDefault();
              const target = visibleGroups[0]?.items[0];
              if (target && searchTerm) {
                if (router) {
                  router.push(target.href);
                } else if (typeof window !== 'undefined') {
                  window.location.href = target.href;
                }
                setQuery('');
              }
            }}
          >
            <Search size={18} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-label="Tìm chức năng"
              aria-keyshortcuts="Control+k Meta+k"
              placeholder="Tìm chức năng…"
              value={query}
              tabIndex={expanded ? 0 : -1}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.searchClear}
                aria-label="Xoá tìm kiếm"
                title="Xoá tìm kiếm"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
              >
                <X size={14} />
              </button>
            )}
            <kbd title="⌘K — Ctrl+K trên Windows" aria-label="Command K">
              <Command size={13} aria-hidden="true" />
              <span>K</span>
            </kbd>
          </form>
        </div>

        <nav className={styles.navigation} aria-label="Chức năng quản trị">
          {visibleGroups.map((group) => (
            <section key={group.label} className={styles.group} aria-label={group.label}>
              <h2 className={styles.groupTitle}>{group.label}</h2>
              {group.items.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href === '/super-admin' && pathname === '/super-admin') ||
                  (href !== '/super-admin' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    data-no-preloader="true"
                    title={label}
                    aria-label={label}
                    aria-current={active ? 'page' : undefined}
                    className={styles.link}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span className={styles.label}>{label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
          {visibleGroups.length === 0 && (
            <p className={styles.searchStatus}>Không tìm thấy chức năng phù hợp.</p>
          )}
        </nav>

        <footer className={styles.footer}>
          <div className={styles.accountRow}>
            <button
              type="button"
              ref={profileRef}
              className={styles.profile}
              aria-label="Menu tài khoản Super Admin"
              aria-expanded={showProfileMenu}
              aria-haspopup="menu"
              onClick={() => setShowProfileMenu((prev) => !prev)}
            >
              <span className={styles.avatar} aria-hidden="true">
                SA
              </span>
              <span className={styles.company}>
                {adminName}
                <small className="block text-slate-400 font-normal">Super Admin</small>
              </span>
            </button>
            <button
              type="button"
              data-no-preloader="true"
              aria-haspopup="dialog"
              aria-expanded={showNotificationModal}
              className={styles.notification}
              aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}
              title="Thông báo"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNotificationModal((prev) => !prev);
              }}
            >
              <Bell size={20} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          </div>

          {showProfileMenu && (
            <div
              ref={profileMenuRef}
              role="menu"
              aria-label="Menu cá nhân"
              className={styles.profileMenu}
            >
              <Link
                href="/home"
                role="menuitem"
                className={styles.profileMenuItem}
                onClick={() => setShowProfileMenu(false)}
              >
                <Home size={16} />
                <span>Trang chủ Tripri</span>
              </Link>
              <button
                type="button"
                role="menuitem"
                className={styles.profileMenuItem}
                onClick={() => {
                  setShowProfileMenu(false);
                  logout();
                }}
              >
                <LogOut size={16} />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </footer>
      </aside>

      {showNotificationModal && (
        <AdminNotificationPopover
          expanded={expanded}
          onClose={() => setShowNotificationModal(false)}
        />
      )}
    </>
  );
}

export default AdminSidebar;
