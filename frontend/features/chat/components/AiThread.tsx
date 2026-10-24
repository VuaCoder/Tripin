'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, Send, Sparkles, RotateCcw, AlertCircle, Plus } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { containsProfanity, PROFANITY_ERROR_MESSAGE } from '@travel-platform/constants';
import {
  useChatWithAiMutation,
  useGetAiConversationsQuery,
  useLazyGetAiConversationQuery,
  aiChatApi,
  useReadAiConversationMutation,
} from '../api/aiChatApi';
import type { AiChatMessage } from '../ai-types';
import { TypingBubble } from './TypingBubble';
import { FormattedMessage } from './FormattedMessage';
import { useChat } from '../ChatProvider';
import { clockTime, dayLabel, fullTime, inboxTime, preview, sameDay, useChatClock, useOfflineRefresh } from '../presentation';
import { UnreadBadge } from './UnreadBadge';

const QUICK_PROMPTS = [
  'Gợi ý lịch trình 3 ngày 2 đêm tại Đà Nẵng - Hội An',
  'Mùa này đi Sapa cần chuẩn bị những trang phục gì?',
  'Top món ngon đặc sản nhất định phải thử ở Cần Thơ',
  'Kinh nghiệm du lịch Phú Quốc tự túc tiết kiệm',
];

