# API error codes

Every error answers `{ "success": false, "error": { "code", "message", "details"? } }`. The **`code`** is the stable,
machine-readable part: clients branch on it, never on `message`. A test (`src/routes/__tests__/error-contract.test.ts`)
fails when a code exists in the source but not in this table, when this table lists a code the source no longer uses,
or when the HTTP status written here differs from the status the code is thrown with.

Unknown or foreign records answer **404** (never 403) so ids of other people's data are not revealed.

## General

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body, query or path failed validation; `details[]` lists `location`, `path`, `message`. Also used for malformed JSON and `413` payload too large |
| `UNAUTHENTICATED` | 401 | No or unusable credentials where a login is required |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password (same answer for unknown email), or wrong password confirmation |
| `TOKEN_INVALID` | 401 | Access or refresh token is malformed, expired, forged, revoked, or its account is gone/not active |
| `FORBIDDEN` | 403 | The account lacks the permission, or a business rule forbids the actor |
| `NOT_FOUND` | 404 | Unknown route, unknown id, or a record that belongs to someone else |
| `CONFLICT` | 409 | Duplicate (unique index) or generic state conflict |
| `INVALID_STATE_TRANSITION` | 409 | The record is in a state from which the requested change is not allowed |
| `CONCURRENT_UPDATE` | 409 | Somebody changed the record between read and write; reload and retry |
| `RATE_LIMITED` | 429 | Too many requests from this client |
| `SERVICE_UNAVAILABLE` | 503 | A required provider (payment, mail, AI, Google) is not configured or not reachable |
| `INTERNAL_ERROR` | 500 | Unexpected server error; details are only in the server log |

## Accounts and sessions (`auth`, `users`)

| Code | HTTP | Meaning |
|---|---|---|
| `ACCOUNT_BANNED` | 403 | The account was banned by a moderator |
| `ACCOUNT_NOT_VERIFIED` | 403 | The email has not been verified yet (a new code is sent) |
| `EMAIL_ALREADY_REGISTERED` | 409 | The email belongs to an active account |
| `AGENCY_PORTAL_REQUIRED` | 403 | Agency accounts must use the dedicated Agency authentication portal |
| `AGENCY_ONBOARDING_REQUIRED` | 403 | Agency account is missing the required onboarding profile |
| `OTP_INVALID` | 400 | Wrong, used, or unknown one-time code |
| `OTP_EXPIRED` | 400 | The one-time code is older than its lifetime |
| `OTP_TOO_MANY_ATTEMPTS` | 429 | Too many wrong guesses for this code; request a new one |
| `OTP_RESEND_TOO_SOON` | 429 | A code was sent a moment ago; wait for the cooldown |
| `AGENCY_NOT_VERIFIED` | 403 | The agency profile is not VERIFIED yet (needed to submit tours) |
| `LAST_SUPER_ADMIN` | 409 | The last active Super admin cannot be demoted |
| `TWO_FACTOR_REQUIRES_PASSWORD` | 400 | The account is Google-only and must configure a password to enable 2FA |

## Tours and inventory (`tours`, `categories`, `promotions`)

| Code | HTTP | Meaning |
|---|---|---|
| `TOUR_LOCKED` | 409 | The tour is in PENDING_REVIEW and cannot be edited |
| `TOUR_HAS_BOOKINGS` | 409 | The tour has sold seats on a future departure and cannot be deleted |
| `NO_OPEN_DEPARTURE` | 400 | A tour needs at least one open future departure to be submitted |
| `ITINERARY_EXCEEDS_DURATION` | 400 | An itinerary day is beyond `durationDays` |
| `CAPACITY_BELOW_BOOKED` | 409 | Capacity cannot go below the seats already sold |
| `DEPARTURE_HAS_BOOKINGS` | 409 | A departure with sold seats cannot be moved or removed (close it instead) |
| `DEPARTURE_UNAVAILABLE` | 409 | The departure is closed, past, or sold out |
| `CATEGORY_EXISTS` | 409 | A category with the same slug exists |
| `PROMOTION_CODE_EXISTS` | 409 | The promotion code is already used |
| `PROMOTION_IN_USE` | 409 | The discount of a promotion that has been used cannot change |
| `PROMOTION_INACTIVE` | 409 | The promotion is switched off |
| `PROMOTION_NOT_STARTED` | 409 | The promotion has not started |
| `PROMOTION_EXPIRED` | 409 | The promotion has ended |
| `PROMOTION_NOT_APPLICABLE` | 409 | The promotion belongs to another agency |
| `PROMOTION_MIN_ORDER` | 409 | The order is below the promotion's minimum amount |
| `PROMOTION_EXHAUSTED` | 409 | Every redemption of the promotion is used |

## Bookings and payments (`bookings`, `payments`, `reviews`)

| Code | HTTP | Meaning |
|---|---|---|
| `NOT_ENOUGH_SEATS` | 409 | Fewer seats left than requested |
| `BOOKING_AMOUNT_TOO_LOW` | 409 | The amount to pay would be below 1 VND (a free departure, or a promotion that makes the order free); online payment is impossible, so no booking is created |
| `BOOKING_NOT_PAYABLE` | 409 | The booking is not PENDING, so there is nothing to pay |
| `BOOKING_PAYMENT_EXPIRED` | 409 | The payment window of the booking has passed |
| `CANCELLATION_WINDOW_PASSED` | 409 | Too close to departure to cancel under the cancellation policy |
| `PAYMENT_IN_PROGRESS` | 409 | A parallel request is creating the payment link; retry in a moment |
| `BOOKING_NOT_COMPLETED` | 409 | Only a COMPLETED booking can be reviewed |
| `REVIEW_EXISTS` | 409 | The booking already has a review |

## Community (`reports`, `support`, `wishlists`, `ai`)

| Code | HTTP | Meaning |
|---|---|---|
| `REPORT_ALREADY_OPEN` | 409 | The reporter already has an open report about this target |
| `TICKET_CLOSED` | 409 | A closed support ticket accepts nothing |
| `TICKET_FULL` | 409 | The support ticket reached its message limit |
| `WISHLIST_FULL` | 409 | The wishlist reached its size limit |
| `AI_CONVERSATION_FULL` | 409 | The AI conversation reached its message limit; start a new one |
