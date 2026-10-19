import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';
import { reportApi } from '@/features/report/api/reportApi';
import { moderationApi } from '../api/moderationApi';

/**
 * Cross-feature check of the dispute flow against the real RTK Query store and the real `baseApi`:
 * a Traveler files a report, the Moderator queue sees it, the Moderator decides it, and the Traveler's own
 * list reflects the backend's decision. Only the network is stubbed — the HTTP integration itself is covered
 * by `backend/src/modules/reports/__tests__/reports.integration.test.ts`.
 */

const json = (body: unknown, status = 200) => {
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

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

const createTestStore = () =>
  configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });

afterEach(() => vi.unstubAllGlobals());

describe('report -> dispute resolution flow', () => {
  it('carries one report from the traveler through the moderator decision back to the traveler', async () => {
    const openReport = {
      id: 'r1',
      targetType: 'TOUR',
      targetId: 't1',
      category: 'SAFETY',
      description: 'Xe đưa đón không có dây an toàn.',
      status: 'OPEN',
      createdAt: '2026-10-10T00:00:00.000Z',
    };
    const resolvedReport = {
      ...openReport,
      status: 'RESOLVED',
      agencyResponse: { text: 'Chúng tôi đã thay xe.', respondedAt: '2026-10-11T00:00:00.000Z' },
      resolution: { decision: 'RESOLVED', note: 'Đã xác minh cùng đối tác.', resolvedAt: '2026-10-12T00:00:00.000Z' },
    };
    const moderationReport = {
      ...openReport,
      reporterId: 'u-traveler',
      reporterName: 'Nguyễn Văn An',
      agencyId: 'u-agency',
      agencyName: 'Saigon Travel',
      tourId: 't1',
      tourTitle: 'Đà Nẵng 3N2Đ',
      targetName: 'Đà Nẵng 3N2Đ',
    };

    const calls: { url: string; method: string; body?: unknown }[] = [];
    // What the traveler's own list returns: OPEN until the moderator decides, RESOLVED afterwards.
    let travelerSees = openReport;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: Request | string) => {
        const req = input as Request;
        const url = typeof input === 'string' ? input : req.url;
        const method = typeof input === 'string' ? 'GET' : req.method;
        const body = method === 'GET' ? undefined : await req.clone().json();
        calls.push({ url, method, body });

        if (url.includes('/reports/me')) return json({ success: true, data: [travelerSees], meta: META });
        if (url.includes('/moderation/reports/') && url.includes('/resolve')) {
          travelerSees = resolvedReport;
          return json({ success: true, data: { ...resolvedReport, reporterId: 'u-traveler', agencyId: 'u-agency', tourId: 't1' } });
        }
        if (url.includes('/moderation/reports')) return json({ success: true, data: [moderationReport], meta: META });
        if (url.includes('/reports')) return json({ success: true, data: openReport }, 201);
        return json({ success: true, data: [] });
      }),
    );

    const store = createTestStore();

    // 1. The traveler files the report.
    const created = await store.dispatch(
      reportApi.endpoints.createReport.initiate({
        targetType: 'TOUR',
        targetId: 't1',
        category: 'SAFETY',
        description: 'Xe đưa đón không có dây an toàn.',
      }),
    );
    expect(created.data).toEqual(openReport);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { targetType: 'TOUR', targetId: 't1', category: 'SAFETY', description: 'Xe đưa đón không có dây an toàn.' },
    });
    expect(calls[0].url).toContain('/reports');

    // 2. The moderator queue returns exactly the report the traveler just filed, with the names the dialog shows.
    const queue = await store.dispatch(moderationApi.endpoints.getModerationReports.initiate({ status: 'OPEN' }));
    expect(queue.data?.items.map((r) => r.id)).toEqual([created.data?.id]);
    expect(queue.data?.items[0]).toMatchObject({
      reporterName: 'Nguyễn Văn An',
      agencyName: 'Saigon Travel',
      tourTitle: 'Đà Nẵng 3N2Đ',
      targetName: 'Đà Nẵng 3N2Đ',
    });

    // 3. The moderator decides it, with the note the backend requires.
    const decided = await store.dispatch(
      moderationApi.endpoints.resolveReport.initiate({ id: 'r1', decision: 'RESOLVED', note: 'Đã xác minh cùng đối tác.' }),
    );
    expect(decided.data?.status).toBe('RESOLVED');
    const resolveCall = calls.find((c) => c.url.includes('/moderation/reports/r1/resolve'));
    expect(resolveCall).toMatchObject({ method: 'POST', body: { decision: 'RESOLVED', note: 'Đã xác minh cùng đối tác.' } });

    // 4. The traveler's own list now shows the decision the backend stored.
    const mine = await store.dispatch(reportApi.endpoints.getMyReports.initiate());
    expect(mine.data?.items[0].status).toBe('RESOLVED');
    expect(mine.data?.items[0].resolution?.note).toBe('Đã xác minh cùng đối tác.');
    expect(mine.data?.items[0].agencyResponse?.text).toBe('Chúng tôi đã thay xe.');
  });

  it('keeps the traveler out of the moderation queue (403 is surfaced, never treated as data)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403)));
    const store = createTestStore();
    const result = await store.dispatch(moderationApi.endpoints.getModerationReports.initiate());
    expect('error' in result && result.error).toBeTruthy();
    expect('data' in result && result.data).toBeFalsy();
  });
});
