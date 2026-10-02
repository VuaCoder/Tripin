# promotions

Discount codes. **Agencies** create promotions that apply to their own tours; the **Super admin** creates platform-wide
promotions. Travelers enter a code at booking time; `bookings` validates and redeems it through this module.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Upload promotions | Agency | `GET/POST /agency/promotions`, `GET/PATCH /agency/promotions/:id` |
| Config platform promotions | Super admin | `GET/POST /admin/promotions`, `GET/PATCH /admin/promotions/:id` |
| (supporting, DECISIONS D-17) apply a code at checkout | Traveler | `GET /promotions/preview?code&tourId&subtotal` + `promotionsService.redeem` inside `bookings` |

## Files
| File | Role |
|---|---|
| `promotions.model.ts` / `.repository.ts` | `Promotion` schema; atomic `consume` / `release` |
| `promotions.policy.ts` | Pure rules: `computeDiscount`, `assertApplicable`, `isRunning` |
| `promotions.service.ts` | Scope/ownership rules, create/update, `preview`, `redeem`, `release` |
| `promotions.validation.ts` / `.controller.ts` / `.routes.ts` / `.mapper.ts` / `.types.ts` | HTTP layer + DTO |
| `index.ts` | Public API |

## API (base `/api/v1`)
* `POST /agency/promotions` (`promotion:agency-manage`) body `{ code, title, description?, discountType: PERCENT|FIXED, discountValue, maxDiscountAmount?, minOrderAmount?, startsAt, endsAt, usageLimit? }` → 201.
* `GET /agency/promotions?isActive&page&limit`, `GET /:id`, `PATCH /:id` (`title, description, discountValue, maxDiscountAmount, minOrderAmount, startsAt, endsAt, usageLimit, isActive`). There is no delete: set `isActive:false`.
* Same four routes under `/admin/promotions` with `promotion:platform-manage`.
* `GET /promotions/preview?code&tourId&subtotal` (`booking:create`) → `{ promotionId, code, scope, discountAmount, finalAmount }`; nothing is consumed.
* DTO adds `usedCount` and the derived `isRunning` (active and inside its window).
* Errors: 409 `PROMOTION_CODE_EXISTS`, `PROMOTION_INACTIVE`, `PROMOTION_NOT_STARTED`, `PROMOTION_EXPIRED`, `PROMOTION_NOT_APPLICABLE`, `PROMOTION_MIN_ORDER`, `PROMOTION_EXHAUSTED`, `PROMOTION_IN_USE`; 404 unknown code/promotion.

## Business rules
1. Codes are upper-case, 3–30 chars (`A-Z 0-9 _ -`), globally unique and immutable; `discountType` is immutable.
2. PERCENT is 1–100 and floored to whole VND, optionally capped by `maxDiscountAmount` (not allowed on FIXED). FIXED never exceeds the order.
3. `endsAt > startsAt`; a new promotion must end in the future.
4. Agency promotions apply only to tours of the owning agency; platform promotions to every tour. One code per booking.
5. Once redeemed (`usedCount > 0`) the discount value cannot change (create a new promotion); `usageLimit` cannot drop below `usedCount`.
6. Redemption is an atomic increment guarded by `usedCount < usageLimit` – concurrent bookings cannot over-redeem. `release` gives it back on cancel/expiry and never goes below 0.
7. Agencies see only their own promotions; a wrong-scope or foreign id answers 404.
8. Platform promotion changes are audited (`promotion.platform_changed`).

## State machine
None; availability is `isActive` plus the `startsAt..endsAt` window.

## Data model
`Promotion { scope, ownerId?, code (unique), title, discountType, discountValue, maxDiscountAmount?, minOrderAmount, startsAt, endsAt, usageLimit?, usedCount, isActive, createdBy }`. Index `(scope, ownerId, createdAt)` for both list screens; `code` unique for lookups.

## Permissions
`promotion:agency-manage`, `promotion:platform-manage`, `booking:create` (preview). Ownership enforced in the service.

## Dependencies
* Uses: `tours` (`getTourFacts` to learn the tour's agency), `audit`.
* Used by: `bookings` (`redeem`, `release`, `preview`).

## Events / side effects
Audit for platform changes. No emails.

## Testing
`__tests__/promotions.integration.test.ts` – real MongoDB: `usageLimit` is exact under parallel bookings (refused bookings give their seats back), cancel releases the redemption once, agency promotions do not leak to other agencies, preview consumes nothing, expired/inactive/not-started codes get precise errors.
`__tests__/promotions.service.test.ts` – discount math, every inapplicability reason, scope/ownership, immutability rules, redeem race, release.

## Not implemented / follow-ups
* Per-traveler usage limits and first-booking-only rules (not in the diagram).
* Restricting a promotion to specific tours/categories.
* Stacking several codes on one booking.
