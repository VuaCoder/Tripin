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
