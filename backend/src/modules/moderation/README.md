# moderation

The Moderator's workbench. It owns **no data**: each use case is a thin, permission-guarded route that calls the module
which owns the entity (so state machines, audit records and notifications stay in one place).

## Use cases covered
| Use case (diagram) | Endpoint(s) | Permission | Delegates to |
|---|---|---|---|
| View tour lists | `GET /moderation/tours`, `GET /moderation/tours/:id` | `tour:list-all` | `tours` |
| Validate tour | `POST /moderation/tours/:id/validate` `{approve, reason?}` | `tour:validate` | `tours.decideReview` |
| Suspend tours | `POST /moderation/tours/:id/suspend` `{reason}` | `tour:suspend` | `tours.suspendTour` |
| Verify Agency Profile | `GET /moderation/agencies?status=PENDING`, `POST /moderation/agencies/:id/verify` `{approve, note?}` | `agency:verify` | `users` (+ notification/email here) |
| Moderate reviews | `GET /moderation/reviews`, `POST /moderation/reviews/:id/moderate` `{hide, reason?}` | `review:moderate` | `reviews` |
| Ban violating account | `POST /moderation/users/:id/ban` `{reason}`, `POST /moderation/users/:id/unban` | `account:ban` | `users` |
| Resolve disputes | `GET /moderation/reports`, `GET /moderation/reports/:id`, `POST /moderation/reports/:id/resolve` `{decision, note}` | `dispute:resolve` | `reports` |
| Handle complaints | `GET /moderation/support-tickets`, `GET …/:id`, `POST …/:id/reply` `{text, resolve?}`, `PATCH …/:id/status` | `complaint:handle` | `support` |
| View moderation dashboard | `GET /moderation/dashboard` | `moderation:dashboard` | `dashboards` (step B19) |

## Files
| File | Role |
|---|---|
| `moderation.routes.ts` | One route per use case with the exact permission and validation |
| `moderation.controller.ts` | HTTP only; the acting staff member is the authenticated user |
| `moderation.service.ts` | Delegation + the cross-module step "notify the agency after verification" |
| `moderation.validation.ts` | zod schemas (strict; reasons required for negative decisions) |
| `index.ts` | Public API (`moderationRouter`) |

## Business rules
1. Authorization is **per route**: MODERATOR has these permissions by default and SUPER_ADMIN has all; a TRAVELER/AGENCY/TOUR_GUIDE or guest is refused (tested for every route).
2. Negative decisions need a reason/note (reject a tour, hide a review, reject an agency, ban an account, suspend a tour) – enforced by the schema and again by the owning service.
3. Rules about *what* may happen live in the owning module: tour transitions (`tours`), "moderators cannot ban other staff / nobody can ban a SUPER_ADMIN or themselves" (`users`), review and report state machines, support ticket flow.
4. Every sensitive decision is audited by the owning module (`tour.validated`, `tour.suspended`, `review.moderated`, `report.resolved`, `user.banned`, `user.unbanned`, `agency.verification_decided`).
5. Agency verification results are sent to the agency in-app and by email; tour, review, report and ticket results are notified by their own modules.
6. A banned account is blocked on its very next request (the actor is re-read from the DB), and cannot refresh its session.

## State machine
None here (see `tours`, `users`, `reviews`, `reports`, `support`).

## Data model
None.

## Permissions
`tour:list-all`, `tour:validate`, `tour:suspend`, `agency:verify`, `review:moderate`, `account:ban`, `dispute:resolve`, `complaint:handle` (+ `moderation:dashboard`).

## Dependencies
* Uses: `tours`, `users`, `reviews`, `reports`, `support`, `notifications`.
* Used by: `routes/index.ts` only.

## Events / side effects
Agency verification notification + email (`AGENCY_VERIFICATION_DECIDED`); everything else is emitted by the delegated module.

## Testing
`__tests__/moderation.service.test.ts` (delegation, verification notice, no notice on failure) and
`__tests__/moderation.integration.test.ts` (real PostgreSQL: every route refuses guests/non-staff and admits moderators, agency verification has one winner among parallel decisions, ban takes effect on the next request, ban guards for self/staff/super admin) and
`__tests__/moderation.routes.test.ts` (authorization matrix over all 17 routes with the real role→permission table, plus validation failures).

## Not implemented / follow-ups
* Banned users are not e-mailed the reason (only ACTIVE accounts are contactable by `notifications`); the reason is in the audit log and on the account.
* Assignment/queue locking between several moderators, bulk actions, SLA reporting.
