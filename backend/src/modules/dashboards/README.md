# dashboards

Read-only dashboards for the three staff-like actors. The module owns no data: each figure comes from a small
`stats` method of the module that owns the collection, so aggregation logic stays next to the schema it reads.

## Use cases covered
| Use case (diagram) | Actor | Endpoint | Permission |
|---|---|---|---|
| View dashboard | Agency | `GET /agency/dashboard` | `agency:dashboard` |
| View moderation dashboard | Moderator | `GET /moderation/dashboard` | `moderation:dashboard` |
| View detailed dashboards | Super admin | `GET /admin/dashboard` | `admin:dashboard` |

## Files
| File | Role |
|---|---|
| `dashboards.service.ts` | Composes the read models; 30 s cache per key |
| `dashboards.types.ts` | DTOs (`AgencyDashboardDto`, `ModerationDashboardDto`, `AdminDashboardDto`) |
| `dashboards.controller.ts` / `dashboards.routes.ts` | HTTP layer, three routers |
| `../../utils/ttl-cache.ts` | Bounded in-process TTL cache with request coalescing |
| `index.ts` | Public API |

## API (base `/api/v1`)
* **Agency** – `{ generatedAt, customers, tours{total,byStatus}, bookings{<status>:n}, revenue{bookings,gross,commission,net}, last30Days[{date,bookings,net}], last6Months[{month,bookings,net}], topTours[{tourId,title,coverImage,bookings,net}], openComplaints }`. There is **no id parameter**: it is always the logged-in agency. `customers` counts distinct travelers with CONFIRMED/COMPLETED bookings belonging to this agency, lifetime; returning travelers count once, and no customer identity data is exposed. `last6Months` includes the current partial UTC calendar month and five previous months, oldest first, with zero-filled months. `coverImage` is the first tour image or null. Revenue includes only CONFIRMED/COMPLETED bookings belonging to the logged-in agency.
* **Moderation** – `{ generatedAt, queues{toursPendingReview, agenciesPendingVerification, reportsOpen, reportsAwaitingDecision, supportTicketsOpen, supportTicketsInProgress}, tours{<status>:n}, reviews{visible,hidden} }`.
* **Admin** – `{ generatedAt, users{total,byRole,byStatus,newLast30Days}, tours{total,byStatus}, bookings{byStatus}, revenue{bookings,gross,commission,net,subscriptions{amount,count}}, monthly[{month,bookings,gross,commission}] (12 months), subscriptions{active}, moderation{reportsOpen,supportTicketsOpen} }`.

## Business rules
1. "Revenue" counts **paid** bookings only (CONFIRMED + COMPLETED); cancelled/pending ones are in `byStatus` but not in money.
2. Agency figures: `gross` = what travelers paid, `commission` = platform share (snapshot on each booking), `net` = what the agency receives.
3. All money is integer VND; days and months are UTC.
4. Numbers may be up to 30 seconds old (cache); a failed computation is never cached.
5. The agency cache key is the agency id, so agencies can never see each other's numbers (tested).

## State machine / Data model
None.

## Dependencies
* Uses stats methods of: `bookings` (`getAgencyStats`, `getPlatformStats`), `tours` (`countByStatus`), `users` (`getStats`), `reports` (`countByStatus`, `countOpenForAgency`), `support`, `reviews`, `payments` (`paidTotal`), `subscriptions` (`countActive`).
* Used by: `routes/index.ts` only.

## Events / side effects
None.

## Testing
`__tests__/dashboards.integration.test.ts` – real PostgreSQL: every number of the three dashboards is compared with rows inserted by the test (revenue counts only CONFIRMED + COMPLETED, a paid-then-cancelled booking is not income, the 30-day window, per-agency isolation, unpaid payments are not revenue, ended-but-unswept subscriptions are not "active", queue counts, role gating).
`__tests__/dashboards.service.test.ts` (composition, agency scoping + cache isolation, zero defaults, TTL cache semantics) and
`__tests__/dashboards.routes.test.ts` (who may open which dashboard; agency dashboard bound to the token).

## Not implemented / follow-ups
* CSV export and per-category / per-destination breakdowns.
* Guide-specific dashboard (the guide has `earnings`).
* The aggregations rely on existing indexes (`agencyId,status,createdAt`; `status,endDate`); add `(status, confirmedAt)` on bookings if the revenue charts become slow (review in step D4).

## ADMIN-01 role boundary
Admin endpoints require the current `SUPER_ADMIN` role as well as the listed permission. Other roles cannot use admin endpoints through extra permission grants. Public, agency and moderation access rules are otherwise unchanged.

## Admin reporting ranges
`GET /admin/dashboard?from=<ISO>&to=<ISO>` accepts an optional inclusive pair, ordered and no longer than 366 days.
No parameters retain the previous lifetime totals / last-12-month series contract. With a range, booking revenue and
monthly series filter `confirmedAt`; subscription payments filter `paidAt`. Booking status counts filter `createdAt`.
Users/tours/account-status counts, active subscriptions and moderation queues remain current platform-wide snapshots.
The response includes `period` (the requested bounds and immediately preceding equally long disjoint bounds) and
`comparison` (prior booking totals plus subscription payment totals). Selected-period UTC months are zero-filled.
Cache keys include both bounds. UTC timestamps stored by Prisma are grouped directly, without a session-timezone conversion.
The UI defaults to 30 Vietnam calendar days, offers 7/30/90/365 presets, and explicitly separates period and snapshot figures.
