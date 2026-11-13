# H2.8 — Local migration and shared deployment gate

Date: 2026-11-12. Tested commit: `84d6c3ecd8db4fc2bd0f39ff9b6c154f352d9c7d`.
Branch: `feature/agency-accounting`.

## Decision

- PHASE 1 LOCAL: **PASS** on isolated PostgreSQL.
- PHASE 2 NEON SHARED PREFLIGHT: **FAIL / NO-GO** due to unresolved history drift.
- PHASE 3 SHARED MIGRATION: **NOT RUN**.
- PHASE 4 SHARED POST-MIGRATION VERIFICATION: **NOT RUN** because there was no shared deployment.
- **SHARED DEPLOYMENT: PENDING MIGRATION HISTORY RECONCILIATION.**

The stop rule was applied. No shared migration, ledger mutation, migration
resolve, reset, historical SQL edit, data repair, checkpoint creation or deploy
was attempted. No frontend/manual business tests were performed.

## 1. Local migration results

HEAD exactly matches the requested commit. All 29 migration SQL files and
migration_lock.toml are committed. No migration file is missing or modified in
the working tree. The pre-existing untracked tripin-pr61-resolve scratch tree
was not touched. No application/schema/migration source changes were needed.

The committed lab was rerun with an archived pre-H2 read-only H2.6 snapshot,
using a new loopback-only persistent PostgreSQL cluster. The clone is a logical
public-schema/data restore, not a fresh full-infrastructure backup of current
Neon. Its snapshot predates the shared preflight; local PASS must not be read as
certification that every current shared row/catalog object is identical.

| Check | Result |
|---|---|
| Fresh history deploy, 29 migrations | PASS |
| Existing snapshot clone forward deploy | PASS |
| Database lab: schema, indexes, constraints, window, rollback | 53/53 PASS |
| API/auth/OTP/2FA/refresh/RBAC suite | 41/41 PASS |
| Notification revocation and legacy transfer quarantine | 26/26 PASS |
| Additional owner/PK/FK/delete/unique/data-integrity checks | 13/13 PASS |
| Backend unit tests | 763/763 PASS |
| TypeScript noEmit | PASS |
| Prisma schema validation and schema diff | PASS; fresh/clone diff exit 0 |
| Prisma migrate status | Fresh/clone both up to date |

Additional SQL verification confirmed:

- Six original AgencyProfile mappings retain id=userId and their original ACTIVE OWNER.
- No agency in the clone is missing an ACTIVE OWNER; no duplicate membership.
- AgencyProfile primary key is id; legacy userId uniqueness remains enforced.
- All 13 FKs referencing AgencyProfile are validated RESTRICT / NO ACTION.
- Notification agency scope index exists; the main lab verifies all indexes ready/valid.
- Deleting a synthetic AgencyProfile with an OWNER or its legacy User is rejected,
  SQLSTATE 23001. Duplicate legacy userId and membership are rejected, SQLSTATE 23505.
- Negative tests run inside a rolled-back transaction. No fixture or ledger change
  remains from these additional tests. The main API fixtures are retained only in
  the separate fresh test database, never in the cloned historical-data comparison.

The extra verification launcher initially hit Windows pg_ctl restricted-token
startup error 87. Retrying with the same direct postgres.exe launch technique
used by the committed lab succeeded; all 13 checks then passed. This was a local
tool-launch issue, not a failed migration. No SQL artifact was changed.

## 2. Actual local migration execution

Fresh: all 29 committed migrations ran through Prisma migrate deploy in an empty
local database. Full names are recorded in fresh-history.log and the retained
history directory. Clone: these seven migrations ran normally against its restored
ledger; original cloned ledger rows were not edited:

1. `20261110000000_subscription_expiring_soon`
2. `20261112000000_agency_calendar_index`
3. `20261112000050_agency_onboarding_guard`
4. `20261112000100_agency_multimember_foundation`
5. `20261112000200_agency_legacy_onboarding`
6. `20261112000300_agency_notification_scope`
7. `20261112000400_agency_onboarding_release`

Separate local rollback and committed-window databases rehearse the six H2/H2.7
candidate SQL artifacts, including two-connection insert blocking and safe release.
No shared migration ran: **zero**.

## 3. Local data integrity comparison

All 50 original non-ledger tables have equal before/after row counts and row
fingerprints. Only the new AgencyProfile.id and nullable Notification.agencyId
are excluded from legacy-field fingerprints. Original ledger rows are checked
separately; normal local Prisma deploy appends new migration rows.

