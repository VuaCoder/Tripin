# custom-tours

Group-booking requests, negotiated in chat. Approved by the owner 2026-11-12 (DECISIONS D-85); build order in
`plan/docs/booking-doan-thi-cong.md` (S0–S12).

A traveler who wants a private departure of a public tour sends a request (`POST /custom-tours`). The agency accepts
or declines (S3); accepting clones exactly one `PRIVATE` tour and lets the agency edit an offer the traveler can
accept (S5). After that the traveler enters the members in a resumable form (S9) and turns it into a booking (S10);
lists, the chat card and an expired hold all lead back to the right step (S11).
Only then does the normal booking flow run: the request carries a frozen `offerSnapshot`, `POST /:id/bookings` hands it
to `bookings`, and the existing booking detail page opens PayOS — this module never holds seats, prices money or talks
to PayOS.

## Endpoints (S3–S10)

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/v1/custom-tours` | TRAVELER (`custom-tour:request`) |
| GET | `/api/v1/custom-tours` | TRAVELER / AGENCY (`custom-tour:view`) |
| GET | `/api/v1/custom-tours/:id` | owner traveler or owner agency (`custom-tour:view`) |
| PATCH | `/api/v1/custom-tours/:id/decision` | owner agency `{ decision: ACCEPT \| DECLINE }`, owner traveler `{ decision: CANCEL }` (`custom-tour:respond`) |
| PATCH | `/api/v1/custom-tours/:id/draft` | owner agency `{ revision, content?, guestCounts?, departure? }` (`custom-tour:respond`) |
| POST | `/api/v1/custom-tours/:id/offers` | owner agency `{ revision }` (`custom-tour:respond`) |
| POST | `/api/v1/custom-tours/:id/acceptance` | owner traveler `{ revision }` (`custom-tour:request`) |
| PATCH | `/api/v1/custom-tours/:id/checkout-draft` | owner traveler `{ checkoutRevision, contact, passengers, notes? }` (`custom-tour:request`) |
| POST | `/api/v1/custom-tours/:id/bookings` | owner traveler `{ clientRequestId? }` — `201` new booking, `200` the one that already exists (`custom-tour:request`) |

## Rules

- The source tour must be `APPROVED` + `PUBLIC` and its agency `ACTIVE` + `VERIFIED`; otherwise the answer is `404`
  (a traveler is never told why an agency cannot take requests).
- `clientRequestId` makes retries safe: the same payload returns the same request, a different payload is
  `409 IDEMPOTENCY_KEY_REUSED`.
- The create body is `{ sourceTourId, participants, guestCounts?, startDate?, notes?, clientRequestId? }`.
  `guestCounts` carries the tour page's own adult/child/infant split and must sum to `participants` with at least one
  adult, so the agency sees the composition the traveler entered — the group has no price until the agency offers one.
  `startDate` is the day the group wants to start: optional, must be in the future, and becomes the clone's single
  departure on `ACCEPT` while it is still ahead (otherwise the source's next open departure is used).
- A request creates (or reuses) the traveler↔agency conversation; if chat fails the request still exists.
- The agency is notified with `CUSTOM_TOUR_REQUESTED` carrying only `requestId` / `conversationId` — never notes or
  identity documents.
- Reads are scoped by the actor: a foreign id is `404`, not `403`, so ids are not revealed.
- `ACCEPT` is one transaction: `SUBMITTED → NEGOTIATING` (compare-and-set) plus the clone of the source tour
  (`status = DRAFT`, `visibility = PRIVATE`, `maxGroupSize` = participants, one future departure with
  `capacity = remaining = participants`, dated at the request's `startDate` when it is still ahead, else at the
  source's next open departure). Content is copied; rating, moderation fields and the guide assignment are not.
  `privateTourId` is unique and only set by that transaction, so a second accept (or a parallel one) gets `409` and
  never a second tour.
- A private clone is edited only from the request: every normal agency write (`PATCH`, delete, restore, availability,
  itinerary, guide, submit) answers `409 TOUR_PRIVATE_MANAGED_BY_CUSTOM_TOUR`. Reading it stays allowed.
- `DECLINE` / `CANCEL` never clone; `CUSTOM_TOUR_DECIDED` tells the other side (no notes or documents in the payload).
- **Draft edits** are one transaction over the request, the private tour content and its only departure. The body is
  strict and carries no workflow fields: only the visible content fields, `guestCounts` and `departure` are accepted
  (`visibility`, `status`, `agencyId` and `maxGroupSize` are rejected; the head count never changes). `guestCounts` must
  sum to `participants` with at least one adult; a departure date must be in the future and a provided capacity must
  equal `participants`. The transaction compare-and-swaps `revision` (the one the agency saw), increments it and, from
  `OFFERED`, returns the request to `NEGOTIATING` and clears `offerSnapshot` so the old offer cannot be accepted.
- **Offers** are server-priced: the body is `{ revision }` only, and `unitPrice` / `subtotal` in the body are `400`.
  An offer requires title, destination, duration, `basePrice > 0`, exactly one future departure, saved `guestCounts`
  matching `participants` and age pricing able to price every child/infant (`priceGuests` → `400`). The snapshot is
  `{ revision, unitPrice: basePrice, agePricing, guestCounts, subtotal, departureDate, sentAt }`; the CAS
  `NEGOTIATING → OFFERED` also matches the revision, so a parallel draft wins with `409 CONCURRENT_UPDATE`.
- **Acceptance** is traveler-only, `OFFERED` only, and the body revision must equal both the row revision and the
  snapshot revision (otherwise `409 CONCURRENT_UPDATE`). One transaction sets `ACCEPTED` + `acceptedAt` and flips the
  private tour `DRAFT → APPROVED` while keeping `PRIVATE`; then the discovery cache is cleared and
  `CUSTOM_TOUR_ACCEPTED` notifies the agency (ids only).
- **The checkout form** is the only write after `ACCEPTED`: `{ checkoutRevision, contact: { fullName, phone },
  passengers: [{ fullName, phone, idCard, guestType }], notes? }`. It must describe exactly the accepted group —
  `passengers.length === participants`, the `guestType` counts equal the snapshot's `guestCounts`, at least one adult —
  and each row needs a name, a phone and a unique 12-digit `idCard`. `checkoutRevision` is the form's own counter, not
  the negotiation `revision`: an outdated value is `409 CONCURRENT_UPDATE`, so two devices cannot silently overwrite
  each other's papers. Nothing is written to a notification or a log.
- After `ACCEPTED`, draft/offers/acceptance stay `409 INVALID_STATE_TRANSITION`; only the checkout draft and the booking
  are allowed, and the private tour keeps refusing normal agency writes.
- **The booking** is created only here: `POST /:id/bookings` is traveler-only, `ACCEPTED`-only, and refuses (`400`) until
  the saved form parses. `bookings` books the private tour's own departure, prices strictly from the snapshot
  (`unitPrice`, `agePricing`, `guestCounts` — no promotion/voucher), writes `customTourRequestId` and the
  `BookingPassenger` rows in the same insert, and the partial unique index allows one `PENDING`/`CONFIRMED` booking per
  request. A second call returns that booking (`200`) instead of booking twice; a cancelled or expired one no longer
  counts, so the request can be booked again from the unchanged snapshot. `GET /:id` and `GET /custom-tours` then carry
  `currentBooking` and `nextStep` becomes `PAY` (unpaid) or `DONE` (paid).
- REST stays the source of truth. After accepted decisions and every draft/offer/acceptance the API emits the existing
  `chat:updated` socket event to both `user:<id>` rooms (a silent no-op when no socket server is attached), so open
  clients refetch.

`offerSnapshot` and `checkoutDraft` are JSON on the row; `BookingPassenger` is where member names, phones and
12-digit CCCD live — never in `Booking.notes`.

## Chat panel (S8)

`CustomTourChatSection` pins the request under a conversation header: it reads `GET /custom-tours?conversationId=…`
(so several requests in one conversation are picked, never mixed) and opens the offer as a centred dialog over a dimmed
page (`showModal`, so focus is trapped and Esc closes it). The agency side is the only editor of the clone — it loads the clone through
`GET /agency/tours/:id` and saves with `/draft`, so no new endpoint is involved. `POST /offers` freezes the negotiated tour content (title, destination, duration, summary,
description, inclusions/exclusions and the policy texts) next to the price in `offerSnapshot`, and the traveler panel
renders exactly that snapshot — a `PRIVATE` tour still has no traveler read endpoint, so unsent agency edits stay
invisible and the itinerary travels in the chat messages. Both mutations invalidate the `CustomTour` RTK tag and the
`chat:updated` event does the same for the other side, so REST stays the source of truth.

## Passenger form (S9)

`GET /custom-tours/:id` returns `checkoutDraft` and `checkoutRevision` so the traveler can resume anywhere.
`/traveler/bookings/new?customTourRequestId=…` renders `GroupBookingEntry` instead of the regular wizard: the tour,
date, age mix and price come from the frozen offer (no voucher/promotion), the traveler only fills the people. The form
autosaves 800 ms after the last keystroke through a serialized queue, only when it is complete (the API stores the whole
roster or nothing), shows **Đang lưu / Đã lưu / Lưu lỗi + Thử lại**, guards `beforeunload` while dirty and adopts a newer
revision after a 409. A reload, a new sign-in or another device restores the last saved version; keystrokes that were
never saved are not promised.

## Booking (S10)

`GroupBookingEntry` ends with **Đặt chỗ và thanh toán**: it saves the form once more (so the booking uses exactly what
is on screen), then `POST /custom-tours/:id/bookings` and `router.replace('/settings/history/{id}')`. The booking detail
page is the unchanged one — it already starts PayOS and already handles cancel/complete — and now lists the
`BookingPassenger` rows for the owner (the agency detail page does too). A request that already has a booking sends the
form straight to `/settings/history/{id}`; the chat card's PAY/DONE link does the same through `customTourHref`.

## Resuming and expiry (S11)

Both list and detail responses carry `currentBooking`, so `/traveler/custom-tours`, `/agency/custom-tours`, the pinned
chat card and the passenger page all derive the same `nextStep`: an accepted request with a live booking links to
`/settings/history/:id` ("Xem đơn"), and the wishlist banner offers the passenger form only while an accepted request
has no booking yet.

A booking not paid within the existing 15-minute window is cancelled by `bookings.expirePendingBookings` (seats and
promotions released, `cancelReason = PAYMENT_EXPIRED`); it is never revived. The request's `currentBooking` disappears
and the next call creates a **new** booking from the same frozen snapshot, so the price cannot change. The expired
booking's detail page explains the expiry and, when the booking carries `customTourRequestId`, links back to the
passenger form. `POST /:id/bookings` refuses a stale offer with `409 DEPARTURE_PASSED` (the agreed day is past) or
`409 TOUR_UNAVAILABLE` (the private clone is no longer `APPROVED`); the form checks the date up front and turns both
codes into a reason plus a link to the chat rather than collecting members for nothing. Payment itself is unchanged:
the existing PayOS checkout is idempotent while a live payment exists and late/duplicate webhooks are resolved by the
existing payment reconciliation.

## Dependencies

`tours` (source facts, `getBriefs`), `categories` (active category ids on a draft), `users` (agency verification),
`chat` (conversation + `chat:updated` nudge), `notifications`, `bookings` (create from the snapshot, read the live
booking).

## Testing

`src/modules/custom-tours/__tests__/custom-tours.integration.test.ts`,
`custom-tours.negotiation.integration.test.ts`, `custom-tours.checkout.integration.test.ts` and
`custom-tours.booking.integration.test.ts` — real app + real PostgreSQL. Frontend:
`pnpm --filter frontend test features/custom-tours features/booking`.

Browser acceptance against the disposable fixture (`chat-browser-server.ts`, ports 3003/3002):
`node src/test/custom-tours.browser-smoke.cjs` for the request → lists → decision flow (S7) and
`node src/test/custom-tours.chat-panel.cjs` for the pinned card, the centred dialog, the offer, the acceptance (S8),
the passenger form with its autosave and reload (S9), the booking it creates (S10) and the resume links plus the
expired-hold rebooking it enables (S11), and the same screens at 320/768/1024/1440 px with the dialog's focus trap
(S12); screenshots in `plan/docs/screenshots/s7`, `s8`, `s9`, `s10` and `s12`.
