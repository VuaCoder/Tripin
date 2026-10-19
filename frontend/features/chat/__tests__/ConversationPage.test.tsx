import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  dispatch: (action: unknown) => action,
  fetch: vi.fn(), sendRest: vi.fn(), send: vi.fn(), read: vi.fn(), listener: null as null | ((message: unknown) => void),
  detailError: undefined as unknown, revision: 0,
}));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
vi.mock('@/store/hooks', () => ({
  useAppSelector: () => ({ id: 't1', role: 'TRAVELER', permissions: ['chat:use'] }),
  useAppDispatch: () => mocks.dispatch,
}));
vi.mock('../api', () => ({
  chatApi: { endpoints: { messages: { initiate: (args: unknown) => ({ unwrap: () => mocks.fetch(args), abort: vi.fn() }) } }, util: { invalidateTags: vi.fn() } },
  useConversationsQuery: () => ({ data: { data: [{ id: 'c1', counterpart: { fullName: 'Guide A' }, lastMessage: { text: 'Xin chào' }, updatedAt: '2026-10-18T10:00:00Z', unreadCount: 2 }], meta: { totalPages: 2 } }, refetch: vi.fn() }),
  useConversationQuery: () => ({ data: { counterpart: { fullName: 'Guide A' } }, error: mocks.detailError, refetch: vi.fn() }),
  useReadConversationMutation: () => [(id: string) => ({ unwrap: () => mocks.read(id) })],
  useSendMessageMutation: () => [(args: unknown) => ({ unwrap: () => mocks.sendRest(args) })],
}));
vi.mock('../ChatProvider', () => ({ useChat: () => ({ connected: true, delivered: new Set(), revision: mocks.revision, reconnect: vi.fn(), send: mocks.send,
  subscribe: (listener: (message: unknown) => void) => { mocks.listener = listener; return () => { mocks.listener = null; }; },
}) }));
import { ConversationPage } from '../ConversationPage';
const message = (id: string, mine = false) => ({ id, conversationId: 'c1', senderId: mine ? 't1' : 'g1', text: `Tin ${id}`, isMine: mine, createdAt: `2026-10-18T10:00:${id.padStart(2, '0')}Z` });
beforeEach(() => {
  vi.clearAllMocks(); mocks.detailError = undefined; mocks.revision = 0;
  mocks.fetch.mockResolvedValue({ items: [], hasMore: false }); mocks.read.mockResolvedValue({ unreadCount: 0 }); mocks.send.mockReturnValue(null);
});
afterEach(cleanup);
describe('ConversationPage', () => {
  it('shows inbox preview, unread count and pagination', () => {
    render(<ConversationPage />);
    expect(screen.getByText('Xin chào')).toBeTruthy();
    expect(screen.getByLabelText('2 tin chưa đọc')).toBeTruthy();
    fireEvent.click(screen.getByText('Sau')); expect(screen.getByText('Trang 2')).toBeTruthy();
  });
  it('sends by REST when the socket is disconnected and renders backend text safely', async () => {
    mocks.sendRest.mockResolvedValue({ ...message('1', true), text: '<script>hello</script>' });
    render(<ConversationPage id="c1" />);
    await screen.findByText('Chưa có tin nhắn. Hãy gửi lời chào!');
    fireEvent.change(screen.getByLabelText('Nội dung tin nhắn'), { target: { value: '<script>hello</script>' } });
    fireEvent.click(screen.getByLabelText('Gửi tin nhắn'));
    await screen.findByText('<script>hello</script>');
    expect(mocks.sendRest).toHaveBeenCalledWith({ id: 'c1', text: '<script>hello</script>' });
    expect(document.querySelector('script')).toBeNull();
  });
  it('merges socket echo and acknowledgment into one bubble', async () => {
    mocks.send.mockImplementation(() => { mocks.listener?.(message('1', true)); return Promise.resolve(message('1', true)); });
    render(<ConversationPage id="c1" />); await screen.findByText('Chưa có tin nhắn. Hãy gửi lời chào!');
    fireEvent.change(screen.getByLabelText('Nội dung tin nhắn'), { target: { value: 'Tin 1' } });
    fireEvent.click(screen.getByLabelText('Gửi tin nhắn'));
    await waitFor(() => expect(screen.getAllByText('Tin 1')).toHaveLength(1));
    expect(mocks.sendRest).not.toHaveBeenCalled();
  });
  it('keeps draft on uncertain send, synchronizes and does not resend by REST', async () => {
    mocks.send.mockRejectedValue(new Error('Chưa xác nhận được kết quả gửi'));
    render(<ConversationPage id="c1" />); await screen.findByText('Chưa có tin nhắn. Hãy gửi lời chào!');
    fireEvent.change(screen.getByLabelText('Nội dung tin nhắn'), { target: { value: 'Xin chào' } });
    fireEvent.click(screen.getByLabelText('Gửi tin nhắn'));
    await screen.findByText('Chưa xác nhận được kết quả gửi');
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    expect((screen.getByLabelText('Nội dung tin nhắn') as HTMLTextAreaElement).value).toBe('Xin chào');
    expect(mocks.sendRest).not.toHaveBeenCalled();
  });
  it('fetches all missed pages on reconnect until a known message is reached', async () => {
    mocks.fetch.mockResolvedValueOnce({ items: [message('1')], hasMore: false });
    const view = render(<ConversationPage id="c1" />); await screen.findByText('Tin 1');
    mocks.fetch.mockResolvedValueOnce({ items: [message('4'), message('3')], hasMore: true }).mockResolvedValueOnce({ items: [message('2'), message('1')], hasMore: false });
    mocks.revision++; view.rerender(<ConversationPage id="c1" />);
    await screen.findByText('Tin 2');
    expect(mocks.fetch).toHaveBeenLastCalledWith({ id: 'c1', before: '3' });
    expect(screen.getAllByText('Tin 1')).toHaveLength(1);
  });
  it('clears history and disables sending after a forbidden history request', async () => {
    mocks.fetch.mockRejectedValue({ status: 404 });
    render(<ConversationPage id="c1" />);
    await screen.findByText('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập.');
    expect(screen.queryByLabelText('Nội dung tin nhắn')).toBeNull();
  });
  it('recovers multiple pages after an initially empty conversation received only live messages', async () => {
    const view = render(<ConversationPage id="c1" />);
    await screen.findByText('Chưa có tin nhắn. Hãy gửi lời chào!');
    act(() => mocks.listener?.(message('1')));
    mocks.fetch.mockResolvedValueOnce({ items: [message('4'), message('3')], hasMore: true }).mockResolvedValueOnce({ items: [message('2'), message('1')], hasMore: false });
    mocks.revision++; view.rerender(<ConversationPage id="c1" />);
    await screen.findByText('Tin 2');
    expect(mocks.fetch).toHaveBeenLastCalledWith({ id: 'c1', before: '3' });
  });
  it('ignores events for another conversation', async () => {
    render(<ConversationPage id="c1" />); await screen.findByText('Chưa có tin nhắn. Hãy gửi lời chào!');
    act(() => mocks.listener?.({ ...message('1'), conversationId: 'other' }));
    expect(screen.queryByText('Tin 1')).toBeNull();
  });
  it('does not send whitespace or submit while composing Vietnamese text', async () => {
    render(<ConversationPage id="c1" />); await screen.findByText('Chưa có tin nhắn. Hãy gửi lời chào!');
    const input = screen.getByLabelText('Nội dung tin nhắn');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' }); expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Xin chào' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true }); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('loads older messages using the oldest rendered cursor', async () => {
    mocks.fetch.mockResolvedValueOnce({ items: [message('3'), message('2')], hasMore: true }).mockResolvedValueOnce({ items: [message('1')], hasMore: false });
    render(<ConversationPage id="c1" />); await screen.findByText('Tin 2');
    fireEvent.click(screen.getByText('Tải tin cũ')); await screen.findByText('Tin 1');
    expect(mocks.fetch).toHaveBeenLastCalledWith({ id: 'c1', before: '2' });
    expect(screen.queryByText('Tải tin cũ')).toBeNull();
  });
});
