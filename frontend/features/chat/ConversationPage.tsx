'use client';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth/store/authSlice';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { chatApi, useConversationsQuery, useConversationQuery, useReadConversationMutation, useSendMessageMutation } from './api';
import { useChat } from './ChatProvider';
import { mergeMessages, type Message } from './types';
import { ConversationWelcome } from './ConversationWelcome';

const time = (value: string) => new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const denied = (error: unknown) => [403, 404].includes((error as { status?: number })?.status ?? 0) || ['FORBIDDEN', 'NOT_FOUND'].includes((error as { code?: string })?.code ?? '');
export function ConversationPage({ id }: { id?: string }) {
  const user = useAppSelector(selectUser);
  if (!user || !user.permissions.includes('chat:use')) return <p role="alert">Bạn không có quyền sử dụng tin nhắn.</p>;
  return <ChatWorkspace key={user.id} id={id} />;
}
function ChatWorkspace({ id }: { id?: string }) {
  const user = useAppSelector(selectUser);
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch, isFetching } = useConversationsQuery(page, { refetchOnFocus: true, refetchOnReconnect: true });
  const chat = useChat();
  return <section aria-label="Tin nhắn" className="w-full">
    <h1 className="mb-4 text-2xl font-bold text-slate-900">Tin nhắn</h1>
    {!chat.connected && <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{chat.status}<button type="button" onClick={chat.reconnect} className="font-semibold underline">Kết nối lại</button></div>}
    <div className="grid h-[calc(100vh-13rem)] min-h-[550px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside aria-label="Danh sách cuộc trò chuyện" className={`${id ? 'hidden md:flex' : 'flex'} flex-col border-r border-slate-200/80 bg-slate-50/40`}>
        <h2 className="border-b border-slate-200/80 p-4 font-bold text-slate-900">Cuộc trò chuyện</h2>
        {isLoading ? (
          <p role="status" className="p-4 text-sm text-slate-500">Đang tải…</p>
        ) : error ? (
          <div role="alert" className="p-4 text-sm text-red-600">Không thể tải danh sách. <button onClick={() => void refetch()} className="underline">Thử lại</button></div>
        ) : !data?.data.length ? (
          <div className="flex-1"><p className="hidden px-5 py-6 text-sm leading-6 text-slate-500 md:block">Chưa có cuộc trò chuyện nào.</p>{!id && <div className="h-full md:hidden"><ConversationWelcome guide={user?.role === 'TOUR_GUIDE'} /></div>}</div>
        ) : (
          <nav className="flex-1 overflow-y-auto ant-scrollbar">
            {data.data.map(item => (
              <Link
                key={item.id}
                href={`/conversations/${item.id}`}
                aria-current={id === item.id ? 'page' : undefined}
                className={`block border-b border-slate-100 p-4 transition-colors hover:bg-slate-100/70 ${id === item.id ? 'bg-teal-50/80 font-medium' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-slate-900">{item.counterpart?.fullName || 'Tài khoản không còn khả dụng'}</span>
                  {item.unreadCount > 0 && (
                    <span aria-label={`${item.unreadCount} tin chưa đọc`} className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                      {item.unreadCount}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{item.lastMessage?.text || 'Chưa có tin nhắn'}</p>
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
              onClick={() => setPage(value => value - 1)}
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
              onClick={() => setPage(value => value + 1)}
              className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight size={16} />
              <span className="sr-only">Sau</span>
            </button>
          </div>
        )}
      </aside>
      {id ? (
        <Thread key={id} id={id} />
      ) : (
        <div className="hidden min-w-0 md:block">{!isLoading && !error && <ConversationWelcome guide={user?.role === 'TOUR_GUIDE'} recent={data?.data[0] ? { id: data.data[0].id, name: data.data[0].counterpart?.fullName || 'người đồng hành' } : undefined} />}</div>
      )}
    </div>
  </section>;
}
function Thread({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const chat = useChat();
  const detail = useConversationQuery(id);
  const [sendRest] = useSendMessageMutation();
  const [markRead] = useReadConversationMutation();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  // Only REST-confirmed history is a safe reconnect boundary. A live event
  // arriving during reconnection must not hide an earlier gap.
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
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requests.current.forEach(request => request.abort()); }; }, []);
  const add = useCallback((incoming: Message[]) => {
    if (!mounted.current) return;
    messagesRef.current = mergeMessages(messagesRef.current, incoming);
    setMessages(messagesRef.current);
  }, []);
  const block = useCallback(() => { if (!mounted.current) return; setBlocked(true); messagesRef.current = []; setMessages([]); setDraft(''); }, []);
  const fetchPage = useCallback(async (before?: string) => {
    const request = dispatch(chatApi.endpoints.messages.initiate({ id, before }, { forceRefetch: true, subscribe: false }));
    requests.current.add(request);
    try { return await request.unwrap(); } finally { requests.current.delete(request); }
  }, [dispatch, id]);
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
          if (!result.hasMore || result.items.some(message => known.has(message.id)) || initialLoad || !result.items.length) break;
          const cursor = result.items[result.items.length - 1].id;
          if (cursor === before) break;
          before = cursor;
        }
        if (!mounted.current) return;
        incoming.forEach(message => synchronizedIds.current.add(message.id));
        historyLoaded.current = true;
        add(incoming); setHistoryError('');
      } catch (error) {
        if (!mounted.current) return;
        if (denied(error)) block(); else setHistoryError(getApiErrorMessage(error, 'Không thể tải lịch sử. Vui lòng thử lại.'));
      } finally { if (mounted.current) setLoading(false); }
    };
    syncQueue.current = syncQueue.current.then(run, run);
    return syncQueue.current;
  }, [add, block, fetchPage]);
  useEffect(() => { if (!blocked) void synchronize(); }, [chat.revision, retrySync, blocked, synchronize]);
  useEffect(() => { if (denied(detail.error)) block(); }, [detail.error, block]);
  useEffect(() => chat.subscribe(message => {
    if (message.conversationId !== id || blocked) return;
    if (!stick.current) setNewMessages(true);
    add([message]);
  }), [chat.subscribe, id, blocked, add]);
  useEffect(() => {
    const change = () => setVisible(document.visibilityState === 'visible');
    change(); document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    if (previousHeight.current !== null) { element.scrollTop += element.scrollHeight - previousHeight.current; previousHeight.current = null; }
    else if (stick.current) element.scrollTop = element.scrollHeight;
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
  const newestIncoming = [...messages].reverse().find(message => !message.isMine)?.id;
  useEffect(() => {
    if (!newestIncoming || loading || blocked || !visible || !atBottom || readBusy.current || lastRead.current === newestIncoming) return;
    const timer = setTimeout(async () => {
      readBusy.current = true;
      try {
        await markRead(id).unwrap();
        if (mounted.current) { lastRead.current = newestIncoming; setReadError(''); setReadCycle(value => value + 1); }
      }
      catch (error) { if (denied(error)) block(); else if (mounted.current) setReadError('Không thể cập nhật trạng thái đã đọc.'); }
      finally { readBusy.current = false; }
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
      add(result.items); setHasMore(result.hasMore); setHistoryError('');
    } catch (error) { if (mounted.current) { if (denied(error)) block(); else setHistoryError('Không thể tải tin cũ. Vui lòng thử lại.'); } }
    finally { if (mounted.current) setLoadingOlder(false); }
  }
  async function send() {
    const text = draft.trim();
    if (!text || text.length > 2000 || sendingRef.current || blocked || loading || !!historyError) return;
    sendingRef.current = true; setSending(true); setSendError('');
    try {
      const request = chat.send(id, text);
      const message = await (request ?? sendRest({ id, text }).unwrap());
      if (!mounted.current) return;
      stick.current = true; setAtBottom(true); add([message]); setDraft('');
      dispatch(chatApi.util.invalidateTags(['Conversation']));
    } catch (error) {
      if (!mounted.current) return;
      if (denied(error)) block();
      else {
        setSendError(error instanceof Error ? error.message : getApiErrorMessage(error, 'Chưa xác nhận được kết quả gửi. Kiểm tra lịch sử trước khi gửi lại.'));
        await synchronize();
      }
    } finally { sendingRef.current = false; if (mounted.current) setSending(false); }
  }
  if (blocked) return <div role="alert" className="p-6">Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập.<Link href="/conversations" className="mt-3 block underline">Về danh sách</Link></div>;
  if (detail.error) return <div role="alert" className="p-6">Không thể tải thông tin cuộc trò chuyện. <button className="underline" onClick={() => void detail.refetch()}>Thử lại</button></div>;
  return <div className="flex h-full min-h-0 min-w-0 flex-col">
    <header className="flex items-center gap-3 border-b p-4"><Link href="/conversations" aria-label="Về danh sách" className="md:hidden"><ArrowLeft size={20} /></Link><h2 className="truncate font-semibold">{detail.data?.counterpart?.fullName || 'Cuộc trò chuyện'}</h2></header>
    {historyError && <div role="alert" className="bg-red-50 p-3 text-sm text-red-800">{historyError} <button onClick={() => setRetrySync(value => value + 1)} className="underline">Thử lại</button></div>}
    {readError && <div role="alert" className="bg-amber-50 p-2 text-sm text-amber-900">{readError} <button className="underline" onClick={() => setReadCycle(value => value + 1)}>Thử lại</button></div>}
    <div ref={scroll} role="log" aria-label="Lịch sử tin nhắn" className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4" onScroll={() => {
      const element = scroll.current!; const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      stick.current = bottom; setAtBottom(bottom); if (bottom) setNewMessages(false);
    }}>
      {loading ? <p role="status">Đang tải tin nhắn…</p> : <>
        {hasMore && <button disabled={loadingOlder} onClick={() => void older()} className="mx-auto block text-sm font-semibold text-teal-800">{loadingOlder ? 'Đang tải…' : 'Tải tin cũ'}</button>}
        {!messages.length && !historyError && <p className="py-12 text-center text-sm text-slate-600">Chưa có tin nhắn. Hãy gửi lời chào!</p>}
        {messages.map(message => <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}><div className="max-w-[85%] sm:max-w-[75%]">
          <p className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm [overflow-wrap:anywhere] ${message.isMine ? 'rounded-br-sm bg-primary-container text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-900'}`}>{message.text}</p>
          <div className={`mt-1 text-xs text-slate-600 ${message.isMine ? 'text-right' : ''}`}><time dateTime={message.createdAt}>{time(message.createdAt)}</time>{message.isMine && <span> · {message.readAt ? 'Đã xem' : chat.delivered.has(message.id) ? 'Đã nhận' : 'Đã gửi'}</span>}</div>
        </div></div>)}
      </>}
    </div>
    {newMessages && <button onClick={() => { stick.current = true; setAtBottom(true); setNewMessages(false); if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }} className="bg-teal-50 p-2 text-sm font-semibold text-teal-900">Tin nhắn mới</button>}
    <form className="border-t p-4" onSubmit={event => { event.preventDefault(); void send(); }}>
      {sendError && <p role="alert" className="mb-2 text-sm text-red-700">{sendError}</p>}
      <div className="flex items-end gap-2"><textarea aria-label="Nội dung tin nhắn" placeholder="Nhập tin nhắn…" maxLength={2000} rows={2} value={draft} disabled={sending || loading || !detail.data} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void send(); }
      }} className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" /><button aria-label="Gửi tin nhắn" disabled={sending || loading || !detail.data || !draft.trim() || !!historyError} className="rounded-lg bg-primary-container p-3 text-white disabled:opacity-40"><Send size={20} /></button></div>
      <p className="mt-1 text-right text-xs text-slate-500">{draft.length}/2000 · Shift+Enter để xuống dòng</p>
    </form>
  </div>;
}
