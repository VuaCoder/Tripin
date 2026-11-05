# Premium

Role-specific paid memberships built on the existing `Subscription`, `Payment` and PayOS fulfilment pipeline. Legacy Guide plans keep `isPremium=false`; their price, periods and benefits are not migrated into Premium entitlements.

## Access and entry points

- Public: `GET /premium/plans?audience=TRAVELER|TOUR_GUIDE`, `GET /premium/guides/:id` (membership label and published portfolio only).
- Account: `GET /premium/me`, `/premium/me/history?page&limit`, `/premium/me/vouchers`, `/premium/subscriptions/:id`; `POST /premium/subscribe {planId}` requires `premium:subscribe` and a matching current role. History returns standard `data`/`meta` pagination; callbacks read the exact owned period instead of searching a bounded history page.
- Refund request: `POST /premium/subscriptions/:id/refunds {reason}`; ownership comes from the actor.
- Guide: `GET/PUT /premium/guide/profile`, `GET /premium/guide/analytics`, `POST /premium/guide/images/signature`, `POST /premium/guide/images/complete`. Writes, analytics and upload require an effective Guide Premium membership. Basic profile/earnings APIs stay available.
- Agency: `/agency/premium/contributions` GET/POST, `POST /:id/stop`, `GET /agency/premium/usage`; requires Agency role plus `premium:contribute`.
- Super Admin: `/admin/premium/plans` GET/POST, `PATCH /plans/:id {published}`, `/contributions` GET and `PATCH /contributions/:id {status}`, `/refunds` GET and `PATCH /refunds/:id {action,note,transferReference?}`, `/flags` GET/PUT, `/operations` GET. Requires Super Admin role plus `premium:manage`.

## Commercial rules

Plans are immutable editions: new prices/benefits require a new unique code/version. Admin can publish/stop an edition but cannot rewrite sold terms. Publication requires configured benefits and approved supply for Traveler plans. Sales additionally require `SystemSetting` key `premium.enabled.TRAVELER` or `premium.enabled.TOUR_GUIDE` to be exactly JSON `true`; absent flags are off.

One period may contain at most 500 vouchers across at most 20 sources. The wallet returns the latest 500 by period expiry so the entire running period remains visible; older periods remain in paginated subscription history.

Agency contributions apply only to their own explicitly selected tours. Agencies fund the discount and consent to the committed quantity. Sources cannot be edited after submission; stopping prevents new purchases, while sold snapshots remain enforceable. `reserved` includes checkout holds and lifetime sold commitments, not only redeemed vouchers.

Checkout snapshots benefit text/version and reserves source quantity in stable lock order. Activation locks the subscriber row and stacks periods after the last non-revoked Premium period of that audience. Webhook replays do not extend time. Grants are transactional and unique by `(subscriptionId,contributionId,ordinal)` and happen only at period start. `/me` derives the contiguous paid expiry, excluding revoked periods and gaps, and matches the user's current role.

Expired unpaid holds are released after the payment reconciler has no PENDING/PAID payment. Late money after release creates an approved manual-refund obligation instead of consuming inventory already sold to another customer. Provider failures can leave an unpaid hold until the maintenance sweep; they never grant membership.

## Booking and refund safety

`POST /bookings` optionally accepts `premiumVoucherId`, mutually exclusive with all existing promotion fields. Server validates owner, dates, agency, tour and minimum spend against the immutable voucher terms. A conditional lease prevents double redemption. Booking persistence and attachment of its lease share a transaction; failure releases only that lease token. Cancellation releases by booking ID; maintenance reconciles any cancellation whose release was interrupted. Existing non-Premium promotion stacking is unchanged.

Refunds are full amount and only for paid periods whose start is still in the future when reviewed. Approval revokes that period and releases its committed inventory; other sold dates remain unchanged. Manual completion requires a transfer reference and is idempotent. Original payments remain PAID for audit; revoked subscriptions cannot be reactivated by replayed webhooks. A late-payment automatic refund is the exception to the future-period requirement because no entitlement was granted.

## Guide and operations

Existing Guide fields remain free. Premium adds portfolio/certificates, scoped Cloudinary image slots, advanced analytics and directory priority before pagination. Documents are self-reported, not verification. Expiration preserves private edits but hides public Premium sections and blocks writes/analytics. Activity is recorded transactionally on assignment, response and earning creation; history begins at this deployment and is not reconstructed from overwritten assignments.

Maintenance: grant due benefits and release stale holds/leases every minute. Operations exposes paid-but-unfulfilled subscription payments, overdue holds and pending manual refunds. Notification failures are logged by the existing notification module. Run workers and monitor `[job] premium.*` / payment fulfilment errors.

## Deployment and validation

Migration: `prisma/migrations/20261025090000_premium/migration.sql`. It adds tables/columns and database constraints without converting legacy subscriptions. Test on an isolated database using the existing PostgreSQL integration harness; use a direct connection when applying migrations. No development test requires a production database.

Frontend: `/premium`, `/agency/premium`, `/super-admin/premium`, existing voucher wallet, account/header/mobile avatars and Guide directory/public profile. Membership dates display in Asia/Ho_Chi_Minh. Analytics months use UTC. Query caches reset on identity changes; local editing surfaces remount per account.

Before opening sales: deploy schema/API/UI together, verify real PayOS callbacks and Cloudinary configuration, have Agencies submit supply, approve it, publish configured editions, then enable one role's sales flag at a time. Stopping sales must never disable existing paid entitlements. No automatic renewal, automated refund transfer or Agency-owned subscription products are implemented.
