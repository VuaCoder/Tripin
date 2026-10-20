import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { moderationApi } from '../api/moderationApi';

const response = (body: unknown, status = 200) => {
  const payload = JSON.stringify(body);
  const res = {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => payload,
    json: async () => body,
    clone: () => res,
  };
  return res;
};

const mockFetch = (...responses: ReturnType<typeof response>[]) => {
  const fetchMock = vi.fn();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  // A mutation invalidates tags and a subscribed list refetches; answer those with an empty page.
  fetchMock.mockResolvedValue(response({ success: true, data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const createTestStore = () =>
  configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });

const requestOf = async (fetchMock: ReturnType<typeof mockFetch>) => {
  const req = fetchMock.mock.calls[0][0] as Request;
  return { url: req.url, method: req.method, body: req.method === 'GET' ? undefined : await req.clone().json() };
};

afterEach(() => vi.unstubAllGlobals());

describe('moderationApi wiring', () => {
  it('lists tours with paging and filters and unwraps data + meta', async () => {
    const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };
    const fetchMock = mockFetch(response({ success: true, data: [{ id: 't1' }], meta }));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.getModerationTours.initiate({ status: 'APPROVED', q: 'a' }));
    expect(result.data).toEqual({ items: [{ id: 't1' }], meta });
    const { url } = await requestOf(fetchMock);
    expect(url).toContain('/moderation/tours');
    expect(url).toContain('status=APPROVED');
    expect(url).toContain('q=a');
    expect(url).toContain('limit=10');
  });

  it('posts validate with the backend body shape', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { id: 't1', status: 'REJECTED' } }));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.validateTour.initiate({ id: 't1', approve: false, reason: 'bad' }));
    expect(result).toEqual({ data: { id: 't1', status: 'REJECTED' } });
    const req = await requestOf(fetchMock);
    expect(req.url).toContain('/moderation/tours/t1/validate');
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({ approve: false, reason: 'bad' });
  });

  it('posts suspend and verify', async () => {
    const fetchMock = mockFetch(response({ success: true, data: {} }), response({ success: true, data: {} }));
    const store = createTestStore();
    await store.dispatch(moderationApi.endpoints.suspendTour.initiate({ id: 't1', reason: 'bad' }));
    await store.dispatch(moderationApi.endpoints.verifyAgency.initiate({ id: 'u1', approve: true }));
    const a = fetchMock.mock.calls[0][0] as Request;
    const b = fetchMock.mock.calls[1][0] as Request;
    expect(a.url).toContain('/moderation/tours/t1/suspend');
    expect(await a.clone().json()).toEqual({ reason: 'bad' });
    expect(b.url).toContain('/moderation/agencies/u1/verify');
    expect(await b.clone().json()).toEqual({ approve: true });
  });

  it('surfaces backend failures instead of success', async () => {
    mockFetch(response({ success: false, error: { code: 'INVALID_STATE_TRANSITION', message: 'x' } }, 409));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.suspendTour.initiate({ id: 't1', reason: 'bad' }));
    expect('error' in result && result.error).toBeTruthy();
    expect('data' in result && result.data).toBeFalsy();
  });

  it('reads the dashboard', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { queues: { toursPendingReview: 2 } } }));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.getModerationDashboard.initiate());
    expect(result.data).toEqual({ queues: { toursPendingReview: 2 } });
    expect((await requestOf(fetchMock)).url).toContain('/moderation/dashboard');
  });
});

