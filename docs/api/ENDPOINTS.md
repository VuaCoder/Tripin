# API endpoint index

> **Generated** from the Express routers by `pnpm --filter backend docs:routes` — do not edit by hand.
> A test (`routes.docs.test.ts`) fails when this file is out of date.

Base URL: `/api/v1` · 120 endpoints · behaviour, request/response shapes and rules are documented in each module README (`backend/src/modules/<name>/README.md`).

**Access**: `public` = no login needed (GUEST) · `login` = any logged-in user (ownership checked in the service) · `` `permission` `` = the listed permission(s) are required (see `packages/constants/src/permissions.ts`).

Responses use one envelope: `{ "success": true, "data": …, "meta"?: { page, limit, total, totalPages } }` or `{ "success": false, "error": { "code", "message", "details"? } }`.

## `/admin/audit-logs`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/admin/audit-logs` | `audit:view` |

## `/admin/categories`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/admin/categories` | `category:configure` |
| POST | `/api/v1/admin/categories` | `category:configure` |
| DELETE | `/api/v1/admin/categories/:id` | `category:configure` |
| PATCH | `/api/v1/admin/categories/:id` | `category:configure` |

## `/admin/dashboard`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/admin/dashboard` | `admin:dashboard` |

## `/admin/policies`

| Method | Path | Access |
|---|---|---|
| PUT | `/api/v1/admin/policies/:key` | `policy:configure` |

## `/admin/promotions`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/admin/promotions` | `promotion:platform-manage` |
| POST | `/api/v1/admin/promotions` | `promotion:platform-manage` |
| GET | `/api/v1/admin/promotions/:id` | `promotion:platform-manage` |
| PATCH | `/api/v1/admin/promotions/:id` | `promotion:platform-manage` |

## `/admin/settings`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/admin/settings/commission` | `commission:configure` |
| PUT | `/api/v1/admin/settings/commission` | `commission:configure` |

## `/admin/users`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/admin/users` | `user:assign-permissions` |
| PATCH | `/api/v1/admin/users/:id/access` | `user:assign-permissions` |

## `/agencies`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/agencies/:id` | public |

## `/agency/bookings`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/agency/bookings` | `agency:bookings-view` |
| GET | `/api/v1/agency/bookings/:id` | `agency:bookings-view` |

## `/agency/complaints`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/agency/complaints` | `complaint:respond` |
| GET | `/api/v1/agency/complaints/:id` | `complaint:respond` |
| POST | `/api/v1/agency/complaints/:id/respond` | `complaint:respond` |

## `/agency/dashboard`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/agency/dashboard` | `agency:dashboard` |

## `/agency/promotions`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/agency/promotions` | `promotion:agency-manage` |
| POST | `/api/v1/agency/promotions` | `promotion:agency-manage` |
| GET | `/api/v1/agency/promotions/:id` | `promotion:agency-manage` |
| PATCH | `/api/v1/agency/promotions/:id` | `promotion:agency-manage` |

## `/agency/tours`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/agency/tours` | `tour:update-own` |
| POST | `/api/v1/agency/tours` | `tour:create` |
| DELETE | `/api/v1/agency/tours/:id` | `tour:delete-own` |
| GET | `/api/v1/agency/tours/:id` | `tour:update-own` |
| PATCH | `/api/v1/agency/tours/:id` | `tour:update-own` |
| PUT | `/api/v1/agency/tours/:id/availability` | `tour:set-availability` |
| GET | `/api/v1/agency/tours/:id/customers.pdf` | `agency:export-customers` |
| PUT | `/api/v1/agency/tours/:id/guide` | `tour:assign-guide` |
| PUT | `/api/v1/agency/tours/:id/itinerary` | `tour:configure-itinerary` |
| POST | `/api/v1/agency/tours/:id/submit` | `tour:update-own` |
| POST | `/api/v1/agency/tours/import` | `tour:import` |

## `/ai`

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/ai/chat` | `ai:chat` |
| GET | `/api/v1/ai/conversations` | `ai:chat` |
| GET | `/api/v1/ai/conversations/:id` | `ai:chat` |

## `/auth`

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/auth/forgot-password` | public |
| POST | `/api/v1/auth/google` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/logout` | public |
| POST | `/api/v1/auth/refresh` | public |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/resend-otp` | public |
| POST | `/api/v1/auth/reset-password` | public |
| PATCH | `/api/v1/auth/two-factor` | login |
| POST | `/api/v1/auth/verify-otp` | public |

## `/bookings`

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/bookings` | `booking:create` |
| GET | `/api/v1/bookings/:id` | `booking:view-own` |
| POST | `/api/v1/bookings/:id/cancel` | `booking:view-own` |
| GET | `/api/v1/bookings/me` | `booking:view-own` |

## `/categories`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/categories` | public |

