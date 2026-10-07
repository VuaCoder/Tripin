# 0004 — One PostgreSQL store, no MongoDB

**Status:** Accepted · **Date:** 2026-10-06 · **Supersedes:** `0001-split-data-stores`
(originally at `~/Work/tripin/docs/adr/0001-split-data-stores.md`)

Tripin started as an all-NoSQL design, then split into two stores: PostgreSQL for booking,
inventory, trips, payments, payouts and itineraries, and MongoDB for content, catalogue,
reviews and notifications (ADR 0001). We decided to **put everything in one PostgreSQL
database and drop MongoDB entirely**.

## Why the split is no longer worth it

ADR 0001 kept content in NoSQL because content "does not need" the guarantees Postgres
gives. That reasoning held for the *shape* of the data, but not for the cost:

- **The content tables are relational.** Every one of them points at a Postgres row:
  `REVIEW.bookingId → BOOKING`, `WISHLIST.productId → PRODUCT`, `PRODUCT_CONTENT.productId`,
  `TICKET.userId`, `REPORT.reporterUserId`, `PRODUCT.zoneId → ZONE`. Mongo could only hold
  those as unenforced strings, so a deleted booking left orphan reviews and nothing noticed.
  Merging turns 17 of those references into real foreign keys: the 4 the old DBML already
  declared as logical, plus 13 columns that pointed at a Postgres row from Mongo with no
  constraint at all.
- **`PRODUCT.zoneId` could not be a foreign key at all** while `ZONE` lived in the other
  store. The two-store boundary cut straight through the catalogue.
- **Two stores must be kept in sync**, which was the accepted cost in ADR 0001. In practice
  it means every read of a product joins across two systems in application code, and every
  write has to decide what to do when the second write fails.
- **The split gave no availability benefit.** Both stores were required for the product to
  work at all, so neither could be taken down independently.
- The content collections carried `$jsonSchema` validators, unique indexes and ordinary
  indexes — i.e. the same constraints Postgres offers, reimplemented with weaker semantics
  (`validationAction: 'warn'` does not reject a bad write).

## Considered Options

- **Keep the split (ADR 0001).** Rejected: the boundary runs through the middle of the
  catalogue (`PRODUCT.zoneId`), and the content tables are relational by nature.
- **Move the transactional core to NoSQL.** Rejected again, for the reasons ADR 0001 already
  gives: no range exclusion for itinerary overlap, weaker multi-document transactions, no
  foreign keys, hard reconciliation between booking, payment and payout.
- **One PostgreSQL store.** Chosen.

## Consequences

- The schema is `docs/database/design/tripin.sql` (56 tables, 24 enums, 73 foreign keys) with
  `docs/database/design/tripin.dbml` as the diagram and `docs/database/design/seed.sql` as
  sample data. It is a **design artifact**; the schema the application runs is
  `prisma/schema.prisma` (see below).
- MongoDB artifacts are gone: no `mongo/docker-compose.yml`, no `mongo/init/01-init.js`,
  no mongo-express, no second store to reconcile.
- Content rows now obey the same constraints as everything else: `NOT NULL` from the old
  Mongo `required` lists, `UNIQUE` from the old Mongo unique indexes, and real foreign keys.
- Two things ADR 0001 could not express are now enforceable: the `SLOT` no-overlap rule
  (`EXCLUDE USING gist`, which needs `btree_gist` — the original DBML omitted the extension,
  so the rule silently did not exist) and `TRIP`'s unique index over nullable columns
  (`UNIQUE NULLS NOT DISTINCT`, PostgreSQL 15+).
- Polymorphic columns keep no foreign key on purpose: `REVIEW.targetId`, `REPORT.targetId`,
  `NOTIFICATION.refId`, `MODERATION_REQUEST.targetId`, `INVOICE.refId`, `CHAT_THREAD.refId`.
  `INVOICE.refId` lost the foreign key the original DBML declared, because that FK would have
  rejected every invoice whose `refType` is not `BOOKING`.
- The design artifact and the running schema are **not** the same model, and the design is **not a
  superset** of it. Measured against `prisma/schema.prisma`: 24 of the 56 tables have a counterpart
  (several folded into a single model), 2 survive only partially, and **30 have no place in the
  current scope at all** — hotel/transport marketplace (11), self-assembled itineraries and guide
  slots (7), payouts/invoices (5), infrastructure never built (7). In the other direction, **10
  models the application runs are absent from the design**: `Otp`, `RefreshToken`, `Category`,
  `SubscriptionPlan`, `Subscription`, `Promotion`, `ETicket`, `Earning`, `AiConversation`,
  `AiMessage` — i.e. the design omits use cases that *are* in the diagram. It was written for the
  marketplace vision in `CONTEXT.md` while the code follows the use-case diagram, and the two were
  never re-cut to match, so the design must not be used as a target schema. Unifying them is a
  separate change through a Prisma migration, not by copying this SQL into `prisma/migrations/`.
- Open items handed to the owner are listed in
  [`docs/database/design/README.md`](../design/README.md#điểm-cần-owner-chốt): 115 nullable
  columns to confirm, the `varchar` status columns that still need a value list, whether
  `BOOKING` should snapshot `policyVersion` (ADR 0003 says it should), and the
  `TRAVELLER` vs `travellerUserId` naming ambiguity.
