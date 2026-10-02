# support

Help desk: a traveler sends a **support ticket** (a question or problem with an account, a booking, a payment…), and
moderators answer it. Different from `reports`, which are complaints about a tour/agency/guide/review (DECISIONS D-12).

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Send ticket | Traveler | `POST /support/tickets`, `GET /support/tickets/me`, `GET /support/tickets/:id`, `POST /support/tickets/:id/messages`, `POST /support/tickets/:id/close` |
| Handle complaints | Moderator | no route here — `moderation` calls `supportService.listForModeration / getForModeration / replyAsStaff / setStatus` |

## Files
| File | Role |
|---|---|
| `support.service.ts` | Ticket lifecycle rules, owner/staff replies, notifications |
| `support.model.ts` / `.repository.ts` | `SupportTicket` (messages embedded, capped), atomic append |
| `support.types.ts` / `.mapper.ts` | statuses, categories, `TICKET_TRANSITIONS`, DTOs per viewer |
| `support.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer (`supportRouter`) |
| `index.ts` | Public API |

## API (base `/api/v1/support/tickets`, permission `support:create`)
* `POST /` `{ subject 5..200, category BOOKING|PAYMENT|ACCOUNT|TOUR|OTHER, message 10..4000, bookingId? }` → 201 `TicketDto` (10 per hour per IP).
* `GET /me?status&page&limit` → summaries (no messages); `GET /:id` → full conversation (`author`: `YOU` / `SUPPORT`).
* `POST /:id/messages` `{ text }` → adds my message (30/min per IP); `POST /:id/close` → closes (final).
* Errors: 404 for other people's tickets / foreign booking, 409 `TICKET_CLOSED`, `TICKET_FULL` (200 messages), `INVALID_STATE_TRANSITION`, `CONCURRENT_UPDATE`.

## Business rules
1. Tickets are private to their owner; staff see them through `moderation` only. Owners never see which moderator answered.
2. `bookingId`, if given, must be the user's own booking.
3. A moderator reply moves OPEN → IN_PROGRESS (or → RESOLVED when `resolve` is set); the first answering moderator becomes `assignedTo`. The user gets an in-app notification and an email (`SUPPORT_REPLIED`).
4. If the user writes on a RESOLVED ticket it is reopened (IN_PROGRESS); a CLOSED ticket accepts nothing.
5. Appending a message is one atomic update guarded by the expected status and the 200-message cap.
6. `setStatus` (moderator) only follows the state machine.

## State machine (`TICKET_TRANSITIONS`)
`OPEN → IN_PROGRESS | RESOLVED | CLOSED`; `IN_PROGRESS → RESOLVED | CLOSED`; `RESOLVED → IN_PROGRESS | CLOSED`; `CLOSED` final.

## Data model
`SupportTicket { userId, subject, category, bookingId?, status, assignedTo?, messages[{authorId,authorKind,text,createdAt}], messageCount, lastMessageAt, closedAt? }`.
Indexes: `(userId, lastMessageAt)`, `(status, createdAt)`, `(createdAt)` (queue without a status filter) and `(category, status, createdAt)` for the moderator queue. List queries exclude `messages`.

## Permissions
`support:create` (TRAVELER). `complaint:handle` is checked on the moderation routes.

## Dependencies
* Uses: `bookings` (`getFacts`), `notifications`.
* Used by: `moderation`, `dashboards`.

## Events / side effects
Notification + email `SUPPORT_REPLIED`.

## Testing
`__tests__/support.integration.test.ts` – real PostgreSQL: ownership 404s, first answering moderator becomes assignee, 6 parallel messages all kept with a consistent counter, RESOLVED reopens on user message, CLOSED is final and closes once.
`__tests__/support.service.test.ts` – creation, ownership, viewer-specific authorship, reopen/close rules, cap, staff replies/assignment, state machine.

## Not implemented / follow-ups
* Agencies and guides opening tickets (the diagram only has the Traveler).
* SLA timers / auto-close of stale RESOLVED tickets, attachments, notifying moderators of new tickets (they use the queue).