## `/chat`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/chat/conversations` | `chat:use` |
| POST | `/api/v1/chat/conversations` | `chat:use` |
| GET | `/api/v1/chat/conversations/:id/messages` | `chat:use` |
| POST | `/api/v1/chat/conversations/:id/messages` | `chat:use` |
| POST | `/api/v1/chat/conversations/:id/read` | `chat:use` |

## `/e-tickets`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/e-tickets` | `eticket:view-own` |
| GET | `/api/v1/e-tickets/:id` | `eticket:view-own` |
| GET | `/api/v1/e-tickets/booking/:bookingId` | `eticket:view-own` |

## `/earnings`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/earnings/me` | `earnings:view` |
| GET | `/api/v1/earnings/me/summary` | `earnings:view` |

## `/guide/tours`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/guide/tours` | `guide:tours-view` |
| POST | `/api/v1/guide/tours/:tourId/verification` | `guide:tours-verify` |

## `/health`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/health` | public |

## `/moderation`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/moderation/agencies` | `agency:verify` |
| POST | `/api/v1/moderation/agencies/:id/verify` | `agency:verify` |
| GET | `/api/v1/moderation/reports` | `dispute:resolve` |
| GET | `/api/v1/moderation/reports/:id` | `dispute:resolve` |
| POST | `/api/v1/moderation/reports/:id/resolve` | `dispute:resolve` |
| GET | `/api/v1/moderation/reviews` | `review:moderate` |
| POST | `/api/v1/moderation/reviews/:id/moderate` | `review:moderate` |
| GET | `/api/v1/moderation/support-tickets` | `complaint:handle` |
| GET | `/api/v1/moderation/support-tickets/:id` | `complaint:handle` |
| POST | `/api/v1/moderation/support-tickets/:id/reply` | `complaint:handle` |
| PATCH | `/api/v1/moderation/support-tickets/:id/status` | `complaint:handle` |
| GET | `/api/v1/moderation/tours` | `tour:list-all` |
| GET | `/api/v1/moderation/tours/:id` | `tour:list-all` |
| POST | `/api/v1/moderation/tours/:id/suspend` | `tour:suspend` |
| POST | `/api/v1/moderation/tours/:id/validate` | `tour:validate` |
| POST | `/api/v1/moderation/users/:id/ban` | `account:ban` |
| POST | `/api/v1/moderation/users/:id/unban` | `account:ban` |

## `/moderation/dashboard`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/moderation/dashboard` | `moderation:dashboard` |

## `/notifications`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/notifications` | login |
| PATCH | `/api/v1/notifications/:id/read` | login |
| POST | `/api/v1/notifications/read-all` | login |
| GET | `/api/v1/notifications/unread-count` | login |

## `/payments`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/payments/:id` | login |
| POST | `/api/v1/payments/bookings/:bookingId/checkout` | `payment:create` |
| POST | `/api/v1/payments/webhooks/payos` | public |

## `/policies`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/policies` | public |
| GET | `/api/v1/policies/:key` | public |

## `/promotions`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/promotions/preview` | `booking:create` |

## `/reports`

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/reports` | `report:create` |
| GET | `/api/v1/reports/:id` | `report:create` |
| GET | `/api/v1/reports/me` | `report:create` |

## `/reviews`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/reviews` | public |
| POST | `/api/v1/reviews` | `review:create` |
| GET | `/api/v1/reviews/me` | `review:create` |

## `/subscriptions`

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/subscriptions` | `subscription:subscribe` |
| GET | `/api/v1/subscriptions/me` | `subscription:subscribe` |
| GET | `/api/v1/subscriptions/me/current` | `subscription:subscribe` |
| GET | `/api/v1/subscriptions/plans` | public |

## `/support/tickets`

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/support/tickets` | `support:create` |
| GET | `/api/v1/support/tickets/:id` | `support:create` |
| POST | `/api/v1/support/tickets/:id/close` | `support:create` |
| POST | `/api/v1/support/tickets/:id/messages` | `support:create` |
| GET | `/api/v1/support/tickets/me` | `support:create` |

## `/tour-guides`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/tour-guides/:id` | public |

## `/tours`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/tours` | public |
| GET | `/api/v1/tours/:id` | public |

## `/users`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/users/me` | `profile:view-own` |
| PATCH | `/api/v1/users/me` | `profile:update-own` |
| POST | `/api/v1/users/me/agency-verification` | `profile:update-own` |

## `/wishlist`

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/wishlist` | `wishlist:manage` |
| DELETE | `/api/v1/wishlist/:tourId` | `wishlist:manage` |
| POST | `/api/v1/wishlist/:tourId` | `wishlist:manage` |
