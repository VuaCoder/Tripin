# Cart (P2) — end-to-end walkthrough

Browser evidence for the traveler cart, captured with `playwright-cli` against a **local** stack
(Postgres 16 on `:5433`, backend `:3001`, frontend `:3000`). Nothing here was run against the Neon
production branch that the repo `.env` points at: `DATABASE_URL` was overridden per command, which
wins because `dotenv` does not replace an already-set variable.

## Fixtures

Seeded through SQL so the run is reproducible: one agency (`VERIFIED`) and five tours — four
`APPROVED` and one `DRAFT` that must never be discoverable. `Đà Nẵng – Hội An` carries four
departures chosen to hit each branch: one healthy, one sold out (`remaining = 0`), one in the past,
and one with a `priceOverride`.

## What was exercised

| Step | Expected | Observed |
| --- | --- | --- |
| Empty cart | empty state + no totals | ✅ `01` |
| Open "Thêm tour vào giỏ" | public tour list only | ✅ `02` — the `DRAFT` tour is absent |
| Pick a tour with no bookable departure | explanatory message, no add buttons | ✅ `03` |
| Pick a tour with seats | only open, future, `remaining > 0` departures | ✅ `04` — sold-out and past departures hidden; `priceOverride` shown |
| Add 2 guests | line + backend-computed totals | ✅ `05` — 9.000.000 ₫ |
| Add a second departure, raise head-count to the seat cap | `+` disables at `remaining` | ✅ `06` — 2 tours / 10 guests / 42.600.000 ₫ |
| "Đặt chỗ" | handoff carries the selection to the booking step | ✅ `07` — booking form prefilled, seat ceiling read from live data |
| Departure closed *while sitting in the cart* | line **kept** and flagged, never hidden; totals count only bookable lines | ✅ `08` — 1 unavailable, subtotal 33.600.000 ₫, "Đặt chỗ" disabled |
| Remove a line / remove the last line | row gone, empty state returns | ✅ DB row count followed the UI |

## Ownership

Checked over the API with a second traveler account:

- `PATCH /cart/items/:id` on somebody else's line → **404** `NOT_FOUND` (not 403, so ids are not confirmed)
- `DELETE /cart/items/:id` on somebody else's line → **204**, but a silent no-op: the owner's row survived

## Console

0 errors during the cart flow. The only errors on the login screen are pre-existing and unrelated:
`401` on `/auth/refresh` before a session exists, Google GSI rejecting the `localhost` origin, and a
missing `favicon.ico`.

## Test suites (same run)

- backend unit `src/modules/carts` — 15/15
- backend integration `src/modules/carts` — 5/5
- frontend `features/cart` — 19/19
