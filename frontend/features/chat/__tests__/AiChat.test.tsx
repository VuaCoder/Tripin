import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  chatWithAi: vi.fn(),
  getAiConversations: vi.fn(),
  getAiConversation: vi.fn(),
  readAi: vi.fn().mockResolvedValue({ unreadCount: 0 }),
  currentUser: { id: 't1', role: 'TRAVELER', permissions: ['chat:use', 'ai:chat'] } as any,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/store/hooks', () => ({
  useAppSelector: () => mocks.currentUser,
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('../api/aiChatApi', () => ({
  useGetAiOverviewQuery: () => ({ data: { latest: null, unreadCount: 0 }, refetch: vi.fn() }),
  useReadAiConversationMutation: () => [(args: unknown) => ({ unwrap: () => mocks.readAi(args) })],
  aiChatApi: {
    util: {
      invalidateTags: vi.fn(),
    },
  },
  useChatWithAiMutation: () => [
    (body: any) => ({ unwrap: () => mocks.chatWithAi(body) }),
    { isLoading: false },
  ],
  useGetAiConversationsQuery: () => mocks.getAiConversations(),
  useLazyGetAiConversationQuery: () => [
    (id: string) => ({ unwrap: () => mocks.getAiConversation(id) }),
  ],
}));

vi.mock('../api', () => ({
  chatApi: {
    endpoints: {
      messages: { initiate: () => ({ unwrap: () => Promise.resolve({ items: [], hasMore: false }), abort: vi.fn() }) },
    },
    util: { invalidateTags: vi.fn() },
  },
  useConversationsQuery: () => ({
    data: {
      data: [
        {
          id: 'c1',
          counterpart: { fullName: 'Hướng Dẫn Viên Tuấn' },
          lastMessage: { text: 'Hẹn gặp anh ngày mai nhé' },
          updatedAt: '2026-10-18T10:00:00Z',
          unreadCount: 0,
        },
      ],
      meta: { totalPages: 1 },
    },
    refetch: vi.fn(),
    isLoading: false,
    error: null,
  }),
  useConversationQuery: () => ({ data: null }),
  useReadConversationMutation: () => [vi.fn()],
  useSendMessageMutation: () => [vi.fn()],
}));

vi.mock('../ChatProvider', () => ({
  useChat: () => ({
    connected: true,
    delivered: new Set(),
    revision: 0,
    reconnect: vi.fn(),
    send: vi.fn(),
    subscribe: () => () => {},
  }),
}));

import { ConversationPage } from '../ConversationPage';
import { AiThread } from '../components/AiThread';

