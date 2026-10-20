import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authReducer from '@/features/auth/store/authSlice';
import { chatApi } from '../api';
const makeStore = () => configureStore({ reducer: { auth: authReducer, api: chatApi.reducer }, middleware: get => get().concat(chatApi.middleware) });
function respond(data: unknown, meta?: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: status < 400, data, meta }), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch); return fetch;
}
afterEach(() => vi.unstubAllGlobals());
describe('chatApi', () => {
  it('preserves inbox metadata and page parameters', async () => {
    const fetch = respond([{ id: 'c1' }], { page: 2, totalPages: 3 }); const store = makeStore();
    const result = await store.dispatch(chatApi.endpoints.conversations.initiate(2));
    expect(result.data?.meta.totalPages).toBe(3);
    expect(fetch.mock.calls[0][0].url).toContain('page=2&limit=20'); store.dispatch(chatApi.util.resetApiState());
  });
  it('loads conversation detail and passes the history cursor', async () => {
    respond({ id: 'c1' }); const store = makeStore();
    expect(await store.dispatch(chatApi.endpoints.conversation.initiate('c1')).unwrap()).toEqual({ id: 'c1' });
    const fetch = respond({ items: [], hasMore: false });
    await store.dispatch(chatApi.endpoints.messages.initiate({ id: 'c1', before: 'm1' }));
    expect(fetch.mock.calls[0][0].url).toContain('/c1/messages?limit=30&before=m1'); store.dispatch(chatApi.util.resetApiState());
  });
  it('creates a conversation with only the counterpart and optional tour', async () => {
    const fetch = respond({ id: 'c1' }); const store = makeStore();
    await store.dispatch(chatApi.endpoints.startConversation.initiate({ participantId: 'g1', tourId: 't1' }));
    const request = fetch.mock.calls[0][0] as Request;
    expect(request.method).toBe('POST'); expect(await request.json()).toEqual({ participantId: 'g1', tourId: 't1' }); store.dispatch(chatApi.util.resetApiState());
  });
});
