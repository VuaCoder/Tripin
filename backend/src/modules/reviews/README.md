# reviews

Ratings and written reviews of tours. Travelers review a trip once it is completed; everybody can read the visible
reviews; moderators can hide abusive ones. The average rating shown on tours is computed from the visible reviews.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Write a review | Traveler | `POST /reviews` |
| View reviews | Traveler | `GET /reviews/me` |
| View public review | Guest | `GET /reviews?tourId=…` or `GET /reviews?agencyId=…` |
| Moderate reviews | Moderator | no route here — `moderation` calls `reviewsService.listForModeration / moderate` |

## Files
| File | Role |
|---|---|
| `reviews.service.ts` | Eligibility rules, rating refresh, moderation, audit/notifications |
| `reviews.model.ts` / `.repository.ts` | `Review` schema, list queries, rating aggregate |
| `reviews.mapper.ts` | Public (masked) / own / moderator DTOs, `maskName` |
| `reviews.types.ts` | DTOs, `REVIEW_STATUS`, `REVIEW_TRANSITIONS` |
| `reviews.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer (`reviewsRouter`) |
| `index.ts` | Public API |

## API (base `/api/v1`)
* `POST /reviews` (`review:create`) body `{ bookingId, rating 1..5, comment 10..2000 }` → 201 `MyReviewDto`. Tour and agency are taken from the booking.
* `GET /reviews/me?page&limit` (`review:create`) → my reviews, including hidden ones with `hiddenReason`.
* `GET /reviews?tourId|agencyId&sort=newest|rating_desc|rating_asc&page&limit` (public) → `{ id, rating, comment, tourId, author{name,avatarUrl}, createdAt }`; exactly one of `tourId` / `agencyId` is required.
* Errors: 404 unknown/foreign booking, 409 `BOOKING_NOT_COMPLETED`, `REVIEW_EXISTS`.

## Business rules
1. Only the traveler of a **COMPLETED** booking can review it, once per booking (unique index + pre-check; a race returns `REVIEW_EXISTS`).
2. Rating and comment are validated server-side; reviews cannot be edited or deleted by their author (not in the diagram).
3. Public lists show only VISIBLE reviews and mask the author (`Nguyen A.`); traveler ids are never exposed.
4. Hiding needs a reason; hiding/restoring is a compare-and-set, recomputes the tour's `ratingAvg` (2 decimals) and `ratingCount` from VISIBLE reviews, is audited (`review.moderated`) and notifies the author.
5. The agency is notified of each new review.

## State machine (`REVIEW_TRANSITIONS`)
`VISIBLE ⇄ HIDDEN`.

## Data model
`Review { bookingId (unique), tourId, tourTitle, agencyId, travelerId, rating, comment, status, hiddenReason?, moderatedBy?, moderatedAt? }`.
Indexes: `(tourId, status, createdAt)` and `(tourId, status, rating)` for the public list/sort, `(agencyId, status, createdAt)`, `(travelerId, createdAt)`, `(status, createdAt)` moderator queue.

## Permissions
`review:create` (TRAVELER) for writing and "my reviews"; public listing needs none; `review:moderate` is checked on the moderation routes.

## Dependencies
* Uses: `bookings` (`getFacts`), `tours` (`updateRatingStats`), `users` (`getSummaries`), `notifications`, `audit`.
* Used by: `moderation`, `dashboards`, `reports` (reporting a review).

## Events / side effects
Notifications `REVIEW_RECEIVED`, `REVIEW_MODERATED`; audit `review.moderated`; tour rating fields updated.

## Testing
`__tests__/reviews.integration.test.ts` – real PostgreSQL (also covers earnings): review only after the real completion job, one review per booking under 5 parallel requests, author masking, hide/restore recomputes the rating, 8 simultaneous reviews give an exact `ratingCount/ratingAvg`, guide earned once per booking (4 parallel job runs), no earning without an accepted guide, earnings are private.
`__tests__/reviews.service.test.ts` – eligibility (owner, completed, once, race), masking, rating refresh, moderation transitions/audit/notification.

## Not implemented / follow-ups
* Agency replies to reviews, review photos, helpful votes (not in the diagram).
* Agency-level rating aggregate on the agency profile (the list by `agencyId` exists; the average is not stored).