describe('Chat with AI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser = { id: 't1', role: 'TRAVELER', permissions: ['chat:use', 'ai:chat'] };
    mocks.getAiConversations.mockReturnValue({ data: { data: [], meta: { totalPages: 1 } } });
    mocks.getAiConversation.mockResolvedValue({
      id: 'conv-1',
      title: 'Đà Nẵng',
      messages: [],
    });
    mocks.chatWithAi.mockResolvedValue({
      conversationId: 'conv-1',
      reply: { role: 'assistant', content: 'Đà Nẵng rất đẹp với bãi biển Mỹ Khê và Bà Nà Hills.', createdAt: '2026-10-18T10:01:00Z' },
      messageCount: 2,
    });
  });

  afterEach(cleanup);

  it('renders pinned "Trợ lý AI Tripri" in sidebar for TRAVELER role', () => {
    render(<ConversationPage />);
    expect(screen.getByText('Trợ lý AI Tripri')).toBeTruthy();
    expect(screen.getByText('Chưa có tin nhắn')).toBeTruthy();
  });

  it('does NOT render pinned "Trợ lý AI Tripri" for TOUR_GUIDE role', () => {
    mocks.currentUser = { id: 'g1', role: 'TOUR_GUIDE', permissions: ['chat:use'] };
    render(<ConversationPage />);
    expect(screen.queryByText('Trợ lý AI Tripri')).toBeNull();
  });

  it('filters conversations and AI by search box', () => {
    render(<ConversationPage />);
    const searchInput = screen.getByPlaceholderText('Tìm kiếm cuộc trò chuyện hoặc AI...');

    // Search for AI
    fireEvent.change(searchInput, { target: { value: 'AI' } });
    expect(screen.getByText('Trợ lý AI Tripri')).toBeTruthy();
    expect(screen.queryByText('Hướng Dẫn Viên Tuấn')).toBeNull();

    // Search for Guide
    fireEvent.change(searchInput, { target: { value: 'Tuấn' } });
    expect(screen.queryByText('Trợ lý AI Tripri')).toBeNull();
    expect(screen.getByText('Hướng Dẫn Viên Tuấn')).toBeTruthy();
  });

  it('renders AiThread when id="ai" with welcome banner and quick prompt chips', () => {
    render(<ConversationPage id="ai" />);
    expect(screen.getByText('Xin chào! Tôi có thể giúp gì cho chuyến đi của bạn?')).toBeTruthy();
    expect(screen.getByText('Gợi ý lịch trình 3 ngày 2 đêm tại Đà Nẵng - Hội An')).toBeTruthy();
    expect(screen.getByPlaceholderText('Hỏi Trợ lý AI về địa điểm, kinh nghiệm du lịch...')).toBeTruthy();
  });

  it('sends message to AI, shows user bubble with "seen" status and renders AI response', async () => {
    render(<AiThread />);

    const textarea = screen.getByPlaceholderText('Hỏi Trợ lý AI về địa điểm, kinh nghiệm du lịch...');
    fireEvent.change(textarea, { target: { value: 'Đi Đà Nẵng có gì vui?' } });

    const submitBtn = screen.getByLabelText('Gửi câu hỏi');
    fireEvent.click(submitBtn);

    // User message rendered
    await screen.findByText('Đi Đà Nẵng có gì vui?');

    // AI Response rendered
    await screen.findByText('Đà Nẵng rất đẹp với bãi biển Mỹ Khê và Bà Nà Hills.');

    // Status 'Đã xem' shown
    expect(screen.getByText(/Đã xem/)).toBeTruthy();

    expect(mocks.chatWithAi).toHaveBeenCalledWith({
      conversationId: undefined,
      message: 'Đi Đà Nẵng có gì vui?',
    });
  });

  it('handles 503 service unavailable error with friendly message and retry option', async () => {
    mocks.chatWithAi.mockRejectedValueOnce({ status: 503 });

    render(<AiThread />);

    const textarea = screen.getByPlaceholderText('Hỏi Trợ lý AI về địa điểm, kinh nghiệm du lịch...');
    fireEvent.change(textarea, { target: { value: 'Lịch trình Hà Giang' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));

    const errors = await screen.findAllByText('Dịch vụ AI tạm thời gián đoạn. Vui lòng thử lại sau.');
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Thử lại')).toBeTruthy();
  });

  it('handles 409 AI_CONVERSATION_FULL error gracefully', async () => {
    mocks.chatWithAi.mockRejectedValueOnce({
      status: 409,
      data: { error: { code: 'AI_CONVERSATION_FULL' } },
    });

    render(<AiThread />);

    const textarea = screen.getByPlaceholderText('Hỏi Trợ lý AI về địa điểm, kinh nghiệm du lịch...');
    fireEvent.change(textarea, { target: { value: 'Tiếp tục cuộc trò chuyện' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));

    const errors = await screen.findAllByText(
      'Cuộc trò chuyện này đã đạt giới hạn 100 tin nhắn. Vui lòng bấm "Đoạn chat mới" để tiếp tục.',
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('clears session when clicking "Đoạn chat mới"', async () => {
    render(<AiThread />);

    const textarea = screen.getByPlaceholderText('Hỏi Trợ lý AI về địa điểm, kinh nghiệm du lịch...');
    fireEvent.change(textarea, { target: { value: 'Câu hỏi 1' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));

    await screen.findByText('Câu hỏi 1');

    // Click "Đoạn chat mới"
    const newChatBtn = screen.getByTitle('Bắt đầu cuộc trò chuyện mới');
    fireEvent.click(newChatBtn);

    // Welcome banner is back
    expect(screen.getByText('Xin chào! Tôi có thể giúp gì cho chuyến đi của bạn?')).toBeTruthy();
    expect(screen.queryByText('Câu hỏi 1')).toBeNull();
  });

  it('opens an older conversation from history after starting a new chat and continues it', async () => {
    mocks.getAiConversations.mockReturnValue({ data: { data: [{ id: 'saved', title: 'Chuyến Hội An', updatedAt: '2026-10-17T10:00:00Z', unreadCount: 2, lastMessage: { role: 'assistant', content: '**Gợi ý** Hội An' } }], meta: { totalPages: 1 } }, isLoading: false });
    mocks.getAiConversation.mockResolvedValue({ id: 'saved', messages: [{ id: 'reply-saved', role: 'assistant', content: 'Gợi ý Hội An', createdAt: '2026-10-17T10:00:00Z' }] });
    render(<AiThread />);
    await screen.findByText('Gợi ý Hội An');
    fireEvent.click(screen.getByTitle('Bắt đầu cuộc trò chuyện mới'));
    expect(screen.queryByText('Gợi ý Hội An')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lịch sử', exact: true }));
    expect(screen.getByText('AI: Gợi ý Hội An')).toBeTruthy();
    expect(screen.getByLabelText('2 tin chưa đọc')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Chuyến Hội An/ }));
    await screen.findByText('Gợi ý Hội An');
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi cho Trợ lý AI'), { target: { value: 'Đi tiếp ở đâu?' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    await waitFor(() => expect(mocks.chatWithAi).toHaveBeenCalledWith({ conversationId: 'saved', message: 'Đi tiếp ở đâu?' }));
  });

  it('does not mark a reply read in a hidden tab, and reads it when visible', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    mocks.getAiConversations.mockReturnValue({ data: { data: [{ id: 'saved' }], meta: { totalPages: 1 } }, isLoading: false });
    mocks.getAiConversation.mockResolvedValue({ id: 'saved', messages: [{ id: 'reply-hidden', role: 'assistant', content: 'Tin khi ẩn tab', createdAt: new Date().toISOString() }] });
    try {
      render(<AiThread />);
      await screen.findByText('Tin khi ẩn tab');
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
      expect(mocks.readAi).not.toHaveBeenCalled();
      visibility.mockReturnValue('visible');
      fireEvent(document, new Event('visibilitychange'));
      await waitFor(() => expect(mocks.readAi).toHaveBeenCalledWith({ id: 'saved', throughMessageId: 'reply-hidden' }));
    } finally { visibility.mockRestore(); }
  });

  it('keeps replies unread while scrolled away from the latest message', async () => {
    mocks.getAiConversations.mockReturnValue({ data: { data: [{ id: 'scrolled' }], meta: { totalPages: 1 } }, isLoading: false });
    mocks.getAiConversation.mockResolvedValue({ id: 'scrolled', messages: [{ id: 'reply-scrolled', role: 'assistant', content: 'Tin cuối đang ở dưới', createdAt: new Date().toISOString() }] });
    render(<AiThread />);
    await screen.findByText('Tin cuối đang ở dưới');
    const log = screen.getByRole('log');
    Object.defineProperties(log, { scrollHeight: { configurable: true, value: 1500 }, clientHeight: { configurable: true, value: 300 }, scrollTop: { configurable: true, value: 0, writable: true } });
    fireEvent.scroll(log);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(mocks.readAi).not.toHaveBeenCalled();
    log.scrollTop = 1200; fireEvent.scroll(log);
    await waitFor(() => expect(mocks.readAi).toHaveBeenCalledWith({ id: 'scrolled', throughMessageId: 'reply-scrolled' }));
  });

  it('formats AI reply markdown with bold and lists, and strips any emojis in thread', async () => {
    mocks.chatWithAi.mockResolvedValueOnce({
      conversationId: 'c1',
      reply: {
        role: 'assistant',
        content: 'Chào bạn! 😊 Mình rất vui được hỗ trợ:\n1. **Bạn muốn đi đâu?** (Ví dụ: Miền Trung)\n2. **Thời gian?** (3 ngày 2 đêm)',
        createdAt: new Date().toISOString(),
      },
      messageCount: 2,
    });

    render(<AiThread />);

    fireEvent.change(screen.getByPlaceholderText('Hỏi Trợ lý AI về địa điểm, kinh nghiệm du lịch...'), {
      target: { value: 'Tư vấn cho mình với' },
    });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));

    const strongEl = await screen.findByText('Bạn muốn đi đâu?');
    expect(strongEl.tagName).toBe('STRONG');
    expect(screen.queryByText(/😊/)).toBeNull();
    expect(screen.getByText('Thời gian?').tagName).toBe('STRONG');
  });
});

