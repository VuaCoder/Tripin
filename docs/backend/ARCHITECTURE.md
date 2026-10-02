# Backend architecture (backend)

Layered MVC, organised **by domain module**. Everything about one feature lives in one folder.

```
Route -> Middleware -> Controller -> Service -> Repository -> Model
```

| Layer | File | Responsibility | Must NOT |
|---|---|---|---|
| Route | `<m>.routes.ts` | URL + HTTP verb, wires middleware (`validate`, `requirePermission`, rate limit) to a controller method | contain logic |
| Validation | `<m>.validation.ts` | zod schemas for body / query / params + inferred types | be skipped: every external input is validated |
| Controller | `<m>.controller.ts` | read validated input, call ONE service method, send the response with `sendOk/sendCreated/...` | business rules, DB access |
| Service | `<m>.service.ts` | business rules, ownership checks, state transitions, orchestration, calls other modules **through their `index.ts`** | touch the Prisma client, know about `req`/`res` |
| Repository | `<m>.repository.ts` | **all** database access of the module (Prisma queries, raw SQL for aggregations); returns plain `*Record` objects and takes plain patches (`null` clears a column) | contain business rules, leak Prisma operators to services |
| Schema | `prisma/schema.prisma` + `prisma/migrations/` (repo root) | tables, enums, indexes (each index has a reason); one migration per change (`pnpm --filter backend db:migrate`) | be edited without a migration |
| Mapper | `<m>.mapper.ts` | record -> DTO (what the API returns). Never return raw records | |
| Types | `<m>.types.ts` | DTOs, inputs, module-private enums / state machines | |
| Policy (optional) | `<m>.policy.ts` | module-specific tunables / permission rules (no magic numbers in services) | |
| Public API | `index.ts` | the ONLY file other modules may import from | |
| Docs | `README.md` | see `docs/backend/MODULE_README_TEMPLATE.md` | be missing or stale |
| Tests | `__tests__/*.test.ts` | service tests with fake repositories (no DB needed), plus HTTP tests where useful; `*.integration.test.ts` run the real app on a real PostgreSQL (embedded server started once by `src/test/global-setup.ts`, one database per test file cloned from a migrated template; helper `src/test/integration.ts`) for races, idempotency and webhooks | |

A module with several entities names files `<entity>.repository.ts`, `<entity>.service.ts` (see `auth/otp.*`).

## Folder map

```
backend/src
  app.ts               Express app factory (no listen, importable by tests)
  server.ts            HTTP server bootstrap, DB connection, graceful shutdown
  config/              env validation (zod), database connection
  scripts/             one-off CLI scripts (seed)
  routes/index.ts      ONE registry: mounts every module router under /api/v1
  jobs/                periodic sweeps (expiry, completion, retries) started by server.ts; JOBS_ENABLED=false disables them on a node
  middlewares/         authenticate, authorize (RBAC), validate, error-handler, rate-limit
  integrations/        cross-cutting external services behind interfaces (mail, google)
  modules/<name>/      domain modules (see below)
  types/               Actor + Express augmentation
  utils/               AppError, response envelope, pagination, crypto, state-machine, logger
packages/constants     roles, permissions, shared enums (single source of truth)
```

External providers that belong to ONE domain live inside that module (`payments/providers/payos.provider.ts`,
`ai/providers/*.ts`) behind an interface; services depend on the interface only.

## Conventions

* **Response envelope**: `{ success: true, data, meta? }` / `{ success: false, error: { code, message, details? } }`.
  Always through `utils/api-response.ts`; errors are thrown as `AppError` and rendered only by `middlewares/error-handler.ts`.
* **Versioned API**: everything under `/api/v1`.
* **Actor**: `req.actor` is `GUEST` or a user, set by `authenticate` from a signed JWT **plus a DB re-check** (role and
  status are never trusted from the client). Controllers read it via `userActor(req)`.
* **Authorization**: central permissions (`packages/constants/src/permissions.ts`) enforced with
  `requirePermission(...)` on the route. **Ownership** (e.g. "this booking is mine") is enforced in the service.
  Use `404` instead of `403` when revealing existence would leak data.
* **Validation**: `validate({ body, query, params })` then `validated<Body, Query, Params>(req)` in the controller.
* **State machines**: any entity with a status declares `TRANSITIONS` in its types file and changes status only through
  `assertTransition()` (`utils/state-machine.ts`). Clients never set a status directly.
* **Dependency injection**: services take their collaborators in the constructor (default = real singletons) so unit
  tests can pass fakes. Singletons are exported at the bottom of the file (`export const xService = new XService()`).
* **Cross-module calls**: `import { usersService } from '../users'` (public `index.ts`) — never deep imports into
  another module's files, never another module's model/repository.
* **Money**: integer VND (`amount: number`, no floats). Never trust a client-sent price, total, or payment status.
* **IDs in responses**: `id` (string), never `_id`/`__v`.
* **Security defaults**: bcrypt passwords, HttpOnly refresh cookie, rate-limit on credential endpoints, helmet, CORS
  allow-list, no secrets or OTP codes in logs.
* **Docs rule**: when behaviour changes, the module `README.md` changes in the same edit.

