# AI RULES

When acting as an AI assistant for this repository, the following rules MUST be enforced at all times:

- Inspect existing code before modifying.
- Follow existing architecture.
- Make minimal changes.
- Do not invent requirements.
- Do not add unrequested features.
- Do not restructure the repository without explicit instruction.
- Do not bypass layers.
- Do not bypass backend authorization.
- Do not bypass validation.
- Do not expose secrets.
- Do not introduce unnecessary dependencies.
- Do not use MongoDB.
- Do not introduce Custom Tour.
- Do not introduce another authentication framework.
- Do not introduce another UI framework.
- Do not couple business logic directly to PayOS.
- Do not create duplicate services or modules.
- Do not modify unrelated code.
- Validate changes before completion.
- Update documentation when necessary.

The AI must treat repository architecture and explicit project requirements as the source of truth.

## Agent context (read first)

This is the compact current-state summary. Prefer this section before scanning the
repository; inspect source files only when a task touches them.

### Project

- Product: **TRIPRI**, online tour booking platform.
- Monorepo: `pnpm`; frontend in `frontend/`, backend in `backend/`, shared packages in `packages/`.
- Frontend: Next.js App Router + TypeScript + Tailwind + Redux Toolkit/RTK Query.
- Backend: Express + TypeScript, layered flow `route -> middleware -> controller -> service -> repository`.
- Database: PostgreSQL via Prisma/Neon. Do not introduce MongoDB.
- Auth: JWT access/refresh tokens, Google OAuth, email OTP and optional 2FA.
- Payment: PayOS. Do not couple business logic directly to PayOS.

### Completed behavior

- Homepage hero uses full viewport width through `AppShell fullBleed`.
- The canonical logo is `frontend/public/images/tripri-logo.png`; it is already used by
  header, footer and auth screens. Do not replace it with the old SVG unless explicitly requested.
- Successful login routing:
  - `TRAVELER` -> `/` (homepage, continue browsing/booking)
  - `AGENCY` -> `/agency`
  - `TOUR_GUIDE` -> `/guide`
  - `MODERATOR` -> `/moderator`
  - `SUPER_ADMIN` -> `/super-admin`
  Keep this mapping in `frontend/features/auth/utils/roles.ts` via `homeForRole`.
- Register creates a pending account and sends `REGISTER` OTP; successful registration goes to
  the OTP screen, not directly to an authenticated page.
- OTP purposes:
  - `REGISTER` and `LOGIN_2FA` call backend OTP verification and establish the session.
  - `FORGOT_PASSWORD` passes email + code to reset-password; it must not call the normal verify endpoint.
- `POST /auth/resend-otp` is public and must remain represented in route audits and API docs.
- Mail fallback must never log email bodies or OTP values; log recipient/subject only.

### Change/validation checklist

1. Read the affected feature/module README and existing implementation first.
2. Preserve the current auth/API contracts and role routing above.
3. Use existing scripts and patterns; avoid new dependencies unless required.
4. After frontend changes run `pnpm --filter frontend test` and, for build-affecting changes,
   `pnpm --filter frontend build`.
5. After backend changes run `pnpm --filter backend typecheck` and
   `pnpm --filter backend test:unit`.
6. Update `docs/api/ENDPOINTS.md` and `docs/backend/USE_CASE_MAP.md` when routes change.
