'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  X,
  Bot,
  Search,
  Image as ImageIcon,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth/store/authSlice';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { containsProfanity, PROFANITY_ERROR_MESSAGE } from '@travel-platform/constants';
import {
  chatApi,
  useConversationQuery,
  useConversationsQuery,
  useReadConversationMutation,
  useSendMessageMutation,
} from './api';
import { useChat } from './ChatProvider';
import { ConversationWelcome } from './ConversationWelcome';
import { TypingBubble } from './components/TypingBubble';
import { AiThread } from './components/AiThread';
import { ConversationListSkeleton } from './components/ChatSkeleton';
import { useGetAiOverviewQuery } from './api/aiChatApi';
import {
  clockTime,
  dayLabel,
  fullTime,
  inboxTime,
  preview,
  sameDay,
  useChatClock,
  useOfflineRefresh,
} from './presentation';
import { UnreadBadge } from './components/UnreadBadge';
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
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading, error, refetch, isFetching } = useConversationsQuery(page, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    pollingInterval: 30_000,
  });
  const chat = useChat();
  const now = useChatClock();
  const [aiEntryVersion, setAiEntryVersion] = useState(0);
  useOfflineRefresh(chat.connected, refetch);

  const isTraveler = user?.role === 'TRAVELER' || user?.permissions?.includes('ai:chat');
  const aiOverview = useGetAiOverviewQuery(undefined, {
    skip: !isTraveler,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const refreshAi = useCallback(() => {
    if (isTraveler) void aiOverview.refetch();
  }, [isTraveler, aiOverview.refetch]);
  useOfflineRefresh(chat.connected, refreshAi);
  const latestAi = aiOverview.data?.latest;
  const aiUnread = aiOverview.data?.unreadCount ?? 0;
  const matchesAi = Boolean(
    isTraveler &&
      (!searchQuery.trim() ||
        'trợ lý ai tripri'.includes(searchQuery.toLowerCase()) ||
        'ai'.includes(searchQuery.toLowerCase()) ||
        'bot'.includes(searchQuery.toLowerCase())),
  );

  const filteredItems = (data?.data ?? []).filter(
    (item) =>
      !searchQuery.trim() ||
      item.counterpart?.fullName?.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const isAgency = user?.role === 'AGENCY';

  return (
    <section aria-label="Tin nhắn" className="w-full flex-1 flex flex-col min-h-0">
      <div className="mb-2.5 flex items-center justify-between gap-2 shrink-0">
        <h1 className="text-xl font-bold text-slate-900">Hộp thư &amp; Tin nhắn</h1>
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
          className={`${id ? 'hidden md:flex' : 'flex'} flex-col border-r border-slate-200/80 bg-slate-50/40`}
        >
          {/* Thanh tìm kiếm */}
          <div className="border-b border-slate-200/80 p-3 sm:p-4 bg-white">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm cuộc trò chuyện hoặc AI..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500/20 transition-all"
              />
            </div>
          </div>

          {isLoading ? (
            <ConversationListSkeleton />
          ) : error ? (
            <div role="alert" className="p-4 text-sm text-red-600">
              Không thể tải danh sách.{' '}
              <button onClick={() => void refetch()} className="underline">
                Thử lại
              </button>
            </div>
          ) : !filteredItems.length && !matchesAi ? (
            <div className="flex-1 flex flex-col justify-between p-5 text-sm leading-6 text-slate-500">
              <p className="hidden md:block">Chưa có cuộc trò chuyện nào.</p>
              {!id && (
                <div className="h-full md:hidden">
                  <ConversationWelcome guide={user?.role === 'TOUR_GUIDE'} />
                </div>
              )}
            </div>
          ) : (
            <nav className="flex-1 overflow-y-auto ant-scrollbar">
              {matchesAi && (
                <Link
                  href="/conversations/ai"
                  onClick={() => setAiEntryVersion((value) => value + 1)}
                  aria-current={id === 'ai' ? 'page' : undefined}
                  className={`block border-b border-slate-100 p-3.5 transition-colors hover:bg-slate-100/70 ${
                    id === 'ai'
                      ? 'bg-teal-50/90 font-medium border-l-4 border-l-primary-container'
                      : 'bg-gradient-to-r from-teal-50/50 to-indigo-50/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 via-primary-container to-indigo-600 text-white shadow-xs">
                      <Bot size={20} />
                      <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`truncate text-slate-900 flex items-center gap-1.5 text-sm ${aiUnread ? 'font-bold' : 'font-medium'}`}>
                          Trợ lý AI Tripri
                          <span className="rounded-full bg-teal-100/90 px-1.5 py-0.2 text-[10px] font-bold text-primary-container">
                            AI
                          </span>
                        </span>
                        <UnreadBadge count={aiUnread} />
                      </div>
                      <p className={`mt-0.5 truncate text-xs ${aiUnread ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                        {aiUnread > 5
                          ? '5+ tin nhắn mới'
                          : latestAi?.lastMessage
                            ? `${latestAi.lastMessage.role === 'user' ? 'Bạn' : 'AI'}: ${preview(latestAi.lastMessage.content)}`
                            : 'Chưa có tin nhắn'}
                      </p>
                      {latestAi?.lastMessage && (
                        <time
                          dateTime={latestAi.lastMessage.createdAt}
                          title={fullTime(latestAi.lastMessage.createdAt)}
                          aria-label={fullTime(latestAi.lastMessage.createdAt)}
                          className="mt-1 block text-xs text-slate-500"
                        >
                          {inboxTime(latestAi.lastMessage.createdAt, now)}
                        </time>
                      )}
                    </div>
                  </div>
                </Link>
              )}

              {filteredItems.map((item) => {
                const counterpartName = item.counterpart?.fullName || 'Tài khoản không còn khả dụng';
                const counterpartAvatar = item.counterpart?.avatarUrl;
                const initial = counterpartName.charAt(0).toUpperCase();

                return (
                  <Link
                    key={item.id}
                    href={`/conversations/${item.id}`}
                    aria-current={id === item.id ? 'page' : undefined}
                    className={`block border-b border-slate-100 p-3.5 transition-colors hover:bg-slate-100/70 ${
                      id === item.id ? 'bg-teal-50/80 font-medium' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar with initial fallback and online indicator */}
                      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-sm shadow-2xs overflow-hidden">
                        {counterpartAvatar ? (
                          <img
                            src={counterpartAvatar}
                            alt={counterpartName}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span>{initial}</span>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`truncate text-slate-900 text-sm ${item.unreadCount ? 'font-bold' : 'font-medium'}`}>
                            {counterpartName}
                          </span>
                          <UnreadBadge count={item.unreadCount} />
                        </div>
                        <p className={`mt-0.5 truncate text-xs ${item.unreadCount ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                          {item.unreadCount > 5
                            ? '5+ tin nhắn mới'
                            : item.lastMessage
                              ? `${item.lastMessage.senderId === user?.id ? 'Bạn' : counterpartName}: ${preview(item.lastMessage.text)}`
                              : 'Chưa có tin nhắn'}
                        </p>
                        <time
                          dateTime={item.lastMessage?.sentAt || item.updatedAt}
                          title={fullTime(item.lastMessage?.sentAt || item.updatedAt)}
                          aria-label={fullTime(item.lastMessage?.sentAt || item.updatedAt)}
                          className="mt-1 block text-xs text-slate-400"
                        >
                          {inboxTime(item.lastMessage?.sentAt || item.updatedAt, now)}
                        </time>
                      </div>
                    </div>
                  </Link>
                );
              })}
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
        </aside>

        {/* Khung nội dung bên phải */}
        {id === 'ai' ? (
          <AiThread key={aiEntryVersion} />
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

function renderMessageContent(text: string, isMine: boolean) {
  const imgMarkdownMatch = text.match(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/);
  const isDirectImageUrl = /^(https?:\/\/[^\s]+(?:\.(?:jpg|jpeg|png|webp)|res\.cloudinary\.com[^\s]+))$/i.test(text.trim());

  if (imgMarkdownMatch) {
    const [, alt, url] = imgMarkdownMatch;
    const textWithoutImg = text.replace(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/, '').trim();
    return (
      <div className="space-y-1.5">
        <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl group max-w-xs sm:max-w-sm">
          <img
            src={url}
            alt={alt || 'Hình ảnh'}
            className="max-h-64 w-full rounded-xl object-cover transition-transform group-hover:scale-102"
          />
        </a>
        {textWithoutImg && (
          <p className="whitespace-pre-wrap break-words text-sm">{textWithoutImg}</p>
        )}
      </div>
    );
  }

  if (isDirectImageUrl) {
    const url = text.trim();
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl group max-w-xs sm:max-w-sm">
        <img
          src={url}
          alt="Hình ảnh"
          className="max-h-64 w-full rounded-xl object-cover transition-transform group-hover:scale-102"
        />
      </a>
    );
  }

  return <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{text}</p>;
}

function Thread({ id }: { id: string }) {
  const now = useChatClock();
  const dispatch = useAppDispatch();
  const chat = useChat();
  const detail = useConversationQuery(id, { pollingInterval: 30_000 });
  const [sendRest] = useSendMessageMutation();
  const [markRead] = useReadConversationMutation();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  // Only REST-confirmed history is a safe reconnect boundary. A live event
  // arriving during reconnection must not hide an earlier gap.
  const synchronizedIds = useRef(new Set<string>());
  const historyLoaded = useRef(false);
  const [hasMore, setHasMore] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const clearTyping = useCallback(() => {
    clearTimeout(typingTimer.current);
    setIsTyping(false);
  }, []);

  useEffect(() => {
    if (!chat.connected || blocked) {
      clearTyping();
      return;
    }
    const unsubscribe = chat.subscribeTyping((event) => {
      if (event.conversationId !== id) return;
      clearTimeout(typingTimer.current);
      setIsTyping(true);
      typingTimer.current = setTimeout(() => setIsTyping(false), 3000);
    });
    return () => {
      unsubscribe();
      clearTimeout(typingTimer.current);
    };
  }, [chat.connected, chat.subscribeTyping, id, clearTyping, blocked]);

  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Image attachment state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSendError('Chỉ hỗ trợ file ảnh JPG, PNG hoặc WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSendError('Ảnh không được vượt quá 5MB');
      return;
    }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    if (sendError) setSendError('');
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
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
        chatApi.endpoints.messages.initiate(
          { id, before },
          { forceRefetch: true, subscribe: false },
        ),
      );
      requests.current.add(request);
      // A hung request must not wedge syncQueue forever: abort it and surface the retry banner.
      const timeout = setTimeout(() => request.abort(), 15_000);
      try {
        return await request.unwrap();
      } finally {
        clearTimeout(timeout);
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
          if (
            !result.hasMore ||
            result.items.some((message) => known.has(message.id)) ||
            initialLoad ||
            !result.items.length
          ) {
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

  useOfflineRefresh(chat.connected, synchronize);
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
        clearTyping();
        add([message]);
      }),
    [chat.subscribe, id, blocked, add, clearTyping],
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
  }, [messages, isTyping]);

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
    let text = draft.trim();
    if ((!text && !selectedImage) || text.length > 2000 || sendingRef.current || blocked || loading || !!historyError) return;
    if (text && containsProfanity(text)) {
      setSendError(PROFANITY_ERROR_MESSAGE);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    try {
      if (selectedImage) {
        setUploadingImage(true);
        const formData = new FormData();
        formData.append('file', selectedImage);
        const res = await fetch('/api/v1/chat/upload-image', {
          method: 'POST',
          body: formData,
        });
        const json = await res.json();
        if (!res.ok || !json.data?.url) {
          throw new Error(json.error?.message || 'Không thể tải ảnh lên');
        }
        const imgUrl = json.data.url;
        text = text ? `![ảnh](${imgUrl})\n${text}` : `![ảnh](${imgUrl})`;
        handleRemoveImage();
      }

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
      setUploadingImage(false);
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
      <header className="flex items-center gap-3 border-b p-3.5 sm:p-4 bg-white">
        <Link href="/conversations" aria-label="Về danh sách" className="md:hidden flex size-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-700">
          <ArrowLeft size={18} />
        </Link>
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-sm shadow-2xs overflow-hidden">
          {detail.data?.counterpart?.avatarUrl ? (
            <img
              src={detail.data.counterpart.avatarUrl}
              alt={detail.data.counterpart.fullName}
              className="size-full object-cover"
            />
          ) : (
            <span>{(detail.data?.counterpart?.fullName || 'U').charAt(0).toUpperCase()}</span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold text-slate-900 text-sm sm:text-base leading-tight">
            {detail.data?.counterpart?.fullName || 'Cuộc trò chuyện'}
          </h2>
        </div>
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
        aria-busy={loading}
        className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4"
        onScroll={() => {
          const element = scroll.current!;
          const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          stick.current = bottom;
          setAtBottom(bottom);
          if (bottom) setNewMessages(false);
        }}
      >
        {!loading && (
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
            {!messages.length && !historyError && detail.data?.counterpart && (
              <p className="py-12 text-center text-sm text-slate-600">
                Cuộc trò chuyện mới cùng {detail.data.counterpart.fullName}
              </p>
            )}
            {messages.map((message, index) => (
              <Fragment key={message.id}>
                {(!index || !sameDay(messages[index - 1].createdAt, message.createdAt)) && (
                  <p className="py-2 text-center text-xs font-medium text-slate-600">
                    {dayLabel(message.createdAt, now)}
                  </p>
                )}
                <div className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm [overflow-wrap:anywhere] ${
                        message.isMine
                          ? 'rounded-br-sm bg-primary-container text-white'
                          : 'rounded-bl-sm border border-slate-200 bg-white text-slate-900'
                      }`}
                    >
                      {renderMessageContent(message.text, message.isMine)}
                    </div>
                    <div className={`mt-1 text-xs text-slate-600 ${message.isMine ? 'text-right' : ''}`}>
                      <time
                        dateTime={message.createdAt}
                        title={fullTime(message.createdAt)}
                        aria-label={fullTime(message.createdAt)}
                      >
                        {clockTime(message.createdAt)}
                      </time>
                      {message.isMine && (
                        <span>
                          {' '}
                          · {message.readAt ? 'Đã xem' : chat.delivered.has(message.id) ? 'Đã nhận' : 'Đã gửi'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Fragment>
            ))}
          </>
        )}
        {isTyping && (
          <TypingBubble label={`${detail.data?.counterpart?.fullName || 'Người nhận'} đang nhập tin nhắn`} />
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
        className="border-t p-3 sm:p-4 bg-white"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {sendError && <p role="alert" className="mb-2 text-sm text-red-700">{sendError}</p>}
        {imagePreview && (
          <div className="relative mb-2.5 inline-block">
            <img
              src={imagePreview}
              alt="Ảnh đính kèm"
              className="h-20 w-20 rounded-xl object-cover border border-slate-200 shadow-sm"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-slate-900 text-white text-xs hover:bg-slate-700 shadow-md cursor-pointer"
              title="Xóa ảnh"
            >
              <X size={12} />
            </button>
            {uploadingImage && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-[11px] font-semibold text-white">
                Đang tải...
              </div>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageSelect}
          />
          <button
            type="button"
            disabled={sending || loading || !detail.data}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:p-3 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-colors cursor-pointer"
            title="Đính kèm hình ảnh"
            aria-label="Đính kèm hình ảnh"
          >
            <ImageIcon size={20} />
          </button>
          <textarea
            aria-label="Nội dung tin nhắn"
            placeholder="Nhập tin nhắn…"
            maxLength={2000}
            rows={2}
            value={draft}
            disabled={sending || loading || !detail.data}
            onChange={(event) => {
              setDraft(event.target.value);
              if (sendError) setSendError('');
              if (event.target.value.trim()) chat.typing(id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                void send();
              }
            }}
            className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 p-2.5 sm:p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
          <button
            aria-label="Gửi tin nhắn"
            disabled={sending || loading || !detail.data || (!draft.trim() && !selectedImage) || !!historyError}
            className="rounded-lg bg-primary-container p-2.5 sm:p-3 text-white disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Send size={20} />
          </button>
        </div>
        <p className="mt-1 text-right text-xs text-slate-500">{draft.length}/2000 · Shift+Enter để xuống dòng</p>
      </form>
    </div>
  );
}
