# e-tickets

The electronic ticket a traveler receives after a booking is paid. It is created automatically when a booking becomes
CONFIRMED, follows the booking if it is cancelled or completed, and is delivered by notification + email.

## Use cases covered
| Use case (diagram) | Actor | Endpoint / trigger |
|---|---|---|
| Receive E-ticket | Traveler | automatic on booking CONFIRMED (in-app + email), then `GET /e-tickets`, `GET /e-tickets/:id`, `GET /e-tickets/booking/:bookingId` |
| Scan QR check-in | Tour guide | `GET /guide/e-tickets/:tourId` (roster), `POST /guide/e-tickets/:tourId/check-in` |

(In the diagram "Receive E-ticket" is an outcome of payment, not something that includes it — DECISIONS D-10.)

## Files
| File | Role |
|---|---|
| `e-tickets.service.ts` | Idempotent issue, cancel/use transitions, traveler reads, guide roster/check-in |
| `e-tickets.model.ts` / `.repository.ts` | `ETicket` schema, compare-and-set transitions, guide queries |
| `e-tickets.types.ts` / `.mapper.ts` | DTO, `ETICKET_STATUS`, code policy |
| `e-tickets.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer (`eTicketsRouter`, `guideETicketsRouter`) |
| `index.ts` | Public API **and** the one-time wiring to `bookingEvents` |

## API (base `/api/v1`)
**Traveler** (`eticket:view-own`):
* `GET /e-tickets?page&limit` → paginated tickets, newest first.
* `GET /e-tickets/:id`, `GET /e-tickets/booking/:bookingId` → `{ id, code, status, booking{id,code}, tour{id,title}, departureDate, participants, holderName, issuedAt }`.
* 404 for unknown tickets **and** for tickets of other travelers. `code` is the string to put in the QR code (the API does not render images).

**Tour guide** (`guide:check-in`, assignment must be ACCEPTED):
* `GET /guide/e-tickets/:tourId` → `{ tourId, tourTitle, total, checkedIn, items[] }`; items are `{ ticketId, bookingCode, holderName, participants, contactPhone?, guests{adults,children,infants}, notes?, departureDate, checkedIn, checkedInAt? }`. Cancelled tickets are excluded; the ticket `code` is not exposed. `total`/`checkedIn` count ticket groups, not seats.
* `POST /guide/e-tickets/:tourId/check-in` `{ code }` → `{ ticketId, holderName, participants, tourTitle, checkedInAt }`.
* Errors: `TICKET_NOT_FOUND` (404), `TICKET_WRONG_TOUR`, `TICKET_CANCELLED`, `TICKET_ALREADY_USED`, `CONCURRENT_UPDATE` (409), `NOT_FOUND` (404, not the guide's tour).
* The roster is tour-level: a guide assigned to a tour sees its tickets across departures (each row carries `departureDate`).

There is no create endpoint: tickets exist only as a consequence of a verified payment.

## Business rules
1. One ticket per booking (unique `bookingId`), so repeated or concurrent `confirmed` events create exactly one ticket and one notification.
2. `code` = `ETK-` + 16 random characters from an unambiguous alphabet; unique index with retry on collision.
3. The holder name is the contact name stored on the booking.
4. Booking CANCELLED → ticket CANCELLED (only from VALID). Booking COMPLETED → ticket USED (only from VALID). A cancelled ticket is never revived.
5. Issuing notifies the traveler (`ETICKET_ISSUED`, in-app and email).
6. Guide check-in stamps `usedAt` once (`status` stays VALID), so the traveler's ticket is not shown as completed before the trip. The guide's roster counts `usedAt != null` (or `USED`) as present; a second scan answers `TICKET_ALREADY_USED`. The check-in is a compare-and-set on `{ id, status: VALID, usedAt: null }`.
7. A guide can only check in tickets of a tour whose assignment is ACCEPTED and not archived; the assignment is verified before the code is looked up.
8. The roster joins the booking behind each ticket for the contact phone, the adult/child/infant breakdown and the booking notes; a booking without age pricing counts every participant as an adult.

## State machine
`VALID → USED` (trip done) · `VALID → CANCELLED` (booking cancelled). `USED` and `CANCELLED` are terminal; each status change is a compare-and-set on `VALID`. Guide check-in is **not** a status change: it stamps `usedAt` while the ticket remains `VALID` until the booking completes.

## Data model
`ETicket { bookingId (unique), bookingCode, code (unique), travelerId, agencyId, tourId, tourTitle, departureDate, participants, holderName, status, issuedAt, cancelledAt?, usedAt? }`, index `(travelerId, issuedAt desc)`.
`usedAt` is the check-in/usage timestamp: set by a guide check-in (status still `VALID`) or by the COMPLETED transition.
Booking/tour fields are snapshots so the ticket stays readable if the tour changes.

## Permissions
* `eticket:view-own` (TRAVELER); ownership by `travelerId` in the service.
* `guide:check-in` (TOUR_GUIDE); the service also checks the guide's ACCEPTED assignment on the tour.

## Dependencies
* Uses: `bookings` (types + `bookingEvents`), `notifications`.
* Used by: none (reacts to events).

## Events / side effects
Subscribes to `bookingEvents.onConfirmed / onCancelled / onCompleted` in `index.ts`. Handler failures are logged and never fail the payment or the booking.

## Testing
`__tests__/e-tickets.service.test.ts` – idempotent issue, race on `bookingId`, code retry, cancel/use transitions, ownership and listing.
`__tests__/e-tickets.check-in.test.ts` – roster counts/filtering, assignment guard, successful stamp, unknown/wrong-tour/cancelled/already-used and compare-and-set races.

End-to-end (Playwright, real Postgres + HTTP + traveler web ticket): `docs/testing/guide-check-in/README.md`.

## Not implemented / follow-ups
* Persisting "trip started / trip finished" — there is no trip-state field; the mobile buttons are UI-only.
* PDF/QR image generation – the frontend renders the QR from `code`.
* A repair job for confirmed bookings whose ticket handler failed (re-run `issueForBooking`, it is idempotent).
