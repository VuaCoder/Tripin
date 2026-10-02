import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { PERMISSIONS } from '@travel-platform/constants';
import { env } from '../../config/env';
import { resolveUserActor } from '../../middlewares/authenticate';
import type { UserActor } from '../../types/actor';
import { AppError } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import { notificationsService, type NotificationsService } from '../notifications';
import { chatService, type ChatService } from './chat.service';
import { socketConversationPayload, socketSendPayload } from './chat.validation';

type Ack = (response: { ok: true; data?: unknown } | { ok: false; error: { code: string; message: string } }) => void;

/** Max messages per socket in a sliding window; the REST endpoint has its own limiter. */
const RATE = { windowMs: 10_000, max: 20 } as const;

export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Thin Socket.IO adapter (AI rules §16): authenticate the handshake, validate payloads, call `ChatService`, answer with
 * an ack. NO business rule lives here. Rooms are per user (`user:<id>`), so a message reaches every device of both
 * participants without clients having to join conversation rooms.
 *
 * Client -> server events (all take an optional ack callback):
 *   chat:send   { conversationId, text }  -> ack { ok, data: MessageDto }
 *   chat:read   { conversationId }        -> ack { ok, data: { unreadCount } }
 *   chat:typing { conversationId }        -> forwarded to the counterpart as `chat:typing`
 * Server -> client events: `chat:message` { conversationId, message }, `notification:new` NotificationDto.
 * Authentication: `io(url, { auth: { token: <access token> } })`.
 */
export function attachChatGateway(
  httpServer: HttpServer,
  deps: { chat?: ChatService; notifications?: NotificationsService } = {},
): Server {
  const chat = deps.chat ?? chatService;
  const notifications = deps.notifications ?? notificationsService;

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: env.CLIENT_URL.split(',').map((origin) => origin.trim()), credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
      if (!token) throw AppError.unauthenticated('Missing access token');
      const actor = await resolveUserActor(token);
      socket.data.actor = actor;
      next();
    } catch (error) {
      next(new Error(error instanceof AppError ? error.code : 'UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    const connected = socket.data.actor as UserActor;
    const token = socket.handshake.auth.token as string;
    void socket.join(userRoom(connected.userId));
    const bucket: number[] = [];

    /**
     * Every event re-reads the account (like every HTTP request does), so a ban, a demotion or an expired access token
     * stops an already open socket at its next event. A dead session also closes the socket.
     */
    const handle = <T>(event: string, run: (payload: unknown, actor: UserActor) => Promise<T>) => {
      socket.on(event, async (payload: unknown, ack?: Ack) => {
        try {
          let actor: UserActor;
          try {
            actor = await resolveUserActor(token);
          } catch (error) {
            ack?.({ ok: false, error: toSocketError(error) });
            socket.disconnect(true);
            return;
          }
          if (!actor.permissions.includes(PERMISSIONS.CHAT_USE)) throw AppError.forbidden();
          const now = Date.now();
          while (bucket.length > 0 && bucket[0]! < now - RATE.windowMs) bucket.shift();
          if (bucket.length >= RATE.max) throw AppError.tooManyRequests();
          bucket.push(now);
          const data = await run(payload, actor);
          ack?.({ ok: true, data });
        } catch (error) {
          ack?.({ ok: false, error: toSocketError(error) });
        }
      });
    };

    handle('chat:send', async (payload, actor) => {
      const input = parse(socketSendPayload, payload);
      return chat.sendMessage(actor.userId, input.conversationId, input.text);
    });
    handle('chat:read', async (payload, actor) => {
      const input = parse(socketConversationPayload, payload);
      return chat.markRead(actor.userId, input.conversationId);
    });
    handle('chat:typing', async (payload, actor) => {
      const input = parse(socketConversationPayload, payload);
      const counterpartId = await chat.getCounterpartId(actor.userId, input.conversationId);
      io.to(userRoom(counterpartId)).emit('chat:typing', { conversationId: input.conversationId, userId: actor.userId });
      return undefined;
    });

    socket.on('error', (error: Error) => logger.warn('Socket error', { message: error.message }));
  });

  chat.setPublisher((userId, event) => {
    io.to(userRoom(userId)).emit('chat:message', event);
  });
  notifications.setPublisher((userId, notification) => {
    io.to(userRoom(userId)).emit('notification:new', notification);
  });

  return io;
}

function parse<S extends { safeParse: (value: unknown) => { success: true; data: unknown } | { success: false; error: { issues: unknown[] } } }>(
  schema: S,
  payload: unknown,
): NonNullable<ReturnType<S['safeParse']> extends infer R ? (R extends { success: true; data: infer D } ? D : never) : never> {
  const result = schema.safeParse(payload);
  if (!result.success) throw AppError.badRequest('Invalid payload', result.error.issues);
  return result.data as never;
}

function toSocketError(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  logger.error('Unhandled socket handler error', { message: (error as Error)?.message });
  return { code: 'INTERNAL_ERROR', message: 'Internal server error' };
}

export type { Socket };
