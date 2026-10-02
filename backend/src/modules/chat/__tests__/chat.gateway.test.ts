import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@travel-platform/constants';

// The handshake uses the same token -> actor resolution as HTTP; replace it so no database is needed.
vi.mock('../../../middlewares/authenticate', () => ({
  resolveUserActor: vi.fn(async (token: string) => {
    if (token === 'traveler-token') return { kind: 'user', userId: 't1', email: 't@x.y', role: 'TRAVELER', permissions: [PERMISSIONS.CHAT_USE] };
    if (token === 'guide-token') return { kind: 'user', userId: 'g1', email: 'g@x.y', role: 'TOUR_GUIDE', permissions: [PERMISSIONS.CHAT_USE] };
    if (token === 'agency-token') return { kind: 'user', userId: 'a1', email: 'a@x.y', role: 'AGENCY', permissions: [] };
    throw Object.assign(new Error('bad token'), { code: 'TOKEN_INVALID' });
  }),
}));

import { attachChatGateway } from '../chat.gateway';

const CONV = '11111111-1111-4111-8111-111111111111';

let server: http.Server;
let url: string;
let clients: Socket[] = [];
let chat: { sendMessage: ReturnType<typeof vi.fn>; markRead: ReturnType<typeof vi.fn>; getCounterpartId: ReturnType<typeof vi.fn>; setPublisher: ReturnType<typeof vi.fn> };
let publisher: (userId: string, event: unknown) => void;

const client = (token?: string) => {
  const socket = connect(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
  clients.push(socket);
  return socket;
};
const connected = (socket: Socket) => new Promise<void>((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); });
const emitAck = (socket: Socket, event: string, payload: unknown) => new Promise<any>((resolve) => socket.emit(event, payload, resolve)); // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(async () => {
  chat = {
    sendMessage: vi.fn(async (userId: string, _c: string, text: string) => ({ id: 'm1', text, senderId: userId })),
    markRead: vi.fn(async () => ({ unreadCount: 0 })),
    getCounterpartId: vi.fn(async () => 'g1'),
    setPublisher: vi.fn((fn) => { publisher = fn; }),
  };
  server = http.createServer();
  attachChatGateway(server, { chat: chat as never, notifications: { setPublisher: vi.fn() } as never });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  clients.forEach((socket) => socket.close());
  clients = [];
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('chat gateway', () => {
  it('rejects connections without a valid token', async () => {
    await expect(connected(client())).rejects.toThrow();
    await expect(connected(client('nonsense'))).rejects.toThrow();
  });

  it('delegates chat:send to the service with the AUTHENTICATED user, never an id from the payload', async () => {
    const socket = client('traveler-token');
    await connected(socket);
    const ack = await emitAck(socket, 'chat:send', { conversationId: CONV, text: 'hello' });
    expect(ack).toMatchObject({ ok: true, data: { text: 'hello', senderId: 't1' } });
    expect(chat.sendMessage).toHaveBeenCalledWith('t1', CONV, 'hello');
  });

  it('validates payloads and reports errors through the ack', async () => {
    const socket = client('traveler-token');
    await connected(socket);
    expect(await emitAck(socket, 'chat:send', { conversationId: 'nope', text: 'x' })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await emitAck(socket, 'chat:send', { conversationId: CONV, text: 'x', senderId: 'g1' })).toMatchObject({ ok: false });
    chat.sendMessage.mockRejectedValueOnce(Object.assign(new Error('Conversation not found'), { name: 'AppError' }));
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('refuses users without the chat permission', async () => {
    const socket = client('agency-token');
    await connected(socket);
    expect(await emitAck(socket, 'chat:send', { conversationId: CONV, text: 'hi' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it('pushes published messages to every socket of the target user only', async () => {
    const guide1 = client('guide-token');
    const guide2 = client('guide-token');
    const traveler = client('traveler-token');
    await Promise.all([connected(guide1), connected(guide2), connected(traveler)]);

    const received = (socket: Socket) => new Promise<any>((resolve) => socket.once('chat:message', resolve)); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [a, b] = [received(guide1), received(guide2)];
    const travelerGotIt = vi.fn();
    traveler.on('chat:message', travelerGotIt);

    publisher('g1', { conversationId: CONV, message: { id: 'm1', text: 'hi' } });
    expect(await a).toMatchObject({ conversationId: CONV });
    expect(await b).toMatchObject({ conversationId: CONV });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(travelerGotIt).not.toHaveBeenCalled();
  });

  it('forwards typing indicators to the counterpart', async () => {
    const guide = client('guide-token');
    const traveler = client('traveler-token');
    await Promise.all([connected(guide), connected(traveler)]);
    const typing = new Promise<any>((resolve) => guide.once('chat:typing', resolve)); // eslint-disable-line @typescript-eslint/no-explicit-any
    await emitAck(traveler, 'chat:typing', { conversationId: CONV });
    expect(await typing).toEqual({ conversationId: CONV, userId: 't1' });
  });

  it('rate limits a flooding socket', async () => {
    const socket = client('traveler-token');
    await connected(socket);
    const results = [];
    for (let i = 0; i < 25; i += 1) results.push(await emitAck(socket, 'chat:read', { conversationId: CONV }));
    expect(results.filter((r) => r.ok)).toHaveLength(20);
    expect(results.at(-1)).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
  });
});
