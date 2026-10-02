# wishlists

A traveler's saved ("favourite") tours.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Add wishlist | Traveler | `POST /wishlist/:tourId` |
| Remove tour from wishlist | Traveler | `DELETE /wishlist/:tourId` |
| (supporting) see the saved tours | Traveler | `GET /wishlist` |

## Files
| File | Role |
|---|---|
| `wishlists.model.ts` | `WishlistItem { userId, tourId, createdAt }` with unique `(userId, tourId)` |
| `wishlists.repository.ts` | upsert-style `addIfAbsent`, `remove`, `count`, paginated `list` |
| `wishlists.service.ts` | rules (public tours only, size limit, idempotency), builds the list DTO |
| `wishlists.validation.ts` / `.controller.ts` / `.routes.ts` / `.types.ts` | HTTP layer, DTO, limits |
| `index.ts` | Public API |

## API (base `/api/v1`, permission `wishlist:manage` on all routes)
* `GET /wishlist?page&limit` → paginated `{ tourId, addedAt, available, tour? }`, newest first. `tour` is the same card as `GET /tours` items.
* `POST /wishlist/:tourId` → `201 { tourId, saved:true }` when newly saved, `200` when it was already saved. 404 if the tour does not exist or is not public; 409 `WISHLIST_FULL`.
* `DELETE /wishlist/:tourId` → 204 whether or not it was saved.

## Business rules
1. The owner is always the authenticated user; no user id is accepted from the client, so another traveler's list can never be read or changed.
2. Only APPROVED (public) tours can be added; others answer 404.
3. Add and remove are idempotent (unique index + upsert, safe under double-clicks/races).
4. At most 200 saved tours per traveler (`WISHLIST_LIMITS.MAX_ITEMS`).
5. A saved tour that later stops being public stays in the list with `available:false` and no card, so travelers can still remove it.

## State machine
None.

## Data model
`WishlistItem` with unique index `(userId, tourId)` (idempotent add) and `(userId, createdAt desc)` (list).

## Permissions
`wishlist:manage` (TRAVELER). Ownership is implicit in the query (`userId` from the token).

## Dependencies
* Uses: `tours` (`getTourFacts`, `getPublicCards`).
* Used by: none.

## Events / side effects
None.

## Testing
`__tests__/wishlists.integration.test.ts` – real PostgreSQL: parallel add yields one row, idempotent remove, privacy, only public tours can be saved, suspended tours stay listed as unavailable, permission checks.
`__tests__/wishlists.service.test.ts` – idempotency, visibility by tour status, limit, unavailable entries, user scoping.

## Not implemented / follow-ups
* No "move to cart" (carts are out of the diagram).
* Wishlist entries are not removed when a tour is archived (they are flagged unavailable).
