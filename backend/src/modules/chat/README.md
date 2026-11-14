# chat

One-to-one conversations between a **Traveler** and a **Tour guide**, or a traveler and an **Agency's shared inbox**, over REST
(history, sending, inbox) and Socket.IO (live delivery). AI chat is a different module (`ai`).

## Use cases covered
| Use case (diagram) | Actor | Endpoint / event |
|---|---|---|
| Make a conservation | Traveler, Tour guide, Agency | `POST /chat/conversations`, `GET /chat/conversations`, `GET/POST /chat/conversations/:id/messages`, `POST /chat/conversations/:id/read`; Socket.IO `chat:send / chat:read / chat:typing` |
| Agency inbox | Traveler, agency member with `chat:use` | `POST/GET /agency/chat/conversations`, `GET/POST /agency/chat/conversations/:id/messages`, `POST /agency/chat/conversations/:id/read` |

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
* `POST /chat/conversations` `{ participantId | agencyId, tourId? }` → `ConversationDto` (finds or creates the single thread). A traveler passes `agencyId` (an AgencyProfile id) to open the agency inbox; `participantId` is a guide/agency user.
* `POST /agency/chat/conversations` `{ participantId, tourId? }` → the agency member opens the shared thread with that traveler. The tenant comes from `X-Agency-Id`.
* `GET /chat/conversations/:id` → `ConversationDto`, participant-only; unknown and foreign conversations both return 404.
* `GET /chat/conversations?page&limit` → inbox, most recent first: `{ id, counterpart{id,fullName,avatarUrl,role}, tourId?, lastMessage?, unreadCount, updatedAt }`.
* `GET /chat/conversations/:id/messages?limit&before` → `{ items (newest first), hasMore }`; pass the last item id as `before`.
* `POST /chat/conversations/:id/messages` `{ text 1..2000 }` → 201 `MessageDto` (60/min/IP limiter).
* `POST /chat/conversations/:id/read` → `{ unreadCount: 0 }`.
* `/agency/chat/*` mirrors every route above and additionally requires an active membership with `chat:use`; a traveler/guide thread is not visible there and an agency thread is not visible to another agency.
Unknown conversations **and** conversations of other people answer 404.

## Socket.IO (same port, path `/socket.io`)
* Connect with `io(API_URL, { auth: { token: <access token> } })`; invalid/expired token → `connect_error`.
* Client → server (each accepts an ack callback returning `{ ok:true, data }` or `{ ok:false, error:{code,message} }`): `chat:send {conversationId,text}`, `chat:read {conversationId}`, `chat:typing {conversationId}`.
* Server → client: `chat:message { conversationId, message }` (to **both** participants' sockets, all devices), `chat:typing { conversationId, userId }`, `notification:new <NotificationDto>` (from `notifications`).
* Recipient clients can acknowledge `chat:message` with `true`. The gateway then emits `chat:delivered { conversationId, messageId }` to the sender's sockets. This is a transient delivery receipt, not a persisted read receipt; older clients can omit the acknowledgment.
* Payloads are validated with zod; at most 20 events / 10 s per socket (`RATE_LIMITED`); users without `chat:use` get `FORBIDDEN`. The sender id is always the authenticated user.

## Business rules
1. Only TRAVELER ↔ TOUR_GUIDE, TRAVELER ↔ AGENCY, and SUPER_ADMIN ↔ AGENCY (D-13, D-85); changing that means editing `chat.policy.ts` only. Staff of an agency chat as the agency, not as a separate person.
2. One thread per traveler+guide and one per traveler+agency (partial unique indexes); optionally remembering the tour it started from.
3. Messages are stored in PostgreSQL (plain text, trimmed, ≤ 2000); clients must render them as text, not HTML.
4. Sending bumps the recipient's unread counter atomically; an in-app notification (`CHAT_MESSAGE`) is created only when the recipient had nothing unread, to avoid notification floods.
5. An agency thread has **one shared unread counter**: any member reading it clears it for the whole agency, and a colleague's reply is not "unread" for the agency.
6. A failing realtime publisher never fails the send (the message is already stored).
7. Banned/inactive accounts cannot authenticate over HTTP or the socket handshake (same `resolveUserActor`).

## State machine
None.

## Data model
`Conversation { travelerId, guideId?, agencyId?, tourId?, lastMessage{text,senderId,sentAt}, unreadTraveler, unreadGuide, lastActivityAt }`:
a guide thread has `guideId` set and `agencyId` null; an agency thread has `agencyId` set and `guideId` null. Partial unique indexes
`(travelerId, guideId) WHERE agencyId IS NULL` and `(travelerId, agencyId) WHERE agencyId IS NOT NULL`; inbox indexes
`(travelerId|guideId|agencyId, lastActivityAt desc)`.
`Message { conversationId, senderId, text, readAt?, createdAt }` with index `(conversationId, _id desc)` for cursor pagination.

## Permissions
`chat:use` (TRAVELER, TOUR_GUIDE, AGENCY; within an agency: OWNER, MANAGER, STAFF — ACCOUNTANT has no customer chat). Participation is verified per conversation in the service.

## Dependencies
* Uses: `users` (`assertActiveWithRole`, `getSummaries`), `agencies` (`effectiveAgencyPermissions` for recipient lookup), `notifications` (`notify`, `notifyAgency`, `setPublisher`), `middlewares/authenticate` (`resolveUserActor`).
* Used by: `server.ts` (attaches the gateway), `custom-tours` (opens the traveler↔agency thread), `routes/index.ts` (mounts `/chat` and `/agency/chat`).

## Events / side effects
Socket events above; notification `CHAT_MESSAGE` (personal for a guide thread, agency-scoped for an agency thread).

## Testing
`__tests__/chat.realtime.integration.test.ts` (the whole stack: HTTP + Socket.IO + real services + PostgreSQL + real tokens: fan-out to counterpart and the sender's other devices only, foreign conversations leak nothing, typing/read, live notifications reach only their owner, handshake refuses missing/garbage/banned, a ban or demotion or expired token stops an ALREADY OPEN socket on its next event and closes it, per-socket flood limit) and
`__tests__/chat.integration.test.ts` (real PostgreSQL, REST: one conversation when both sides start at once, participants only, newest-first cursor pagination, unread counters with 10 parallel sends, banned users cut off, the agency thread shared by owner/manager and hidden from another agency) and
`__tests__/chat.service.test.ts` (policy, idempotent start, agency thread creation, participation, shared agency unread, notification logic, publisher isolation) and
`__tests__/chat.gateway.test.ts` (real Socket.IO server + client: auth, delegation with the authenticated user, validation, permission, fan-out to the right user, typing, rate limit).

## Not implemented / follow-ups
* Per-member read state for an agency thread: the current counter is per agency, so one member reading clears everyone's badge.
* Colleague sender names in the thread: a reply from another member renders as an incoming bubble (`isMine: false`) without a name.
* Attachments, message edit/delete, delivery receipts per device, presence.
* Horizontal scaling needs the Socket.IO Redis adapter (rooms are per node today).
* Conversations are not closed when a guide or agency is banned (the other side simply cannot message a non-ACTIVE account in new conversations).
