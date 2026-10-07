# carts

The traveler's cart: a shortlist of tour departures they intend to book. It sits between "view tour details" and
"Book tour" in the traveler flow: the traveler adds a tour + departure + head-count, reviews the shortlist (with live
availability and money computed by the backend), then continues to booking. This module was a README-only placeholder
(decision D-56); the owner approved the feature and D-81 records the rules below.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Add tour to cart (supporting "Book tour") | Traveler | `POST /cart/items` |
| (supporting) view my cart with live totals | Traveler | `GET /cart` |
| (supporting) change the head-count of a line | Traveler | `PATCH /cart/items/:id` |
| (supporting) remove a line | Traveler | `DELETE /cart/items/:id` |

"Continue to booking" is not a cart endpoint: the traveler goes to `POST /bookings` (module `bookings`), which
re-prices and reserves seats server-side. The cart holds no seat and no price.

## Files
| File | Role |
|---|---|
| `carts.types.ts` | `CartItemDto` / `CartDto` / totals, inputs, `CART_LIMITS.MAX_ITEMS`, unavailability reasons |
| `carts.repository.ts` | `CartItem` access: `upsert`, `findById`, `exists`, `count`, `updateParticipants`, `remove`, `listByUser` |
| `carts.service.ts` | rules (public tour + bookable departure, head-count limits, size limit, ownership) and the read model |
| `carts.mapper.ts` | row + live tour card + departure facts -> `CartItemDto`; totals over the bookable lines |
| `carts.validation.ts` | zod body/params schemas (head-count bounded by the booking ceiling) |
| `carts.controller.ts` / `carts.routes.ts` | HTTP layer, permission `cart:manage` on every route |
| `index.ts` | Public API |

## API (base `/api/v1`, permission `cart:manage` on all routes)
* `GET /cart` → `{ items: CartItemDto[], totals }`. Newest first, no pagination (bounded by `CART_LIMITS.MAX_ITEMS`).
  Each item carries the live `tour` card (same shape as `GET /tours` items), its `departure` facts, `available` and —
  when bookable — `unitPrice`/`subtotal`. `totals` = counts + `subtotal` (whole VND) over the bookable lines.
* `POST /cart/items` body `{ tourId, departureId, participants }` → `201` with the new line, `200` when that departure
  was already in the cart (its head-count is replaced). `404` unknown/unpublished tour or departure; `409`
  `DEPARTURE_UNAVAILABLE`, `409` `NOT_ENOUGH_SEATS`, `409` `CART_FULL`.
* `PATCH /cart/items/:id` body `{ participants }` → `200` with the updated line. `404` if the line is not the caller's;
  `409` `DEPARTURE_UNAVAILABLE` / `NOT_ENOUGH_SEATS` when live availability no longer allows the change.
* `DELETE /cart/items/:id` → `204` whether or not the line existed (idempotent; a foreign id is a silent no-op).

## Business rules
1. The owner is always the authenticated user; no user id is accepted from the client, so another traveler's cart can
   never be read or changed. A line that is not the caller's answers `404` (update) / silent `204` (delete).
2. Only an APPROVED (public) tour with a bookable departure can be added: open, in the future and with seats left
   (`tours.getBookableDeparture`).
3. `participants` is 1..`BOOKING_POLICY.MAX_PARTICIPANTS` (50) and may not exceed the departure's remaining seats.
4. At most `CART_LIMITS.MAX_ITEMS` (20) distinct departures per traveler. The cap is a count check, so several
   simultaneous adds of *different* departures can briefly exceed it (the same accepted trade-off as the wishlist
   limit); adding a departure already in the cart replaces its head-count and never counts against the limit again.
5. Adding the same departure twice is safe under double-clicks: unique `(userId, departureId)` + upsert.
6. The cart stores NO price and NO promotion. `unitPrice`/`subtotal`/`totals.subtotal` are computed from live tour data
   on every read; the discount is applied by `bookings` at checkout (D-16).
7. A line whose tour stops being public, whose departure closes/passes/sells out, or whose head-count no longer fits
   the remaining seats stays in the cart flagged `available:false` with an `unavailableReason`
   (`TOUR_UNAVAILABLE` | `DEPARTURE_UNAVAILABLE` | `NOT_ENOUGH_SEATS`) and contributes nothing to the totals. The
   traveler can still remove it; reducing its head-count only works while the departure is still bookable.

## State machine
None (a cart line has no status; availability is derived, never stored).

## Data model
`CartItem { id, userId, tourId, departureId, participants, createdAt, updatedAt }`.
Indexes: unique `(userId, departureId)` (idempotent add / upsert target) and `(userId, createdAt desc, id desc)`
(the cart list sorts newest-first, so the index ends with `id`).

## Permissions
`cart:manage` (TRAVELER only). Ownership is enforced in the service by scoping every query with the token's `userId`.

## Dependencies
* Uses: `tours` (`getBookableDeparture`, `getDepartureFacts`, `getPublicCards`), `bookings` (`BOOKING_POLICY.MAX_PARTICIPANTS`).
* Used by: none. `bookings` does not import `carts` — the handoff is the client calling `POST /bookings`.

## Events / side effects
None (no notification, no audit entry, no realtime event: a cart is private scratch space).

## Testing
`__tests__/carts.service.test.ts` – fake repositories: public-tour/bookable-departure rules, head-count and size
limits, merge-on-duplicate, ownership 404, unavailable reasons and totals.
`__tests__/carts.integration.test.ts` – real PostgreSQL over HTTP: parallel add yields one row, privacy between
travelers, update/remove scoping, live availability changes reflected on read, totals, permission checks.

## Not implemented / follow-ups
* No multi-item checkout: each line hands off to `POST /bookings` separately (a booking owns its own payment window and
  state machine, so "checkout all" would create several bookings at once — not in the diagram).
* The booking step accepts a `promotionCode` and the discount/total come back in the booking response; there is no live
  preview inside the cart or the booking step yet (`GET /promotions/preview` exists and could power one).
* The cart size cap is a count check, not a database constraint (see rule 4); parallel adds of different departures may
  briefly exceed `CART_LIMITS.MAX_ITEMS`.
