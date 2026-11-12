# Agency Multi-member: controlled migration results

Date: 2026-11-12 (Asia/Saigon). Branch: `feature/agency-accounting`.

## Decision

- **PASS: database candidate experiments, 52/52 checks.**
- **Ready to review/merge the isolated lab tooling.**
- **Not ready to merge/deploy the complete Multi-member feature.** Application
  authentication, agency context, tenant RBAC and business-module cutover have
  not been implemented or certified by this lab.
- **No shared/production deployment is authorized or performed.**

The successful run is `.test-artifacts/migration-lab-xRqTFj/report.json`.
The PostgreSQL cluster was stopped successfully; its data and logs are retained.
The retained source snapshot was captured in a repeatable-read, read-only Neon
transaction during this session. Subsequent runs reused that exact snapshot
offline. Results describe that snapshot, not a continuously changing live DB.

## Isolation and preservation

Every run initializes a new PostgreSQL cluster, listening on `127.0.0.1` on a
newly allocated port. All Prisma commands have explicit loopback datasource
URLs. The application `.env` and the application Prisma schema are unchanged.
No reset, truncate, database drop, seed, migration resolve, or manual ledger
repair is used. Source reads enforce `default_transaction_read_only=on` and
`REPEATABLE READ READ ONLY`.

The logical clone restores all public application tables, including the exact
original migration ledger rows. It compares row fingerprints and catalog
definitions against the snapshot. Prisma subsequently appends its normal
deployment records on the local clone; all original ledger rows are separately
verified unchanged. This is not a repair of shared migration history.

All 23 existing migration files remain byte-for-byte unchanged. Private source
rows, including authentication data, are confined to ignored local artifacts
and PostgreSQL storage. Do not publish the snapshot or database directory.

## Results

| Scenario/check | Result |
| --- | --- |
| Fresh database: deploy all 23 unchanged repository migrations | PASS |
| Current Prisma schema validation | PASS |
| Target candidate Prisma schema validation | PASS |
| Restore existing source schema and all rows | PASS |
| Restored catalog equals source catalog | PASS |
| Restored row fingerprints equal source, including ledger | PASS |
| Deploy reconciliation + Multi-member candidate on fresh DB | PASS |
| Deploy pending subscription enum + candidates on existing clone | PASS |
| Prisma migration status after candidate deployment | PASS on fresh/clone/baseline |
| Prisma datasource-to-target-schema diff | Empty on fresh/clone/baseline |
| OWNER backfill on existing clone | Exactly 6 ACTIVE OWNER memberships |
| Existing business rows unchanged | PASS, including all original User/profile/financial records |
| Original migration ledger rows unchanged | PASS |
| Tenant foreign keys to AgencyProfile | 12: ten business tables plus member/invitation |
| Orphan member/business insert rejected | PASS |
| Duplicate membership rejected | PASS |
| Traveler joins two independent agencies without changing global role | PASS at DB level |
| OWNER invitation rejected | PASS |
| Duplicate pending invitation rejected | PASS |
| All constraints validated / indexes valid and ready | PASS |
| Apply candidate in a transaction, then rollback | PASS |
| Catalog, all data and ledger restored after DDL rollback | PASS |
| Experimental baseline reconstructs source catalog on empty DB | PASS |
| Baseline + forward reconciliation + candidate reaches same target | PASS |

Local databases: `lab_fresh`, `lab_clone`, `lab_baseline`, `lab_rollback`.
No application API or real email/payment flow was invoked.

## Findings and forward reconciliation

The first schema comparison identified:

1. `GuidePayoutAccount.guideId` FK uses `ON UPDATE NO ACTION`, whereas the
   application schema leaves Prisma's update action implicit.
2. `GuidePayoutLedger.earningId` has the same difference.
3. Source DB has `TourDeparture_tourId_date_idx`; unchanged fresh history does not.

The reviewed test target explicitly preserves `NoAction` on the two payout
relations. A separate **new** reconciliation candidate creates the calendar
index if absent. It also declares that index in the generated target schema.
No historical SQL is changed to obtain the passing result.

The foundation migration staged for Prisma deployment is explicitly wrapped in
`BEGIN`/`COMMIT`; the runner does not assume Prisma wraps PostgreSQL migrations.
The separate rollback scenario exercises the same SQL inside an uncommitted
transaction and verifies full restoration of the original clone.

`backend/migration-lab/agency-foundation.sql` is the test candidate for:

- Backfill `AgencyProfile.id = userId` on existing profiles.
- Preserve unique legacy `userId`, switch the primary key to `id`.
- Make legacy userId optional and restrict deletion of its User.
- Add membership/invitation enums, tables and constraints.
- Backfill OWNER membership for the six existing agency accounts.
- Add ownership FKs to the ten agency-scoped business tables.

This is a final key-transition candidate, not an online rolling-upgrade plan.
The current application still treats User IDs as agency IDs. Before deploying,
split/release the expand, compatibility-write, backfill and contract phases as
required by the application cutover. Do not copy this candidate into the shared
migration chain and deploy it on its own.

## Baseline assessment

The generated experimental baseline reproduces the source public catalog,
including enums, columns/defaults, FK/unique/check constraints, standalone and
partial indexes, application functions and triggers. It is deployed only into
an empty local database; an existing ledger is never marked baselined/resolved.

This proves that a catalog baseline is technically feasible. It does not recover
the SQL of the two missing migration artifacts or erase the historical checksum
differences. A green `migrate deploy/status` on the clone also does not certify
that this historical provenance has been repaired.

Recommendation: continue feature work using this isolated lab. Review baseline
adoption as a separate delivery: archive old artifacts/ledger evidence, establish
an approved immutable baseline, verify a clean install and an existing clone,
and define how each existing environment adopts it. Review reference-data
initialization separately; a catalog-only baseline contains schema, not the
data inserts from the old migration chain. Never rewrite ledger checksums just
to hide drift.

The exporter deliberately rejects sequences, views/materialized views, foreign
tables, partitions, RLS tables, identity/generated columns and unusual trigger
enablement. This run passed those guards. It is a public-schema logical clone,
not a backup of roles/ACLs, installed extensions, database-wide configuration,
Neon infrastructure or all possible PostgreSQL features. Audit any new feature
before extending this exporter, or use a standard pg_dump-based clone.

## Remaining gates

- Missing history artifacts and old checksum differences still need a governed
  reconciliation/baseline decision, but do not block isolated development.
- Existing orphan identities/review bookings and the eight historical agency
  mismatches are preserved. No FK that would reject those records was added.
- HTTP login/2FA/Google, invitation acceptance and membership revocation need
  application implementation and integration tests.
- Last-active-OWNER protection and concurrent ownership changes need service
  transaction tests; the candidate does not claim to enforce them by itself.
- Tenant request context, cache isolation, notifications/audit actors and
  financial permissions must be implemented before application cutover.
- Finance transaction/payout models and bank reconciliation are outside this
  foundation experiment; no finance deployment is certified.
- Transaction rollback was exercised before commit. It is not proof that an
  old application can safely return after new independent agencies/members have
  been created. Keep a tenant-aware rollback release for that stage.

## Reproduce

From the repository root:

```powershell
node backend/migration-lab/run.cjs
```

To repeat against the same captured snapshot without reconnecting to Neon:

```powershell
node backend/migration-lab/run.cjs --snapshot .test-artifacts/migration-lab-v9glXK/source-private-snapshot.json
```

Each invocation creates another independent cluster and preserves all previous
runs. No successful result in this document grants permission to migrate the
shared Neon database.
