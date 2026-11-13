# Agency Multi-member Foundation (H2)

## Co-owners

Each agency has one primary owner, identified by `AgencyCreationKey.userId` for
independent workplaces or legacy `AgencyProfile.userId`. This stable creation
identity is not inferred from mutable membership ordering. Missing identity fails
closed for ownership administration. Membership/context DTOs expose `isPrimaryOwner`
and labels `owner` / `co_owner`; both keep internal role `OWNER`.

Only the primary owner can add, downgrade, suspend or remove a co-owner via the
existing `PATCH /agency/members/:id`. Role changes also require TEAM_MANAGE and
PERMISSIONS_MANAGE and respect delegable permissions. Promotion requires an active,
verified recipient. Promotion/demotion resets overrides atomically and is audited.
Co-owners share the OWNER template and can manage ordinary staff, but cannot change
any owner's membership, overrides or tour scopes, or the shared OWNER role template.
The primary owner cannot be demoted/suspended/removed through team APIs, including
self-mutation. No ownership-transfer flow, migration or global-role change is added.
Email invitations still exclude OWNER.

## Workplace onboarding

Email invitation notifications contain no website link or token. The personal
inbox is `GET /users/me/agency-invitations?page=1` (20 items plus total), scoped to
the authenticated active user's verified email, with no selected tenant required.
`POST /agency-invitations/:id/accept` accepts an invitation using an empty body;
it shares transaction/authorization checks with the legacy token acceptance API.
New emails instruct the recipient to use Chọn nơi làm việc → Lời mời của tôi.
The invitation is valid for 24 hours; creation enqueues mail and does not create a
membership. Mail delivery uses the existing durable outbox and retries. No new
migration is required beyond the foundation/flexible/workplaces migrations.

Current extension: `workplaces.routes.ts` and `workplaces.service.ts` implement
independent agency creation with an idempotency requestId, OWNER application
draft/submission, 12-character join codes valid for 15 minutes, pending requests,
and OWNER-only approval with an agency-local non-OWNER role. Account status and
verified email are checked on writes. Code expiry does not expire submitted
requests. Owner approval, code operations and email acceptance serialize using
the same agency row lock as membership changes. REMOVED members can rejoin through
a fresh invitation or fresh code request plus approval. The same membership ID
is reused, with only the newly assigned role and cleared overrides/tour scopes.
SUSPENDED members must be explicitly reactivated, never bypassed by invitations.
Removal/suspension revokes prior pending invitations and cancels pending requests;
legacy stale admissions are retired on the next invitation/request. Former OWNER
members can only be readmitted by the primary owner. Existing email invitation accounts
may register/verify first; email acceptance preserves any concurrently approved
membership's role and cancels its redundant pending join request.

Apply `20261113000100_agency_flexible_permissions` and
`20261113000200_agency_workplaces` before deploying this client/backend.
Migration rollout must pass the current target/history preflight first.
Global `User.staffStatus` is reserved for platform staff, not agency membership.

Workplace entry is `/workplaces`; new/join screens are `/workplaces/new` and
`/workplaces/join`. OWNER profile editing is `/agency/application/workplace`,
available before verification. Settings/profile redirects there. AgencyProfile.id
is used by the moderation queue, moderation decisions and public agency profile;
legacy profile/auth endpoints remain for older clients. Promotions, premium,
complaints and review disputes still retain their legacy integration gate; this
release does not claim those modules support independent agencies.

> The matrix and role-based invitation rules below document the historical H2
> foundation. Current flexible roles, member overrides, scopes, and endpoints are
> specified in `docs/database/agency-multimember/FLEXIBLE_MEMBER_ACCESS.md`.

Identity is a User; the tenant is AgencyProfile.id. AgencyProfile.userId is a
nullable, unique legacy mapping, not the authorization boundary. A Traveler can
join one or multiple agencies without changing global role or password.

## API contract

