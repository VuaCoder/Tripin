# payments

Online payment of bookings and guide subscriptions (`purpose` BOOKING / SUBSCRIPTION) through a **payment provider abstraction**. PayOS is the
first provider. Business logic never talks to PayOS directly.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Make payment (includes Payment Gateway actor) | Traveler | `POST /payments/bookings/:bookingId/checkout` |
| (supporting) check payment result / reconcile | Traveler | `GET /payments/:id` |
| (system) payment confirmation from the gateway | Payment Gateway | `POST /payments/webhooks/payos` |
| Subscribe to plan (payment step) | Tour guide | `subscriptions` calls `paymentsService.createCheckout` (B12) |
| Receive E-ticket (trigger) | Traveler | payment → `bookings.confirmPayment` → `bookingEvents.onConfirmed` → `e-tickets` (B10) |

## Files
| File | Role |
|---|---|
| `providers/payment.provider.ts` | `PaymentProvider` interface (create link, verify webhook, get status) |
| `providers/payos.provider.ts` | PayOS over REST + HMAC-SHA256 (no SDK); `canonicalize()` for signatures |
| `payments.service.ts` | Checkout, idempotent webhook settlement, reconciliation, expiry & retry jobs |
| `payments.events.ts` | `paymentEvents.onPaid(purpose, handler)` for non-booking purposes |
| `payments.model.ts` / `.repository.ts` / `.mapper.ts` / `.types.ts` | persistence, DTOs, `PAYMENT_TRANSITIONS` |
| `payments.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer |
| `index.ts` | Public API |

## API (base `/api/v1`)
* `POST /payments/bookings/:bookingId/checkout` (`payment:create`) → 201 `{ paymentId, checkoutUrl, amount, expiresAt }`. No body: amount and description come from the booking. While a live link exists for the same booking the **same link** is returned.
* `GET /payments/:id` (any logged-in owner) → `PaymentDto` (`checkoutUrl` only while PENDING). A PENDING payment is first reconciled with the gateway, so a delayed webhook does not leave the user stuck.
* `POST /payments/webhooks/payos` (public, rate limited) → always `200 { success:true }` for a correctly signed call, 400 for a bad signature.
* Configuration (`.env`): `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, optional `PAYMENT_RETURN_URL` / `PAYMENT_CANCEL_URL`. Without credentials checkout answers 503 and webhooks 503. Register the webhook URL `https://<api>/api/v1/payments/webhooks/payos` in the PayOS dashboard.

## Business rules
1. **Never trust the client**: no price, total or "paid" flag is accepted from a request. The amount is read from the booking on the server.
2. **Webhook trust** comes only from the HMAC signature (checksum key). After that the order is found by **our** order code and the amount in the webhook must equal the stored amount, otherwise it is recorded (`AMOUNT_MISMATCH`) and ignored.
3. **Idempotency**: PENDING→PAID is a compare-and-set, and the business effect is gated by `fulfilledAt`. Replays and concurrent deliveries confirm the booking and notify the payer once. If fulfilment throws, the payment stays PAID-but-unfulfilled and `retryUnfulfilled()` (job) / the next webhook delivery repeats it.
3b. **One open payment per booking / subscription**: a unique partial index (`status = PENDING`) makes parallel checkouts (double click, two tabs) create a single payment; the loser waits (max ~0.5 s) and returns the winner's link, otherwise `409 PAYMENT_IN_PROGRESS`. An expired PENDING payment the sweep has not closed yet is closed by the next checkout.
4. A payment that arrives after `EXPIRED/CANCELLED/FAILED` still becomes PAID (money was received); `bookings.confirmPayment` then flags `refundRequired` instead of reviving a cancelled booking.
5. Unknown order codes (e.g. the gateway's test ping) and non-success events are acknowledged but ignored.
6. `expireStalePayments()` (job) asks the gateway before expiring, so a missed webhook still settles correctly.
7. Order codes are strictly increasing per process (ms × 1000 + random offset) and protected by a unique index with a retry on collision.
8. Gateway failures surface as 503 without provider details; the half-created payment is marked `FAILED (PROVIDER_ERROR)`.

## State machine (`PAYMENT_TRANSITIONS`)
`PENDING → PAID | CANCELLED | EXPIRED | FAILED`; `EXPIRED | CANCELLED | FAILED → PAID` (late money, webhook-verified only); `PAID` is terminal.

## Data model
`Payment { purpose, userId, referenceId, amount, provider, providerOrderCode (unique), providerPaymentLinkId, checkoutUrl, status, expiresAt, paidAt, fulfilledAt, failureReason }`.
Indexes: unique partial `(purpose, referenceId)` where `status = PENDING` (at most one open payment per booking / subscription: reuse of the live link and protection against double clicks), `(userId, createdAt)`, `(status, expiresAt)` expiry job, `(status, fulfilledAt)` retry of PAID-but-unfulfilled payments.

## Permissions
`payment:create` for booking checkout; reading a payment needs login + ownership (404 otherwise); the webhook is public + signature.

## Dependencies
* Uses: `bookings` (`getPayable`, `confirmPayment`), `notifications`.
* Used by: `subscriptions` (checkout + `paymentEvents`), the scheduler (jobs).

## Events / side effects
Notification `PAYMENT_SUCCEEDED`; booking confirmation (which emails/notifies and issues the e-ticket via its own event).

## Testing
`__tests__/payos.provider.test.ts` – signature verification (tampering, wrong key, malformed), request signing, gateway failure mapping.
`__tests__/payments.integration.test.ts` – real MongoDB with a faked PayOS HTTP API: signed webhook confirms the booking and issues exactly one e-ticket/notification even with 7 parallel replays; tampered/unsigned/wrong-amount/unknown-order webhooks change nothing; cancelled-booking payment is flagged for refund; retry job fulfils once.
`__tests__/payments.service.test.ts` (also: polling `GET /payments/:id` asks the gateway at most once per 5 s per payment) – amount source, link reuse, idempotent/concurrent webhooks, amount mismatch, late payment, retry of failed fulfilment, reconciliation, expiry.

## Not implemented / follow-ups
* Refunds / payouts (no provider refund API call; bookings only carry `refundRequired`).
* Verify the signature recipe against the PayOS **sandbox** before go-live (implemented from the public docs, covered by unit tests only).
* Other providers: implement `PaymentProvider` and select it in `PaymentsService`'s default argument.
