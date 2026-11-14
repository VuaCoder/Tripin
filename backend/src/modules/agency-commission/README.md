# agency-commission

An agency owner asks the platform to change the share of each booking the agency keeps. A Super Admin
approves or rejects it; approval writes `AgencyProfile.commissionRateBps` (the platform fee) and bumps
`commissionVersion`, so bookings created afterwards snapshot the new rate and old bookings keep theirs.

## State machine

`PENDING → APPROVED | REJECTED | CANCELLED`. Only one `PENDING` request per agency (partial unique index).
The owner may cancel while pending. A request is approved only when `AgencyProfile.commissionVersion`
still equals the `baseVersion` captured at request time; otherwise the review answers `409 SETTINGS_CONFLICT`
and the agency must send a new request.

## Rates

The API speaks the **agency share** (0–50%, `requestedSharePercent`), while `AgencyProfile.commissionRateBps`
stores the **platform fee**. Approval writes `10_000 - requestedShareBps`, so the booking math
(`commissionAmount = total × commissionRateBps / 10_000`) keeps its existing meaning.

## Endpoints

| Method | Path | Access |
|---|---|---|
| GET | `/agency/commission` | `agency:context-view` |
| POST | `/agency/commission/requests` | `agency:finance-manage` (OWNER only) |
| POST | `/agency/commission/requests/:id/cancel` | `agency:finance-manage` |
| GET | `/admin/settings/agency-commission-requests` | `SUPER_ADMIN` + `commission:configure` |
| POST | `/admin/settings/agency-commission-requests/:id/approve` | `SUPER_ADMIN` + `commission:configure` |
| POST | `/admin/settings/agency-commission-requests/:id/reject` | `SUPER_ADMIN` + `commission:configure` |

Create notifies active Super Admins; approve/reject notifies the agency (`AGENCY_COMMISSION_DECIDED`,
delivered to members with `agency:finance-view`). Every transition writes an audit entry.