describe('AI session regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiConversations.mockReturnValue({ data: { data: [] }, isLoading: false });
  });
  afterEach(cleanup);
  it('does not restore the old session after reset and ignores a late history response', async () => {
    mocks.getAiConversations.mockReturnValue({ data: { data: [{ id: 'old' }] }, isLoading: false });
    let resolve!: (value: any) => void;
    mocks.getAiConversation.mockReturnValue(new Promise(done => { resolve = done; }));
    render(<AiThread />);
    expect(screen.queryByLabelText('Đang tải cuộc trò chuyện')).toBeNull();
    fireEvent.click(screen.getByTitle('Bắt đầu cuộc trò chuyện mới'));
    await act(async () => resolve({ messages: [{ role: 'user', content: 'Old history', createdAt: new Date().toISOString() }] }));
    expect(screen.queryByText('Old history')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi cho Trợ lý AI'), { target: { value: 'New question' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    await waitFor(() => expect(mocks.chatWithAi).toHaveBeenCalledWith({ conversationId: undefined, message: 'New question' }));
    expect(mocks.getAiConversation).toHaveBeenCalledTimes(1);
  });
  it('uses only a dots bubble during a pending answer and locks reset', async () => {
    mocks.getAiConversations.mockReturnValue({ data: { data: [] } });
    mocks.chatWithAi.mockReturnValue(new Promise(() => {}));
    render(<AiThread />);
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi cho Trợ lý AI'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    expect(screen.getByLabelText('Trợ lý AI đang trả lời').querySelectorAll('span')).toHaveLength(3);
    expect(screen.queryByText('Trợ lý AI đang soạn câu trả lời...')).toBeNull();
  });
  it('blocks profane questions and shows warning without calling AI', async () => {
    mocks.getAiConversations.mockReturnValue({ data: { data: [] } });
    render(<AiThread />);
    const textarea = screen.getByLabelText('Nhập câu hỏi cho Trợ lý AI');
    fireEvent.change(textarea, { target: { value: 'địt mẹ mày' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    expect(await screen.findByText('Tin nhắn chứa từ ngữ không phù hợp hoặc vi phạm tiêu chuẩn cộng đồng')).toBeTruthy();
    expect(mocks.chatWithAi).not.toHaveBeenCalled();
  });
});

describe('AI retry', () => {
  afterEach(cleanup);
  it('classifies quota errors and retries without duplicating the question', async () => {
    mocks.getAiConversations.mockReturnValue({ data: { data: [] } });
    mocks.chatWithAi.mockRejectedValueOnce({ status: 503, data: { error: { code: 'AI_QUOTA_EXCEEDED' } } }).mockResolvedValue({ conversationId: 'new', reply: { content: 'Answer', createdAt: new Date().toISOString() } });
    render(<AiThread />);
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi cho Trợ lý AI'), { target: { value: 'Question to retry' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    await screen.findAllByText('Dịch vụ AI đã đạt giới hạn lượt sử dụng. Vui lòng thử lại sau.');
    fireEvent.click(screen.getByText('Thử lại'));
    await screen.findByText('Answer');
    expect(screen.getAllByText('Question to retry')).toHaveLength(1);
  });
});
