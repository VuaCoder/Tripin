# backend — Travel platform backend

Express 5 + TypeScript + Mongoose, layered MVC organised by domain module.
Read first: `docs/backend/ARCHITECTURE.md` (rules), `docs/backend/USE_CASE_MAP.md` (what exists),
`docs/backend/PROGRESS.md` (what is done), `docs/backend/DECISIONS.md` (assumptions to review).

## Run
```bash
cp .env.example .env            # fill MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET at minimum
pnpm install
pnpm --filter backend dev           # http://localhost:3001/api/v1/health
pnpm --filter backend typecheck
pnpm --filter backend test          # unit + integration (real MongoDB via mongodb-memory-server)
pnpm --filter backend test:unit     # unit tests only, no database binary needed
# EXPLAIN_REPORT=plans.jsonl pnpm --filter backend test   -> also writes every query that scans a collection / sorts in memory
pnpm --filter backend seed          # first SUPER_ADMIN (SEED_ADMIN_EMAIL/PASSWORD), default categories & plans; idempotent
pnpm --filter backend build && pnpm --filter backend start
```

## Where things live
| Path | What |
|---|---|
| `src/modules/<feature>/` | One folder per feature: routes, validation, controller, service, repository, model, mapper, types, `README.md`, tests |
| `src/middlewares/` | authenticate (sets `req.actor`), authorize (RBAC), validate (zod), error handler, rate limit |
| `src/integrations/` | Cross-cutting external services behind interfaces (mail, google) |
| `src/routes/index.ts` | The only place modules are mounted under `/api/v1` |
| `src/utils/` | AppError, response envelope, pagination, crypto, state-machine helpers |
| `../../packages/constants` | Roles, permissions, shared statuses |

Every feature README lists its use cases, endpoints, business rules, state machine, data model and permissions.
