'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  CalendarCheck, 
  Compass, 
  PlusCircle, 
  Sparkles, 
  BadgePercent, 
  Bell, 
  LogOut, 
  PanelLeftOpen, 
  PanelLeftClose, 
  Search, 
  X, 
  Command
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectUser, useLogout } from '@/features/auth';
import { useAgencyNotifications } from '../notifications';
import styles from './AgencySidebar.module.css';
import { AgencyNotificationPopover } from './AgencyNotificationPopover';

/** Compatibility export; the rail now sits on the left. */
export function AgencyRightSidebar({ initialExpanded = false }: { initialExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [pinned, setPinned] = useState(false);
  const [query, setQuery] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const focusSearch = useRef(false);
  const shortcut = '⌘K';
  const user = useAppSelector(selectUser);
  const logout = useLogout();
  const pathname = usePathname();
  const router = useRouter();
  const { count, connected, latest } = useAgencyNotifications();

  const companyName = user?.agencyProfile?.companyName?.trim() || 'Đối tác du lịch';
  const ToggleIcon = pinned ? PanelLeftClose : PanelLeftOpen;
  const closeMenu = () => { if (!pinned) setExpanded(false); setQuery(''); };
  const unpinAndClose = () => { setPinned(false); setExpanded(false); setQuery(''); };
  const toggleLabel = pinned ? 'Bỏ ghim và thu gọn thanh bên' : expanded ? 'Ghim mở thanh bên' : 'Mở rộng thanh bên';

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
    if (expanded && focusSearch.current) { searchRef.current?.focus(); focusSearch.current = false; }
  }, [expanded]);

  // Clean, harmonized groups with intuitive Lucide icons
  const groups = [
    { label: 'Vận hành', items: [
      { href: '/agency', label: 'Tổng quan', icon: LayoutDashboard, permission: 'agency:dashboard' },
      { href: '/agency/bookings', label: 'Đơn đặt chỗ', icon: CalendarCheck, permission: 'agency:bookings-view' },
    ] },
    { label: 'Sản phẩm', items: [
      { href: '/agency/tours', label: 'Quản lý tour', icon: Compass, permission: 'tour:update-own' },
      { href: '/agency/tours/new', label: 'Tạo tour mới', icon: PlusCircle, permission: 'tour:create' },
      { href: '/agency/tours/import', label: 'Nhập tour / AI', icon: Sparkles, permission: 'tour:import' },
    ] },
    { label: 'Đối tác', items: [
      { href: '/agency/settings/commission', label: 'Chiết khấu hoa hồng', icon: BadgePercent, permission: '' },
      { href: '/agency/notifications', label: 'Thông báo', icon: Bell, permission: '' },
    ] },
  ];

  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi').trim();
  const searchTerm = normalize(query);
  const visibleGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) =>
    (!item.permission || user?.permissions?.includes(item.permission)) &&
    (item.href !== '/agency/notifications' || searchTerm) &&
    (!searchTerm || normalize(`${item.label} ${group.label}`).includes(searchTerm)),
  ) })).filter((group) => group.items.length > 0);

  return <>
    {expanded && !pinned && <button type="button" aria-label="Đóng menu điều hướng" className="fixed inset-0 z-40 bg-slate-950/30 sm:hidden" onClick={closeMenu} />}
    <aside aria-label="Điều hướng đối tác" data-expanded={expanded} data-pinned={pinned} className={styles.sidebar}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') setExpanded(true); }}
      onPointerLeave={(event) => { if (event.pointerType !== 'touch' && !showNotificationModal) closeMenu(); }}
      onFocus={(event) => { if (!(event.target as HTMLElement).closest('button')) setExpanded(true); }}
      onBlur={(event) => { if (!showNotificationModal && !event.currentTarget.contains(event.relatedTarget)) closeMenu(); }}
      onKeyDown={(event) => { 
        if (event.key === 'Escape') { 
          event.preventDefault(); 
          if (showNotificationModal) {
            setShowNotificationModal(false);
          } else {
            unpinAndClose(); 
            toggleRef.current?.focus(); 
          }
        } 
      }}>
      <header className={styles.header}>
        <div className={styles.brand}><svg className={styles.brandMark} role="img" aria-label="Logo Tripri" viewBox="0 0 70 70"><image href="/images/tripri-logo.svg" width="260" height="70" /></svg><span className={styles.brandName}><strong>Đối tác Tripri</strong><small>Không gian vận hành</small></span></div>
        <button type="button" ref={toggleRef} className={styles.toggle} title={toggleLabel} aria-label={toggleLabel} aria-expanded={expanded} aria-pressed={pinned} onClick={() => { if (pinned) unpinAndClose(); else if (expanded) setPinned(true); else setExpanded(true); }}><ToggleIcon size={20} aria-hidden="true" /></button>
      </header>
      <div className={styles.searchArea}>
        {!expanded && <button type="button" className={styles.searchTrigger} aria-label="Tìm chức năng" title={`Tìm chức năng (${shortcut})`} onClick={() => { focusSearch.current = true; setExpanded(true); }}><Search size={20} /></button>}
        <form className={styles.searchForm} role="search" aria-label="Tìm chức năng" onSubmit={(event) => { event.preventDefault(); const target = visibleGroups[0]?.items[0]; if (target && searchTerm) { if (target.href === '/agency/notifications') { setShowNotificationModal(true); } else { if (target.href !== window.location.pathname + window.location.search) window.dispatchEvent(new Event('tripri:route-navigation-start')); router.push(target.href); closeMenu(); } } }}>
          <Search size={18} aria-hidden="true" />
          <input ref={searchRef} type="search" aria-label="Tìm chức năng" aria-keyshortcuts="Control+k Meta+k" placeholder="Tìm chức năng…" value={query} tabIndex={expanded ? 0 : -1} onChange={(event) => setQuery(event.target.value)} />
          {query && <button type="button" className={styles.searchClear} aria-label="Xoá tìm kiếm" title="Xoá tìm kiếm" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={14} /></button>}
          <kbd title="⌘K — Ctrl+K trên Windows" aria-label="Command K"><Command size={13} aria-hidden="true" /><span>K</span></kbd>
        </form>
      </div>
      <nav className={styles.navigation} aria-label="Chức năng đối tác">
        {visibleGroups.map((group) => <section key={group.label} className={styles.group} aria-label={group.label}>
          <h2 className={styles.groupTitle}>{group.label}</h2>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href ||
              (href.startsWith('/agency/settings') && pathname.startsWith('/agency/settings')) ||
              (href === '/agency/tours' && pathname.startsWith('/agency/tours/') && !['/agency/tours/new', '/agency/tours/import'].includes(pathname)) ||
              (href === '/agency/bookings' && pathname.startsWith('/agency/bookings/'));
            return (
              <Link 
                key={href} 
                href={href} 
                data-no-preloader={href === '/agency/notifications' ? 'true' : undefined}
                data-route-preloader={href !== '/agency/notifications' ? 'true' : undefined}
                title={label} 
                aria-label={label} 
                aria-current={active ? 'page' : undefined} 
                className={styles.link} 
                onClick={(e) => {
                  if (href === '/agency/notifications') {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowNotificationModal((prev) => !prev);
                    return;
                  }
                  closeMenu();
                }}
              >
                <Icon size={21} aria-hidden="true" />
                <span className={styles.label}>{label}</span>
              </Link>
            );
          })}
        </section>)}
        {searchTerm && <p role="status" className={styles.searchStatus}>{visibleGroups.length === 0 ? 'Không tìm thấy chức năng phù hợp.' : `${visibleGroups.reduce((total, group) => total + group.items.length, 0)} chức năng phù hợp. Nhấn Enter để mở kết quả đầu tiên.`}</p>}
      </nav>
      <div className={styles.footer}>
        <div className={styles.accountRow}>
          <Link href="/agency/settings/profile" data-route-preloader="true" className={styles.profile} aria-label={`Hồ sơ đối tác: ${companyName}`} title={companyName} onClick={closeMenu}>
            <span className={styles.avatar}>{user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full rounded-lg object-cover" />
            ) : companyName.slice(0, 1).toLocaleUpperCase('vi')}</span>
            <span className={styles.company}>{companyName}</span>
          </Link>
          <Link 
            href="/agency/notifications" 
            data-no-preloader="true"
            aria-haspopup="dialog"
            aria-expanded={showNotificationModal}
            className={styles.notification} 
            aria-label={`Thông báo${count === undefined ? '' : `, ${count} chưa đọc`}`} 
            title={connected ? 'Thông báo · Đang kết nối trực tiếp' : 'Thông báo · Tự cập nhật mỗi 30 giây'} 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowNotificationModal((prev) => !prev);
            }}
          >
            <Bell size={20} aria-hidden="true" />
            {count !== undefined && count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
            <span className={styles.connectionDot} data-connected={connected} />
          </Link>
        </div>
        {/* Styled prominent logout button with distinct red-tint to prevent accidental clicks */}
        <button 
          type="button" 
          onClick={() => { window.dispatchEvent(new Event('tripri:route-navigation-start')); logout(); }}
          className={styles.logoutButton} 
          aria-label="Đăng xuất" 
          title="Đăng xuất tài khoản"
        >
          <LogOut size={20} />
          <span className={styles.label}>Đăng xuất</span>
        </button>
      </div>
    </aside>

    {showNotificationModal && <AgencyNotificationPopover expanded={expanded} onClose={() => setShowNotificationModal(false)} />}

    <div role="status" aria-live="polite" className="sr-only">{latest ? `Thông báo mới: ${latest}` : ''}</div>
  </>;
}
