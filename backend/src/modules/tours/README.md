# tours

The tour catalogue: public discovery for Guests and Travelers, tour management for Agencies (create, edit, delete,
bulk import, availability, itinerary, guide assignment, submit for review), the assigned-tour workflow for Tour guides,
the moderation decisions (validate / suspend) invoked by the `moderation` module, and the **seat inventory** used by
`bookings`.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Search tours / Filter tours / View tours list | Guest, Traveler | `GET /tours` |
| View tour details | Guest, Traveler | `GET /tours/:id` |
| Create tour | Agency | `POST /agency/tours` |
| Edit tour | Agency | `PATCH /agency/tours/:id` |
| Delete tour | Agency | `DELETE /agency/tours/:id` |
| Upload tours | Agency | `POST /agency/tours/import` |
| Set tour availability | Agency | `PUT /agency/tours/:id/availability` |
| Config itinerary | Agency | `PUT /agency/tours/:id/itinerary` |
| Assign guide to tour | Agency | `PUT /agency/tours/:id/guide` |
| (supporting) submit for review, list/get own tours | Agency | `POST /agency/tours/:id/submit`, `GET /agency/tours`, `GET /agency/tours/:id` |
| View assigned tours | Tour guide | `GET /guide/tours` |
| Verify assigned tours | Tour guide | `POST /guide/tours/:tourId/verification` |
| Validate tour / Suspend tours / View tour lists | Moderator | no route here — `moderation` calls `toursService.decideReview / suspendTour / listForModeration` |

## Files
| File | Role |
|---|---|
| `tours.routes.ts` | 3 routers: `publicToursRouter`, `agencyToursRouter`, `guideToursRouter` |
| `tours.validation.ts` | zod schemas (strict bodies, bounded query, UUID params) |
| `tours.controller.ts` | HTTP only |
| `tours.service.ts` | Agency/guide/moderation rules, state machine, inventory API |
| `tours-discovery.service.ts` | Public search + visibility rules for details |
| `tours.view.ts` | Builds DTOs, batching agency/guide/category lookups (no N+1) |
| `tours.repository.ts` | All DB access incl. atomic seat reservation |
| `tours.model.ts` | `Tour` schema (embedded departures, itinerary, guide assignment) |
| `tours.mapper.ts` / `tours.types.ts` / `tours.query.ts` | DTO mapping, types, `TOUR_TRANSITIONS` |
| `index.ts` | Public API for other modules |

## API (base `/api/v1`)
**`GET /tours`** (public) – query: `q` (title/destination/summary, escaped contains), `categoryId`, `destination`,
`minPrice`,`maxPrice` (VND), `minDays`,`maxDays`, `departureFrom`,`departureTo` (a *bookable* departure in range),
`minRating`, `sort` = `newest|price_asc|price_desc|rating`, `page`, `limit` (≤100). Always `status=APPROVED`.
Items: `{ id,title,summary,destination,durationDays,basePrice,coverImage,categoryIds,ratingAvg,ratingCount,nextDepartureDate,agency{id,name} }`.

**`GET /tours/:id`** – APPROVED: public detail (bookable departures only, guide shown only after accepting).
Owner agency (not ARCHIVED) and staff with `tour:list-all` get the management view of any status; everybody else 404.

**Agency** (`/agency/tours`, each route has its own permission): `POST /` body `{title,summary?,description?,destination,durationDays,basePrice,maxGroupSize?,categoryIds[1..10],images?,inclusions?,exclusions?}` → 201 DRAFT ·
`GET /?status&page&limit` · `GET /:id` · `PATCH /:id` (any subset, ≥1 field) · `DELETE /:id` 204 ·
`POST /import` `{tours:[≤50]}` → 201 `{created,tours}` · `PUT /:id/availability` `{departures:[{id?,date,capacity,priceOverride?,isOpen}]}` ·
`PUT /:id/itinerary` `{days:[{day,title,description?,activities?}]}` · `PUT /:id/guide` `{guideId|null, feePerBooking}` · `POST /:id/submit` 202.

**Guide** (`/guide/tours`): `GET /` assigned tours · `POST /:tourId/verification` `{accept, note?}`.

Common errors: 400 validation, 401/403 permission, 404 unknown/not owned, 409 `TOUR_LOCKED`, `TOUR_HAS_BOOKINGS`,
`CAPACITY_BELOW_BOOKED`, `DEPARTURE_HAS_BOOKINGS`, `CONCURRENT_UPDATE`, `INVALID_STATE_TRANSITION`, 403 `AGENCY_NOT_VERIFIED`.

