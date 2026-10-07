# 0005 — The design is re-cut to the implemented scope

**Status:** Accepted · **Date:** 2026-10-07 · **Relates to:** 0004 (one PostgreSQL store)

ADR 0004 merged the two data stores into one PostgreSQL schema, but kept the design at the size of the
marketplace vision in `CONTEXT.md`: 56 tables covering hotels, transport, self-assembled itineraries and
guide slots. Measured against the use-case diagram, that design turned out to be **both larger and
smaller** than what the code does — 30 of its tables have no place in the current scope, and 10 models
the application runs are missing from it entirely (see
[`../design/README.md`](../design/README.md#61-đối-chiếu-với-phạm-vi-đang-code)). We decided to re-cut
the design so that it matches the implemented scope, and to keep the marketplace version as history.

## What was decided

- The authoritative design is now [`docs/database/scope/`](../scope/README.md): 29 tables + 1 join
  table + 21 enums, matching `prisma/schema.prisma` one to one.
- The 56-table marketplace design moves to being a **historical document** under
  [`docs/database/design/`](../design/README.md). It is not a target schema and must not be used as one.
- The re-cut is expressed as the exact DDL Prisma emits (byte-for-byte, minus the `pg_dump` preamble)
  plus an explicit additions section, so that **every difference from the running database is
  deliberate and countable**. The diff is verified mechanically and reported in the folder README.

## Why express it that way

Hand-writing a "clean" DDL would have produced a document that differs from reality in dozens of
cosmetic ways (type spellings, default expressions, index order), which would bury the differences that
matter. Keeping Prisma's own output as part 1 means a diff against a database built from
`prisma/migrations/` shows *only* the intended additions. That property is what makes the artifact
usable as an audit rather than as another opinion.

## Consequences

- The audit found that the running database is much weaker than the Prisma schema suggests:
  **11 foreign keys instead of 60**, **0 CHECK constraints**, **26 foreign-key columns with no index**,
  7 `text[]` columns that are nullable although the code assumes arrays, and no `updatedAt` trigger
  anywhere. Most seriously, `Booking` has **no foreign key at all** — `travelerId`, `agencyId`, `tourId`
  and `departureId` are bare `uuid` columns, so a booking can reference a tour or a departure that does
  not exist without the database objecting. Referential integrity is currently enforced by application
  code only.
- [`preflight.sql`](../scope/preflight.sql) checks existing data for the three constraint groups that
  can be blocked by it (orphan references, rows violating a CHECK, `NULL` arrays) before anything is
  applied. It is read-only.
- Adding these constraints to the application is a normal Prisma migration containing part 2 of
  `tripin.sql` — **not** a copy of the whole file. Two constraints need a data check first: the
  `MIN_PAYABLE_AMOUNT` booking floor (only enforced since D-74) and the seven `SET NOT NULL`.
- The vision design keeps its value as a record of where the product could grow (hotels, transport,
  itineraries, guide slots) — which is exactly the material for a future ADR if the scope is widened.
