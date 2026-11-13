# Agency member access — implementation and integration contract

## Scope and deployment boundary

Development implementation extends H2 with tenant-owned permission templates and
individual overrides. No old migration or migration ledger is modified. Candidate:
`20261113000100_agency_flexible_permissions`. Apply the candidate **before** starting
this backend/generated Prisma client. Shared deployment is not authorized by this
implementation task. Migration history reconciliation remains deferred.

## Data model

- `AgencyRole`: belongs to `AgencyProfile.id`; permissions are a PostgreSQL text
  array. Four seeded templates, plus any agency-local custom roles. The permission
  catalog is server-owned; templates do not create new executable permissions.
- `AgencyMember.roleId`: selects one template; `role` remains for historical
  compatibility and protected OWNER identity. Custom roles use the STAFF enum
  classification without inheriting STAFF grants.
- `AgencyMemberPermissionOverride`: one ALLOW or DENY per member/permission;
  absent row means INHERIT. DENY wins over the template.
- `AgencyMemberTourScope`: explicit tour and allowed content fields. Composite
  FKs prevent both foreign-member and foreign-tour assignments.
- `AgencyProfile.permissionVersion`: incremented by access/team writers. All
  membership reads and requests recalculate permissions; JWT does not contain
  authoritative tenant grants. Frontend cache identity includes this version.

The migration seeds roles for existing organizations and backfills member and
invitation role IDs without changing historical IDs/statuses or business rows.
Triggers seed defaults for new agencies and keep legacy nested onboarding and
enum-based member writers compatible. Roles referenced by members/invitations
cannot be deleted. Override/scope rows cascade only when their membership is
deleted; business/agency FKs remain RESTRICT.

OWNER recovery controls (context, team read/invite/manage, permissions management)
cannot be revoked. Ordinary OWNER business grants remain configurable. Removing
or demoting the last active OWNER is refused under the agency row lock.

## API contract

All organization endpoints use Bearer authentication and `X-Agency-Id`. Tenant
selection is checked against an ACTIVE membership and active personal account.
`GET /agency/context` and session membership DTOs preserve existing fields and
add `roleId`, `roleName`, `permissionVersion`:

```ts
{
  agencyId: string;       // AgencyProfile.id, not User.id
  actorUserId: string;    // authenticated User.id, context response only
  memberId: string;
  memberRole: 'OWNER' | 'MANAGER' | 'STAFF' | 'ACCOUNTANT';
  roleId: string;
  roleName: string;
  permissions: string[];  // final effective grants, authoritative on server
  permissionVersion: number;
}
```

Base `/api/v1`, standard `{success,data}` responses:

| Method | Endpoint | Effective permission / payload |
| --- | --- | --- |
| GET | `/agency/members` | `agency:team-view`; safe names/emails, role, status, effective grants, overrides, tour scopes |
| GET | `/agency/permissions` | `agency:team-view`; organization-only capability catalog |
| GET | `/agency/roles` | `agency:team-view` |
| POST | `/agency/roles` | `agency:permissions-manage`; `{name,permissions}` |
| PATCH | `/agency/roles/:id` | same; replace template grants, not individual overrides |
| PUT | `/agency/members/:id/access` | same; `{roleId,overrides:[{permission,effect:'ALLOW'|'DENY'}]}`; empty overrides reset inheritance |
| PUT | `/agency/members/:id/tour-scopes` | permissions management plus full tour editing; `{scopes:[{tourId,allowedFields}]}`; empty scopes revoke assignments |
| PATCH | `/agency/members/:id` | `agency:team-manage`; `{status?}`; enum role changes additionally require permissions management |
| GET | `/agency/invitations` | `agency:team-view`; latest 100 metadata rows, never tokens/hashes |
| POST | `/agency/invitations` | `agency:team-invite`; `{email,role,roleId?}`; roleId supports custom templates |
| POST | `/agency/invitations/:id/revoke` | `agency:team-manage` |
| POST | `/agency-invitations/accept` | personal authenticated/verified matching email; `{token}` |
| GET | `/agency/work/tours` | `agency:tour-view`; max 200 operating tours, content and caller's allowed fields |
| PATCH | `/agency/work/tours/:id/content` | `agency:tour-content-update`; strict subset of `{title,summary,description}`; scope and editable status checked transactionally |
| GET | `/agency/work/bookings?page=1` | `agency:booking-monitor`; pages of 50, contact name/phone, booking/tour/departure/status/participants only |

Delegated administrators cannot modify themselves or OWNER access, edit their own
assigned template, or grant rights they do not hold. Clearing a DENY is validated
against final access too. Invitation acceptance rechecks inviter's current rights
and the current template; a stale email cannot resurrect removed privileges.
Role/status/access writers share the same per-agency lock as notification delivery.

## Defaults and frontend