## Business rules
1. Money is integer VND; a departure's price is `priceOverride ?? basePrice`.
2. Ownership: every agency route loads the tour and answers **404** if it is not the caller's.
3. Content edits are allowed in DRAFT / REJECTED / APPROVED / SUSPENDED; **locked** while PENDING_REVIEW. Editing (or changing the itinerary of) an APPROVED tour sends it back to PENDING_REVIEW. Availability and guide assignment do not trigger review.
4. Submit requires: a **VERIFIED** agency (D-27), ≥1 category, ≥1 open future departure (D-28).
5. Delete = archive; refused while a future departure has sold seats (`remaining < capacity`).
6. Availability: matched by departure id; capacity cannot go below sold seats; a departure with sold seats cannot be moved or removed (close it); new/moved dates must be future. The write is guarded by the document version, so it can never overwrite seats sold at the same moment.
7. Itinerary: unique day numbers, each ≤ `durationDays`; `durationDays` cannot be cut below the itinerary.
8. Guide assignment: the guide must be an ACTIVE TOUR_GUIDE; a new assignment is PENDING; only that guide can answer, only once (`PENDING → ACCEPTED|DECLINED`).
9. Moderator: reject needs a reason; suspend needs a reason; both audited.
10. Inventory (`reserveSeats`) is one atomic update (`remaining ≥ seats`, open, future, tour APPROVED) — no overselling.

## State machine (`TOUR_TRANSITIONS`)
| From | To |
|---|---|
| DRAFT | PENDING_REVIEW, ARCHIVED |
| PENDING_REVIEW | APPROVED, REJECTED (moderator) |
| APPROVED | SUSPENDED (moderator), PENDING_REVIEW (material edit), ARCHIVED |
| REJECTED | PENDING_REVIEW, ARCHIVED |
| SUSPENDED | PENDING_REVIEW, ARCHIVED |
| ARCHIVED | — |

Guide assignment: `PENDING → ACCEPTED | DECLINED`. Status changes use compare-and-set (`updateIfStatus`) so concurrent decisions cannot clobber each other.

## Data model
`Tour` with embedded `departures[{date,capacity,remaining,priceOverride,isOpen}]`, `itinerary[]`, `guide{guideId,feePerBooking,status,…}`,
`categories` (many-to-many with `Category`), review stats `ratingAvg/ratingCount`. Indexes (all match a real query; the paginated ones end with `id` because the sorts use `id` as tie-breaker, so PostgreSQL reads them in order instead of sorting in memory): `(status,createdAt,_id)` default list,
`(status,basePrice,_id)` price filter/sort (both directions), `(status,categoryIds)`, `(status,ratingAvg,ratingCount,_id)`, `(status,departures.date)`, `(status,submittedAt,_id)` moderator queue,
`(agencyId,status,updatedAt)` agency list, `(guide.guideId,status)` guide list. Text search uses escaped regex (fine at this size; switch to Atlas Search when the catalogue grows).

## Permissions
`tour:create`, `tour:update-own` (also list/get/submit), `tour:delete-own`, `tour:import`, `tour:set-availability`,
`tour:configure-itinerary`, `tour:assign-guide`, `guide:tours-view`, `guide:tours-verify`; `tour:list-all` for staff visibility. Discovery is public.

## Dependencies
* Uses: `users` (summaries, guide check, agency verification), `categories`, `audit`.
* Used by: `bookings` (`getBookableDeparture`, `reserveSeats`, `releaseSeats`), `carts` (`getBookableDeparture`, `getDepartureFacts`, `getPublicCards`), `reviews` (`getTourFacts`, `updateRatingStats`), `earnings`, `moderation`, `dashboards`.

## Events / side effects
Audit: `tour.validated`, `tour.suspended`. In-app notifications: moderation decision and suspension (to the agency), guide assignment (to the guide).

## Testing
`__tests__/tours.integration.test.ts` – real PostgreSQL over HTTP: draft -> submit -> moderator decision -> public, locked/re-review edits, one winner among parallel decisions, suspended tours cannot be booked, ownership 404s, availability vs sold seats, seat accounting while bookings and availability edits race, delete guard, guide assignment answered once.
`__tests__/tours.service.test.ts` (ownership, locking, re-review, delete guard, availability invariants, submit rules, moderation, guide, inventory) and
`__tests__/tours-discovery.service.test.ts` (visibility matrix by status/actor).

## Not implemented / follow-ups
* Image upload (only URLs are stored) – no upload use case in the diagram.
* Rating stats are written by the reviews module through `ToursService.updateRatingStats` (backed by `ToursRepository.setRatingStats`).
* "Reinstate a suspended tour" is not in the diagram: the agency re-submits instead.
* Concurrency of the other content edits relies on status compare-and-set, not versioning (last write wins within the same status).
