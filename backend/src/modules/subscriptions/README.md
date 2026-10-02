# subscriptions

Subscription plans that **tour guides** buy through the payment gateway. This module owns the plans, the guide's
subscription periods and their lifecycle; the money side is delegated to `payments`.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Subcribe to plan (includes Make payment → Payment Gateway) | Tour guide | `GET /subscriptions/plans`, `POST /subscriptions`, `GET /subscriptions/me`, `GET /subscriptions/me/current` |

## Files
| File | Role |
|---|---|
| `subscriptions.service.ts` | Subscribe, payment fulfilment (`activateFromPayment`), current state, maintenance jobs |
| `subscriptions.model.ts` | `SubscriptionPlan` and `Subscription` schemas |
| `subscriptions.repository.ts` | DB access incl. `createPlanIfAbsent` (seed script; never overwrites an existing plan) |
| `subscriptions.types.ts` / `.mapper.ts` | DTOs, `SUBSCRIPTION_STATUS`, `SUBSCRIPTION_TRANSITIONS`, policy |
| `subscriptions.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer |
| `index.ts` | Public API **and** registration of the payment handler |

## API (base `/api/v1`)
* `GET /subscriptions/plans` (public) → `[{ id, code, name, description?, price, durationDays, benefits[] }]`.
* `POST /subscriptions` (`subscription:subscribe`) body `{ planId }` → 201 `{ subscription, checkout{ paymentId, checkoutUrl, amount, expiresAt } }`. No price is accepted from the client.
* `GET /subscriptions/me?page&limit` → my subscriptions, newest first. `GET /subscriptions/me/current` → `{ active, subscription|null }`.

## Business rules
1. Price and duration are snapshotted from the plan when the guide subscribes; changing a plan later does not alter existing subscriptions.
2. Pressing "subscribe" again for the same plan while unpaid reuses the same subscription and the same payment link.
3. A verified payment (`paymentEvents.onPaid('SUBSCRIPTION')`) activates the subscription. Activation is idempotent and is a compare-and-set.
4. Renewals stack: the new period starts when the running one ends (or now if none), so paying twice never wastes time.
5. A payment that arrives after the subscription was cancelled still activates it (money received wins).
6. Jobs: `expireEndedSubscriptions()` (ACTIVE → EXPIRED) and `cancelAbandonedSubscriptions()` (unpaid for > 2× the payment window → CANCELLED).
7. Other modules ask `subscriptionsService.hasActiveSubscription(userId)`; **nothing is gated on it yet** because the diagram does not say what a subscription unlocks (DECISIONS D-18/D-44).

## State machine (`SUBSCRIPTION_TRANSITIONS`)
`PENDING_PAYMENT → ACTIVE | CANCELLED`; `CANCELLED → ACTIVE` (late payment); `ACTIVE → EXPIRED`; `EXPIRED` terminal.

## Data model
* `SubscriptionPlan { code (unique), name, description?, price, durationDays, benefits[], isActive, sortOrder }`, index `(isActive, sortOrder)`. Plans are created by the seed script (`pnpm --filter backend seed`, illustrative prices); there is no plan-management endpoint (not in the diagram).
* `Subscription { userId, planId, planCode, planName, price, durationDays, status, startsAt?, endsAt? }`, indexes `(userId, status, endsAt)`, `(userId, createdAt)`, unique partial `(userId, planId)` where `status = PENDING_PAYMENT` (one unpaid subscription per plan: double click safe), `(status, endsAt)`, `(status, createdAt)`.

## Permissions
`subscription:subscribe` (TOUR_GUIDE) for subscribing and reading own subscriptions; plans are public.

## Dependencies
* Uses: `payments` (`createCheckout`, `paymentEvents`), `notifications`.
* Used by: scheduler (jobs), future gating features.

## Events / side effects
Notification + email `SUBSCRIPTION_ACTIVATED`; payment `PAYMENT_SUCCEEDED` comes from `payments`.

## Testing
`__tests__/subscriptions.integration.test.ts` – real PostgreSQL + faked PayOS: subscribe -> signed webhook -> ACTIVE once (6 parallel replays), double click creates one subscription and one payment, renewals stack, abandoned/ended sweeps, late payment still activates, foreign payments are 404.
`__tests__/subscriptions.service.test.ts` – checkout from plan data, reuse, idempotent activation, stacking, late payment, failure signalling, expiry and abandonment jobs.

## Not implemented / follow-ups
* What a subscription unlocks (e.g. being assignable to tours) – owner decision needed.
* Cancelling/refunding an active subscription, auto-renewal, plan management endpoints.
