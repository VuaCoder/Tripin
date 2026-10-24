import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  user: { id: 't1', role: 'TRAVELER', permissions: ['chat:use'] }, token: 'token-1',
  dispatch: vi.fn(), io: vi.fn(), refresh: vi.fn(),
}));
vi.mock('socket.io-client', () => ({ io: mocks.io }));
vi.mock('@/store/hooks', () => ({ useAppDispatch: () => mocks.dispatch, useAppSelector: (selector: Function) => selector({ auth: { user: mocks.user, accessToken: mocks.token } }) }));
vi.mock('@/store/api/baseApi', () => ({ refreshSession: mocks.refresh }));
vi.mock('../api', () => ({ chatApi: { util: { invalidateTags: () => ({ type: 'invalidate' }) } } }));
vi.mock('../api/aiChatApi', () => ({ aiChatApi: { util: { invalidateTags: () => ({ type: 'invalidate-ai' }) } } }));
import { ChatProvider, useChat } from '../ChatProvider';
let socket: ReturnType<typeof createSocket>;
function createSocket() {
  const handlers: Record<string, Function> = {};
  return { connected: false, handlers, on: vi.fn((name: string, listener: Function) => { handlers[name] = listener; }),
    disconnect: vi.fn(), connect: vi.fn(), removeAllListeners: vi.fn(), timeout: vi.fn(), emit: vi.fn() };
}
function Consumer() {
  const chat = useChat();
  return <><p>{chat.connected ? 'connected' : 'offline'}</p><p>{chat.delivered.has('m1') ? 'delivered' : 'sent'}</p><button onClick={() => { void chat.send('c1', 'hello'); }}>Send</button></>;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.token = 'token-1'; mocks.user = { id: 't1', role: 'TRAVELER', permissions: ['chat:use'] };
  socket = createSocket(); socket.timeout.mockReturnValue(socket); mocks.io.mockReturnValue(socket);
});
afterEach(cleanup);
describe('ChatProvider', () => {
  it('authenticates one shared socket and disposes it on unmount', () => {
    const view = render(<ChatProvider><Consumer /></ChatProvider>);
    expect(mocks.io).toHaveBeenCalledTimes(1);
    expect(mocks.io.mock.calls[0][1]).toMatchObject({ path: '/socket.io', auth: { token: 'token-1' }, reconnectionDelayMax: 10000 });
    view.unmount(); expect(socket.disconnect).toHaveBeenCalled(); expect(socket.removeAllListeners).toHaveBeenCalled();
  });
  it('never emits a send while offline', () => {
    render(<ChatProvider><Consumer /></ChatProvider>); fireEvent.click(screen.getByText('Send'));
    expect(socket.emit).not.toHaveBeenCalled();
  });
  it('uses a bounded acknowledgment and accepts delivery only from backend events', () => {
    render(<ChatProvider><Consumer /></ChatProvider>);
    act(() => { socket.connected = true; socket.handlers.connect(); });
    fireEvent.click(screen.getByText('Send'));
    expect(socket.timeout).toHaveBeenCalledWith(10000);
    expect(socket.emit).toHaveBeenCalledWith('chat:send', { conversationId: 'c1', text: 'hello' }, expect.any(Function));
    act(() => socket.handlers['chat:delivered']({ messageId: 'm1' })); expect(screen.getByText('delivered')).toBeTruthy();
  });
  it('acknowledges receipt only for a consistent message payload', () => {
    render(<ChatProvider><Consumer /></ChatProvider>); const acknowledge = vi.fn();
    act(() => socket.handlers['chat:message']({ conversationId: 'c1', message: { id: 'm1', conversationId: 'c2' } }, acknowledge));
    expect(acknowledge).not.toHaveBeenCalled();
    act(() => socket.handlers['chat:message']({ conversationId: 'c1', message: { id: 'm1', conversationId: 'c1' } }, acknowledge));
    expect(acknowledge).toHaveBeenCalledWith(true);
  });
  it('does not apply a late refresh after an account switch', async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.refresh.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<ChatProvider><Consumer /></ChatProvider>);
    act(() => socket.handlers.connect_error(new Error('TOKEN_INVALID')));
    mocks.user = { ...mocks.user, id: 't2' }; view.rerender(<ChatProvider><Consumer /></ChatProvider>);
    await act(async () => resolve({ user: { id: 't1' }, accessToken: 'late' }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});

function TypingConsumer() {
  const chat = useChat();
  useEffect(() => chat.subscribeTyping(event => mocks.dispatch(event)), [chat.subscribeTyping]);
  return <button onClick={() => chat.typing('c1')}>Typing</button>;
}
describe('Chat typing events', () => {
  it('throttles outgoing events and ignores malformed or self typing events', () => {
    vi.useFakeTimers();
    try {
      render(<ChatProvider><TypingConsumer /></ChatProvider>);
      fireEvent.click(screen.getByText('Typing'));
      expect(socket.emit).not.toHaveBeenCalled();
      act(() => { socket.connected = true; socket.handlers.connect(); });
      mocks.dispatch.mockClear();
      fireEvent.click(screen.getByText('Typing'));
      fireEvent.click(screen.getByText('Typing'));
      expect(socket.emit).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(2000));
      fireEvent.click(screen.getByText('Typing'));
      expect(socket.emit).toHaveBeenCalledTimes(2);
      act(() => socket.handlers['chat:typing']({ conversationId: 'c1', userId: 't1' }));
      act(() => socket.handlers['chat:typing']({ conversationId: 'c1' }));
      expect(mocks.dispatch).not.toHaveBeenCalled();
      act(() => socket.handlers['chat:typing']({ conversationId: 'c1', userId: 'g1' }));
      expect(mocks.dispatch).toHaveBeenCalledWith({ conversationId: 'c1', userId: 'g1' });
    } finally { vi.useRealTimers(); }
  });
});
