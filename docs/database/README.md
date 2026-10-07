# Database Architecture

- PostgreSQL is the primary database.
- Prisma is the ORM.
- `prisma/schema.prisma` is the single source of truth for the database schema definition.
- Prisma Migrations are used: `prisma/migrations/` is committed, never edited after it is merged.

## Daily workflow

```bash
docker compose up -d                       # local PostgreSQL (docker-compose.yml), DATABASE_URL in .env
pnpm --filter backend db:migrate           # create + apply a migration after editing schema.prisma
pnpm --filter backend db:deploy            # apply existing migrations (CI / production / fresh clone)
pnpm --filter backend db:generate          # regenerate the Prisma client (also runs on pnpm install)
pnpm --filter backend db:studio            # browse the data
```

The generated client lives in `backend/src/generated/prisma` (git-ignored). Application code never imports it directly:
repositories use the shared `prisma` from `backend/src/config/database.ts`.

## Conventions

- Ids are UUIDs (`@db.Uuid`). Money is whole VND (`Int`); the PayOS order code is `BigInt`.
- Enums mirror `packages/constants` and the module `*.types.ts` files; `prisma-enums-in-sync.test.ts` fails if they drift.
- Embedded data became rows when it is queried or changed on its own (departures, guide assignment, profiles, messages)
  and flat columns when it is a snapshot (booking contact, applied promotion).
- Polymorphic references (`Payment.referenceId`, `Report.targetId`) have no foreign key on purpose.
- Two partial unique indexes cannot be written in `schema.prisma` and live in the init migration SQL:
  one PENDING payment per (purpose, referenceId) and one PENDING subscription per (user, plan).
- PostgreSQL has no TTL indexes: expired OTPs / refresh tokens and notifications older than 180 days are removed by
  the jobs in `backend/src/jobs/maintenance.ts`.
- User-supplied search text goes through `backend/src/utils/search.ts` (escapes `%`, `_`, `\`).

## Tests

Integration tests start an embedded PostgreSQL by themselves (no Docker): one server per run, one database per test
file cloned from a migrated template (`backend/src/test/global-setup.ts`).

## Design reference

`prisma/schema.prisma` above is what the application runs. Two design artifacts sit beside it:

- **[`scope/`](scope/README.md)** — the schema **re-cut to the implemented scope**: 29 tables + 1 join table + 21 enums,
  matching `prisma/schema.prisma` one to one. Part 1 of `scope/tripin.sql` is the exact DDL Prisma emits; part 2 adds
  what Prisma cannot express (49 foreign keys, 36 CHECKs, 26 indexes, 7 `NOT NULL`, 16 `updatedAt` triggers), so every
  difference from the running database is deliberate. `scope/preflight.sql` checks existing data before anything is
  applied. This is the artifact to audit Prisma against — ADR
  [`adr/0005-recut-design-to-scope.md`](adr/0005-recut-design-to-scope.md).
- **[`design/`](design/README.md)** — the earlier **marketplace vision** (56 tables: hotels, transport, self-assembled
  itineraries, guide slots). Historical only: 30 of its tables are outside the current scope and 10 models the app runs
  are missing from it, so it is **not** a superset and must not be used as a target schema. ADR
  [`adr/0004-single-postgres-store.md`](adr/0004-single-postgres-store.md) records the move to one PostgreSQL store.

Neither is applied by Prisma and neither is a Prisma schema. Never copy either SQL file into `prisma/migrations/`; a
change to the running schema goes through Prisma migrations.
