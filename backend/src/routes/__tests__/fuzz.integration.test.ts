import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@travel-platform/constants';
import { createApp } from '../../app';
import { listRoutes, API_PREFIX } from '../introspect';
import { bearer, createApprovedTour, createUser, startDatabase, stopDatabase } from '../../test/integration';

// Every route of the LIVE route table receives garbage as a user who passes the guards (and as a plain traveler).
// Whatever arrives, the API must answer in its own envelope and never with a 5xx.
const app = createApp();
const routes = listRoutes().filter((route) => route.method !== 'OPTIONS' && route.method !== 'HEAD');

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);

const KNOWN_UNKNOWN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const BODIES: unknown[] = [
  undefined,
  {},
  [],
  null,
  'just a string',
  42,
  true,
  { email: { $ne: null }, password: { $gt: '' }, code: { $regex: '.*' } },
  { __proto__: { isAdmin: true }, constructor: { prototype: { polluted: true } } },
  JSON.parse('{"__proto__":{"polluted":"yes"},"a":{"constructor":{"prototype":{"polluted":"yes"}}}}'),
  { text: 'x'.repeat(100_000), message: 'y'.repeat(100_000), title: 'z'.repeat(100_000) },
  { page: -1, limit: 'abc', participants: -5, rating: 99, price: 'free', amount: { $gt: 0 }, ratePercent: 'ten' },
  { departures: [{ date: 'not a date', capacity: 'many' }], days: 'none', tours: [{}, null, 7], planId: ['a'], bookingId: { a: 1 } },
  { id: KNOWN_UNKNOWN_ID, tourId: KNOWN_UNKNOWN_ID, bookingId: KNOWN_UNKNOWN_ID, participantId: KNOWN_UNKNOWN_ID, targetId: KNOWN_UNKNOWN_ID, planId: KNOWN_UNKNOWN_ID, conversationId: KNOWN_UNKNOWN_ID },
  { nested: { deep: { deeper: { deepest: Array.from({ length: 50 }, () => ({ a: [[[[[1]]]]] })) } } } },
  { emoji: '😀'.repeat(500), nul: 'a\u0000b', rtl: '‮evil', surrogate: '\ud800' },
];

const QUERIES = [
  '',
  '?page=-1&limit=0',
  '?page=abc&limit=9999999',
  '?q[$ne]=1&sort[$gt]=0&status[$in][]=x',
  `?tourId=${KNOWN_UNKNOWN_ID}&agencyId=${KNOWN_UNKNOWN_ID}&from=yesterday&to=tomorrow&status=NOPE`,
  `?q=${encodeURIComponent('(a+)+$'.repeat(20))}&destination=${encodeURIComponent('<script>alert(1)</script>')}`,
  `?before=${encodeURIComponent('%00')}&minPrice=1e999&maxPrice=-Infinity&sort=%E0%A4%A`,
  `?${'a=1&'.repeat(500)}`,
];

const PARAMS = [KNOWN_UNKNOWN_ID, 'not-an-id', encodeURIComponent('../../etc/passwd'), 'x'.repeat(5000), encodeURIComponent('%00'), '{"$ne":1}'];

function fill(path: string, value: string): string {
  return path.replace(/:\w+/g, value);
}

describe('route fuzzing (real stack)', () => {
  it('the route table is not empty and covers every method', () => {
    expect(routes.length).toBeGreaterThan(100);
    expect(new Set(routes.map((r) => r.method))).toEqual(new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']));
  });

  it('no route answers 5xx to garbage bodies, queries or path parameters, with or without full permissions', async () => {
    const everything = await createUser('SUPER_ADMIN', 'root@example.com', { extraPermissions: Object.values(PERMISSIONS) });
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const agency = await createUser('AGENCY', 'agency@example.com');
    await createApprovedTour(agency.id); // some real data around so lookups sometimes succeed
    const actors: { name: string; token?: string }[] = [{ name: 'guest' }, { name: 'traveler', token: traveler.token }, { name: 'root', token: everything.token }];

    const failures: string[] = [];
    let requests = 0;
    const attempt = async (method: string, url: string, actor: { name: string; token?: string }, body?: unknown) => {
      let agent = (request(app) as unknown as Record<string, (u: string) => request.Test>)[method.toLowerCase()]!(url);
      if (actor.token) agent = agent.set(bearer(actor.token));
      if (body !== undefined && method !== 'GET' && method !== 'DELETE') agent = agent.set('Content-Type', 'application/json').send(typeof body === 'string' ? JSON.stringify(body) : (body as object));
      const res = await agent.ok(() => true);
      requests += 1;
      // 503 SERVICE_UNAVAILABLE is the documented answer when a provider (PayOS, Google, AI) is not configured: not a crash.
      const providerMissing = res.status === 503 && res.body?.error?.code === 'SERVICE_UNAVAILABLE';
      if (res.status >= 500 && !providerMissing) failures.push(`${res.status} ${method} ${url} as ${actor.name} body=${JSON.stringify(body)?.slice(0, 80)} -> ${JSON.stringify(res.body).slice(0, 120)}`);
      else if (res.status >= 400 && res.headers['content-type']?.includes('json')) {
        if (res.body?.success !== false || typeof res.body?.error?.code !== 'string') failures.push(`bad envelope ${res.status} ${method} ${url}: ${JSON.stringify(res.body).slice(0, 120)}`);
      }
    };

    for (const route of routes) {
      const isWrite = route.method !== 'GET' && route.method !== 'DELETE';
      for (const actor of actors) {
        const full = actor.name === 'root'; // the user who passes every guard gets the whole battery, the others a light one
        for (const param of full ? PARAMS : PARAMS.slice(0, 2)) {
          const url = fill(route.path, param);
          await attempt(route.method, url, actor, isWrite ? BODIES[requests % BODIES.length] : undefined);
        }
        const base = fill(route.path, KNOWN_UNKNOWN_ID);
        for (const query of full ? QUERIES : QUERIES.slice(0, 4)) await attempt(route.method, base + query, actor, isWrite ? BODIES[(requests + 3) % BODIES.length] : undefined);
        if (isWrite && full) for (const body of BODIES) await attempt(route.method, base, actor, body);
      }
    }
    expect(requests).toBeGreaterThan(3000);
    expect(failures).toEqual([]);
    // Prototype-pollution payloads were sent everywhere: the global object prototype must be untouched.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  }, 600_000);

  it('malformed JSON, wrong content types and an oversized body are refused politely', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const post = (path: string) => request(app).post(`${API_PREFIX}${path}`).set(bearer(admin.token)).ok(() => true);

    for (const raw of ['{"a":', '{{{', '[1,2', '\u0000', '{"a":1}garbage']) {
      const res = await post('/admin/categories').set('Content-Type', 'application/json').send(raw);
      expect(res.status, raw).toBe(400);
      expect(res.body.success).toBe(false);
    }
    for (const type of ['text/plain', 'application/xml', 'multipart/form-data; boundary=x', 'application/x-www-form-urlencoded']) {
      const res = await post('/admin/categories').set('Content-Type', type).send('name=Hello');
      expect(res.status, type).toBeLessThan(500);
    }
    const huge = await post('/admin/categories').set('Content-Type', 'application/json').send(JSON.stringify({ name: 'x'.repeat(3_000_000) }));
    expect(huge.status).toBe(413);
  });
});
