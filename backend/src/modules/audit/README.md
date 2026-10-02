# audit

Append-only trail of sensitive actions (bans, access changes, verification decisions, configuration changes, moderation,
payment confirmation). Other modules write to it through `auditService.record()`; Super admins read it.

## Use cases covered
| Use case | Actor | Endpoint |
|---|---|---|
| (supporting) View audit log | Super admin | `GET /admin/audit-logs` |
| (supporting) Record sensitive action | any service | `auditService.record(entry)` (no HTTP) |

## Files
| File | Role |
|---|---|
| `audit.types.ts` | `AUDIT_ACTIONS` catalogue, `AuditEntry`, DTO, list query |
| `audit.model.ts` | `AuditLog` schema (append-only, indexes) |
| `audit.repository.ts` | create + filtered list |
| `audit.service.ts` | `record()` (never throws) and `list()` |
| `audit.mapper.ts` / `audit.validation.ts` / `audit.controller.ts` / `audit.routes.ts` | list endpoint |
| `index.ts` | Public API: `auditRouter`, `auditService`, `AUDIT_ACTIONS` |

## API (base `/api/v1`)
`GET /admin/audit-logs?page&limit&actorId&action&targetType&targetId&from&to` — permission `audit:view`.
Returns a paginated list newest first: `{ id, actorId, actorRole, action, targetType, targetId?, metadata?, createdAt }`.
There is deliberately no create/update/delete endpoint.

## Business rules
1. Every sensitive state change calls `record()` AFTER it succeeded, with an action from `AUDIT_ACTIONS`.
2. `record()` swallows and logs write failures (`Audit write failed for <action>`): losing an audit row must not roll back or
   fail an already-completed business action.
3. `metadata` must be small and non-sensitive (reasons, before/after values). Never tokens, passwords, OTPs, documents.
4. Filters are validated: ids must be ObjectIds, `from <= to`, `action` must exist in `AUDIT_ACTIONS`.

## State machine
None (immutable records).

## Data model
`AuditLog { actorId, actorRole, action, targetType, targetId?, metadata?, createdAt }`.
Indexes: `createdAt:-1` (default list), `action+createdAt`, `actorId+createdAt`, `targetType+targetId+createdAt` (history of
one entity) — each matches a filter of the list endpoint.

## Permissions
`audit:view` (SUPER_ADMIN only by default).

## Dependencies
* Uses: `@travel-platform/constants`, `utils/*`.
* Used by: `users` (access assignment, ban/unban, agency verification), `system-settings` (commission, policies), `categories`, `tours` (validate/suspend), `reviews` (moderation), `reports` (resolve), `promotions` (platform promotions), `moderation`.

## Events / side effects
None.

## Testing
`__tests__/audit.coverage.integration.test.ts` – every action in `AUDIT_ACTIONS` is produced by exactly one entry per privileged mutation (commission, policies, categories, platform promotions, access, tour validate/suspend, agency verification, review moderation, report resolution, ban/unban); refused, invalid, no-op and agency-level requests write nothing; two moderators banning at once leave one entry; a test fails if a declared action is never exercised.
`wishlists/__tests__/wishlists.integration.test.ts` (second describe) – real MongoDB: entries written by bans/commission/categories, every filter, validation, staff-only and read-only access.
`__tests__/audit.service.test.ts` – storage, failure isolation, pagination mapping. Wiring is asserted in the users tests.

## Not implemented / follow-ups
* Moderator replies to support tickets and status changes of tickets are NOT audited (the ticket thread itself is the record); add an action to `AUDIT_ACTIONS` if the owner wants them in the log.
* No retention/archival policy (TTL) – decide with the owner before enabling.
* Add a new action to `AUDIT_ACTIONS` only together with the code that records it (every declared action is wired).
* IP / user-agent of the actor is not stored yet.
