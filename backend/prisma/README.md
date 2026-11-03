# Prisma

The schema and migrations live at the repository root: `prisma/schema.prisma` and `prisma/migrations/`.
See `docs/database/README.md` for the workflow (`pnpm --filter backend db:migrate`, `db:deploy`, `db:generate`).

Money is stored as whole VND in `BIGINT` columns. Repository mappings expose checked, safe JSON numbers;
rates, quotas and participant counts remain `Int`. Shared business limits are 1 billion VND per tour/departure
unit price and 50 billion VND per booking (at most 50 participants), defined in `packages/constants/src/money.ts`.
Historical amounts are preserved; values above the new limits are not silently clamped.

For `20261103000000_expand_whole_vnd_storage`, first test against an isolated database containing existing data.
Use `DATABASE_URL_UNPOOLED` for deployment. `ALTER COLUMN TYPE` takes table locks and can rewrite data/indexes;
schedule a maintenance window and deploy the regenerated Prisma client and compatible backend together.
Run `pnpm --filter backend db:deploy` and `pnpm --filter backend db:generate` in that controlled deployment.
Do not narrow columns back to `INTEGER` after amounts beyond Int32 exist; roll forward with compatible code.
The integration test verifies all 16 columns, old amounts, nulls/defaults and writes above Int32.

Storage limits do not establish a PayOS/bank transaction limit. End-to-end tests use a fake provider;
the real channel's supported amount must be verified before treating high-value payments as supported.