export function AiThread() {
  const chat = useChat();
  const now = useChatClock();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [atBottom, setAtBottom] = useState(true);
  const [visible, setVisible] = useState(true);
  const [readError, setReadError] = useState('');
  const [readCycle, setReadCycle] = useState(0);
  const lastRead = useRef('');
  const readBusy = useRef(false);
  const [markRead] = useReadAiConversationMutation();
  const dispatch = useAppDispatch();
  const [chatWithAi, { isLoading: isSending }] = useChatWithAiMutation();
  const { data: convsData, isLoading: isLoadingConvs, error: historyError, refetch: refetchHistory, isFetching: fetchingHistory } = useGetAiConversationsQuery({ page: historyPage }, { refetchOnFocus: true, refetchOnReconnect: true });
  useOfflineRefresh(chat.connected, refetchHistory);
  const [fetchConversation] = useLazyGetAiConversationQuery();

  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [globalError, setGlobalError] = useState<string>('');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const restored = useRef(false);
  const generation = useRef(0);
  const sending = useRef(false);
  const [pendingSend, setPendingSend] = useState(false);
  const busy = isSending || pendingSend;
  const loading = (!restored.current && isLoadingConvs) || isLoadingDetail;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<boolean>(true);

  const openConversation = useCallback(async (id: string) => {
    if (sending.current) return;
    restored.current = true;
    const version = ++generation.current;
    setIsLoadingDetail(true); setGlobalError(''); setReadError('');
    setHistoryOpen(false); setDraft('');
    try {
      const detail = await fetchConversation(id, false).unwrap();
      if (!mounted.current || generation.current !== version) return;
      setActiveConversationId(id);
      setMessages(detail.messages.map(m => ({ ...m, status: 'seen' })));
      stickRef.current = true; setAtBottom(true);
    } catch {
      if (mounted.current && generation.current === version) setGlobalError('Không thể tải lịch sử AI. Vui lòng mở Lịch sử và thử lại.');
    } finally {
      if (mounted.current && generation.current === version) setIsLoadingDetail(false);
    }
  }, [fetchConversation]);

  useEffect(() => {
    const change = () => setVisible(document.visibilityState === 'visible');
    change(); document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);

  // Refresh the selected transcript without switching to another conversation.
  const refreshActive = useCallback(async () => {
    if (!activeConversationId || sending.current || isLoadingDetail) return;
    const version = generation.current;
    try {
      const detail = await fetchConversation(activeConversationId, false).unwrap();
      if (mounted.current && generation.current === version && !sending.current) setMessages(detail.messages.map(m => ({ ...m, status: 'seen' })));
    } catch { /* Keep the readable transcript; the next reconnect retries. */ }
  }, [activeConversationId, fetchConversation, isLoadingDetail]);
  useOfflineRefresh(chat.connected, refreshActive);
  const seenRevision = useRef(chat.revision);
  useEffect(() => {
    if (seenRevision.current === chat.revision) return;
    seenRevision.current = chat.revision;
    void refreshActive();
  }, [chat.revision, refreshActive]);

  const newestReply = [...messages].reverse().find(m => m.role === 'assistant')?.id;
  useEffect(() => {
    if (!activeConversationId || !newestReply || !visible || !atBottom || historyOpen || loading || busy || readBusy.current || lastRead.current === newestReply) return;
    const timer = setTimeout(async () => {
      readBusy.current = true;
      try {
        await markRead({ id: activeConversationId, throughMessageId: newestReply }).unwrap();
        if (mounted.current) { lastRead.current = newestReply; setReadError(''); setReadCycle(v => v + 1); }
      } catch { if (mounted.current) setReadError('Không thể cập nhật trạng thái đã đọc.'); }
      finally { readBusy.current = false; }
    }, 300);
    return () => clearTimeout(timer);
  }, [activeConversationId, newestReply, visible, atBottom, historyOpen, loading, busy, markRead, readCycle, chat.revision]);

  // Restoration is a one-time action, separate from explicitly starting a fresh chat.
  useEffect(() => {
    if (restored.current || isLoadingConvs) return;
    restored.current = true;
    const latest = convsData?.data?.[0];
    if (!latest) return;
    const version = ++generation.current;
    setIsLoadingDetail(true);
    void fetchConversation(latest.id).unwrap().then(detail => {
      if (!mounted.current || generation.current !== version) return;
      setActiveConversationId(latest.id);
      setMessages(detail.messages.map(m => ({ ...m, status: 'seen' })));
    }).catch(() => {
      if (mounted.current && generation.current === version) setGlobalError('Không thể tải lịch sử AI. Bạn có thể bắt đầu đoạn chat mới.');
    }).finally(() => {
      if (mounted.current && generation.current === version) setIsLoadingDetail(false);
    });
  }, [convsData, isLoadingConvs, fetchConversation]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && stickRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy, historyOpen, scrollToBottom]);

  const handleStartNewChat = () => {
    if (sending.current) return;
    restored.current = true;
    generation.current += 1;
    setIsLoadingDetail(false);
    setActiveConversationId(undefined);
    setMessages([]);
    setGlobalError('');
    setDraft('');
    setHistoryPage(1);
    setReadError(''); setHistoryOpen(false); stickRef.current = true; setAtBottom(true);
  };

  const handleSend = async (textToSend?: string, retryIndex?: number) => {
    const text = (textToSend ?? draft).trim();
    if (!text || text.length > 2000 || sending.current || loading) return;
    if (containsProfanity(text)) {
      setGlobalError(PROFANITY_ERROR_MESSAGE);
      return;
    }
    restored.current = true;
    sending.current = true;
    setPendingSend(true);
    // Ignore background history requests that began before this outgoing turn.
    const version = ++generation.current;

    setGlobalError('');
    if (!textToSend) setDraft('');

    const nowIso = new Date().toISOString();
    const userMsgIndex = retryIndex ?? messages.length;

    // Optimistically append user message with 'sending' status
    const pendingMsg: AiChatMessage = {
      role: 'user',
      content: text,
      createdAt: nowIso,
      status: 'sending',
    };

    setMessages((prev) => retryIndex === undefined ? [...prev, pendingMsg] : prev.map((m, i) => i === retryIndex ? pendingMsg : m));
    stickRef.current = true;
    setAtBottom(true);

    try {
      // Step 1: Mark as 'sent'
      setMessages((prev) =>
        prev.map((m, idx) => (idx === userMsgIndex ? { ...m, status: 'sent' } : m)),
      );

      const result = await chatWithAi({
        conversationId: activeConversationId,
        message: text,
      }).unwrap();

      if (!mounted.current || generation.current !== version) return;

      // Step 2: Update conversationId if newly created
      if (!activeConversationId && result.conversationId) {
        setActiveConversationId(result.conversationId);
      }

      // Step 3: Mark traveler message as 'seen' and append AI reply
      setMessages((prev) => [
        ...prev.map((m, idx) => (idx === userMsgIndex ? { ...m, status: 'seen' as const } : m)),
        {
          id: result.reply.id,
          role: 'assistant',
          content: result.reply.content,
          incomplete: result.reply.incomplete,
          createdAt: result.reply.createdAt || new Date().toISOString(),
          status: 'seen',
        },
      ]);

      dispatch(aiChatApi.util.invalidateTags([{ type: 'AiChat', id: 'LIST' }]));
    } catch (err: unknown) {
      if (!mounted.current || generation.current !== version) return;
      const status = (err as { status?: number })?.status;
      const errorCode = (err as { data?: { error?: { code?: string } } })?.data?.error?.code;

      let errorMsg = 'Chưa nhận được phản hồi từ AI. Vui lòng thử lại.';
      const errors: Record<string, string> = {
        AI_NOT_CONFIGURED: 'Trợ lý AI chưa được cấu hình đúng. Vui lòng liên hệ hỗ trợ.',
        AI_QUOTA_EXCEEDED: 'Dịch vụ AI đã đạt giới hạn lượt sử dụng. Vui lòng thử lại sau.',
        AI_TIMEOUT: 'AI phản hồi quá lâu. Bạn có thể thử gửi lại câu hỏi.',
        AI_UNREACHABLE: 'Không thể kết nối dịch vụ AI. Vui lòng thử lại.',
        AI_TEMPORARILY_UNAVAILABLE: 'Dịch vụ AI tạm thời gián đoạn. Vui lòng thử lại sau.',
        AI_CONTENT_BLOCKED: 'AI không thể trả lời nội dung này. Hãy thử diễn đạt lại câu hỏi.',
        AI_EMPTY_RESPONSE: 'AI chưa trả về nội dung trả lời. Bạn có thể thử lại.',
        AI_INCOMPLETE_RESPONSE: 'AI chưa hoàn thành câu trả lời. Hãy thử câu hỏi ngắn hơn.',
        PROFANITY_DETECTED: PROFANITY_ERROR_MESSAGE,
      };
      if (errorCode && errors[errorCode]) {
        errorMsg = errors[errorCode];
      } else if (status === 503) {
        errorMsg = 'Dịch vụ AI tạm thời gián đoạn. Vui lòng thử lại sau.';
      } else if (status === 429) {
        errorMsg = 'Bạn đang gửi câu hỏi quá nhanh. Vui lòng chờ vài giây rồi thử lại.';
      } else if (status === 409 || errorCode === 'AI_CONVERSATION_FULL') {
        errorMsg = 'Cuộc trò chuyện này đã đạt giới hạn 100 tin nhắn. Vui lòng bấm "Đoạn chat mới" để tiếp tục.';
      } else {
        errorMsg = getApiErrorMessage(err, errorMsg);
      }

      // Mark the user message as 'error'
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === userMsgIndex ? { ...m, status: 'error' as const, error: errorMsg } : m,
        ),
      );
      setGlobalError(errorMsg);
    } finally {
      sending.current = false;
      if (mounted.current && generation.current === version) setPendingSend(false);
    }
  };


  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-slate-200/90 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link
            href="/conversations"
            aria-label="Về danh sách"
            className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 via-primary-container to-indigo-600 text-white shadow-sm ring-2 ring-teal-500/20">
            <Bot size={22} />
            <span className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm sm:text-base font-bold text-slate-900">
                Trợ lý AI Tripri
              </h2>
              <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-primary-container border border-teal-200/60 sm:inline-flex">
                <Sparkles size={11} className="text-teal-600" />
                AI Agent
              </span>
            </div>
            <p className="truncate text-xs text-slate-500">
              Tư vấn lịch trình, ẩm thực & kinh nghiệm du lịch 24/7
            </p>
          </div>
        </div>

        <button type="button" aria-expanded={historyOpen} aria-controls="ai-history" onClick={() => setHistoryOpen(v => !v)} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600">Lịch sử</button>
        <button
          type="button"
          onClick={handleStartNewChat}
          disabled={busy}
          aria-label="Bắt đầu cuộc trò chuyện mới"
          title="Bắt đầu cuộc trò chuyện mới"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container cursor-pointer shrink-0"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Đoạn chat mới</span>
        </button>
      </header>

      <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">Các đoạn chat trước vẫn nằm trong Lịch sử</p>
      {historyOpen && <section id="ai-history" aria-label="Lịch sử AI" className="max-h-[45%] shrink-0 overflow-y-auto border-b border-slate-200 bg-white p-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Các đoạn chat trước</h3>
        {isLoadingConvs ? <p role="status" className="p-3 text-sm text-slate-600">Đang tải lịch sử…</p> : historyError ? <p role="alert" className="p-3 text-sm text-red-700">Không thể tải lịch sử. <button onClick={() => void refetchHistory()} className="underline">Thử lại</button></p> : !convsData?.data.length ? <p className="p-3 text-sm text-slate-600">Chưa có đoạn chat nào.</p> : convsData.data.map(item => <button key={item.id} type="button" disabled={busy || fetchingHistory} aria-current={activeConversationId === item.id ? 'true' : undefined} onClick={() => void openConversation(item.id)} className={`block w-full rounded-lg p-3 text-left hover:bg-teal-50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-teal-600 ${activeConversationId === item.id ? 'bg-teal-50' : ''}`}>
          <span className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${item.unreadCount ? 'font-bold' : 'font-medium'}`}>{item.title}</span><UnreadBadge count={item.unreadCount} /></span>
          <span className={`mt-1 block truncate text-xs ${item.unreadCount ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{item.lastMessage ? `${item.lastMessage.role === 'user' ? 'Bạn' : 'AI'}: ${preview(item.lastMessage.content)}` : 'Chưa có tin nhắn'}</span>
          <time dateTime={item.updatedAt} title={fullTime(item.updatedAt)} aria-label={fullTime(item.updatedAt)} className="mt-1 block text-xs text-slate-500">{inboxTime(item.updatedAt, now)}</time>
        </button>)}
        {Boolean(convsData && convsData.meta.totalPages > 1) && <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <button disabled={historyPage <= 1 || fetchingHistory} onClick={() => setHistoryPage(p => p - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trước</button>
          <span>Trang {historyPage}/{convsData?.meta.totalPages}</span>
          <button disabled={historyPage >= (convsData?.meta.totalPages ?? 1) || fetchingHistory} onClick={() => setHistoryPage(p => p + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Sau</button>
        </div>}
      </section>}
      {readError && <p role="alert" className="bg-amber-50 p-2 text-xs text-amber-900">{readError} <button className="underline" onClick={() => setReadCycle(v => v + 1)}>Thử lại</button></p>}

      {/* Global Error Alert (if any) */}
      {globalError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50/90 px-4 py-2.5 text-xs font-medium text-red-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-600" />
            <span>{globalError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalError('')}
            className="text-red-600 hover:underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Message Scroll Area */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Lịch sử tin nhắn AI"
        aria-busy={loading}
        className="flex-1 space-y-4 overflow-y-auto ant-scrollbar bg-slate-50/60 p-4 sm:p-6"
        onScroll={() => {
          if (!scrollRef.current) return;
          const element = scrollRef.current;
          const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          stickRef.current = bottom;
          setAtBottom(bottom);
        }}
      >
        {/* Welcome screen when conversation is empty */}
        {!loading && messages.length === 0 && !globalError && (
          <div className="mx-auto my-auto max-w-lg py-8 text-center animate-fadeInScale">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white shadow-lg shadow-teal-500/20">
              <Bot size={36} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Xin chào! Tôi có thể giúp gì cho chuyến đi của bạn?
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
              Hãy hỏi tôi về các điểm tham quan, lịch trình du lịch, đặc sản ẩm thực hoặc kinh nghiệm chuẩn bị hành lý tại Việt Nam.
            </p>

            <div className="mt-6 flex flex-col gap-2 text-left">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                Gợi ý câu hỏi nhanh:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void handleSend(prompt)}
                    className="flex items-start gap-2 rounded-xl border border-slate-200/90 bg-white p-3 text-xs text-slate-700 shadow-2xs transition-all hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-900 text-left cursor-pointer"
                  >
                    <Sparkles size={14} className="text-primary-container shrink-0 mt-0.5" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Items */}
        {messages.map((message, index) => {
          const isMine = message.role === 'user';
          return (
            <Fragment key={message.id || index}>
            {(!index || !sameDay(messages[index - 1].createdAt, message.createdAt)) && <p className="py-2 text-center text-xs font-medium text-slate-600">{dayLabel(message.createdAt, now)}</p>}
            <div
              key={index}
              className={`flex items-end gap-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              {!isMine && (
                <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-white shadow-2xs">
                  <Bot size={15} />
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`break-words rounded-2xl px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere] shadow-2xs ${
                    isMine
                      ? 'rounded-br-xs bg-primary-container text-white'
                      : 'rounded-bl-xs border border-slate-200/90 bg-white text-slate-900'
                  }`}
                >
                  <FormattedMessage content={message.content} isMine={isMine} />
                  {message.incomplete && (
                    <p className="mt-2 text-xs italic text-slate-500">
                      Câu trả lời chưa đầy đủ. Bạn có thể yêu cầu AI nói tiếp.
                    </p>
                  )}
                </div>

                <div
                  className={`mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 ${
                    isMine ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <time dateTime={message.createdAt} title={fullTime(message.createdAt)} aria-label={fullTime(message.createdAt)}>{clockTime(message.createdAt)}</time>
                  {isMine && (
                    <span>
                      {message.status === 'sending' && ' · Đang gửi...'}
                      {message.status === 'sent' && ' · Đã gửi'}
                      {message.status === 'seen' && ' · Đã xem'}
                      {message.status === 'error' && (
                        <span className="text-red-500 font-medium"> · Lỗi gửi</span>
                      )}
                    </span>
                  )}
                  {!isMine && <span> · Trợ lý AI</span>}
                </div>

                {/* Inline Retry if message errored */}
                {message.status === 'error' && (
                  <div className="mt-1 flex items-center justify-end gap-2 text-xs text-red-600">
                    <span>{message.error || 'Gửi thất bại'}</span>
                    <button
                      type="button"
                      disabled={busy || loading}
                      onClick={() => void handleSend(message.content, index)}
                      className="flex items-center gap-1 font-semibold underline hover:text-red-700 cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      Thử lại
                    </button>
                  </div>
                )}
              </div>
            </div>
            </Fragment>
          );
        })}

        {busy && <TypingBubble label="Trợ lý AI đang trả lời" />}

      </div>

      {/* Input Footer */}
      <form
        className="border-t border-slate-200/90 bg-white p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Nhập câu hỏi cho Trợ lý AI"
            placeholder="Hỏi Trợ lý AI về địa điểm, kinh nghiệm du lịch..."
            maxLength={2000}
            rows={2}
            value={draft}
            disabled={busy || loading}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault();
                void handleSend();
              }
            }}
            className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50"
          />
          <button
            type="submit"
            aria-label="Gửi câu hỏi"
            disabled={busy || loading || !draft.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-white shadow-sm transition-all hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>Trợ lý AI cung cấp lời khuyên &amp; gợi ý du lịch</span>
          <span>{draft.length}/2000 · Shift+Enter để xuống dòng</span>
        </div>
      </form>
    </div>
  );
}
