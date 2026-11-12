# Agency Multi-member Foundation (H2)

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
single-use, email-bound and transactional; does not restore suspended/removed
memberships. OWNER must explicitly restore them. Team writers lock the agency
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