| Table | Before | After | Original fields unchanged |
|---|---:|---:|---|
| AgencyProfile | 6 | 6 | yes; new ID mapping verified separately |
| User | 49 | 49 | yes; original roles and credential fields preserved |
| Tour | 32 | 32 | yes |
| Booking | 30 | 30 | yes |
| Payment | 24 | 24 | yes |
| RefundLedger | 0 | 0 | yes; no historical rows existed to exercise refund-row preservation |
| Review | 271 | 271 | yes |
| ETicket | 10 | 10 | yes |
| Notification | 150 | 150 | yes; historical agency scope remains null |

Historical orphans and the eight booking/tour agency mismatches were not repaired.
Their rows remain covered by the unchanged fingerprints. The six real OWNER
backfills are verified on the clone; password login tests use six synthetic owners,
not the real users' credentials.

## 4. Neon shared preflight

Checked at `2026-11-12T10:34:56.605Z` (17:34:56 Asia/Saigon).
The existing unpooled environment connection was used; the URL and credentials
were not printed. Identity was returned by read-only SQL:

- Project ID: `super-darkness-97500515`.
- Branch ID: `br-wild-dawn-b3khbmd0`.
- Endpoint ID: `ep-wild-king-b31i00f1`.
- Database: `neondb`, role: `neondb_owner`.
- Human-readable branch name was not looked up; technical branch ID is verified.
- All connections forced default_transaction_read_only=on; the SQL inspection
  transaction was explicitly REPEATABLE READ READ ONLY.

Prisma migrate status returned exit 1, reporting different local/database history.
The ledger contains 27 rows: 25 successful and two rolled-back attempts, with no
unfinished migration. The full names and SHA-256 values for all 31 distinct local
or successfully applied names are recorded in h28-shared-preflight.json.

### Applied on shared, absent from the local repository

1. `20261007000000_add_user_avatar_public_id`
2. `20261111000000_agency_calendar`

### Checksum differences in actual content

1. `20261021200000_promotion_system_enhancements`
2. `20261104140000_toan215_security_refund_chat`

### Checksum differences reproducible by LF/CRLF conversion

1. `20261018010000_tour_detail_policies`
2. `20261018020000_review_images`
3. `20261024000000_ai_message_read_state`
4. `20261025090000_premium`
5. `20261110000000_subscription_expiring_soon`

These five differences are classified, not ignored or automatically repaired.
Two missing artifacts and seven checksum differences mean the history gate FAILS.
No artifact recovery, baseline operation or ledger reconciliation was attempted.

### Exact shared pending list (not executed)

1. `20261112000000_agency_calendar_index`
2. `20261112000050_agency_onboarding_guard`
3. `20261112000100_agency_multimember_foundation`
4. `20261112000200_agency_legacy_onboarding`
5. `20261112000300_agency_notification_scope`
6. `20261112000400_agency_onboarding_release`

subscription_expiring_soon is already applied on current shared, unlike the
archived local clone. This is why the clone ran seven pending migrations while
shared currently has six. H2.8 did not apply that migration on shared.

### Remaining operational gates

- No active migration-like statement, database advisory lock or unfinished ledger
  entry was observed at inspection time. This is an observation, not a concurrency
  guarantee for a later deployment.
- No active AgencyProfile writer candidate was observed. This does NOT establish
  a writer freeze or drain across every application/worker and team member.
- No confirmation exists that all teammates completed/pushed their migrations.
- No new recoverable shared checkpoint was created or verified: stopped at the
  failed history gate. The retained local snapshot is NOT a current shared backup.
- Local transactional DDL rollback passed, but a shared post-commit recovery plan
  and restorable checkpoint still require verification before deployment.

## 5. Shared post-migration verification

Not applicable: shared migration was blocked. Read-only preflight still found no
AgencyProfile.id, AgencyMember or AgencyInvitation on shared. Current observed
counts were AgencyProfile 6, Tour 32, Booking 30, Payment 24, RefundLedger 0.
These counts are observations, not a shared before/after fingerprint proof.
No post-deployment backend/login success is claimed; the diagnosed new-code /
old-shared-schema login incompatibility therefore remains unresolved.

## 6. Evidence and next authorized step

Ignored artifacts under `.test-artifacts/migration-lab-1ZKu9E/`:

- report.json; fresh-history.log; lab_fresh-status.log; lab_clone-status.log.
- h2-smoke.log; h27-smoke.log; h28-additional-verification.json.
- h28-shared-preflight.json; h28-shared-migration-status.log.
- `.test-artifacts/h28-unit.json` contains the backend unit result.

Local PostgreSQL was stopped; its data and private snapshot artifacts were
retained. Do not commit or distribute private snapshots.

Next: synchronize teammates' migration artifacts and obtain an explicitly
reviewed reconciliation plan, without altering applied SQL or forcing the ledger.
Then repeat current-clone rehearsal and shared preflight, confirm an all-writer
onboarding freeze, create/verify a restorable shared backup/checkpoint and approve
post-commit recovery. Only a complete PASS permits the future shared deploy.
