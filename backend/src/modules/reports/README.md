# reports

Travelers report problems with tours, agencies, guides or reviews. The concerned agency can answer; moderators make
the final decision. Covers "Send report", "Handle tour complaints" and (the data side of) "Resolve disputes"
(DECISIONS D-12). Help requests are a different thing: see `support`.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Send report | Traveler | `POST /reports`, `GET /reports/me`, `GET /reports/:id` |
| Handle tour complaints | Agency | `GET /agency/complaints`, `GET /agency/complaints/:id`, `POST /agency/complaints/:id/respond` |
| Resolve disputes | Moderator | no route here — `moderation` calls `reportsService.listForModeration / getForModeration / resolve` |

## Files
| File | Role |
|---|---|
| `reports.service.ts` | Target verification & routing, duplicate rule, agency answer, moderator decision |
| `reports.model.ts` / `.repository.ts` | `Report` schema (agency response + resolution embedded) |
| `reports.types.ts` / `.mapper.ts` | targets, categories, `REPORT_TRANSITIONS`, 3 DTO shapes (reporter / agency / moderator) |
| `reports.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer (`reportsRouter`, `agencyComplaintsRouter`) |
| `index.ts` | Public API |

## API (base `/api/v1`)
* `POST /reports` (`report:create`, 20/h/IP) `{ targetType: TOUR|USER|REVIEW, targetId, category, description 10..2000, bookingId? }` → 201 `MyReportDto`. `USER` targets must be an agency or a tour guide.
* `GET /reports/me?status&page&limit`, `GET /reports/:id` – own reports only.
* `GET /agency/complaints?status`, `GET /agency/complaints/:id`, `POST /agency/complaints/:id/respond` `{ text }` (`complaint:respond`). Agencies see a masked reporter name (`Nguyen A.`), never the reporter id or contact.
* Errors: 404 unknown target/foreign report/booking, 409 `REPORT_ALREADY_OPEN`, `INVALID_STATE_TRANSITION`.

## Business rules
1. The target must exist; the responsible **agency** and the **tour** are derived from it on the server (tour → its agency; agency account → itself; guide account / review → no agency, moderators only).
2. A reporter may have one open report (OPEN or AGENCY_RESPONDED) per target. This is enforced by the unique `openKey` (`reporter:type:target`, removed when the report is RESOLVED/REJECTED), so two simultaneous submissions cannot both succeed.
3. `bookingId`, if given, must be the reporter's own booking (evidence for disputes).
4. The agency can answer **once**, only while the report is OPEN; the reporter is notified (`REPORT_UPDATED`).
5. A moderator can close an OPEN or answered report as `RESOLVED` (upheld) or `REJECTED` (unfounded) with a note; this is audited (`report.resolved`), the reporter is notified in-app and by email, the agency is informed.
6. Closed reports are immutable (no re-opening).

## State machine (`REPORT_TRANSITIONS`)
`OPEN → AGENCY_RESPONDED | RESOLVED | REJECTED`; `AGENCY_RESPONDED → RESOLVED | REJECTED`. Every change is a compare-and-set.

## Data model
`Report { reporterId, targetType, targetId, category, description, bookingId?, agencyId?, tourId?, status, agencyResponse?, resolution? }`.
Indexes: `(reporterId, createdAt, _id)`, unique sparse `(openKey)` (one open report per reporter and target, also the duplicate check), `(agencyId, status, createdAt)` agency inbox, `(status, createdAt)` moderator queue.

## Permissions
`report:create` (TRAVELER), `complaint:respond` (AGENCY); `dispute:resolve` is checked on the moderation routes. Ownership/routing enforced in the service.

## Dependencies
* Uses: `tours` (`getTourFacts`), `users` (`getSummaries`), `reviews` (`getFacts`, `maskName`), `bookings` (`getFacts`), `notifications`, `audit`.
* Used by: `moderation`, `dashboards`.

## Events / side effects
Notifications `COMPLAINT_RECEIVED`, `REPORT_UPDATED`, `REPORT_RESOLVED` (+ email); audit `report.resolved`.

## Testing
`__tests__/reports.integration.test.ts` – real PostgreSQL: server-side routing, one open report under 5 parallel submissions, privacy of reporter/agency views, single agency answer and single moderator decision under races, closed reports stop blocking.
`__tests__/reports.service.test.ts` – routing per target type, evidence ownership, duplicate rule, agency privacy/ownership, single answer, moderator decisions and notifications.

## Not implemented / follow-ups
* Attachments/screenshots, reporter withdrawal, automatic action (e.g. suspend a tour after N upheld reports) – moderators act manually through `moderation`.
* Reports against travelers by agencies/guides (not in the diagram).