- OWNER: existing business grants plus protected team/permission administration.
- MANAGER: operational tour create/edit/itinerary/availability/guide, bookings,
  customer PDF, promotion/complaint/review and operational dashboard. No Finance,
  delete/import, or Team administration by default.
- STAFF: tour read, scoped title/summary/description editing, minimal booking
  monitoring/contact lookup. No assignments means no content writes. Never grant
  broad `tour:update-own` as a substitute for limited content access.
- ACCOUNTANT: existing read-only booking/dashboard/finance summary. No tour writes.

Routes: `/agency/team`, `/agency/work/tours`, `/agency/work/bookings`, and
`/agency/invitations/accept`. Invite acceptance works without an existing agency
membership and returns through personal login with a safe `next` path. Roles are
shown by name, not inferred from global User role. Traveler identity is preserved.

## Finance integration (parallel work)

Finance must check effective `agency:finance-view` rather than role names, scope
queries by `ctx.agencyId`, and audit with `ctx.actorUserId`. Existing finance
summary remains a booking aggregate, not reconciled cash or a payout balance.
The reserved `agency:finance-manage` is not offered as a configurable executable
capability; the legacy transfer endpoint remains quarantined. New finance actions
must be implemented and registered before presenting new permission checkboxes.

Coordinate changes to `prisma/schema.prisma`, the agency policy/routes/service,
audit action registry, auth membership types and session cache. Finance work should
live in its own module/router; no ownership check based on `req.user.id`.

## Known boundaries / rollout

- Promotions, premium, complaints and review disputes still have H2's explicit
  legacy-OWNER integration gate. Their catalog labels disclose this. A configured
  permission does not bypass that gate. Tenant/actor integration is a separate
  prerequisite before opening those modules to other members.
- Agency settings still use the existing legacy-profile integration; no new
  agency-settings permission is advertised before that API is tenant-aware.
- Work-tour picker is capped at 200 operating tours. Larger agencies need server
  search/pagination before relying on it for all assignments.
- No real payout, payment mutation or frontend/backend deployment is included.
- Test migration upgrade uses synthetic pre-candidate data with six OWNERs; this
  is not a claim of having re-audited or migrated the six live Shared accounts.
- Browser visual acceptance remains pending when the browser connector is blocked.

Cutover order: synchronize code/migrations; verify exact target and pending set;
backup/checkpoint; pause agency/team/invitation writers; apply this additive
candidate on an isolated clone; verify IDs/row fingerprints/constraints; then
obtain approval for Shared deployment. Deploy code only after migration succeeds.
For rollback prefer reverting application traffic to the previous compatible
build while retaining new tables/columns. Do not drop templates/overrides/scopes
once users have configured them; recover from the checkpoint only with an
explicitly reviewed business-data recovery plan.

## Verification results — 12 November 2026

- Backend targeted unit: **30/30 PASS** (agency policy and notification policy,
  scope and service). No full-suite rerun.
- Isolated PostgreSQL integration: **20/20 PASS** across two files. Covers fresh
  history replay, populated pre-candidate upgrade, six synthetic OWNERs, unchanged
  business fingerprints, custom roles, overrides, tenant isolation, delegation
  limits, invitation acceptance/revocation of inviter authority, scoped content,
  protected final OWNER and notification visibility.
- Targeted frontend: **51/51 PASS** across Team, Foundation session/selection,
  layout and sidebar tests. This is component/contract coverage, not browser QA.
- Prisma validation and backend/frontend TypeScript: PASS.
- Controlled **isolated Neon dev** deployment: applied only
  `20261113000100_agency_flexible_permissions` using Prisma `migrate deploy`.
  Exact endpoint guards checked both application and direct migration URLs.
  Pending set contained exactly that candidate; no failed migration existed.
- Dev post-check: 6 ACTIVE OWNERs, no agency without OWNER, 24 seeded roles, no
  membership missing roleId, and all **52 existing table fingerprints unchanged**
  after excluding only newly added mapping/version columns. Runtime resolution
  through `AgencyService.resolve` passed for all six dev OWNERs.
- Shared database: **NOT MODIFIED**. No backend/frontend deployment or Git push.
- Browser acceptance: **PENDING**. The browser connector fails before opening the
  page because the machine's Codex configuration contains an invalid `agents`
  value. Global configuration was not changed. Under Impeccable, visual review
  cannot be declared passed without valid desktop/mobile captures.
- Existing toolchain warnings remain: pg's forward-looking SSL mode/deprecated
  concurrent-query warnings, Vite config-loader warning, and an Ant Design
  notification deprecation. These were not suppressed or fixed outside scope.

Private local evidence: `.test-artifacts/agency-flexible-integration.json`,
`.test-artifacts/agency-member-frontend.json`, and
`.test-artifacts/flexible-member-dev-results.json`. No connection secrets or raw
invitation tokens are included in this report.