Base `/api/v1`, Bearer personal access JWT. `X-Agency-Id: <AgencyProfile UUID>`
selects the tenant. Exactly one ACTIVE membership can be selected implicitly;
multiple memberships require the header. Unknown/inactive selection returns 403;
malformed UUID returns 400. No Agency ID or permission from token/body is trusted.
Membership is re-read each request (no tenant permission JWT cache).

| Method | Path | Access / body |
|---|---|---|
| GET | /users/me/agencies | Authenticated User; ACTIVE memberships + permissions |
| GET | /agency/context | ACTIVE member |
| GET | /agency/members | OWNER, MANAGER |
| PATCH | /agency/members/:id | OWNER; `{role?,status?}`; at least one field |
| POST | /agency/invitations | OWNER: MANAGER/STAFF/ACCOUNTANT; MANAGER: STAFF only; `{email,role}` |
| POST | /agency/invitations/:id/revoke | OWNER; bodyless |
| POST | /agency-invitations/accept | Authenticated verified matching email; `{token}` |
| GET | /agency/finance/summary | VERIFIED agency; OWNER/MANAGER/ACCOUNTANT |

Standard response `{success:true,data:...}`. Context data:
`{agencyId,actorUserId,memberId,memberRole,permissions}`. Login, OTP, Google and
refresh responses add `agencies: [{agencyId,memberId,memberRole,companyName,
verificationStatus,permissions}]`. JWT sub remains User.id. Frontend must not
gate Agency portal access solely on global User.role or user.permissions.

Invitations expire after 24h; only SHA-256 hash is stored. Delivery uses encrypted
transactional mail outbox. Raw token is never returned by API. Acceptance is
single-use, email-bound and transactional. New invitations can restore REMOVED
members with a clean non-OWNER role, but never SUSPENDED members. Team writers lock the agency
row and recheck actor access; concurrent demotions cannot remove the final active
OWNER. Global platform bans remain enforced by authentication middleware.

## Permission matrix

| Capability | OWNER | MANAGER | STAFF | ACCOUNTANT |
|---|---|---|---|---|
| Context | yes | yes | yes | yes |
| Team read | yes | yes | no | no |
| Invite | non-OWNER | STAFF only | no | no |
| Change role/status, revoke invite | yes | no | no | no |
| Tour create/delete/import/itinerary/assign guide | yes | yes | no | no |
| Tour update/availability, booking read | yes | yes | yes | booking only |
| Customer PDF export | yes | yes | yes | no |
| Dashboard / Finance summary | yes | yes | no | yes |

`agency:finance-manage` is reserved to OWNER; no money-movement endpoint is
implemented. Summary is paid confirmed/completed Booking.agencyAmount, NOT a
reconciled ledger balance. Finance queries always use AgencyProfile.id.

H2.7: legacy `POST /earnings/payouts/:id/transfer` is quarantined. It requires
ACTIVE AgencyContext, VERIFIED organization and OWNER finance-manage, then
returns 410 `LEGACY_TRANSFER_QUARANTINED` without mutating payouts/audit. Missing
auth returns 401; inactive/foreign membership or insufficient role returns 403.
There is no global-role or extra-permission bypass. Agency event notifications
use membership fanout, optional `NotificationDto.agencyId`, and dynamic inbox /
outbox authorization; see the notifications module README.

## Integration boundary

Foundation, tours, calendar, bookings, customer PDF, dashboard and guide lookup
consume AgencyContext. Unconverted agency promotions/premium/complaints/disputes
are deliberately legacy-OWNER-only, with ACTIVE membership checked first. New
members and independent companies get 403 there until tenant + actor + recipient
separation is finished. Public tour detail no longer reveals drafts merely
because historical User ID equals Agency ID; use `/agency/tours/:id`.

See `docs/database/agency-multimember/H2_IMPLEMENTATION.md` for test evidence,
limitations, owner backfill and cutover approval requirements.
