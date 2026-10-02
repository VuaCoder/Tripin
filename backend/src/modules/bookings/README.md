# bookings

A traveler's reservation of a tour departure: server-side pricing (promotion + platform commission), seat holding while
payment is pending, cancellation rules, the agency's view of its bookings, and the lifecycle hooks used by `payments`,
`e-tickets`, `reviews` and `earnings`.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Book tour | Traveler | `POST /bookings` |
| (supporting) my bookings, details, cancel | Traveler | `GET /bookings/me`, `GET /bookings/:id`, `POST /bookings/:id/cancel` |
| View bookings status | Agency | `GET /agency/bookings`, `GET /agency/bookings/:id` |
| Make payment (booking side) | Traveler | `payments` calls `bookingsService.getPayable / confirmPayment` |
| Export customer PDF | Agency | `GET /agency/tours/:id/customers.pdf?departureId=` (`agency:export-customers`) |

## Files
| File | Role |
|---|---|
| `bookings.routes.ts` | `bookingsRouter` (traveler), `agencyBookingsRouter` |
| `bookings.validation.ts` | zod: create (strict), cancel, list queries |
| `bookings.controller.ts` | HTTP only; owner/agency id always from the token |
| `bookings.service.ts` | Pricing, compensation, cancellation, payment confirmation, maintenance jobs |
| `bookings.policy.ts` | `BOOKING_POLICY` numbers + `BOOKING_TRANSITIONS` |
| `bookings.export.ts` | PDF rendering of the customer list (PDFKit + DejaVu Sans for Vietnamese) |
| `bookings.events.ts` | in-process `bookingEvents.onConfirmed/onCompleted` for consumers |
| `bookings.repository.ts` / `bookings.model.ts` / `bookings.mapper.ts` / `bookings.types.ts` | persistence + DTOs |
| `index.ts` | Public API |

## API (base `/api/v1`)
* `POST /bookings` (`booking:create`) body `{ tourId, departureId, participants (1..50), contact{fullName,phone}, notes?, promotionCode?, clientRequestId? }` → 201 `BookingDto` in status `PENDING` with `paymentExpiresAt`. The client never sends a price.
* `GET /bookings/me?status&page&limit`, `GET /bookings/:id` (`booking:view-own`). `BookingDto` has no commission fields.
* `POST /bookings/:id/cancel` body `{ reason? }` → `BookingDto` (CANCELLED).
* `GET /agency/bookings?status&tourId&departureFrom&departureTo&page&limit`, `GET /agency/bookings/:id` (`agency:bookings-view`): shows `totalAmount`, `commissionAmount`, `agencyAmount`; traveler name/phone only for CONFIRMED / COMPLETED.
* `GET /agency/tours/:id/customers.pdf[?departureId]` (`agency:export-customers`) → `application/pdf` attachment (A4 landscape): booking code, departure date, traveler name, phone, pax, notes of the PAID bookings (CONFIRMED + COMPLETED) of that tour. 404 unless the tour belongs to the caller; capped at 5000 rows (header says when truncated). Mounted by `agencyCustomersExportRouter` under `/agency/tours`.
* Errors: 409 `NOT_ENOUGH_SEATS`, `DEPARTURE_UNAVAILABLE`, `PROMOTION_*`, `CANCELLATION_WINDOW_PASSED`, `INVALID_STATE_TRANSITION`, `BOOKING_NOT_PAYABLE`, `BOOKING_PAYMENT_EXPIRED`, `CONCURRENT_UPDATE`; 404 for foreign ids.

