# notifications

In-app notifications (with an optional email copy) for every actor, plus the `notify()` API other modules call when
something relevant to a user happens.

H2.7: organization events must use `notifyAgency(agencyId, input, {email?})`,
or `writeAgencyNotification(tx, agencyId, input)` inside an existing business
transaction. These fan out only to ACTIVE members with the matching permission
and ACTIVE accounts; no legacy owner fallback. New rows carry `agencyId` with
an AgencyProfile FK. Inbox/list/count/read/bulk-read/delete recheck membership
and role permissions. The DTO adds optional `agencyId` for multi-agency clients.
Personal `notify(userId, ...)` and historical rows with null agencyId stay personal;
no historical rows are reclassified or removed.

Agency emails are durable outbox entries, delivered by `mail.deliverOutbox`.
Delivery and socket publication recheck access under the same agency row lock
as team mutations. An already-started email can finish before suspension commits;
delivery cannot start after committed suspension/removal. Revoked pending emails
remain unsent and retained, not deleted. Email retries retain existing at-least-once
semantics; a provider send followed by a failed DB commit can be retried. Keep
the outbox worker enabled; there is no direct-email fallback for organization events.

System notification templates are localized to Vietnamese by `notifications.locale.ts` before storage, realtime publication and optional email delivery. The DTO mapper also localizes matching legacy English templates when reading existing inbox rows, so no data rewrite is required. Dynamic tour names, booking codes, chat previews and user-written notes remain unchanged. Add a template and regression coverage here when introducing a system notification.

## Use cases covered
| Use case | Actor | Endpoint |
|---|---|---|
| (supporting) read my notifications | any logged-in user | `GET /notifications`, `GET /notifications/unread-count` |
| (supporting) mark as read | any logged-in user | `PATCH /notifications/:id/read`, `POST /notifications/read-all` |
| Receive E-ticket (delivery side) | Traveler | `notify(ETICKET_ISSUED)` called by `e-tickets` (B10) |
| (internal) notify a user | other modules | `notificationsService.notify(userId, input, { email? })` |

## Files
| File | Role |
|---|---|
| `notifications.types.ts` | `NOTIFICATION_TYPE` catalogue, inputs, DTO, `NotificationPublisher` |
| `notifications.model.ts` / `.repository.ts` | `Notification` schema; owner-scoped queries |
| `notifications.service.ts` | `notify` / `notifyMany` (never throw), inbox operations, optional email + realtime publish |
| `notifications.validation.ts` / `.controller.ts` / `.routes.ts` / `.mapper.ts` | HTTP layer + DTO |
| `index.ts` | Public API |

## API (base `/api/v1`, any authenticated user)
* `GET /notifications?page&limit&unreadOnly` → paginated `{ id, type, title, body, data?, isRead, readAt?, createdAt }`, newest first.
* `GET /notifications/unread-count` → `{ unread }`.
* `PATCH /notifications/:id/read` → the notification (idempotent). 404 if it is not yours.
* `POST /notifications/read-all` → `{ updated }`.
* `DELETE /notifications/:id` → `{ deleted: true }`. Deletes only the authenticated user's notification; 404 for missing/foreign ids. This action cannot be undone.
There is no create endpoint: notifications are produced only by server-side events.

## Business rules
1. A user can only see and change their own notifications; a foreign id answers 404.
2. `notify()` and `notifyMany()` never throw – a notification failure is logged, not propagated, so it cannot break the business action.
3. Email is opt-in per call (`{ email: true }`), sent to the account's registered address only while the account is ACTIVE.
4. `data` carries small id references (e.g. `{ tourId }`) for deep links – no personal data.
5. Notifications are deleted after 180 days by the `notifications.purgeOld` job (PostgreSQL has no TTL index).
6. The realtime layer registers `setPublisher(fn)` (chat module, B14) to push each new notification over Socket.IO; publisher errors are ignored.

## State machine
`unread → read` only (`readAt`).

## Data model
`Notification { userId, type, title, body, data (JSON string map), readAt?, createdAt }`. Indexes: `(userId, createdAt desc, id desc)` list,
`(userId, readAt, createdAt)` unread filter/counter, `(createdAt)` for the retention job.

## Permissions
`requireAuth` only; ownership by `userId` in every query.

## Dependencies
* Uses: `users` (`getContact`), `integrations/mail`.
* Used by: `tours` (approve/reject/suspend, guide assignment), `bookings`, `payments`, `e-tickets`, `reviews`, `reports`, `support`, `chat`, `moderation`, `subscriptions`, `earnings`.
* `users` must NOT import this module (circular dependency); moderation notifies after calling `usersService` for bans/agency verification.

## Events / side effects
Emails through `MailProvider` (console in dev), optional Socket.IO push.

## Testing
`__tests__/notifications.service.test.ts` – never-throw guarantee, email opt-in, publisher isolation, ownership, idempotent read.

## Not implemented / follow-ups
* User notification preferences (mute types / email opt-out) – not in the diagram.
* Push notifications to mobile devices.
