# users

Account profiles for every persisted actor: own profile (view/update), public guide and agency profiles for Guests,
agency verification request, and Super-admin access management. Also owns the account **status** (ban/unban) and the
**agency verification** workflow; those decisions are triggered by the `moderation` module through this module's service.
The `User` model is shared by `auth` (credentials) and `authenticate` (actor resolution).

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| View profile | Traveler / Agency / Tour guide | `GET /users/me` |
| Update profile informations / Update Profile | Traveler / Agency / Tour guide | `PATCH /users/me` |
| (supporting) request agency verification | Agency | `POST /users/me/agency-verification` |
| View public tour guide profile | Guest | `GET /tour-guides/:id` |
| View public agency profile | Guest | `GET /agencies/:id` |
| Assign User Permissions | Super admin | `GET /admin/users`, `PATCH /admin/users/:id/access` |
| Ban violating account / Verify Agency Profile | Moderator | no route here — `moderation` calls `usersService.banUser / unbanUser / decideAgencyVerification` (each takes the acting `{ userId, role }`) |

## Files
| File | Role |
|---|---|
| `users.routes.ts` | 4 routers: `usersRouter`, `publicGuidesRouter`, `publicAgenciesRouter`, `adminUsersRouter` |
| `users.validation.ts` | zod: profile update (strict, role-specific sections), list query, access assignment |
| `users.controller.ts` | HTTP only |
| `users.service.ts` | Rules: role-gated profile sections, public visibility, verification, access guards, ban rules |
| `users.repository.ts` | All DB access (`list` supports role/status/agencyVerification/text search with escaped regex) |
| `users.model.ts` | `User` schema |
| `users.mapper.ts` | `toPrivateUserDto`, `toPublicGuideDto`, `toPublicAgencyDto`, `permissionsOf` |
| `users.types.ts` | DTOs, inputs, `AGENCY_VERIFICATION_TRANSITIONS`, `USER_STATUS_TRANSITIONS` |
| `index.ts` | Public API |

## API (base `/api/v1`)
* `GET /users/me` – `profile:view-own` → `PrivateUserDto` (never contains `passwordHash`).
* `PATCH /users/me` – `profile:update-own`; body any of `fullName, phone, avatarUrl, agencyProfile{companyName,description,address,website,licenseNumber}, guideProfile{bio,languages,specialties,experienceYears,licenseNumber}` (strict, at least one field). `agencyProfile` → 403 unless AGENCY; `guideProfile` → 403 unless TOUR_GUIDE. Email, role, status are never editable here.
* `POST /users/me/agency-verification` – AGENCY only; needs `companyName` + `licenseNumber`; `UNVERIFIED|REJECTED → PENDING`. 202.
* `GET /tour-guides/:id`, `GET /agencies/:id` – public, only ACTIVE accounts with the matching role, otherwise 404. No email/phone/license.
* `GET /admin/users?page&limit&role&status&q` – `user:assign-permissions`; paginated `PrivateUserDto` list.
* `PATCH /admin/users/:id/access` – body `{ role?, extraPermissions? }` (at least one). Takes effect immediately (the actor is re-read per request).

## Business rules
1. Role-specific profile sections can only be edited by that role.
2. Public profiles expose no contact data and hide banned/inactive accounts.
3. A SUPER_ADMIN cannot change their own access and the last active SUPER_ADMIN cannot be demoted (`LAST_SUPER_ADMIN`). The count is verified AFTER the write and the demotion is undone when it would leave no SUPER_ADMIN, so two admins demoting each other at once cannot lock the platform out.
4. Moving a user to AGENCY / TOUR_GUIDE creates the empty profile section so the profile endpoints work.
5. `extraPermissions` unknown to `PERMISSIONS` are dropped.
6. Ban: nobody can ban themselves or a SUPER_ADMIN; only SUPER_ADMIN can ban a MODERATOR; the change is an atomic compare-and-set on the current status.
7. Verification decision is only possible from `PENDING`, written as a compare-and-set on the status: two moderators deciding at once get one 200 and one 409 (and one audit entry).

## State machine
Account status (`USER_STATUS_TRANSITIONS`): `PENDING_VERIFICATION → ACTIVE` (auth OTP), `ACTIVE → BANNED`, `BANNED → ACTIVE`.

Agency verification (`AGENCY_VERIFICATION_TRANSITIONS`):
`UNVERIFIED → PENDING → VERIFIED | REJECTED`, `REJECTED → PENDING`. `VERIFIED` is terminal.

## Data model
`User`: unique `email`, sparse unique `googleId`, `(role, status, createdAt)` and `(createdAt)` for the admin list / "new accounts" count, sparse index
`agencyProfile.verificationStatus` (moderator queue). `passwordHash` is `select:false`. Embedded `agencyProfile` and `guideProfile`.

## Permissions
`profile:view-own`, `profile:update-own` (all roles), `user:assign-permissions` (SUPER_ADMIN). Moderation permissions are
checked in `moderation` routes, not here.

## Dependencies
* Uses: `@travel-platform/constants`, `audit` (record), `utils/*`.
* Used by: `auth` (repository, mapper), `middlewares/authenticate` (repository, mapper), `moderation` (service), `tours` (service: `assertActiveWithRole`, `getSummaries`), `chat`, `reviews` (summaries).

## Events / side effects
Audit records (`auditService.record`): `user.access_assigned`, `user.banned`, `user.unbanned`, `agency.verification_decided`.

## Testing
`__tests__/admin.integration.test.ts` – real MongoDB (also covers categories, commission, policies): account list filters + literal search, role/permission changes take effect on the next request, nonsense and non-admin requests refused, last-Super-admin race, categories CRUD + duplicate race, commission validation + booking snapshot, policies, cancellation window used by bookings.
`__tests__/users.service.test.ts` – role gating, dotted `$set` building, public visibility, verification state machine,
access guards, last-super-admin protection, ban rules.

## Not implemented / follow-ups
* Editing `licenseNumber`/`companyName` of a VERIFIED agency does not reset verification (rule not defined by the diagram).
* No email/password change endpoints (not in the diagram).