## Business rules
1. **Pricing is server-side**: `subtotal = departure price × participants`; `total = subtotal − promotion discount`; `commission = floor(total × commissionBps / 10000)`; `agencyAmount = total − commission`. Commission rate and discount are **snapshotted** on the booking.
2. **No overselling**: seats are reserved with one atomic update before the booking is saved; any later failure releases the seats and the promotion redemption (compensation).
2b. **Nothing free**: the amount to pay must be at least `MIN_PAYABLE_AMOUNT` (1 VND). A free departure, or a promotion that would bring the total to 0, is refused with `409 BOOKING_AMOUNT_TOO_LOW` before anything is reserved (seats and redemption given back). There is no free-booking flow in the diagram, and a payment of 0 cannot exist.
3. **Retry safety**: `clientRequestId` (unique per traveler) makes a repeated request return the first booking and reserve nothing.
4. A PENDING booking holds its seats for `PENDING_PAYMENT_MINUTES` (30). `expirePendingBookings()` cancels it afterwards (compare-and-set on PENDING only: a booking paid a moment earlier stays CONFIRMED) (`PAYMENT_EXPIRED`) and frees seats/promotion.
5. Cancel: PENDING any time; CONFIRMED only if the departure is further away than `cancellation.cancellationWindowHours` (policy, default 24h). A paid booking that is cancelled gets `refundRequired=true` (no money movement here, D-15).
6. `confirmPayment()` is idempotent; a payment arriving for a CANCELLED booking never revives it – it sets `isPaid` + `refundRequired` and returns `REFUND_REQUIRED`.
7. `completeFinishedBookings()` moves CONFIRMED → COMPLETED once `endDate = departureDate + durationDays` has passed, notifies the traveler (review invitation) and emits `completed`.
8. Ownership: traveler routes answer 404 for bookings of others; the agency sees only its own bookings.
9. The customer list contains only paid bookings of the agency's own tour and is never cached (`Cache-Control: no-store`); the PDF font is DejaVu Sans (package `dejavu-fonts-ttf`), with a logged fallback to Helvetica.
10. Booking codes (`TRP-XXXXXXXX`, no ambiguous characters) are unique; collisions are retried.

## State machine (`BOOKING_TRANSITIONS`)
| From | To |
|---|---|
| PENDING | CONFIRMED (verified payment), CANCELLED (traveler / expiry) |
| CONFIRMED | COMPLETED (job), CANCELLED (traveler, inside rules) |
| COMPLETED, CANCELLED | — |
Every change is a compare-and-set on the previous status.

## Data model
`Booking` with traveler/agency/tour/departure refs, tour & date snapshots, money fields (integer VND), `promotion` snapshot, status flags. Indexes: `bookingCode` unique, `(travelerId, createdAt, id)`, `(agencyId, status, createdAt, id)`, `(agencyId, createdAt, id)` (agency list without a status filter), `(tourId, departureId, status)`, `(status, confirmedAt)` (dashboard revenue by day/month), `(status, paymentExpiresAt)` and `(status, endDate)` for the jobs, unique `(travelerId, clientRequestId)` (rows without a request id do not clash: PostgreSQL treats NULLs as distinct), so the idempotency lookup is a plain unique-key read.

## Permissions
`booking:create`, `booking:view-own`, `agency:bookings-view`. Ownership checks in the service.

## Dependencies
* Uses: `tours` (inventory), `promotions` (redeem/release), `system-settings` (commission, cancellation window), `notifications`.
* Used by: `payments`, `e-tickets`, `reviews`, `earnings`, `dashboards`, `reports`.
* The maintenance methods must be scheduled: wired in step C2 (`server.ts`).

## Events / side effects
Notifications: BOOKING_CREATED / CONFIRMED / CANCELLED / COMPLETED. `bookingEvents` handlers never break the transition.

## Testing
`__tests__/bookings.money.integration.test.ts` – real PostgreSQL: randomised bookings (odd prices, 0-100 % commission with 2 decimals, percent/capped/fixed/minimum-order promotions): everything is integer VND and non-negative, `total = subtotal - discount`, `commission = floor(total x bps / 10000)`, `commission + agency = total`, the payment charges exactly the booking total, free orders are refused.
`__tests__/bookings.export.test.ts` (real PDF generation incl. Vietnamese text and pagination, ownership/cap of the list, HTTP permissions) and
`__tests__/bookings.integration.test.ts` – real PostgreSQL: seat accounting never oversells under parallel requests, the same `clientRequestId` yields one booking, double cancel releases seats once, IDOR returns 404.
`__tests__/bookings.service.test.ts` – pricing and snapshots, promotion, compensation, idempotency, code collisions, ownership, cancellation rules, payment hooks, expiry and completion jobs, handler isolation.

## Not implemented / follow-ups
* Refund execution and `REFUND_REQUESTED/REFUNDED` states (policy undefined, D-15).
* Agency/admin cancellation of a booking (not in the diagram).
* Revival of an expired booking when a late payment arrives.
