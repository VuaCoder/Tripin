'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth/store/authSlice';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import {
  useGetAgencyComplaintsQuery,
  useGetMyComplaintsQuery,
} from '@/features/complaints/api/complaintsApi';
import { ComplaintConversationView } from '@/features/complaints/components/ComplaintConversationView';
import { STATUS_LABELS } from '@/features/complaints/labels';
import {
  chatApi,
  useConversationQuery,
  useConversationsQuery,
  useReadConversationMutation,
  useSendMessageMutation,
} from './api';
import { useChat } from './ChatProvider';
import { ConversationWelcome } from './ConversationWelcome';
import { mergeMessages, type Message } from './types';

const time = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const denied = (error: unknown) =>
  [403, 404].includes((error as { status?: number })?.status ?? 0) ||
  ['FORBIDDEN', 'NOT_FOUND'].includes((error as { code?: string })?.code ?? '');

export function ConversationPage({ id }: { id?: string }) {
  const user = useAppSelector(selectUser);
  if (!user || !user.permissions.includes('chat:use')) {
    return <p role="alert">Bạn không có quyền sử dụng tin nhắn.</p>;
  }
  return <ChatWorkspace key={user.id} id={id} />;
}

function ChatWorkspace({ id }: { id?: string }) {
  const user = useAppSelector(selectUser);
  const searchParams = useSearchParams();
  const paramTab = searchParams?.get('tab') ?? null;
  const paramTicketId = searchParams?.get('ticketId') ?? null;

  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch, isFetching } = useConversationsQuery(page, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const chat = useChat();

  const isAgency = user?.role === 'AGENCY';
  const myComplaintsQuery = useGetMyComplaintsQuery(undefined, { skip: isAgency });
  const agencyComplaintsQuery = useGetAgencyComplaintsQuery(undefined, { skip: !isAgency });

  const complaintListResult = isAgency ? agencyComplaintsQuery.data : myComplaintsQuery.data;
  const complaints = complaintListResult?.items ?? [];
  const complaintsLoading = isAgency ? agencyComplaintsQuery.isLoading : myComplaintsQuery.isLoading;
  const activeComplaints = complaints.filter((c) => c.status !== 'CLOSED');
  const activeComplaintsCount = activeComplaints.length;
  const complaintsCount = complaints.length;

  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(`dismissed_complaint_banner_${user?.id || 'guest'}`) === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
    try {
      sessionStorage.setItem(`dismissed_complaint_banner_${user?.id || 'guest'}`, 'true');
    } catch {
      // ignore
    }
  }, [user?.id]);

  const [activeTab, setActiveTab] = useState<'chats' | 'complaints'>(() => {
    if (paramTab === 'complaints' || paramTicketId) return 'complaints';
    return 'chats';
  });

  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(
    paramTicketId ?? (complaints[0]?.id || undefined),
  );

  const handleOpenComplaintsTab = useCallback(() => {
    handleDismissBanner();
    setActiveTab('complaints');
    if (!selectedTicketId && complaints[0]) {
      setSelectedTicketId(complaints[0].id);
    }
  }, [complaints, handleDismissBanner, selectedTicketId]);

  // Tự động chuyển sang tab khiếu nại nếu khách có phiếu khiếu nại chưa xử lý nhưng chưa có tin nhắn trực tiếp nào
  useEffect(() => {
    if (!id && !paramTab && !isLoading && !data?.data?.length && activeComplaintsCount > 0 && !isBannerDismissed) {
      setActiveTab('complaints');
      if (!selectedTicketId && complaints[0]) {
        setSelectedTicketId(complaints[0].id);
      }
    }
  }, [isLoading, data?.data?.length, activeComplaintsCount, isBannerDismissed, id, paramTab, complaints, selectedTicketId]);

  useEffect(() => {
    if (paramTicketId) {
      setSelectedTicketId(paramTicketId);
      setActiveTab('complaints');
    }
  }, [paramTicketId]);

  useEffect(() => {
    if (activeTab === 'complaints' && !selectedTicketId && complaints[0]) {
      setSelectedTicketId(complaints[0].id);
    }
  }, [activeTab, selectedTicketId, complaints]);

  const isComplaintDetailOpenOnMobile = activeTab === 'complaints' && Boolean(selectedTicketId);

  return (
    <section aria-label="Tin nhắn & Khiếu nại" className="w-full flex-1 flex flex-col min-h-0">
      <div className="mb-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <h1 className="text-xl font-bold text-slate-900">Hộp thư &amp; Tin nhắn</h1>
        {activeComplaintsCount > 0 ? (
          <span className="text-xs font-semibold text-slate-500">
            Bạn có <strong className="text-brand-teal">{activeComplaintsCount}</strong> phiếu khiếu nại cần xử lý
          </span>
        ) : complaintsCount > 0 ? (
          <span className="text-xs font-semibold text-slate-400">
            {complaintsCount} phiếu khiếu nại (đã hoàn tất)
          </span>
        ) : null}
      </div>

      {!chat.connected && (
        <div
          role="status"
          className="mb-2 shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900"
        >
          {chat.status}
          <button type="button" onClick={chat.reconnect} className="font-semibold underline">
            Kết nối lại
          </button>
        </div>
      )}

      <div className="grid h-[calc(100dvh-8.5rem)] min-h-[460px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Sidebar danh sách */}
        <aside
          aria-label="Danh sách hộp thư"
          className={`${id || isComplaintDetailOpenOnMobile ? 'hidden md:flex' : 'flex'} flex-col border-r border-slate-200/80 bg-slate-50/40`}
        >
          {/* Chuyển tab Trò chuyện / Phiếu khiếu nại */}
          <div className="flex border-b border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setActiveTab('chats')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors border-b-2 ${
                activeTab === 'chats'
                  ? 'border-brand-teal text-brand-teal bg-teal-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <MessageSquare size={15} />
              <span>Trò chuyện trực tiếp</span>
            </button>
            <button
              type="button"
              onClick={handleOpenComplaintsTab}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors border-b-2 ${
                activeTab === 'complaints'
                  ? 'border-brand-teal text-brand-teal bg-teal-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <ShieldAlert size={15} />
              <span>Phiếu khiếu nại</span>
              {activeComplaintsCount > 0 && (
                <span className="rounded-full bg-brand-teal px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {activeComplaintsCount}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'chats' ? (
            /* Tab 1: Danh sách cuộc trò chuyện trực tiếp */
            <>
              {isLoading ? (
                <p role="status" className="p-4 text-sm text-slate-500">
                  Đang tải…
                </p>
              ) : error ? (
                <div role="alert" className="p-4 text-sm text-red-600">
                  Không thể tải danh sách.{' '}
                  <button onClick={() => void refetch()} className="underline">
                    Thử lại
                  </button>
                </div>
              ) : !data?.data.length ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="p-5 text-sm leading-6 text-slate-500">
                    <p className="hidden md:block">Chưa có cuộc trò chuyện trực tiếp nào.</p>
                    {!isBannerDismissed && activeComplaintsCount > 0 && (
                      <div className="relative mt-3 rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-900 shadow-2xs">
                        <button
                          type="button"
                          onClick={handleDismissBanner}
                          className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                          title="Đóng thông báo"
                          aria-label="Đóng thông báo"
                        >
                          <X size={14} />
                        </button>
                        <p className="font-bold flex items-center gap-1.5 pr-6">
                          <ShieldAlert size={14} className="text-brand-teal shrink-0" />
                          <span>Bạn đang có {activeComplaintsCount} phiếu khiếu nại tour</span>
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenComplaintsTab}
                          className="mt-1.5 font-bold text-brand-teal underline hover:text-teal-950 block text-left cursor-pointer"
                        >
                          Chuyển sang xem phiếu khiếu nại ➔
                        </button>
                      </div>
                    )}
                  </div>
                  {!id && (
                    <div className="h-full md:hidden">
                      <ConversationWelcome guide={user?.role === 'TOUR_GUIDE'} />
                    </div>
                  )}
                </div>
              ) : (
                <nav className="flex-1 overflow-y-auto ant-scrollbar">
                  {data.data.map((item) => (
                    <Link
                      key={item.id}
                      href={`/conversations/${item.id}`}
                      aria-current={id === item.id ? 'page' : undefined}
                      className={`block border-b border-slate-100 p-4 transition-colors hover:bg-slate-100/70 ${
                        id === item.id ? 'bg-teal-50/80 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-slate-900">
                          {item.counterpart?.fullName || 'Tài khoản không còn khả dụng'}
                        </span>
                        {item.unreadCount > 0 && (
                          <span
                            aria-label={`${item.unreadCount} tin chưa đọc`}
                            className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-bold text-white shadow-sm"
                          >
                            {item.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {item.lastMessage?.text || 'Chưa có tin nhắn'}
                      </p>
                      <time className="mt-1 block text-xs text-slate-400">{time(item.updatedAt)}</time>
                    </Link>
                  ))}
                </nav>
              )}
              {Boolean(data && data.meta.totalPages > 1) && (
                <div className="flex items-center justify-between border-t border-slate-200/80 bg-white p-3 text-sm">
                  <button
                    type="button"
                    aria-label="Trang trước"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((value) => value - 1)}
                    className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                    <span className="sr-only">Trước</span>
                  </button>
                  <span className="text-xs font-semibold text-slate-600">Trang {page}</span>
                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={!data || page >= data.meta.totalPages || isFetching}
                    onClick={() => setPage((value) => value + 1)}
                    className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronRight size={16} />
                    <span className="sr-only">Sau</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Tab 2: Danh sách phiếu khiếu nại dịch vụ tour */
            <>
              {complaintsLoading ? (
                <p role="status" className="p-4 text-sm text-slate-500">
                  Đang tải danh sách khiếu nại…
                </p>
              ) : complaints.length === 0 ? (
                <div className="flex-1 p-6 text-center text-xs text-slate-500">
                  <ShieldAlert className="mx-auto mb-2 size-8 text-slate-300" />
                  <p className="font-semibold text-slate-700">Chưa có phiếu khiếu nại nào</p>
                  <p className="mt-1 text-slate-400 leading-relaxed">
                    Nếu chuyến đi phát sinh vấn đề không đúng cam kết, bạn có thể gửi phiếu khiếu nại từ trang chi tiết tour.
                  </p>
                </div>
              ) : (
                <nav className="flex-1 overflow-y-auto ant-scrollbar">
                  {complaints.map((item) => {
                    const statusInfo = STATUS_LABELS[item.status] || { label: item.status, className: '' };
                    const isSelected = selectedTicketId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedTicketId(item.id)}
                        className={`w-full text-left border-b border-slate-100 p-3.5 transition-colors hover:bg-slate-100/70 cursor-pointer ${
                          isSelected ? 'bg-teal-50/90 font-medium' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="font-mono text-xs font-bold text-brand-teal">{item.ticketCode}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="truncate text-sm font-semibold text-slate-900">{item.subject}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">Tour: {item.tourTitle || 'Tour'}</p>
                        <time className="mt-1 block text-[11px] text-slate-400">
                          {time(item.lastMessageAt || item.createdAt)}
                        </time>
                      </button>
                    );
                  })}
                </nav>
              )}
            </>
          )}
        </aside>

        {/* Khung nội dung bên phải */}
        {activeTab === 'complaints' ? (
          selectedTicketId ? (
            <div className="h-full min-h-0 flex-1 overflow-hidden p-2 sm:p-3 bg-slate-100/60 flex flex-col">
              <ComplaintConversationView
                ticketId={selectedTicketId}
                userRole={user?.role as any}
                userId={user?.id || ''}
                onBack={() => setSelectedTicketId(undefined)}
              />
            </div>
          ) : (
            <div className="hidden min-w-0 md:flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-teal-50 text-brand-teal mb-3 shadow-2xs">
                <ShieldAlert size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Hộp thư khiếu nại dịch vụ</h3>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                Chọn một phiếu khiếu nại từ danh sách bên trái để theo dõi tiến trình và trao đổi phương án xử lý trực tiếp với đối tác.
              </p>
            </div>
          )
        ) : id ? (
          <Thread key={id} id={id} />
        ) : (
          <div className="hidden min-w-0 md:block">
            {!isLoading && !error && (
              <ConversationWelcome
                guide={user?.role === 'TOUR_GUIDE'}
                recent={
                  data?.data[0]
                    ? { id: data.data[0].id, name: data.data[0].counterpart?.fullName || 'người đồng hành' }
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Thread({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const chat = useChat();
  const detail = useConversationQuery(id);
  const [sendRest] = useSendMessageMutation();
  const [markRead] = useReadConversationMutation();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const synchronizedIds = useRef(new Set<string>());
  const historyLoaded = useRef(false);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [newMessages, setNewMessages] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [visible, setVisible] = useState(true);
  const [retrySync, setRetrySync] = useState(0);
  const [readCycle, setReadCycle] = useState(0);
  const [readError, setReadError] = useState('');
  const mounted = useRef(true);
  const scroll = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const previousHeight = useRef<number | null>(null);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const sendingRef = useRef(false);
  const readBusy = useRef(false);
  const lastRead = useRef('');
  const requests = useRef(new Set<{ abort: () => void }>());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requests.current.forEach((request) => request.abort());
    };
  }, []);

  const add = useCallback((incoming: Message[]) => {
    if (!mounted.current) return;
    messagesRef.current = mergeMessages(messagesRef.current, incoming);
    setMessages(messagesRef.current);
  }, []);

  const block = useCallback(() => {
    if (!mounted.current) return;
    setBlocked(true);
    messagesRef.current = [];
    setMessages([]);
    setDraft('');
  }, []);

  const fetchPage = useCallback(
    async (before?: string) => {
      const request = dispatch(
        chatApi.endpoints.messages.initiate({ id, before }, { forceRefetch: true, subscribe: false }),
      );
      requests.current.add(request);
      try {
        return await request.unwrap();
      } finally {
        requests.current.delete(request);
      }
    },
    [dispatch, id],
  );

  const synchronize = useCallback(() => {
    const run = async () => {
      if (!mounted.current) return;
      const known = new Set(synchronizedIds.current);
      const initialLoad = !historyLoaded.current;
      const incoming: Message[] = [];
      let before: string | undefined;
      try {
        while (mounted.current) {
          const result = await fetchPage(before);
          incoming.push(...result.items);
          if (initialLoad) setHasMore(result.hasMore);
          if (!result.hasMore || result.items.some((message) => known.has(message.id)) || initialLoad || !result.items.length) {
            break;
          }
          const cursor = result.items[result.items.length - 1].id;
          if (cursor === before) break;
          before = cursor;
        }
        if (!mounted.current) return;
        incoming.forEach((message) => synchronizedIds.current.add(message.id));
        historyLoaded.current = true;
        add(incoming);
        setHistoryError('');
      } catch (error) {
        if (!mounted.current) return;
        if (denied(error)) block();
        else setHistoryError(getApiErrorMessage(error, 'Không thể tải lịch sử. Vui lòng thử lại.'));
      } finally {
        if (mounted.current) setLoading(false);
      }
    };
    syncQueue.current = syncQueue.current.then(run, run);
    return syncQueue.current;
  }, [add, block, fetchPage]);

  useEffect(() => {
    if (!blocked) void synchronize();
  }, [chat.revision, retrySync, blocked, synchronize]);

  useEffect(() => {
    if (denied(detail.error)) block();
  }, [detail.error, block]);

  useEffect(
    () =>
      chat.subscribe((message) => {
        if (message.conversationId !== id || blocked) return;
        if (!stick.current) setNewMessages(true);
        add([message]);
      }),
    [chat.subscribe, id, blocked, add],
  );

  useEffect(() => {
    const change = () => setVisible(document.visibilityState === 'visible');
    change();
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);

  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    if (previousHeight.current !== null) {
      element.scrollTop += element.scrollHeight - previousHeight.current;
      previousHeight.current = null;
    } else if (stick.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const element = scroll.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (stick.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const newestIncoming = [...messages].reverse().find((message) => !message.isMine)?.id;

  useEffect(() => {
    if (
      !newestIncoming ||
      loading ||
      blocked ||
      !visible ||
      !atBottom ||
      readBusy.current ||
      lastRead.current === newestIncoming
    ) {
      return;
    }
    const timer = setTimeout(async () => {
      readBusy.current = true;
      try {
        await markRead(id).unwrap();
        if (mounted.current) {
          lastRead.current = newestIncoming;
          setReadError('');
          setReadCycle((value) => value + 1);
        }
      } catch (error) {
        if (denied(error)) block();
        else if (mounted.current) setReadError('Không thể cập nhật trạng thái đã đọc.');
      } finally {
        readBusy.current = false;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newestIncoming, loading, blocked, visible, atBottom, id, markRead, block, chat.revision, readCycle]);

  async function older() {
    if (loadingOlder || !messagesRef.current.length) return;
    setLoadingOlder(true);
    try {
      const result = await fetchPage(messagesRef.current[0].id);
      if (!mounted.current) return;
      previousHeight.current = scroll.current?.scrollHeight ?? null;
      add(result.items);
      setHasMore(result.hasMore);
      setHistoryError('');
    } catch (error) {
      if (mounted.current) {
        if (denied(error)) block();
        else setHistoryError('Không thể tải tin cũ. Vui lòng thử lại.');
      }
    } finally {
      if (mounted.current) setLoadingOlder(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || text.length > 2000 || sendingRef.current || blocked || loading || !!historyError) return;
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    try {
      const request = chat.send(id, text);
      const message = await (request ?? sendRest({ id, text }).unwrap());
      if (!mounted.current) return;
      stick.current = true;
      setAtBottom(true);
      add([message]);
      setDraft('');
      dispatch(chatApi.util.invalidateTags(['Conversation']));
    } catch (error) {
      if (!mounted.current) return;
      if (denied(error)) block();
      else {
        setSendError(
          error instanceof Error
            ? error.message
            : getApiErrorMessage(error, 'Chưa xác nhận được kết quả gửi. Kiểm tra lịch sử trước khi gửi lại.'),
        );
        await synchronize();
      }
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  }

  if (blocked) {
    return (
      <div role="alert" className="p-6">
        Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập.
        <Link href="/conversations" className="mt-3 block underline">
          Về danh sách
        </Link>
      </div>
    );
  }

  if (detail.error) {
    return (
      <div role="alert" className="p-6">
        Không thể tải thông tin cuộc trò chuyện.{' '}
        <button className="underline" onClick={() => void detail.refetch()}>
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <header className="flex items-center gap-3 border-b p-4">
        <Link href="/conversations" aria-label="Về danh sách" className="md:hidden">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="truncate font-semibold">{detail.data?.counterpart?.fullName || 'Cuộc trò chuyện'}</h2>
      </header>
      {historyError && (
        <div role="alert" className="bg-red-50 p-3 text-sm text-red-800">
          {historyError}{' '}
          <button onClick={() => setRetrySync((value) => value + 1)} className="underline">
            Thử lại
          </button>
        </div>
      )}
      {readError && (
        <div role="alert" className="bg-amber-50 p-2 text-sm text-amber-900">
          {readError}{' '}
          <button className="underline" onClick={() => setReadCycle((value) => value + 1)}>
            Thử lại
          </button>
        </div>
      )}
      <div
        ref={scroll}
        role="log"
        aria-label="Lịch sử tin nhắn"
        className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4"
        onScroll={() => {
          const element = scroll.current!;
          const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          stick.current = bottom;
          setAtBottom(bottom);
          if (bottom) setNewMessages(false);
        }}
      >
        {loading ? (
          <p role="status">Đang tải tin nhắn…</p>
        ) : (
          <>
            {hasMore && (
              <button
                disabled={loadingOlder}
                onClick={() => void older()}
                className="mx-auto block text-sm font-semibold text-teal-800"
              >
                {loadingOlder ? 'Đang tải…' : 'Tải tin cũ'}
              </button>
            )}
            {!messages.length && !historyError && (
              <p className="py-12 text-center text-sm text-slate-600">Chưa có tin nhắn. Hãy gửi lời chào!</p>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] sm:max-w-[75%]">
                  <p
                    className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm [overflow-wrap:anywhere] ${
                      message.isMine
                        ? 'rounded-br-sm bg-primary-container text-white'
                        : 'rounded-bl-sm border border-slate-200 bg-white text-slate-900'
                    }`}
                  >
                    {message.text}
                  </p>
                  <div className={`mt-1 text-xs text-slate-600 ${message.isMine ? 'text-right' : ''}`}>
                    <time dateTime={message.createdAt}>{time(message.createdAt)}</time>
                    {message.isMine && (
                      <span> · {message.readAt ? 'Đã xem' : chat.delivered.has(message.id) ? 'Đã nhận' : 'Đã gửi'}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      {newMessages && (
        <button
          onClick={() => {
            stick.current = true;
            setAtBottom(true);
            setNewMessages(false);
            if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
          }}
          className="bg-teal-50 p-2 text-sm font-semibold text-teal-900"
        >
          Tin nhắn mới
        </button>
      )}
      <form
        className="border-t p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {sendError && <p role="alert" className="mb-2 text-sm text-red-700">{sendError}</p>}
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Nội dung tin nhắn"
            placeholder="Nhập tin nhắn…"
            maxLength={2000}
            rows={2}
            value={draft}
            disabled={sending || loading || !detail.data}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                void send();
              }
            }}
            className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
          <button
            aria-label="Gửi tin nhắn"
            disabled={sending || loading || !detail.data || !draft.trim() || !!historyError}
            className="rounded-lg bg-primary-container p-3 text-white disabled:opacity-40"
          >
            <Send size={20} />
          </button>
        </div>
        <p className="mt-1 text-right text-xs text-slate-500">{draft.length}/2000 · Shift+Enter để xuống dòng</p>
      </form>
    </div>
  );
}
