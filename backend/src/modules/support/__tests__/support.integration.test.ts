import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { SupportTicketModel } from '../support.model';
import { bearer, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

// Real Express app + real MongoDB: the support ticket conversation between a user and moderators.
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

async function setup() {
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const stranger = await createUser('TRAVELER', 'stranger@example.com');
  const moderator = await createUser('MODERATOR', 'mod@example.com');
  const moderator2 = await createUser('MODERATOR', 'mod2@example.com');
  return { traveler, stranger, moderator, moderator2 };
}

const open = (token: string, overrides: object = {}) =>
  request(app)
    .post('/api/v1/support/tickets')
    .set(bearer(token))
    .send({ subject: 'Cannot download my ticket', category: 'BOOKING', message: 'The e-ticket link does not open for me.', ...overrides });
const staffReply = (token: string, id: string, body: object) =>
  request(app).post(`/api/v1/moderation/support-tickets/${id}/reply`).set(bearer(token)).send(body);

describe('support (integration)', () => {
  it('opens a ticket, keeps it private to its owner and to moderators', async () => {
    const { traveler, stranger, moderator } = await setup();
    const created = await open(traveler.token);
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    expect((await request(app).get(`/api/v1/support/tickets/${id}`).set(bearer(stranger.token))).status).toBe(404);
    expect((await request(app).post(`/api/v1/support/tickets/${id}/messages`).set(bearer(stranger.token)).send({ text: 'Hello?' })).status).toBe(404);
    expect((await request(app).post(`/api/v1/support/tickets/${id}/close`).set(bearer(stranger.token))).status).toBe(404);
    expect((await request(app).get('/api/v1/support/tickets/me').set(bearer(stranger.token))).body.data).toHaveLength(0);

    expect((await request(app).get('/api/v1/moderation/support-tickets').set(bearer(traveler.token))).status).toBe(403);
    const queue = await request(app).get('/api/v1/moderation/support-tickets').set(bearer(moderator.token));
    expect(queue.body.data.map((t: { id: string }) => t.id)).toEqual([id]);
    expect((await open(traveler.token, { bookingId: '64b000000000000000000009' })).status).toBe(404); // foreign booking
  });

  it('staff reply moves the ticket forward, the first answering moderator is the assignee, the user is notified', async () => {
    const { traveler, moderator, moderator2 } = await setup();
    const id = (await open(traveler.token)).body.data.id;

    expect((await staffReply(moderator.token, id, { text: 'Looking into it now.' })).status).toBe(200);
    expect((await staffReply(moderator2.token, id, { text: 'I also checked the logs.' })).status).toBe(200);
    const stored = (await SupportTicketModel.findById(id))!;
    expect(stored.status).toBe('IN_PROGRESS');
    expect(String(stored.assignedTo)).toBe(moderator.id);
    expect(stored.messageCount).toBe(3);

    const notices = await request(app).get('/api/v1/notifications').set(bearer(traveler.token));
    expect(notices.body.data.filter((n: { type: string }) => n.type === 'SUPPORT_REPLIED').length).toBe(2);
  });

  it('parallel messages on one ticket are all kept, in a consistent counter', async () => {
    const { traveler } = await setup();
    const id = (await open(traveler.token)).body.data.id;
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => request(app).post(`/api/v1/support/tickets/${id}/messages`).set(bearer(traveler.token)).send({ text: `Update number ${i}` })),
    );
    expect(results.map((r) => r.status)).toEqual(results.map(() => 201));
    const stored = (await SupportTicketModel.findById(id))!;
    expect(stored.messages).toHaveLength(7);
    expect(stored.messageCount).toBe(7);
  });

  it('resolved tickets reopen when the user writes; closed tickets are final and close only once', async () => {
    const { traveler, moderator } = await setup();
    const id = (await open(traveler.token)).body.data.id;

    expect((await staffReply(moderator.token, id, { text: 'Fixed on our side.', resolve: true })).status).toBe(200);
    expect((await staffReply(moderator.token, id, { text: 'One more thing.' })).status).toBe(409); // staff cannot write on a RESOLVED ticket
    const reopened = await request(app).post(`/api/v1/support/tickets/${id}/messages`).set(bearer(traveler.token)).send({ text: 'Still broken, sorry.' });
    expect(reopened.status).toBe(201);
    expect((await SupportTicketModel.findById(id))!.status).toBe('IN_PROGRESS');

    const closes = await Promise.all([1, 2, 3].map(() => request(app).post(`/api/v1/support/tickets/${id}/close`).set(bearer(traveler.token))));
    expect(closes.filter((r) => r.status === 200)).toHaveLength(1);

    const late = await request(app).post(`/api/v1/support/tickets/${id}/messages`).set(bearer(traveler.token)).send({ text: 'Hello again' });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('TICKET_CLOSED');
    expect((await staffReply(moderator.token, id, { text: 'Anyone there?' })).status).toBe(409);
  });
});
