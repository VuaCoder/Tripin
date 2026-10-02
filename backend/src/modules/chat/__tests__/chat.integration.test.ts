import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { ConversationModel, MessageModel } from '../chat.model';
import { bearer, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

// Real Express app + real MongoDB: the REST side of the traveler <-> guide chat (the socket side has its own test).
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

async function setup() {
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const guide = await createUser('TOUR_GUIDE', 'guide@example.com');
  const outsider = await createUser('TRAVELER', 'outsider@example.com');
  return { traveler, guide, outsider };
}

const start = (token: string, participantId: string) =>
  request(app).post('/api/v1/chat/conversations').set(bearer(token)).send({ participantId });
const send = (token: string, conversationId: string, text: string) =>
  request(app).post(`/api/v1/chat/conversations/${conversationId}/messages`).set(bearer(token)).send({ text });

describe('chat REST (integration)', () => {
  it('only a traveler and a tour guide can talk; both starting at once share ONE conversation', async () => {
    const { traveler, guide, outsider } = await setup();
    const agency = await createUser('AGENCY', 'agency@example.com');

    expect((await start(traveler.token, outsider.id)).status).toBeGreaterThanOrEqual(400); // traveler -> traveler
    expect((await start(agency.token, guide.id)).status).toBe(403); // agencies are not part of the chat use case
    expect((await start(guide.token, agency.id)).status).toBeGreaterThanOrEqual(400);

    const results = await Promise.all([
      ...Array.from({ length: 4 }, () => start(traveler.token, guide.id)),
      ...Array.from({ length: 4 }, () => start(guide.token, traveler.id)),
    ]);
    expect(results.every((r) => r.status < 300)).toBe(true);
    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
    expect(await ConversationModel.countDocuments()).toBe(1);
  });

  it('messages are visible only to the two participants, in order, with cursor pagination', async () => {
    const { traveler, guide, outsider } = await setup();
    const id = (await start(traveler.token, guide.id)).body.data.id;

    for (let i = 1; i <= 5; i += 1) {
      expect((await send(i % 2 ? traveler.token : guide.token, id, `message ${i}`)).status).toBe(201);
    }
    expect((await send(outsider.token, id, 'let me in')).status).toBe(404);
    expect((await request(app).get(`/api/v1/chat/conversations/${id}/messages`).set(bearer(outsider.token))).status).toBe(404);
    expect((await request(app).post(`/api/v1/chat/conversations/${id}/read`).set(bearer(outsider.token))).status).toBe(404);
    expect((await request(app).get('/api/v1/chat/conversations').set(bearer(outsider.token))).body.data).toHaveLength(0);
    expect((await request(app).get(`/api/v1/chat/conversations/${id}/messages`)).status).toBe(401);

    const firstPage = await request(app).get(`/api/v1/chat/conversations/${id}/messages`).query({ limit: 3 }).set(bearer(guide.token));
    expect(firstPage.body.data.items).toHaveLength(3);
    expect(firstPage.body.data.hasMore).toBe(true);
    const oldestShown = firstPage.body.data.items.at(-1).id; // pages are newest first; the last id is the cursor
    const secondPage = await request(app)
      .get(`/api/v1/chat/conversations/${id}/messages`)
      .query({ limit: 3, before: oldestShown })
      .set(bearer(guide.token));
    expect(secondPage.body.data.items).toHaveLength(2);
    expect(secondPage.body.data.hasMore).toBe(false);
    const all = [...firstPage.body.data.items, ...secondPage.body.data.items].map((m: { text: string }) => m.text);
    expect(all).toEqual(['message 5', 'message 4', 'message 3', 'message 2', 'message 1']);
  });

  it('unread counters follow who wrote last and reset when the recipient reads; parallel sends lose nothing', async () => {
    const { traveler, guide } = await setup();
    const id = (await start(traveler.token, guide.id)).body.data.id;

    const sends = await Promise.all(Array.from({ length: 10 }, (_, i) => send(traveler.token, id, `ping ${i}`)));
    expect(sends.every((r) => r.status === 201)).toBe(true);
    expect(await MessageModel.countDocuments({ conversationId: id })).toBe(10);

    const guideView = await request(app).get('/api/v1/chat/conversations').set(bearer(guide.token));
    expect(guideView.body.data[0].unreadCount).toBe(10);
    const travelerView = await request(app).get('/api/v1/chat/conversations').set(bearer(traveler.token));
    expect(travelerView.body.data[0].unreadCount).toBe(0);

    expect((await request(app).post(`/api/v1/chat/conversations/${id}/read`).set(bearer(guide.token))).status).toBeLessThan(300);
    const after = await request(app).get('/api/v1/chat/conversations').set(bearer(guide.token));
    expect(after.body.data[0].unreadCount).toBe(0);
  });

  it('a banned user cannot chat any more, and messages are validated', async () => {
    const { traveler, guide } = await setup();
    const id = (await start(traveler.token, guide.id)).body.data.id;
    expect((await send(traveler.token, id, '   ')).status).toBe(400);
    expect((await send(traveler.token, id, 'x'.repeat(5000))).status).toBe(400);

    const moderator = await createUser('MODERATOR', 'mod@example.com');
    await request(app).post(`/api/v1/moderation/users/${traveler.id}/ban`).set(bearer(moderator.token)).send({ reason: 'Harassment of guides' });
    expect((await send(traveler.token, id, 'still here')).status).toBe(403);
    expect((await send(guide.token, id, 'hello?')).status).toBeLessThan(300); // the other side is unaffected
  });
});
