# H2.7 — Foundation hardening, isolated database candidate

Date: 2026-11-12. Branch: `feature/agency-accounting`.

## Decision

- **DATABASE CANDIDATE READINESS: GO on the isolated PostgreSQL environment.**
- **SHARED DEPLOYMENT: PENDING MIGRATION HISTORY RECONCILIATION.**
- Migration History Reconciliation is **DEFERRED by request**, not a failed
  code-remediation task. No further provenance investigation, artifact recovery,
  baseline construction, ledger repair or shared status check was performed.
- This is not release, merge-to-shared, or production approval. No frontend,
  browser or UI tests were performed. No real payout was implemented.

## Changes and security contract

### Migration-window protection without changing existing migration files

The original three H2 candidate SQL artifacts and all previously tracked
migrations are unchanged. Three new migrations produce this ordering:

1. `20261112000000_agency_calendar_index` — unchanged H2 artifact.
2. `20261112000050_agency_onboarding_guard` — NEW: BEFORE INSERT guard on
   AgencyProfile, always raises SQLSTATE 55000 while the transition is pending.
   Trigger installation takes the table lock and waits for existing writers.
3. `20261112000100_agency_multimember_foundation` — unchanged H2 artifact.
4. `20261112000200_agency_legacy_onboarding` — unchanged H2 artifact.
5. `20261112000300_agency_notification_scope` — NEW: nullable Notification.agencyId,
   FK to AgencyProfile.id (RESTRICT / NO ACTION) and (agencyId,userId) index.
6. `20261112000400_agency_onboarding_release` — NEW: verifies enabled legacy
   triggers, legacy identity equality and ACTIVE OWNER mappings before dropping
   the temporary guard.

This closes the inter-migration commit window without merging or rewriting SQL
history. Existing reads and profile updates can continue; profile creation is
temporarily unavailable and must be retried after successful release. Failed
Foundation/onboarding/release leaves the guard installed: fail closed. It is
not a zero-downtime onboarding rollout. Operationally freeze/drain onboarding
requests and communicate the temporary outage; do not remove the guard by hand.
The rehearsal starts from the retained pre-H2 source, not a partially migrated
shared database. A shared preflight must confirm the same preconditions later.

### Agency notification recipients and inbox authorization

- Explicit `notifyAgency(agencyId, ...)` replaces organization-as-User recipients
  in Booking, Tour, Review, Report, Complaint and agency verification flows.
- Transactional review moderation/triage uses `writeAgencyNotification(tx, ...)`.
  Agency name is read from AgencyProfile, not User.id=agencyId.
- Only ACTIVE memberships and ACTIVE users with the matching role permission
  receive new scoped rows. No legacy owner fallback, including when global role
  is AGENCY. Booking events use booking-view, complaint events complaint-respond,
  review/report events review-dispute, tour events tour-update-own, and agency
  verification team-manage (OWNER).
- New organization rows carry Notification.agencyId. List/count/read/read-all/
  delete recheck membership and role; old JWTs cannot access these rows after
  suspension/removal or role downgrade. DTO adds optional agencyId so clients
  can identify the originating organization.
- Socket publication rechecks under the agency lock. Agency emails are encrypted
  durable outbox entries, not an immediate personal-email fallback. The outbox
  rechecks status and permission under the same agency row lock as team mutation.
  A send already in flight can complete before suspension commits; a send cannot
  start after that committed membership revocation. Enable mail.deliverOutbox.
- Revoked queued entries remain retained and unsent. No historical notification
  was rewritten: existing rows retain null agencyId and their personal inbox
  semantics. This does not retroactively revoke already-delivered mail/socket
  content or classify old unscoped notifications. If retrospective classification
  is required, it needs a separate reviewed data policy, not a silent backfill.
- Existing at-least-once mail retry semantics remain: provider delivery followed
  by a DB commit failure can produce a retry. Provider idempotency and revocation
  queue retention/cancellation policy remain follow-up operational work.

### Legacy transfer quarantine

`POST /api/v1/earnings/payouts/:id/transfer` resolves AgencyContext, requires ACTIVE
membership, VERIFIED agency and OWNER finance-manage, validates input, then
returns **410 LEGACY_TRANSFER_QUARANTINED** without calling recordTransfer.
Missing authentication returns 401; inactive/foreign membership and insufficient
permissions return 403. An authorized foreign-tenant OWNER also only receives
quarantine: no ledger lookup, mutation or existence disclosure occurs. Global
AGENCY and extra tour permissions cannot bypass the quarantine. Guide read-only
earnings endpoints remain unchanged. Re-enabling transfers requires a separate
approved finance flow with agencyId and actorUserId audited independently.

## Verification

