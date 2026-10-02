# API documentation

* **`ENDPOINTS.md`** — the complete list of endpoints with the access rule of each (`public`, `login`, or the required permissions).
  It is **generated from the code** (`pnpm --filter backend docs:routes`) and a test fails when it is out of date.
* **`ERRORS.md`** — every error `code` with its HTTP status and meaning (checked against the source by a test).
* **Behaviour of a feature** (request/response fields, business rules, errors, state machines): the `README.md` inside
  each module folder, `backend/src/modules/<feature>/README.md`.
* **Use case → endpoint mapping** for the product diagram: `docs/backend/USE_CASE_MAP.md`.

## Conventions
| Topic | Rule |
|---|---|
| Base path | `/api/v1` |
| Success | `{ "success": true, "data": …, "meta"?: { "page", "limit", "total", "totalPages" } }` |
| Error | `{ "success": false, "error": { "code", "message", "details"? } }` — `code` is stable and machine-readable; the full list with HTTP status and meaning is `ERRORS.md` |
| Authentication | `Authorization: Bearer <access token>` (15 min). The refresh token lives in an HttpOnly cookie (`POST /auth/refresh`). No Authorization header = GUEST |
| Authorization | Permission per route (`packages/constants/src/permissions.ts`); ownership of a record is checked in the service and answers **404** (not 403) for other people's data |
| Validation | Every body / query / path param is validated; failures answer 400 `VALIDATION_ERROR` with `details[]` (`location`, `path`, `message`) |
| Pagination | `?page=1&limit=20` (max 100) → `meta` in the response; chat messages use a `before` cursor |
| Money | Integer VND. The client never sends prices; the server computes them |
| Dates | ISO-8601 UTC strings |
| Realtime | Socket.IO on the same port (`auth: { token }`), see `backend/src/modules/chat/README.md` |
| Webhooks | `POST /api/v1/payments/webhooks/payos` (signature-verified), see `backend/src/modules/payments/README.md` |
