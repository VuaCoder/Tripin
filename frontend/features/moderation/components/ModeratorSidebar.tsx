'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Compass,
  Building2,
  Star,
  Flag,
  ShieldAlert,
  LifeBuoy,
  Settings,
  LogOut,
  PanelLeftOpen,
  PanelLeftClose,
  Search,
  X,
  Command,
  Bell,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectUser, useLogout } from '@/features/auth';
import { useAgencyNotifications } from '@/features/agency/notifications';
import { AgencyNotificationPopover } from '@/features/agency/components/AgencyNotificationPopover';
import styles from '@/features/agency/components/AgencySidebar.module.css';

interface ModeratorSidebarProps {
  initialExpanded?: boolean;
}

export function ModeratorSidebar({ initialExpanded = true }: ModeratorSidebarProps) {
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
  const { count } = useAgencyNotifications();
  const logout = useLogout();
  const pathname = usePathname();
  const router = useRouter();

  const moderatorName = user?.fullName?.trim() || 'Kiểm duyệt viên';
  const ToggleIcon = expanded ? PanelLeftClose : PanelLeftOpen;
  const closeMenu = () => {
    setExpanded(false);
    setQuery('');
    setShowProfileMenu(false);
  };
  const toggleLabel = expanded ? 'Thu gọn thanh bên' : 'Mở rộng thanh bên';

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
      label: 'Vận hành',
      items: [
        { href: '/moderator', label: 'Tổng quan', icon: LayoutDashboard, permission: 'moderation:dashboard' },
        { href: '/moderator/tours', label: 'Duyệt tour', icon: Compass, permission: 'tour:list-all' },
        { href: '/moderator/agencies', label: 'Xác minh agency', icon: Building2, permission: 'agency:verify' },
      ],
    },
    {
      label: 'Chất lượng & Nội dung',
      items: [
        { href: '/moderator/reviews', label: 'Kiểm duyệt đánh giá', icon: Star, permission: 'review:moderate' },
        { href: '/moderator/reports', label: 'Báo cáo vi phạm', icon: Flag, permission: 'dispute:resolve' },
      ],
    },
    {
      label: 'Khiếu nại & Hỗ trợ',
      items: [
        { href: '/moderator/complaints', label: 'Khiếu nại dịch vụ tour', icon: ShieldAlert, permission: 'dispute:resolve' },
        { href: '/moderator/support-tickets', label: 'Yêu cầu hỗ trợ sàn', icon: LifeBuoy, permission: 'complaint:handle' },
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
        (item) =>
          (!item.permission || user?.permissions?.includes(item.permission)) &&
          (!searchTerm || normalize(`${item.label} ${group.label}`).includes(searchTerm)),
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
        aria-label="Điều hướng kiểm duyệt"
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
              <strong>Kiểm duyệt Tripri</strong>
              <small>Không gian kiểm duyệt</small>
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
                router.push(target.href);
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

        <nav className={styles.navigation} aria-label="Chức năng kiểm duyệt">
          {visibleGroups.map((group) => (
            <section key={group.label} className={styles.group} aria-label={group.label}>
              <h2 className={styles.groupTitle}>{group.label}</h2>
              {group.items.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href !== '/moderator' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    aria-label={label}
                    aria-current={active ? 'page' : undefined}
                    className={styles.link}
                    onClick={() => setQuery('')}
                  >
                    <Icon size={21} aria-hidden="true" />
                    <span className={styles.label}>{label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
          {searchTerm && (
            <p role="status" className={styles.searchStatus}>
              {visibleGroups.length === 0
                ? 'Không tìm thấy chức năng phù hợp.'
                : `${visibleGroups.reduce((total, group) => total + group.items.length, 0)} chức năng phù hợp. Nhấn Enter để mở kết quả đầu tiên.`}
            </p>
          )}
        </nav>

        <div className={styles.footer}>
          <div className={styles.accountRow}>
            <button
              type="button"
              ref={profileRef}
              className={styles.profile}
              data-no-preloader="true"
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
              aria-label={`Hồ sơ kiểm duyệt viên: ${moderatorName}`}
              title={moderatorName}
              onClick={(event) => {
                event.preventDefault();
                setShowProfileMenu((prev) => !prev);
              }}
            >
              <span className={styles.avatar}>
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                ) : (
                  moderatorName.slice(0, 1).toLocaleUpperCase('vi')
                )}
              </span>
              <span className={styles.company}>{moderatorName}</span>
            </button>
            <button
              type="button"
              data-no-preloader="true"
              aria-haspopup="dialog"
              aria-expanded={showNotificationModal}
              className={styles.notification}
              aria-label={`Thông báo${count !== undefined && count > 0 ? `, ${count > 9 ? '9+ tin nhắn' : `${count} chưa đọc`}` : ''}`}
              title={count !== undefined && count > 9 ? '9+ tin nhắn' : 'Thông báo'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNotificationModal((prev) => !prev);
              }}
            >
              <Bell size={20} aria-hidden="true" />
              {count !== undefined && count > 0 && (
                <span className={styles.badge} aria-hidden="true">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          </div>
          {showProfileMenu && (
            <div
              ref={profileMenuRef}
              className={styles.profileMenu}
              role="menu"
              aria-label="Tùy chọn tài khoản"
            >
              <Link
                href="/settings/profile"
                className={styles.profileMenuItem}
                role="menuitem"
                onClick={() => setShowProfileMenu(false)}
              >
                <Settings size={17} aria-hidden="true" />
                <span>Cài đặt</span>
              </Link>
              <button
                type="button"
                className={styles.profileMenuItem}
                role="menuitem"
                onClick={() => {
                  setShowProfileMenu(false);
                  window.dispatchEvent(new Event('tripri:route-navigation-start'));
                  void logout();
                }}
              >
                <LogOut size={17} aria-hidden="true" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {showNotificationModal && (
        <AgencyNotificationPopover expanded={expanded} onClose={() => setShowNotificationModal(false)} />
      )}
    </>
  );
}

