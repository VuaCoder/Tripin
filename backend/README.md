# backend — Travel platform backend

Express 5 + TypeScript + Prisma (PostgreSQL), layered MVC organised by domain module.
Read first: `docs/backend/ARCHITECTURE.md` (rules), `docs/backend/USE_CASE_MAP.md` (what exists),
`docs/backend/PROGRESS.md` (what is done), `docs/backend/DECISIONS.md` (assumptions to review).

## Run
```bash
pnpm install                         # also generates the Prisma client
cp .env.example .env                 # fill DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET at minimum
docker compose up -d                 # local PostgreSQL (repo root), or use any PostgreSQL
pnpm --filter backend db:deploy      # apply prisma/migrations
pnpm --filter backend dev            # http://localhost:3001/api/v1/health  (also GET /health)
pnpm --filter backend typecheck
pnpm --filter backend test           # unit + integration (an embedded PostgreSQL is started by the run itself)
pnpm --filter backend test:unit      # unit tests only, no database needed
pnpm --filter backend test:integration
pnpm --filter backend seed           # first SUPER_ADMIN (SEED_ADMIN_EMAIL/PASSWORD), default categories & plans; idempotent
pnpm --filter backend build && pnpm --filter backend start
```

Database: see `docs/database/README.md` (schema in `prisma/schema.prisma`, migrations in `prisma/migrations`).

## Where things live
| Path | What |
|---|---|
| `src/modules/<feature>/` | One folder per feature: routes, validation, controller, service, repository, mapper, types, `README.md`, tests |
| `src/middlewares/` | authenticate (sets `req.actor`), authorize (RBAC), validate (zod), error handler, rate limit |
| `src/integrations/` | Cross-cutting external services behind interfaces (mail, google) |
| `src/routes/index.ts` | The only place modules are mounted under `/api/v1` |
| `src/utils/` | AppError, response envelope, pagination, crypto, state-machine helpers |
| `../../packages/constants` | Roles, permissions, shared statuses |

Every feature README lists its use cases, endpoints, business rules, state machine, data model and permissions.
