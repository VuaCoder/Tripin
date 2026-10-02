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
* **Agency** – `{ generatedAt, tours{total,byStatus}, bookings{<status>:n}, revenue{bookings,gross,commission,net}, last30Days[{date,bookings,net}], topTours[{tourId,title,bookings,net}], openComplaints }`. There is **no id parameter**: it is always the logged-in agency.
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
* Custom date ranges and CSV export, per-category / per-destination breakdowns.
* Guide-specific dashboard (the guide has `earnings`).
* The aggregations rely on existing indexes (`agencyId,status,createdAt`; `status,endDate`); add `(status, confirmedAt)` on bookings if the revenue charts become slow (review in step D4).
