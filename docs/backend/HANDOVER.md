# Backend hand-over (backend)

> **Tóm tắt (VI):** toàn bộ backend cho 8 trang use case trong `TripRi.json` đã được dựng ở `backend` theo kiểu
> module-theo-tính-năng (MVC phân lớp), mỗi module có README riêng. Mọi thay đổi **chưa được commit** — nằm trong working
> tree để bạn xem lại. Phần cần bạn quyết định nằm ở mục 4; phần cần kiểm chứng với dịch vụ thật (PayOS sandbox,
> Anthropic, Google, SMTP) ở mục 5. Mục 7 liệt kê các lỗi thật mà test trên MongoDB thật đã tìm ra và đã sửa.

Written from the code, `PROGRESS.md` and `DECISIONS.md`; nothing here is a new claim. Frontend is out of scope.

## 1. What exists

| | |
|---|---|
| Feature modules | 22 working (`auth users audit system-settings categories tours promotions wishlists carts notifications bookings payments e-tickets reviews subscriptions earnings chat ai reports support moderation dashboards`) + 1 README-only placeholder (`custom-tours`, not in the use-case diagram, D-56) |
| Endpoints | 128 under `/api/v1` (+ Socket.IO on the same port for chat and live notifications) — list: `docs/api/ENDPOINTS.md` (generated), errors: `docs/api/ERRORS.md` |
| Use cases | All use cases of the diagram are `done` in `docs/backend/USE_CASE_MAP.md` (Guest, Traveler, Agency, Tour guide, Moderator, Super admin) |
| Code / tests | ~12.5 k lines of source, ~7.7 k lines of tests; 590 tests in 63 files (27 of the files run against a real PostgreSQL) |
| Structure | `modules/<feature>/{routes,validation,controller,service,repository,model,mapper,types}.ts + index.ts + README.md + __tests__/` — rules in `docs/backend/ARCHITECTURE.md` |
| Git | **Nothing was committed or pushed** (D-23). `git status` shows ~280 changed/new files for you to review |

## 2. Run and verify

```bash
pnpm install
cp .env.example .env           # minimum: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (>= 32 chars in production, different from each other)
docker compose up -d           # local PostgreSQL (or point DATABASE_URL at any PostgreSQL)
pnpm --filter backend db:deploy    # apply prisma/migrations
pnpm --filter backend seed         # needs SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD in .env for the first Super admin; idempotent
pnpm --filter backend dev          # http://localhost:3001/api/v1/health
pnpm --filter backend typecheck
pnpm --filter backend test         # unit + integration (an embedded PostgreSQL is started by the test run itself, no Docker)
pnpm --filter backend test:unit    # no database needed
pnpm --filter backend build && pnpm --filter backend start
pnpm --filter backend docs:routes  # regenerate docs/api/ENDPOINTS.md after changing a route (a test fails if you forget)
```

State at hand-over: typecheck clean; the last COMPLETE run was 590/590 green, after which one unit test was added (D-79) and the affected test files were re-run green, the database-free suite is 440/440 (the full suite is expected at 591 — run it once to confirm), `build` succeeds and the bundle was booted
with plain `node` by a test. Stability evidence: 5 consecutive green full runs after the last flake fix, 4 more after the fuzz was added,
2 after the soak test. A planned 10-run soak was stopped after run 1 because the machine ran out of memory (a full run starts ~25 `mongod`
processes) — repeat it on a machine with free memory before trusting CI timings. Earlier in the night a few isolated failures looked like
two test files sharing one database; every file now has a database of its own (D-77) and default timeouts were raised (D-78).

## 3. Where to read

1. `docs/backend/ARCHITECTURE.md` — layers, conventions, automated guard rails, checklist for a new feature.
2. `docs/backend/USE_CASE_MAP.md` — use case → module → endpoint.
3. `backend/src/modules/<feature>/README.md` — behaviour, rules, state machines, permissions, indexes, tests.
4. `docs/backend/DECISIONS.md` — every assumption taken instead of asking (D-1 … D-79). **Nothing is deleted from it.**
5. `docs/backend/PROGRESS.md` — what was done, in order, with the result of each step.

## 4. Decisions that are really yours (ranked by how much they change the product)

| # | Question | Current behaviour | Where / how to change |
|---|---|---|---|
| D-25 | Platform **commission** | 0 % until the Super admin sets it (`PUT /admin/settings/commission`); snapshotted into every booking | seed option `SEED_COMMISSION_PERCENT` or the endpoint |
| D-34, D-39, D-15 | **Payment window and refunds** | A booking holds seats 30 min; a late payment is accepted but only *flags* `refundRequired`; **no money is ever moved back** — refunds are a manual/offline process | `bookings.policy.ts`; a refund flow needs PayOS refund API + a state machine |
| D-18, D-44 | Does the **guide subscription gate anything**? | No — `hasActiveSubscription()` exists but nothing calls it; prices of the 2 seeded plans are illustrative | decide which guide features need an active plan, then guard them in `tours`/`chat` |
| D-19, D-45 | **Guide earnings** | Guide earns the fee the agency agreed when assigning (per COMPLETED booking, only if the guide ACCEPTED); no payout workflow | `earnings` module |
| D-26 | **Cancellation rules** | Traveler may cancel a CONFIRMED booking up to `cancellationWindowHours` (default 24) before departure; set by policy `cancellation` | `PUT /admin/policies/cancellation` |
| D-27, D-28 | Agency must be **VERIFIED** to submit tours; a tour needs a category and an open future departure | enforced in `tours.service` | |
| D-4 | **Staff accounts** | Moderators/Super admins cannot self-register: first Super admin from the seed, then "Assign User Permissions" | |
| D-13, D-46 | **Chat** is traveler ↔ guide only (agencies cannot chat yet) | one function decides the allowed pairs | `chat.policy` |
| D-43 | **Reviews** | only after COMPLETED, one per booking, immutable by the author, moderators can hide | |
| D-74 | **Free orders / minimum amount** | refused (`BOOKING_AMOUNT_TOO_LOW`, minimum 1 VND); no free-booking flow exists. PayOS likely has a higher minimum — set `BOOKING_POLICY.MIN_PAYABLE_AMOUNT` after checking the sandbox | `bookings.policy.ts` |
| D-11 | "Upload tours" = bulk JSON import (≤ 50) | | |
| D-56 | `custom-tours` is **not built** | README-only placeholder; a test fails if code or a route appears before you approve the feature. `carts` was approved and built in P2 (D-81) | |
| D-7, D-73 | **Google login** skips the app's own 2FA code and links to an existing account with the same verified email (a planted password on an unverified account is removed) | | `auth.service.loginWithGoogle` |

