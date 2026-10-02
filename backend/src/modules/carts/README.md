# carts

> **Status: placeholder — no code, no routes, no collections.** Nothing here is deployed or documented as working.

## Why this folder exists
The repository architecture (README "Phase 4", AI rules §2/§9) lists a **Cart** domain, but the use-case diagram
(`docs/architecture/TripRi.json`) has no cart use case: a traveler books one tour departure directly (`Book tour` →
`Make payment`). To avoid inventing behaviour (AI rules §14/§35) the module was left empty on purpose.

## Use cases covered
None.

## Files
Only this README.

## API
None.

## Business rules
None implemented. If a cart is approved later, these boundaries are already decided:
* Owner = the authenticated traveler; items reference `{ tourId, departureId, participants }` only. **No prices are stored**: pricing stays server-side in `bookings` at checkout (D-16).
* Checkout = one `bookings.createBooking` per item (each keeps its own payment window / state machine); the cart never holds seats.
* Dependencies allowed: `tours` (`getBookableDeparture`), `bookings`. No other module may import `carts`.

## State machine
None.

## Data model
None.

## Permissions
None (would reuse `booking:create`).

## Dependencies
None.

## Events / side effects
None.

## Testing
None.

## Not implemented / follow-ups
Everything above, pending an owner decision. See `docs/backend/DECISIONS.md` D-56.

## Guard
`src/scripts/__tests__/build-smoke.integration.test.ts` fails if this folder gains code or a `/api/v1` route before the owner approves the feature (DECISIONS D-56).
