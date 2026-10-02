import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { attachChatGateway } from '../chat.gateway';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { prisma } from '../../../config/database';

// The WHOLE stack: real HTTP + Socket.IO server, real services, real PostgreSQL, real access tokens.
const app = createApp();
let server: http.Server;
let url: string;
let io: ReturnType<typeof attachChatGateway>;
let sockets: Socket[] = [];

beforeAll(async () => {
  await startDatabase();
  server = http.createServer(app);
  io = attachChatGateway(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 120_000);
afterAll(async () => {
  void io.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopDatabase();
});
beforeEach(resetDatabase);
afterEach(() => {
  sockets.forEach((socket) => socket.close());
  sockets = [];
});

const open = (token?: string) => {
  const socket = connect(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
  sockets.push(socket);
  return socket;
};
const ready = (socket: Socket) =>
  new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
const ack = (socket: Socket, event: string, payload: unknown) => new Promise<any>((resolve) => socket.emit(event, payload, resolve)); // eslint-disable-line @typescript-eslint/no-explicit-any
const nextEvent = (socket: Socket, event: string, timeoutMs = 2000) =>
  new Promise<any>((resolve, reject) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${timeoutMs} ms`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
/** Resolves true when NOTHING arrives (used for "must not receive"). */
const silent = (socket: Socket, event: string, ms = 400) =>
  new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(true), ms);
    socket.once(event, () => {
      clearTimeout(timer);
      resolve(false);
    });
  });

async function conversation() {
  const traveler = await createUser('TRAVELER', 'traveler@example.com');
  const guide = await createUser('TOUR_GUIDE', 'guide@example.com');
  const outsider = await createUser('TRAVELER', 'outsider@example.com');
  const started = await request(app).post('/api/v1/chat/conversations').set(bearer(traveler.token)).send({ participantId: guide.id });
  return { traveler, guide, outsider, conversationId: started.body.data.id as string };
}

describe('chat over sockets (real stack)', () => {
  it('delivers a REST message to the counterpart and to the sender’s other devices, and to nobody else', async () => {
    const { traveler, guide, outsider, conversationId } = await conversation();
    const guideSocket = open(guide.token);
    const travelerPhone = open(traveler.token);
    const travelerLaptop = open(traveler.token);
    const outsiderSocket = open(outsider.token);
    await Promise.all([guideSocket, travelerPhone, travelerLaptop, outsiderSocket].map(ready));

    const inbox = Promise.all([nextEvent(guideSocket, 'chat:message'), nextEvent(travelerPhone, 'chat:message'), nextEvent(travelerLaptop, 'chat:message')]);
    const nothing = silent(outsiderSocket, 'chat:message');
    const sent = await request(app).post(`/api/v1/chat/conversations/${conversationId}/messages`).set(bearer(traveler.token)).send({ text: 'Hello guide!' });
    expect(sent.status).toBe(201);

    for (const event of await inbox) {
      expect(event.conversationId).toBe(conversationId);
      expect(event.message.text).toBe('Hello guide!');
    }
    expect(await nothing).toBe(true);
  });

  it('chat:send over the socket stores the message, acks, and fans out; a foreign conversation is refused and leaks nothing', async () => {
    const { traveler, guide, outsider, conversationId } = await conversation();
    const guideSocket = open(guide.token);
    const outsiderSocket = open(outsider.token);
    const travelerSocket = open(traveler.token);
    await Promise.all([guideSocket, outsiderSocket, travelerSocket].map(ready));

    const received = nextEvent(guideSocket, 'chat:message');
    const reply = await ack(travelerSocket, 'chat:send', { conversationId, text: 'Via socket' });
    expect(reply.ok).toBe(true);
    expect((await received).message.text).toBe('Via socket');
    expect(await prisma.message.count({ where: { conversationId } })).toBe(1);

    const nothing = Promise.all([silent(guideSocket, 'chat:message'), silent(travelerSocket, 'chat:message')]);
    const refused = await ack(outsiderSocket, 'chat:send', { conversationId, text: 'Let me in' });
    expect(refused.ok).toBe(false);
    expect(refused.error.code).toBe('NOT_FOUND');
    expect(await nothing).toEqual([true, true]);
    expect(await prisma.message.count({ where: { conversationId } })).toBe(1);

    // Payload validation and spoofing: the sender is always the authenticated user.
    expect((await ack(travelerSocket, 'chat:send', { conversationId, text: '' })).ok).toBe(false);
    expect((await ack(travelerSocket, 'chat:send', { conversationId, text: 'x'.repeat(5000) })).error.code).toBe('VALIDATION_ERROR');
    const spoof = await ack(travelerSocket, 'chat:send', { conversationId, text: 'Spoof', senderId: guide.id });
    expect(spoof.ok).toBe(false); // strict payload: no extra fields
    const mine = await prisma.message.findMany({ where: { conversationId } });
    expect(mine.every((m) => String(m.senderId) === traveler.id)).toBe(true);
  });

  it('typing indicators and read receipts reach only the counterpart', async () => {
    const { traveler, guide, outsider, conversationId } = await conversation();
    const guideSocket = open(guide.token);
    const travelerSocket = open(traveler.token);
    const outsiderSocket = open(outsider.token);
    await Promise.all([guideSocket, travelerSocket, outsiderSocket].map(ready));

    const typing = nextEvent(guideSocket, 'chat:typing');
    const nothing = silent(outsiderSocket, 'chat:typing');
    await ack(travelerSocket, 'chat:typing', { conversationId });
    expect((await typing).userId).toBe(traveler.id);
    expect(await nothing).toBe(true);
    expect((await ack(outsiderSocket, 'chat:typing', { conversationId })).ok).toBe(false);

    await ack(travelerSocket, 'chat:send', { conversationId, text: 'unread one' });
    const read = await ack(guideSocket, 'chat:read', { conversationId });
    expect(read.ok).toBe(true);
    expect(read.data.unreadCount).toBe(0);
  });

  it('live notifications reach only their owner', async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const other = await createUser('TRAVELER', 'other@example.com');
    const { tourId, departureId } = await createApprovedTour(agency.id);
    const travelerSocket = open(traveler.token);
    const otherSocket = open(other.token);
    const agencySocket = open(agency.token);
    await Promise.all([travelerSocket, otherSocket, agencySocket].map(ready));

    const mine = nextEvent(travelerSocket, 'notification:new');
    const theirs = nextEvent(agencySocket, 'notification:new').catch(() => null);
    const nothing = silent(otherSocket, 'notification:new');
    const booked = await request(app)
      .post('/api/v1/bookings')
      .set(bearer(traveler.token))
      .send({ tourId, departureId, participants: 1, contact: { fullName: 'Nguyen Van A', phone: '0901234567' } });
    expect(booked.status).toBe(201);
    expect((await mine).type).toBe('BOOKING_CREATED');
    expect(await nothing).toBe(true);
    await theirs; // the agency gets its own (or none): never the traveler's
  });

  it('authentication: no token, garbage, banned and unknown accounts cannot connect', async () => {
    const { traveler } = await conversation();
    await expect(ready(open())).rejects.toThrow();
    await expect(ready(open('garbage'))).rejects.toThrow();
    await prisma.user.updateMany({ where: { id: traveler.id }, data: { status: 'BANNED' } });
    await expect(ready(open(traveler.token))).rejects.toThrow(/ACCOUNT_BANNED/);
  });

  it('a ban cuts off an ALREADY OPEN socket on its next event, like it does for HTTP', async () => {
    const { traveler, guide, conversationId } = await conversation();
    const travelerSocket = open(traveler.token);
    const guideSocket = open(guide.token);
    await Promise.all([travelerSocket, guideSocket].map(ready));
    expect((await ack(travelerSocket, 'chat:send', { conversationId, text: 'before the ban' })).ok).toBe(true);

    await prisma.user.updateMany({ where: { id: traveler.id }, data: { status: 'BANNED' } });
    const silence = silent(guideSocket, 'chat:message');
    const afterBan = await ack(travelerSocket, 'chat:send', { conversationId, text: 'after the ban' });
    expect(afterBan.ok).toBe(false);
    expect(['ACCOUNT_BANNED', 'FORBIDDEN']).toContain(afterBan.error.code);
    expect(await silence).toBe(true);
    expect(await prisma.message.count({ where: { conversationId } })).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(travelerSocket.connected).toBe(false); // the dead session is closed, not just refused
  });

  it('a role change takes effect on an open socket: an agency promoted away from chat cannot keep using it', async () => {
    const { traveler, conversationId } = await conversation();
    const travelerSocket = open(traveler.token);
    await ready(travelerSocket);
    await prisma.user.updateMany({ where: { id: traveler.id }, data: { role: 'AGENCY' } });
    const res = await ack(travelerSocket, 'chat:send', { conversationId, text: 'still a traveler?' });
    expect(res.ok).toBe(false);
  });

  it('floods are rate limited per socket', async () => {
    const { traveler, conversationId } = await conversation();
    const travelerSocket = open(traveler.token);
    await ready(travelerSocket);
    const replies = await Promise.all(Array.from({ length: 30 }, (_, i) => ack(travelerSocket, 'chat:send', { conversationId, text: `flood ${i}` })));
    expect(replies.filter((r) => r.ok).length).toBeLessThanOrEqual(20);
    expect(replies.some((r) => !r.ok && r.error.code === 'RATE_LIMITED')).toBe(true);
  });
});