## 5. To verify against real services (cannot be proven offline)

| What | Why | How |
|---|---|---|
| **PayOS** signatures and payloads (D-40) | written from the public docs; only unit/integration-tested against a fake | create a PayOS sandbox channel, set `PAYOS_*`, do one real payment + webhook; check `canonicalize()` and the link-creation signature in `payos.provider.ts` |
| **Anthropic** request shape (D-20, D-49) | no key was available | set `AI_PROVIDER=anthropic`, `AI_API_KEY`, `AI_MODEL`; one chat call |
| **Google** ID-token verification | needs a client id | set `GOOGLE_CLIENT_ID`; the frontend sends the ID token to `POST /auth/google` |
| **SMTP** | without `SMTP_HOST` emails (OTP, notifications) are only logged — in production only recipient + subject (D-70), so nothing is delivered | set `SMTP_*` |
| Real data volume | query plans were checked with `explain()` on tiny data (D-71) | re-run `EXPLAIN_REPORT=plans.jsonl pnpm --filter backend test`, and look at slow queries once data exists |

## 6. Operational notes

* **Background jobs** run inside the API process (`src/jobs/maintenance.ts`): booking expiry/completion, payment expiry and
  retry, subscription expiry. They are compare-and-set sweeps, safe on several nodes, but each node repeats the work;
  set `JOBS_ENABLED=false` on nodes that should not run them (D-58).
* Multi-step rules are compare-and-set updates or verified after writing (D-61, D-66, D-72); a few use a short PostgreSQL transaction
  (tour departure edits, support/AI message append, tour update with guide removal). Rule of thumb: no transaction is held across a call to another module.
* The schema is created and changed ONLY by `prisma/migrations` (`pnpm --filter backend db:deploy` before starting a new version). Two indexes are partial and live in the migration SQL, not in `schema.prisma`: one open payment per target and one pending subscription per user+plan (D-80).
* The dashboards cache their answers for 30 s per process (D-53).
* CI needs nothing but Node: the integration tests start an embedded PostgreSQL (D-63, D-80).
* Refresh tokens: HttpOnly cookie scoped to `/api/v1/auth`; with `COOKIE_SAME_SITE=none` the cookie becomes `Secure`.
* Per-IP rate limits are on auth, report/ticket creation, chat messages, AI chat and the webhook; behind a proxy `trust proxy` is set to 1 in production only.

## 7. Real defects the integration tests found (all fixed, each with a regression test)

| Area | Defect | Decision |
|---|---|---|
| Tours inventory | cancelling/expiring a booking **never gave the seats back** (Mongoose 9 refuses pipeline updates without `updatePipeline: true`) | D-64 |
| Payments / subscriptions | double click created several unpaid subscriptions and several payment links (could be paid twice, nothing flagged for refund) | D-66 |
| Moderation | three parallel agency-verification decisions all returned 200 (last write won, three audits) | D-67 |
| Reports | "one open report per target" was check-then-insert (5 parallel submits → 5 reports) | D-69 |
| Admin | two Super admins demoting each other at once left **zero** Super admins | D-72 |
| Auth | **pre-hijacking**: a password planted on an unverified registration survived the owner's Google sign-in; concurrent first Google logins raced | D-73 |
| Mail | OTP codes were logged in full by the console mail fallback, also in production | D-70 |
| Bookings | a retried request (same `clientRequestId`) could be refused with "not enough seats" right after it succeeded | D-64, D-70 |
| Chat sockets | a banned/demoted user (or an expired access token) could keep chatting on an already open socket | D-75 |
| Bookings | an order worth 0 VND (free departure or 100 % promotion) was accepted, then checkout answered 500 | D-74 |
| Payments | polling `GET /payments/:id` hit the gateway on every call (request-storm risk) | D-79 |
| Performance | paginated lists sorted in memory (indexes lacked the `_id` tie-breaker), full collection scan on report submit, unusable partial indexes | D-71 |

## 8. Not implemented / suggested next steps

* Refund execution, payouts to guides, plan-based feature gating (see section 4).
* Image upload (only URLs are stored — there is no upload use case in the diagram).
* E-ticket PDF/QR image rendering (the API returns the unguessable code; D-42).
* Per-account login lockout / CAPTCHA (only per-IP limits and the OTP attempt limit exist).
* "Logout everywhere" (not in the diagram); change-password while logged in (not in the diagram).
* Custom tours (D-56). Carts are now implemented (D-81).
* When the frontend starts: it can be generated against `docs/api/ENDPOINTS.md` + `docs/api/ERRORS.md`; Socket.IO usage is in `modules/chat/README.md`.
