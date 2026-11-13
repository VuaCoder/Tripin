# Controlled migration lab

This lab uses a new, persistent loopback-only PostgreSQL cluster for each run.
It never resets/drops a database, deletes test artifacts, changes `.env`, or
repairs an existing migration ledger. Original migration files are hashed before
and after testing. H2 now tests the actual application migration chain, including
the six `20261112*` migrations. The SQL candidate files remain reference fixtures
from the earlier 52-check experiment; they are not a second deployment chain.
Shared deployment requires explicit application cutover approval.

Run from the repository root:

```powershell
node backend/migration-lab/run.cjs
```

H2.7 offline mode (no Neon connection, no migration-history investigation or
baseline experiment):

```powershell
node backend/migration-lab/run.cjs --snapshot .test-artifacts/migration-lab-3KIFRE/source-private-snapshot.json --foundation-only
```

The snapshot is a private, ignored H2.6 artifact; supply an equivalent retained
pre-H2 lab snapshot on another machine. Do not add snapshots or credentials to Git.
This mode tests fresh history, existing clone, rollback and a two-connection
committed migration-window scenario. The baseline experiment is skipped.
H2.7 adds a guard before Foundation and a release after Legacy Onboarding plus
notification scope. These are new migrations, not edits of existing artifacts.

The source connection is loaded only for a read-only, repeatable-read snapshot.
Every write and Prisma deployment uses an explicit loopback URL and a database
created by this run. Snapshots contain private data and remain under the ignored
`.test-artifacts/migration-lab-*` directory. Do not commit them. PostgreSQL is
stopped at the end; its data directory is retained.

Scenarios:

1. Deploy the unchanged repository history into an empty local database.
2. Restore a source catalog/data snapshot into a separate local database and
   deploy the actual forward migrations through Prisma.
3. Generate an experimental baseline from the live catalog, deploy it into an
   empty local database and compare its catalog to the source. No existing
   ledger is marked resolved or baselined.

The lab also checks a transactional DDL rollback on a fourth restored database,
validates the generated target Prisma schema, and requires an empty Prisma
schema diff after forward reconciliation. The rollback test uses the actual
six H2/H2.7 SQL artifacts, including the legacy-onboarding triggers.
See `docs/database/agency-multimember/MIGRATION_LAB_RESULTS.md` for results and
remaining application/deployment gates.

The snapshot exporter rejects unsupported table features rather than silently
claiming a full clone. This is a logical clone of the public application schema,
not a backup of Neon roles, extensions, compute configuration or storage.

`h2-smoke.mts` exercises the real Express app, Prisma, JWT refresh and OTP using
persistent synthetic fixtures in the fresh DB. Google identity and mail transport
are mocked in memory: no external provider call or delivery is made. Six real
legacy OWNER backfills are checked on the clone; six synthetic known-password
legacy accounts are used for credential-login tests (not the real credentials).
Passing never grants permission to deploy to shared Neon. See H2_IMPLEMENTATION.md.

`h27-smoke.mts` adds real-DB/API notification revocation, inbox isolation, email
outbox recipient checks, transactional fanout and the quarantined legacy transfer.
