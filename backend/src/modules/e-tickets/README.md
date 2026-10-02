# e-tickets

The electronic ticket a traveler receives after a booking is paid. It is created automatically when a booking becomes
CONFIRMED, follows the booking if it is cancelled or completed, and is delivered by notification + email.

## Use cases covered
| Use case (diagram) | Actor | Endpoint / trigger |
|---|---|---|
| Receive E-ticket | Traveler | automatic on booking CONFIRMED (in-app + email), then `GET /e-tickets`, `GET /e-tickets/:id`, `GET /e-tickets/booking/:bookingId` |

(In the diagram "Receive E-ticket" is an outcome of payment, not something that includes it — DECISIONS D-10.)

## Files
| File | Role |
|---|---|
| `e-tickets.service.ts` | Idempotent issue, cancel/use transitions, traveler reads |
| `e-tickets.model.ts` / `.repository.ts` | `ETicket` schema, compare-and-set transitions |
| `e-tickets.types.ts` / `.mapper.ts` | DTO, `ETICKET_STATUS`, code policy |
| `e-tickets.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer (`eTicketsRouter`) |
| `index.ts` | Public API **and** the one-time wiring to `bookingEvents` |

## API (base `/api/v1`, permission `eticket:view-own`)
* `GET /e-tickets?page&limit` → paginated tickets, newest first.
* `GET /e-tickets/:id`, `GET /e-tickets/booking/:bookingId` → `{ id, code, status, booking{id,code}, tour{id,title}, departureDate, participants, holderName, issuedAt }`.
* 404 for unknown tickets **and** for tickets of other travelers. `code` is the string to put in the QR code (the API does not render images).
There is no create endpoint: tickets exist only as a consequence of a verified payment.

## Business rules
1. One ticket per booking (unique `bookingId`), so repeated or concurrent `confirmed` events create exactly one ticket and one notification.
2. `code` = `ETK-` + 16 random characters from an unambiguous alphabet; unique index with retry on collision.
3. The holder name is the contact name stored on the booking.
4. Booking CANCELLED → ticket CANCELLED (only from VALID). Booking COMPLETED → ticket USED (only from VALID). A cancelled ticket is never revived.
5. Issuing notifies the traveler (`ETICKET_ISSUED`, in-app and email).

## State machine
`VALID → USED` (trip done) · `VALID → CANCELLED` (booking cancelled). `USED` and `CANCELLED` are terminal; each change is a compare-and-set on `VALID`.

## Data model
`ETicket { bookingId (unique), bookingCode, code (unique), travelerId, agencyId, tourId, tourTitle, departureDate, participants, holderName, status, issuedAt, cancelledAt?, usedAt? }`, index `(travelerId, issuedAt desc)`.
Booking/tour fields are snapshots so the ticket stays readable if the tour changes.

## Permissions
`eticket:view-own` (TRAVELER); ownership by `travelerId` in the service.

## Dependencies
* Uses: `bookings` (types + `bookingEvents`), `notifications`.
* Used by: none (reacts to events).

## Events / side effects
Subscribes to `bookingEvents.onConfirmed / onCancelled / onCompleted` in `index.ts`. Handler failures are logged and never fail the payment or the booking.

## Testing
`__tests__/e-tickets.service.test.ts` – idempotent issue, race on `bookingId`, code retry, cancel/use transitions, ownership and listing.

## Not implemented / follow-ups
* Ticket check-in / scanning by guides or agencies (no use case in the diagram).
* PDF/QR image generation – the frontend renders the QR from `code`.
* A repair job for confirmed bookings whose ticket handler failed (re-run `issueForBooking`, it is idempotent).
