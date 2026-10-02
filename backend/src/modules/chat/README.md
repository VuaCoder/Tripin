# chat

One-to-one conversations between a **Traveler** and a **Tour guide**, over REST (history, sending, inbox) and Socket.IO
(live delivery). AI chat is a different module (`ai`).

## Use cases covered
| Use case (diagram) | Actor | Endpoint / event |
|---|---|---|
| Make a conservation | Traveler, Tour guide | `POST /chat/conversations`, `GET /chat/conversations`, `GET/POST /chat/conversations/:id/messages`, `POST /chat/conversations/:id/read`; Socket.IO `chat:send / chat:read / chat:typing` |

## Files
| File | Role |
|---|---|
| `chat.service.ts` | **All** rules: who may talk, participation checks, persistence, unread counters, notification, publishing |
| `chat.policy.ts` | `canConverse()` / `assignSides()` – the single place defining allowed pairs |
| `chat.gateway.ts` | Thin Socket.IO adapter: handshake auth, payload validation, rate limit, ack |
| `chat.model.ts` / `.repository.ts` | `Conversation` + `Message` schemas and queries |
| `chat.mapper.ts` / `.types.ts` | DTOs (`isMine`, unread count) and limits |
| `chat.validation.ts` / `.controller.ts` / `.routes.ts` | REST layer (`chatRouter`) |
| `index.ts` | Public API (`attachChatGateway` is called by `server.ts`) |

## REST API (base `/api/v1`, permission `chat:use`)
* `POST /chat/conversations` `{ participantId, tourId? }` → `ConversationDto` (finds or creates the single conversation of the pair). The counterpart must be an ACTIVE user of the opposite role.
* `GET /chat/conversations?page&limit` → inbox, most recent first: `{ id, counterpart{id,fullName,avatarUrl,role}, tourId?, lastMessage?, unreadCount, updatedAt }`.
* `GET /chat/conversations/:id/messages?limit&before` → `{ items (newest first), hasMore }`; pass the last item id as `before`.
* `POST /chat/conversations/:id/messages` `{ text 1..2000 }` → 201 `MessageDto` (60/min/IP limiter).
* `POST /chat/conversations/:id/read` → `{ unreadCount: 0 }`.
Unknown conversations **and** conversations of other people answer 404.

## Socket.IO (same port, path `/socket.io`)
* Connect with `io(API_URL, { auth: { token: <access token> } })`; invalid/expired token → `connect_error`.
* Client → server (each accepts an ack callback returning `{ ok:true, data }` or `{ ok:false, error:{code,message} }`): `chat:send {conversationId,text}`, `chat:read {conversationId}`, `chat:typing {conversationId}`.
* Server → client: `chat:message { conversationId, message }` (to **both** participants' sockets, all devices), `chat:typing { conversationId, userId }`, `notification:new <NotificationDto>` (from `notifications`).
* Payloads are validated with zod; at most 20 events / 10 s per socket (`RATE_LIMITED`); users without `chat:use` get `FORBIDDEN`. The sender id is always the authenticated user.

## Business rules
1. Only TRAVELER ↔ TOUR_GUIDE (D-13); changing that means editing `chat.policy.ts` only. Agencies and staff are refused (403).
2. One conversation per traveler/guide pair (unique index), optionally remembering the tour it started from.
3. Messages are stored in PostgreSQL (plain text, trimmed, ≤ 2000); clients must render them as text, not HTML.
4. Sending bumps the recipient's unread counter atomically; an in-app notification (`CHAT_MESSAGE`) is created only when the recipient had nothing unread, to avoid notification floods.
5. A failing realtime publisher never fails the send (the message is already stored).
6. Banned/inactive accounts cannot authenticate over HTTP or the socket handshake (same `resolveUserActor`).

## State machine
None.

## Data model
`Conversation { travelerId, guideId, tourId?, lastMessage{text,senderId,sentAt}, unreadTraveler, unreadGuide, lastActivityAt }` with unique `(travelerId, guideId)` and inbox indexes `(travelerId|guideId, lastActivityAt desc)`;
`Message { conversationId, senderId, text, readAt?, createdAt }` with index `(conversationId, _id desc)` for cursor pagination.

## Permissions
`chat:use` (TRAVELER, TOUR_GUIDE). Participation is verified per conversation in the service.

## Dependencies
* Uses: `users` (`assertActiveWithRole`, `getSummaries`), `notifications` (`notify`, `setPublisher`), `middlewares/authenticate` (`resolveUserActor`).
* Used by: `server.ts` (attaches the gateway).

## Events / side effects
Socket events above; notification `CHAT_MESSAGE`.

## Testing
`__tests__/chat.realtime.integration.test.ts` (the whole stack: HTTP + Socket.IO + real services + PostgreSQL + real tokens: fan-out to counterpart and the sender's other devices only, foreign conversations leak nothing, typing/read, live notifications reach only their owner, handshake refuses missing/garbage/banned, a ban or demotion or expired token stops an ALREADY OPEN socket on its next event and closes it, per-socket flood limit) and
`__tests__/chat.integration.test.ts` (real PostgreSQL, REST: one conversation when both sides start at once, participants only, newest-first cursor pagination, unread counters with 10 parallel sends, banned users cut off) and
`__tests__/chat.service.test.ts` (policy, idempotent start, participation, unread/notification logic, publisher isolation) and
`__tests__/chat.gateway.test.ts` (real Socket.IO server + client: auth, delegation with the authenticated user, validation, permission, fan-out to the right user, typing, rate limit).

## Not implemented / follow-ups
* Attachments, message edit/delete, delivery receipts per device, presence.
* Horizontal scaling needs the Socket.IO Redis adapter (rooms are per node today).
* Conversations are not closed when a guide is banned (the other side simply cannot message a non-ACTIVE account in new conversations).