describe('moderationApi disputes, reviews, complaints and bans', () => {
  // A mutation invalidates tags, so a subscribed list refetches: pick requests by URL, never by index.
  const requestsTo = (fetchMock: ReturnType<typeof mockFetch>, urlPart: string) =>
    fetchMock.mock.calls.map(([arg]) => arg as Request).filter((r) => r.url.includes(urlPart));

  it('lists the report queue with every filter and unwraps data + meta', async () => {
    const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };
    const fetchMock = mockFetch(response({ success: true, data: [{ id: 'r1' }], meta }));
    const store = createTestStore();
    const result = await store.dispatch(
      moderationApi.endpoints.getModerationReports.initiate({ status: 'OPEN', targetType: 'TOUR', category: 'SAFETY' }),
    );
    expect(result.data).toEqual({ items: [{ id: 'r1' }], meta });
    const { url } = await requestOf(fetchMock);
    expect(url).toContain('/moderation/reports');
    expect(url).toContain('status=OPEN');
    expect(url).toContain('targetType=TOUR');
    expect(url).toContain('category=SAFETY');
  });

  it('posts a dispute decision with the backend body shape', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { id: 'r1', status: 'RESOLVED' } }));
    const store = createTestStore();
    const result = await store.dispatch(
      moderationApi.endpoints.resolveReport.initiate({ id: 'r1', decision: 'RESOLVED', note: 'Đã xác minh' }),
    );
    expect(result).toEqual({ data: { id: 'r1', status: 'RESOLVED' } });
    const req = await requestOf(fetchMock);
    expect(req.url).toContain('/moderation/reports/r1/resolve');
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({ decision: 'RESOLVED', note: 'Đã xác minh' });
  });

  it('lists reviews and posts a moderation decision (reason only when hiding)', async () => {
    const fetchMock = mockFetch(
      response({ success: true, data: [{ id: 'v1' }] }),
      response({ success: true, data: { id: 'v1', tourId: 't1', status: 'HIDDEN' } }),
      response({ success: true, data: { id: 'v1', tourId: 't1', status: 'VISIBLE' } }),
    );
    const store = createTestStore();
    await store.dispatch(moderationApi.endpoints.getModerationReviews.initiate({ status: 'VISIBLE' }));
    await store.dispatch(moderationApi.endpoints.moderateReview.initiate({ id: 'v1', hide: true, reason: 'Xúc phạm' }));
    await store.dispatch(moderationApi.endpoints.moderateReview.initiate({ id: 'v1', hide: false }));

    const list = requestsTo(fetchMock, '/moderation/reviews?')[0];
    expect(list.url).toContain('status=VISIBLE');
    const moderations = requestsTo(fetchMock, '/moderate');
    expect(moderations).toHaveLength(2);
    expect(moderations[0].url).toContain('/moderation/reviews/v1/moderate');
    expect(await moderations[0].clone().json()).toEqual({ hide: true, reason: 'Xúc phạm' });
    expect(await moderations[1].clone().json()).toEqual({ hide: false });
  });

  it('lists support tickets, reads one ticket and replies (optionally resolving)', async () => {
    const fetchMock = mockFetch(
      response({ success: true, data: [{ id: 's1' }] }),
      response({ success: true, data: { id: 's1', messages: [] } }),
      response({ success: true, data: { id: 's1', status: 'RESOLVED' } }),
    );
    const store = createTestStore();
    await store.dispatch(moderationApi.endpoints.getModerationTickets.initiate({ status: 'OPEN', category: 'PAYMENT' }));
    const detail = await store.dispatch(moderationApi.endpoints.getModerationTicket.initiate('s1'));
    expect(detail.data).toEqual({ id: 's1', messages: [] });
    await store.dispatch(moderationApi.endpoints.replyToModerationTicket.initiate({ id: 's1', text: 'Đã hoàn tiền', resolve: true }));

    const list = requestsTo(fetchMock, '/moderation/support-tickets?')[0];
    expect(list.url).toContain('status=OPEN');
    expect(list.url).toContain('category=PAYMENT');
    expect(requestsTo(fetchMock, '/moderation/support-tickets/s1')[0].url).toContain('/moderation/support-tickets/s1');
    const reply = requestsTo(fetchMock, '/reply')[0];
    expect(reply.method).toBe('POST');
    expect(await reply.clone().json()).toEqual({ text: 'Đã hoàn tiền', resolve: true });
  });

  it('patches a ticket status without a message', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { id: 's1', status: 'IN_PROGRESS' } }));
    const store = createTestStore();
    await store.dispatch(moderationApi.endpoints.setModerationTicketStatus.initiate({ id: 's1', status: 'IN_PROGRESS' }));
    const req = await requestOf(fetchMock);
    expect(req.url).toContain('/moderation/support-tickets/s1/status');
    expect(req.method).toBe('PATCH');
    expect(req.body).toEqual({ status: 'IN_PROGRESS' });
  });

  it('bans an account with a reason and surfaces the backend refusal', async () => {
    const fetchMock = mockFetch(response({ success: true, data: { id: 'u1', status: 'BANNED' } }));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.banAccount.initiate({ id: 'u1', reason: 'Spam đánh giá' }));
    expect(result).toEqual({ data: { id: 'u1', status: 'BANNED' } });
    const req = await requestOf(fetchMock);
    expect(req.url).toContain('/moderation/users/u1/ban');
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({ reason: 'Spam đánh giá' });

    mockFetch(response({ success: false, error: { code: 'FORBIDDEN', message: 'nope' } }, 403));
    const refused = await createTestStore().dispatch(moderationApi.endpoints.banAccount.initiate({ id: 'u2', reason: 'x' }));
    expect('error' in refused && refused.error).toBeTruthy();
  });
});
