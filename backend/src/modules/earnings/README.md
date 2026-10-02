# earnings

What a tour guide earns from completed trips. When a booking of a tour is COMPLETED and the tour's guide has accepted
the assignment, the guide is credited the fee the agency agreed when assigning them.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| View earnings | Tour guide | `GET /earnings/me`, `GET /earnings/me/summary` |
| (system) record an earning | — | `bookingEvents.onCompleted` → `earningsService.recordForBooking` |

## Files
| File | Role |
|---|---|
| `earnings.service.ts` | Idempotent recording, listing, monthly summary |
| `earnings.model.ts` / `.repository.ts` | `Earning` schema, list and `$group` by month |
| `earnings.types.ts` / `.mapper.ts` | DTOs |
| `earnings.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer |
| `index.ts` | Public API **and** subscription to `bookingEvents.onCompleted` |

## API (base `/api/v1`, permission `earnings:view`)
* `GET /earnings/me?from&to&page&limit` → paginated `{ id, bookingId, bookingCode, tour{id,title}, amount, earnedAt }`, newest first.
* `GET /earnings/me/summary?from&to` → `{ totalAmount, count, byMonth:[{ month:"2026-10", totalAmount, count }] }` (UTC months).
Read-only; there is no way to create or edit an earning through HTTP.

## Business rules
1. Amount = `feePerBooking` of the guide assignment (VND per completed booking, not per participant), read from the tour when the booking completes (DECISIONS D-19, D-45).
2. Only an ACCEPTED assignment earns; no guide, pending or declined → nothing is recorded.
3. One earning per booking (unique `bookingId`); repeated or racing events create one row and one notification.
4. A guide can only read their own entries (the id comes from the token).
5. The guide is notified in-app (`EARNING_RECORDED`).

## State machine
None (entries are immutable facts).

## Data model
`Earning { guideId, bookingId (unique), bookingCode, tourId, tourTitle, agencyId, amount, earnedAt }`, index `(guideId, earnedAt desc)`.

## Permissions
`earnings:view` (TOUR_GUIDE).

## Dependencies
* Uses: `tours` (`getTourFacts` incl. `guideId`/`guideFee`), `bookings` (types + event), `notifications`.
* Used by: nobody else (a guide dashboard is not in the diagram; `dashboards` reads platform/agency figures only).

## Events / side effects
Notification `EARNING_RECORDED`. Handler failures are logged by `bookingEvents` and never block the booking.

## Testing
Real-database scenarios (completion job, once per booking, privacy) live in `reviews/__tests__/reviews.integration.test.ts`.
`__tests__/earnings.service.test.ts` – crediting rules, idempotency and race, error propagation, listing and summary.

## Not implemented / follow-ups
* Payouts / "paid out" status and the actual money transfer from agency to guide (not in the diagram).
* The fee is read at completion time: if the agency re-assigns or removes the guide before a trip completes, the earning follows the tour's current accepted guide (booking-level snapshot is a possible hardening).
* Platform commission is on the booking (`commissionAmount`), not deducted from the guide fee.