## Automated guard rails
* `routes/__tests__/routes.audit.test.ts` reads the live routers: the list of PUBLIC and LOGIN-ONLY endpoints is frozen (adding one means editing the test on purpose), staff/admin/agency/guide areas must carry a permission, path params and bodies must be validated, and every permission must protect a route and be grantable to a role.
* `routes/__tests__/validation.security.test.ts` scans every `*.validation.ts` for unbounded strings/arrays and checks injection / mass-assignment cases (registration cannot pick a staff role, a booking cannot carry a price, query operators are inert).
* `scripts/__tests__/docs-in-sync.test.ts` fails when `docs/api/ENDPOINTS.md` (generated by `pnpm --filter backend docs:routes`) or `.env.example` is out of date, or `docs/backend/USE_CASE_MAP.md` lists different endpoints than the API serves, or a module lacks a README.
* `routes/__tests__/fuzz.integration.test.ts` sends garbage (operator objects, prototype pollution, huge/odd strings, bad ids, malformed JSON, 3 MB bodies) to EVERY route of the live route table as guest, traveler and a user with all permissions (>3,000 requests, ~20 s): nothing may answer 5xx (except the documented `503 SERVICE_UNAVAILABLE` of an unconfigured provider), every error keeps the envelope, `Object.prototype` stays clean.
* `test/soak.integration.test.ts` runs a seeded random workload (parallel bookings with/without promotions and retry keys, double cancels, double checkouts, replayed webhooks, expiry/completion/retry sweeps, capacity edits; 4 seeds) and then checks that the books balance: free seats = capacity - live seats, promotion counters = live bookings carrying the code (and <= limit), one open payment per booking, paid <=> confirmed (or cancelled + `refundRequired`), one e-ticket per ever-confirmed booking, one "payment received" notification per fulfilled payment, no 5xx.
* `tsc` runs with `noUnusedLocals`: dead imports and variables fail `pnpm --filter backend typecheck`.
* `utils/__tests__/state-machines.test.ts` checks all 10 status machines exhaustively (every legal pair passes, every other pair answers 409 `INVALID_STATE_TRANSITION`, every status reachable, terminal states pinned, the map is really consulted by production code, the module README names every status). A new status or machine = one row in that test.
* `docs/api/ERRORS.md` is the error-code contract: `routes/__tests__/error-contract.test.ts` fails when a code in the source is missing from it, when it lists a stale code, or when a documented HTTP status differs from the one the code is thrown with; `routes/__tests__/error-contract.integration.test.ts` provokes every documented code over HTTP on a real database (only 5 racy/trivial ones are covered elsewhere, listed in the test). New error code = add the row in the same edit.
* `scripts/__tests__/seed.integration.test.ts` runs the seed on a real database (works on an empty one, idempotent, never overwrites owner edits, rejects unsafe input) and `scripts/__tests__/build-smoke.integration.test.ts` builds the production bundle into a temp folder, starts it with plain `node` against a real PostgreSQL database, checks health/DB/headers/SIGTERM and that weak or identical JWT secrets stop the start in production; the same file asserts that `carts` and `custom-tours` stay README-only with no route.
* `jobs/__tests__/maintenance.integration.test.ts` runs the scheduled sweeps exactly as the scheduler does (parallel runs, missed-webhook recovery, expiry).
* `routes/__tests__/query-plans.integration.test.ts` asks PostgreSQL (`EXPLAIN (GENERIC_PLAN)` with `enable_seqscan` and `enable_sort` off) about every SQL statement behind the hot list endpoints (public tours in all sorts/filters, my bookings, agency bookings, notifications, reviews, e-tickets, reports) and fails on a sequential scan or an explicit sort that no index can avoid (a control query proves the audit really flags such statements). Rule for new indexes: paginated lists sort by `<field>, id`, so the index must end with `id` in the same direction.
* `routes/__tests__/security.static.test.ts` scans the source: only the logger writes to the console, no request body/secret reaches the logger, mappers never mention credential fields, `passwordHash` is omitted from every user query unless a `...WithPassword` lookup asks for it, every JWT verification pins `HS256` + issuer, no `eval`/shell/`$where`, secrets are read only in `config/env.ts`.
* `routes/__tests__/security.integration.test.ts` attacks the real app: forged/unsigned/expired/wrong-secret tokens, role claims that lie, deleted or demoted users, cookie flags, login/forgot-password enumeration, credential hashes in responses, error leakage (500, bad JSON, 413), helmet + CORS, operator injection in bodies/queries/paths.

## Adding a feature (checklist)

1. Create `modules/<name>/` with the files above (copy the shape of `modules/auth`).
2. Write the module `README.md` from the template — endpoints, rules, state machine, permissions, dependencies.
3. Export the router (and the public service) from `index.ts`; add ONE line in `routes/index.ts`.
4. Add permissions to `packages/constants` if new; map them to roles.
5. Add service tests (success, invalid input, forbidden, not found, invalid transition, duplicate).
6. Add an `*.integration.test.ts` (real PostgreSQL, helper `src/test/integration.ts`) for everything that can race or that crosses modules: parallel duplicates, ownership 404s, permission matrix, idempotency. Unit tests with fake repositories cannot prove these.
7. Every new error `code` gets a row in `docs/api/ERRORS.md`; every state change is a compare-and-set; every paginated list has an index ending in `id` (the query-plan test asks PostgreSQL).
8. Tick the module in `docs/backend/PROGRESS.md`, add its endpoints to `docs/backend/USE_CASE_MAP.md` (a test compares both with the live routes) and regenerate `docs/api/ENDPOINTS.md` (`pnpm --filter backend docs:routes`).
9. `pnpm --filter backend typecheck && pnpm --filter backend test` must pass.
