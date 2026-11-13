'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, X, RefreshCw, FlaskConical } from 'lucide-react';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsAsReadMutation,
  useMarkNotificationAsReadMutation,
} from '@/features/notifications/api/notificationsApi';
import { EmptyState } from '@/components/shared';
import { Shimmer } from './AdminSkeletons';

interface AdminNotificationPopoverProps {
  expanded: boolean;
  onClose: () => void;
}

export function AdminNotificationPopover({ expanded, onClose }: AdminNotificationPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const { data, isLoading, isFetching, refetch } = useGetNotificationsQuery(1, {
    refetchOnMountOrArgChange: true,
  });
  const [markAllAsRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsAsReadMutation();
  const [markOneAsRead] = useMarkNotificationAsReadMutation();
  const [mockNotification, setMockNotification] = useState<import('@/features/notifications/api/notificationsApi').AppNotification | null>(null);

  const notifications = mockNotification ? [mockNotification, ...(data?.data ?? [])] : (data?.data ?? []);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key === 'Tab') {
        const controls = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input') ?? [],
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previous?.focus();
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Đóng bảng thông báo"
        className="fixed inset-0 z-[55] cursor-default bg-slate-950/15 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Thông báo quản trị"
        className="fixed bottom-4 z-[60] flex max-h-[85dvh] w-[calc(100vw-32px)] max-w-[420px] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl text-slate-900"
        style={{ left: `clamp(16px, ${expanded ? 312 : 88}px, calc(100vw - 436px))` }}
      >
        <header className="flex flex-nowrap items-center justify-between gap-2 border-b border-slate-100 p-3 sm:px-5">
          <div className="flex min-w-0 flex-nowrap items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Bell size={18} />
            </span>
            <div className="flex min-w-0 flex-nowrap items-baseline gap-1.5 whitespace-nowrap">
              <h2 className="text-sm font-bold leading-tight text-slate-900">Thông báo</h2>
              {unreadCount > 0 && <span className="truncate text-[10px] text-slate-400">{unreadCount} chưa đọc</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
            {(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && (
              <button type="button" onClick={() => setMockNotification({ id: `mock-${Date.now()}`, type: 'USER_REQUEST', title: 'Yêu cầu mới từ người dùng', body: 'Nguyễn Minh vừa gửi yêu cầu hỗ trợ. Đây là thông báo mẫu để kiểm tra giao diện.', isRead: false, createdAt: new Date().toISOString() })} className="rounded-lg p-1.5 text-teal-700 hover:bg-teal-50" title="Tạo thông báo mẫu" aria-label="Tạo thông báo mẫu">
                <FlaskConical size={15} />
              </button>
            )}
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={isMarkingAll}
                onClick={() => { void markAllAsRead().then(() => setMockNotification((item) => item ? { ...item, isRead: true } : null)); }}
                className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck size={14} />
                <span className="hidden sm:inline">Đã đọc hết</span>
              </button>
            )}
            <button
              type="button"
              disabled={isFetching}
              onClick={() => void refetch()}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              ref={closeBtnRef}
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Đóng bảng thông báo"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {isLoading && (
            <div role="status" aria-label="Đang tải thông báo" className="space-y-3 py-2"><span className="sr-only">Đang tải thông báo</span>{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex gap-3 rounded-2xl p-3"><Shimmer className="size-8 shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><Shimmer className="h-3 w-2/3" /><Shimmer className="h-3 w-full" /><Shimmer className="h-3 w-1/2" /></div></div>)}</div>
          )}

          {!isLoading && notifications.length === 0 && (
            <div className="py-8">
              <EmptyState
                title="Chưa có thông báo"
                description="Khi có hoạt động hoặc cập nhật mới từ hệ thống, thông báo sẽ hiển thị tại đây."
              />
            </div>
          )}

          {!isLoading &&
            notifications.map((item) => (
              <article
                key={item.id}
                onClick={() => {
                  if (!item.isRead && !item.id.startsWith('mock-')) void markOneAsRead(item.id);
                }}
                className={`group relative flex cursor-pointer gap-3 rounded-2xl p-3 transition ${
                  item.isRead
                    ? 'bg-transparent hover:bg-slate-50 text-slate-600'
                    : 'bg-teal-50/60 hover:bg-teal-50 text-slate-900 font-medium'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  <span
                    className={`flex size-8 items-center justify-center rounded-xl text-sm ${
                      item.isRead
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-teal-600 text-white shadow-sm'
                    }`}
                  >
                    <Bell size={15} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-xs font-semibold text-slate-900">{item.title}</h3>
                    <time className="shrink-0 text-[10px] text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 font-normal">
                    {item.body}
                  </p>
                </div>
                {!item.isRead && (
                  <span
                    className="absolute right-2 top-2 size-2 rounded-full bg-teal-600"
                    aria-label="Chưa đọc"
                  />
                )}
              </article>
            ))}
        </div>
      </div>
    </>,
    document.body,
  );
}

