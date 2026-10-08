# auth

Account access for every actor: registration with email OTP, password login (with optional 2FA), Google login, forgot /
reset password, session refresh and logout. Agency registration/login uses a dedicated API contract so the complete
business profile is captured before activation. Agency Google sign-up is intentionally unavailable.

## Use cases covered
| Use case | Actor | Endpoint |
|---|---|---|
| Register Traveler / Tour guide | Guest | `POST /auth/register` |
| Register Agency + business onboarding | Guest | `POST /auth/agency/register` |
| Verify / resend Agency OTP | Agency | `POST /auth/agency/verify-otp`, `POST /auth/agency/resend-otp` |
| Verify OTP | Guest / User | `POST /auth/verify-otp` |
| Customer login (includes Validate credentials; extended by Verify OTP when 2FA is on) | Traveler / Tour guide / Staff | `POST /auth/login` |
| Agency login | Agency | `POST /auth/agency/login` |
| Login with Google (includes Authenticate via OAuth) | Guest | `POST /auth/google` |
| Forgot password (includes Verify OTP) | All | `POST /auth/forgot-password` -> `POST /auth/reset-password` |
| Log out | All | `POST /auth/logout` |
| (supporting) keep session alive | All | `POST /auth/refresh` |
| (supporting) turn 2FA on/off | auth | `PATCH /auth/two-factor` |

## Files
| File | Role |
|---|---|
| `auth.routes.ts` | URLs, rate limiter, validation, controller wiring |
| `auth.validation.ts` | zod schemas (password policy, OTP shape, roles allowed at registration) |
| `auth.controller.ts` | HTTP only: sets/clears the refresh cookie, shapes responses |
| `auth.service.ts` | All rules: register, credentials, 2FA, Google, reset, refresh rotation, logout |
| `otp.service.ts` / `otp.repository.ts` / `otp.model.ts` | One-time codes (issue, verify, cooldown, attempts) |
| `refresh-token.repository.ts` / `refresh-token.model.ts` | Hashed refresh tokens, rotation families |
| `auth.tokens.ts` | JWT access-token sign/verify, refresh-token generation |
| `auth.mail.ts` | OTP email wording |
| `auth.mapper.ts` | Session response + refresh cookie helpers |
| `auth.policy.ts` | Tunable numbers (bcrypt rounds, OTP TTL, attempts, cookie) |
| `auth.types.ts` | Inputs, `Session`, `LoginResult` |
| `index.ts` | Public API (`authRouter`, `authService`, `verifyAccessToken`) |
| `__tests__/auth.service.test.ts` | Service tests with fake repositories |
| `__tests__/auth.integration.test.ts`, `auth.flows.integration.test.ts` | Real-PostgreSQL tests: sessions, OTP, refresh rotation, 2FA, reset, logout, Google (fake verifier), pre-hijacking |

## API (base `/api/v1/auth`)
All bodies are JSON. Success envelope `{ success: true, data }`. All endpoints except `/refresh`, `/logout` and
the read-only `/security` endpoint are rate limited (20 req / 15 min / IP).

| Endpoint | Body | Success | Errors |
|---|---|---|---|
| `POST /register` | `email, password, fullName, role?` (TRAVELER default; TRAVELER/TOUR_GUIDE only) | 201 `{ email, otpExpiresInSeconds, message }` | 400 validation, 409 `EMAIL_ALREADY_REGISTERED`, 429 `OTP_RESEND_TOO_SOON` |
| `POST /agency/register` | `email, password, fullName, phone, companyName, licenseNumber, address, description?, website?` | 201 `{ email, otpExpiresInSeconds, message }` | 400 validation, 409 `EMAIL_ALREADY_REGISTERED` |
| `POST /agency/login` | `email, password` | same shape as `/login`; Agency role only | 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_*` / `AGENCY_ONBOARDING_REQUIRED` |
| `POST /agency/verify-otp` | `email, code, purpose` (`REGISTER` \| `LOGIN_2FA`) | REGISTER completes registration without a session; 2FA returns a session | `OTP_*`, `AGENCY_ONBOARDING_REQUIRED` |
| `POST /agency/resend-otp` | `email, purpose` | 200 `{ expiresInSeconds, message }` | 400 invalid state, 429 cooldown |
| `POST /verify-otp` | `email, code, purpose` (`REGISTER` \| `LOGIN_2FA`) | 200 `{ accessToken, user }` + refresh cookie | 400 `OTP_INVALID`/`OTP_EXPIRED`, 429 `OTP_TOO_MANY_ATTEMPTS`, 403 `ACCOUNT_BANNED` |
| `POST /login` | `email, password` | 200 `{ twoFactorRequired:false, accessToken, user }` + cookie, or `{ twoFactorRequired:true, email }` (then call `/verify-otp` with `LOGIN_2FA`) | 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_BANNED` / `ACCOUNT_NOT_VERIFIED` |
| `POST /google` | `idToken, role?` | 200 `{ accessToken, user }` + cookie | 401, 503 when `GOOGLE_CLIENT_ID` is missing |
| `POST /forgot-password` | `email` | 202 always the same message | — |
| `POST /reset-password` | `email, code, newPassword` | 204; all sessions revoked | 400 `OTP_*` |
| `POST /refresh` | cookie `refresh_token` | 200 `{ accessToken, user }` + rotated cookie | 401 `TOKEN_INVALID` |
| `POST /logout` | cookie | 204, cookie cleared (idempotent) | — |
| `GET /security` | — | 200 `{ passwordConfigured, googleLinked, twoFactorEnabled, twoFactorMethod }` | 401 |
| `PATCH /two-factor` | `enabled, password?` | 200 `user` | 400 `TWO_FACTOR_REQUIRES_PASSWORD`, 401 `INVALID_CREDENTIALS` |