The retained H2.6 read-only snapshot was reused offline. H2.7 did not connect to
Neon. Every mutation used a newly created persistent loopback PostgreSQL cluster;
no reset, DROP DATABASE, TRUNCATE, historical-data repair or manual ledger update.
New local Prisma migration executions append their normal ledger entries; original
cloned ledger rows are compared and remain identical. Servers were stopped and
private artifacts retained under ignored `.test-artifacts/`.

| Suite | Result |
|---|---|
| Database lab, fresh + existing clone + rollback + committed window | 53/53 PASS |
| H2 real Express/Prisma auth, JWT refresh, OTP/2FA, Google mock, RBAC | 41/41 PASS |
| H2.7 real PostgreSQL/API notification and quarantine regression | 26/26 PASS |
| Backend unit suite | 763/763 PASS |
| Prisma generate / validate and target schema diff | PASS; fresh/clone diff exit 0 |
| Backend TypeScript, `tsc --noEmit` | PASS |
| Working-tree `git diff --check` | PASS |
| Staged whitespace check | One existing blank EOF line in the unchanged H2 calendar-index artifact; retained to preserve artifact bytes |
| All 26 SQL artifacts present at H2.6 versus their saved hashes | Unchanged |

Primary evidence: `.test-artifacts/migration-lab-da8Lxi/report.json`,
`h2-smoke.log`, `h27-smoke.log`, and `.test-artifacts/h27-unit.json`.
Snapshots, database files and private data are not Git artifacts.

The two-connection window tests demonstrate that guard installation waits for
existing profile writers; after each actual committed guard/Foundation/onboarding
boundary a second connection cannot insert a profile; after committed release
the same insert yields id=userId and exactly one ACTIVE OWNER. Separate tests
exercise full transactional DDL rollback, duplicate membership/invitation and
orphan rejection, valid indexes/FKs/constraints, notification transaction rollback,
role downgrade, socket filtering, deferred email revocation and concurrent email
delivery versus membership suspension. Transfer probes retain a real synthetic
ledger in PENDING and create zero transfer audit records.

Two development harness issues were found and corrected: a reserved savepoint
name, and transfer route audit metadata/input validation after initial quarantine.
Final suites have no remaining failure. The conventional reset/drop integration
harness was not executed; relevant real-DB behavior is covered by the persistent
lab suites instead. The payout integration source expectations were updated to
the quarantine contract, but that separate harness is not claimed as passed.

## Preservation

Clone checks confirm all six original AgencyProfile IDs equal the historical
User IDs and retain the matching ACTIVE OWNER, without changing global role,
password hash or other original User fields. Original business row counts and
fingerprints are unchanged, excluding only added AgencyProfile.id and nullable
Notification.agencyId. In the retained source this includes 32 Tours, 30 Bookings,
24 Payments, 10 ETickets and 271 Reviews. Existing mismatched bookings and orphan
records remain unchanged; no new identity/composite FK was added to disguise
those issues. The new notification FK accepts historical null scopes.

The six actual owner backfills are checked on the clone. Credential-login tests
use six synthetic known-password legacy owners; no real owner password was used.

## Commit completeness and remaining gates

The Foundation commit includes schema, all six new migrations, AgencyContext,
AgencyMember/Invitation service/routes/policy, auth/refresh/OTP adaptations,
legacy-owner fail-closed guards, integrated Tour/Booking/dashboard controllers,
notification hardening and policy, transfer quarantine, constants/types, tests,
lab launcher/fixtures and API/handoff documentation. Generated Prisma output,
`.env`, private snapshots and the user's `tripin-pr61-resolve/` scratch tree are
excluded. Use `git show --stat HEAD` for the exact committed manifest.

There is no remaining blocker for the scoped **isolated database candidate**.
Shared deployment remains pending repository synchronization, explicit migration
history reconciliation and deployment approval. Existing H2.6 integration gates
outside this remediation remain: unconverted promotions/premium/complaint/report
management is ACTIVE legacy-OWNER-only; product must settle finance-field
redaction in booking DTOs and Google/remember-me MFA policy before broad tenant
cutover. Global account-ban/last-OWNER recovery and member timestamp maintenance
also remain follow-up work. These do not change the isolated SQL preservation
result or turn DEFERRED history work into a failed H2.7 remediation.

After repository sync and separate approval: rehearse the finalized complete
migration chain again on a current isolated clone, approve backup/recovery and
onboarding outage plan, deploy database before this new backend, run owner/data
postchecks, then enable new backend/team features gradually. A partial failure
must keep onboarding quarantined. Transaction rollback is tested before commit;
after committed migrations use an approved fix-forward/recovery plan. Do not
roll back to a global-role-authorizing old backend after member revocations or
independent agencies have been enabled, and do not rewrite the migration ledger.