Access token: `Authorization: Bearer <jwt>` (15 min). The refresh token is **never** in a response body.

## Business rules
1. Password: 8–72 chars, at least one letter and one digit. Stored with bcrypt (12 rounds).
2. Registration creates a `PENDING_VERIFICATION` account; it becomes `ACTIVE` only after the REGISTER OTP is verified.
   Re-registering a still-pending email overwrites password/name/role (typo recovery).
3. Wrong email and wrong password return the same error and take similar time (dummy hash compare).
4. Banned accounts can never get tokens; pending accounts get a fresh OTP and `ACCOUNT_NOT_VERIFIED`.
5. OTP: 6 digits, 10 min, max 5 wrong attempts (counted atomically), 60 s resend cooldown, single use, one live code per
   user+purpose, stored as HMAC.
6. Forgot password never reveals whether the email exists; resetting revokes every refresh token.
7. Refresh tokens rotate on each use. Using an already-rotated token revokes the whole family (theft signal).
8. Activation (`PENDING_VERIFICATION -> ACTIVE`, via REGISTER OTP or a verified Google email) is a compare-and-set on the status that was read, validated with `USER_STATUS_TRANSITIONS`: if a moderator banned the account meanwhile, the ban wins. Resetting a password never activates an account.
9. A role is never accepted from a login/refresh request. Generic sign-up allows TRAVELER/TOUR_GUIDE only; Agency is forced by the dedicated endpoint.
10. Agency onboarding requires phone, company name, license number and address. Phone is stored but is not verified. REGISTER OTP atomically activates the user and changes the agency profile from UNVERIFIED to PENDING, then the UI returns to Agency login without opening a session.
11. Agency accounts cannot use customer login/OTP/Google routes; non-Agency accounts receive generic invalid credentials from the Agency login route.

## State machine
User status: `PENDING_VERIFICATION -> ACTIVE` (OTP) ; `ACTIVE <-> BANNED` (owned by the moderation/users modules).
This module only performs `PENDING_VERIFICATION -> ACTIVE`.

## Data model
* `Otp` – `userId, purpose, codeHash, attempts, issuedAt, expiresAt`. Unique `(userId, purpose)`; index on `expiresAt`. Expired rows are deleted by the `auth.purgeExpired` job (PostgreSQL has no TTL index).
* `RefreshToken` – `userId, tokenHash (unique), family, expiresAt, revokedAt, ip, userAgent`. Index on `expiresAt` (same purge job);
  index on `family` (family revocation) and `userId` (revoke all).
* Users live in the `users` module.

## Permissions
No RBAC here: every route is public except `GET /security` and `PATCH /two-factor` (`requireAuth`). The `authenticate` middleware
(`middlewares/authenticate.ts`) uses `verifyAccessToken` from this module for all other modules.

## Dependencies
* Uses: `users` (repository + mapper), `integrations/mail`, `integrations/google`, `@travel-platform/constants`.
* Used by: `middlewares/authenticate.ts`, `routes/index.ts`.

## Events / side effects
Sends OTP emails (console provider when `SMTP_HOST` is empty — the code is then printed to the server log in dev only).

## Testing
`pnpm --filter backend test` — `auth.service.test.ts` (login success/failure/ban/unverified/2FA, register, refresh rotation +
reuse detection, forgot password) and `src/app.test.ts` (HTTP envelope, validation, 401).
`__tests__/auth.flows.integration.test.ts` adds 2FA login, code purposes, resend cooldown, forgot/reset with session revocation, banned/unverified accounts, logout idempotency, Google login with a fake verifier (linking, concurrency, pre-hijacking) and registration rules.
`__tests__/auth.integration.test.ts` runs the real app on a real PostgreSQL (an embedded server started once by `src/test/global-setup.ts`, no Docker needed):
register -> OTP -> session, single-use OTP and lock-out, refresh rotation + reuse revokes the family, parallel refresh yields one session, a ban applies on the next request.

## Security notes
* Access tokens: HS256, issuer `tripri-api`, 15 min; the role inside is NOT trusted - the user is re-read from the database on every request (bans/demotions are immediate). Refresh tokens are opaque, stored hashed, rotated, family-revoked on reuse.
* Login answers the same for unknown email and wrong password (a dummy bcrypt compare keeps the timing similar); forgot-password always answers 202 with the same body. Registering an already used email answers 409 (a deliberate usability trade-off, DECISIONS D-70).
* Without SMTP the dev mail fallback prints OTP emails to the log; in production it prints recipient and subject only.
* Google sign-in links to an existing account with the same (Google-verified) email. If that account is still PENDING_VERIFICATION its password is REMOVED at that moment: somebody else may have registered the address ("pre-hijacking") and must not keep a working password. Two simultaneous first Google logins create one account. Signing in with Google does not ask for the 2FA code (Google already authenticated the person; DECISIONS D-73).
* Attacks are exercised in `src/routes/__tests__/security.integration.test.ts`.

## Not implemented / follow-ups
* No "change password while logged in" endpoint (not in the diagram).
* No Google "authorization code" flow, only ID-token verification (DECISIONS D-7).
