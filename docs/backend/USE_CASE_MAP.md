# Use case -> module -> endpoint map

Source: `docs/architecture/TripRi.json` (8 pages). Base path `/api/v1`. **Status**: `done` = implemented + README +
tests, `todo` = planned. This file is the contract for the backend; update it when an endpoint changes.
Endpoint names below are the plan; if the implementation deviates, fix this table in the same edit.

Permission column: `GUEST` = no login needed, `auth` = any logged-in user, otherwise the `PERMISSIONS.*` key.

## Authentication (module `auth`)
| Use case | Actor | Endpoint | Status |
|---|---|---|---|
| Register Traveler / Tour guide | Guest | `POST /auth/register` | done |
| Register Agency + onboarding profile | Guest | `POST /auth/agency/register` | done |
| Verify / resend Agency OTP | Agency | `POST /auth/agency/verify-otp`, `POST /auth/agency/resend-otp` | done |
| Check Agency application status | Agency | `GET /auth/agency/application-status` | done |
| View / edit / resubmit Agency application | Agency | `GET /auth/agency/application`, `PUT /auth/agency/application` | done |
| Upload Agency business license | Agency | `POST /auth/agency/upload-license` | done |
| Dev simulate Agency accept / reject | Dev / Admin | `POST /auth/agency/dev-accept`, `POST /auth/agency/dev-reject` | done |
| Verify OTP | Guest/User | `POST /auth/verify-otp` (purposes REGISTER, LOGIN_2FA) | done |
| View authentication security status | authenticated user | `GET /auth/security` | done |
| Resend OTP (register / login 2FA) | Guest/User | `POST /auth/resend-otp` | done |
| Customer login (+ Validate credentials, + 2FA extend) | Traveler / Tour guide / Staff | `POST /auth/login` | done |
| Agency login (+ 2FA extend) | Agency | `POST /auth/agency/login` | done |
| Login with Google (+ Authenticate via OAuth) | Guest | `POST /auth/google` | done |
| Forgot password (+ Verify OTP) | All | `POST /auth/forgot-password`, `POST /auth/reset-password` | done |
| Log out | All | `POST /auth/logout`, `POST /auth/refresh` (session upkeep) | done |
| Enable/disable 2FA (supports Verify OTP extend) | auth | `PATCH /auth/two-factor` | done |

## Guest (public)
| Use case | Module | Endpoint | Status |
|---|---|---|---|
| Search tours / Filter tours / View tours list | tours | `GET /tours` | done |
| List tour destinations | tours | `GET /tours/destinations` | done |
| View tour details | tours | `GET /tours/:id` | done |
| (supporting) health check | app | `GET /health` | done |
| View public tour guide profile | users | `GET /tour-guides/:id` | done |
| View public agency profile | users | `GET /agencies/:id` | done |
| View public agency promotions | promotions | `GET /agencies/:id/promotions` | done |
| View public review | reviews | `GET /reviews?tourId=` or `?agencyId=` | done |
| (supporting) list categories | categories | `GET /categories` | done |
| (supporting) read policies | system-settings | `GET /policies`, `GET /policies/:key` | done |

## Traveler
| Use case | Module | Endpoint | Permission | Status |
|---|---|---|---|---|
| View profile / Update profile informations | users | `GET/PATCH /users/me`, `GET/PATCH /users/me/preferences` | profile:* | done |
| Upload profile avatar | users | `POST /users/me/avatar/upload-signature`, `POST /users/me/avatar/complete`, `DELETE /users/me/avatar` | profile:update-own | done |
| Add wishlist / Remove tour from wishlist | wishlists | `GET /wishlist`, `POST /wishlist/:tourId`, `DELETE /wishlist/:tourId` | wishlist:manage | done |
| Add tour to cart / view cart / update or remove an item (supports Book tour) | carts | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id` | cart:manage | done |
| Book tour | bookings | `GET /promotions/preview`, `GET /promotions/available` (available promotions for tour), `GET /promotions/my-vouchers`, `POST /promotions/collect`, `POST /bookings`, `GET /bookings/me`, `GET /bookings/:id`, `POST /bookings/:id/cancel` | booking:* | done |
| Complete an owned booking | bookings | `POST /bookings/:id/complete` | booking:view-own | done |
| Make payment (Payment Gateway) | payments | `POST /payments/bookings/:bookingId/checkout`, `GET /payments/:id`, `POST /payments/webhooks/payos` (GUEST, signature) | payment:create | done |
| Receive E-ticket | e-tickets | `GET /e-tickets`, `GET /e-tickets/:id`, `GET /e-tickets/booking/:bookingId` (+ email/notification on issue) | eticket:view-own | done |
| Write a review / View reviews | reviews | `POST /reviews`, `GET /reviews/me`, `POST /reviews/images/upload-signature` | review:create | done |
| Send report | reports | `POST /reports`, `GET /reports/me`, `GET /reports/:id` | report:create | done |
| Tour complaint tickets | complaints | `POST /complaints`, `GET /complaints/me`, `GET /complaints/:id`, `POST /complaints/:id/messages`, `POST /complaints/:id/accept-resolution`, `POST /complaints/:id/escalate`, `POST /complaints/:id/feedback`, `POST /complaints/images/upload-signature` | report:create | done |
| Send ticket (support) | support | `POST /support/tickets`, `GET /support/tickets/me`, `GET /support/tickets/:id`, `POST /support/tickets/:id/messages`, `POST /support/tickets/:id/close` | support:create | done |
| Make a conversation (with Tour guide) | chat | `POST /chat/conversations`, `GET /chat/conversations`, `GET /chat/conversations/:id`, `GET /chat/conversations/:id/messages`, `POST /chat/conversations/:id/messages`, `POST /chat/conversations/:id/read` + Socket.IO | chat:use | done |
| Chat with AI (AI Agent) | ai | `POST /ai/chat`, `GET /ai/conversations`, `GET /ai/conversations/:id` | ai:chat | done |
| (supporting) notifications | notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `DELETE /notifications/:id` | auth; owner-scoped | done |

## Agency
| Use case | Module | Endpoint | Permission | Status |
|---|---|---|---|---|
| Register, onboard and sign in through dedicated portal | auth | `POST /auth/agency/register`, `/login`, `/verify-otp`, `/resend-otp` | GUEST | done |
| Create / Edit / Delete tour | tours | `POST /agency/tours`, `POST /agency/tours/upload-image`, `POST /agency/tours/categories`, `PATCH /agency/tours/:id`, `DELETE /agency/tours/:id`, `POST /agency/tours/:id/restore`, `GET /agency/tours`, `GET /agency/tours/:id` | tour:create/update-own/delete-own | done |
| Upload tours | tours | `POST /agency/tours/import` (bulk JSON, see DECISIONS); `POST /agency/tours/extract-document` (DOCX/PDF to unpersisted AI drafts) | tour:import | done |
| Set tour availability | tours | `PUT /agency/tours/:id/availability` | tour:set-availability | done |
| Config itinerary | tours | `PUT /agency/tours/:id/itinerary` | tour:configure-itinerary | done |
| Assign guide to tour | tours | `GET /agency/guides`, `PUT /agency/tours/:id/guide` | tour:assign-guide | done |
| (supporting) submit tour for review | tours | `POST /agency/tours/:id/submit` | tour:update-own | done |
| Upload promotions | promotions | `GET/POST /agency/promotions`, `GET/PATCH /agency/promotions/:id`, `POST /agency/promotions/:id/generate-batch`, `GET /agency/promotions/:id/batch` | promotion:agency-manage | done |
| View dashboard | dashboards | `GET /agency/dashboard` | agency:dashboard | done |
| View bookings status | bookings | `GET /agency/bookings`, `GET /agency/bookings/:id` | agency:bookings-view | done |
| Export customer PDF | bookings | `GET /agency/tours/:id/customers.pdf` | agency:export-customers | done |
| Handle tour complaints | reports | `GET /agency/complaints`, `GET /agency/complaints/:id`, `POST /agency/complaints/:id/respond` | complaint:respond | done |
| Handle complaint tickets | complaints | `GET /agency/complaint-tickets`, `GET /agency/complaint-tickets/:id`, `POST /agency/complaint-tickets/:id/messages`, `POST /agency/complaint-tickets/:id/resolve`, `POST /agency/complaint-tickets/:id/escalate`, `POST /agency/complaint-tickets/images/upload-signature` | complaint:respond | done |
| Dispute a review | reports | `GET /agency/review-disputes`, `POST /agency/review-disputes/:reviewId` | review:dispute | done |
| View/Update profile (+ submit for verification) | users | `GET/PATCH /users/me`, `POST /users/me/agency-verification` | profile:* | done |

## Tour guide
| Use case | Module | Endpoint | Permission | Status |
|---|---|---|---|---|
| View Profile / Update Profile | users | `GET/PATCH /users/me`, `POST /users/me/license-image/upload-signature`, `POST /users/me/license-image/complete` | profile:* | done |
| View assigned tours | tours | `GET /guide/tours` | guide:tours-view | done |
| Verify assigned tours | tours | `POST /guide/tours/:tourId/verification` (accept/decline) | guide:tours-verify | done |
| Subcribe to plan (Payment Gateway) | subscriptions | `GET /subscriptions/plans`, `POST /subscriptions`, `GET /subscriptions/me`, `GET /subscriptions/me/current` | subscription:subscribe | done |
| View earnings | earnings | `GET /earnings/me`, `GET /earnings/me/summary` | earnings:view | done |
| Make a conservation (with Traveler) | chat | same as Traveler | chat:use | done |

## Moderator
| Use case | Module | Endpoint | Permission | Status |
|---|---|---|---|---|
| View moderation dashboard | moderation/dashboards | `GET /moderation/dashboard` | moderation:dashboard | done |
| View tour lists | moderation | `GET /moderation/tours`, `GET /moderation/tours/:id` | tour:list-all | done |
| Validate tour | moderation | `POST /moderation/tours/:id/validate` (approve/reject) | tour:validate | done |
| Suspend tours | moderation | `POST /moderation/tours/:id/suspend` | tour:suspend | done |
| Verify Agency Profile | moderation | `GET /moderation/agencies`, `POST /moderation/agencies/:id/verify` | agency:verify | done |
| Moderate reviews | moderation | `GET /moderation/reviews`, `POST /moderation/reviews/:id/moderate` | review:moderate | done |
| Ban violating account | moderation | `POST /moderation/users/:id/ban`, `POST /moderation/users/:id/unban` | account:ban | done |
| Resolve disputes | moderation | `GET /moderation/reports`, `GET /moderation/reports/:id`, `POST /moderation/reports/:id/resolve` | dispute:resolve | done |
| Handle complaints | moderation | `GET /moderation/support-tickets`, `GET /moderation/support-tickets/:id`, `POST /moderation/support-tickets/:id/reply`, `PATCH /moderation/support-tickets/:id/status` | complaint:handle | done |
| Adjudicate complaints & CSAT dashboard | complaints | `GET /moderation/complaint-tickets`, `GET /moderation/complaint-tickets/:id`, `POST /moderation/complaint-tickets/:id/messages`, `POST /moderation/complaint-tickets/:id/adjudicate`, `GET /moderation/complaint-tickets/dashboard/agency-quality`, `POST /moderation/complaint-tickets/images/upload-signature` | dispute:resolve | done |

## Super admin

All `/admin/*` endpoints require the current `SUPER_ADMIN` role in addition to their permission; extra admin permissions on another role do not grant access. Backend status remains separate from frontend/QA readiness: see `frontend/features/admin/README.md` and `docs/testing/admin-01/README.md`.

| Use case | Module | Endpoint | Permission | Status |
|---|---|---|---|---|
| Set platform commission rates | system-settings | `GET/PUT /admin/settings/commission` | commission:configure | done |
| View detailed dashboards | dashboards | `GET /admin/dashboard` | admin:dashboard | done |
| Config platform promotions | promotions | `GET/POST /admin/promotions`, `GET/PATCH /admin/promotions/:id`, `POST /admin/promotions/:id/generate-batch`, `GET /admin/promotions/:id/batch` | promotion:platform-manage | done |
| Assign User Permissions | users | `GET /admin/users`, `PATCH /admin/users/:id/access` (role + extra permissions) | user:assign-permissions | done |
| Config Tour Categories | categories | `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id` | category:configure | done |
| Configure System Policies | system-settings | `PUT /admin/policies/:key` (read is public `GET /policies`) | policy:configure | done |
| (supporting) audit log | audit | `GET /admin/audit-logs` | audit:view | done |

## Out of the diagram (kept as documented placeholders, no code)
`custom-tours` — present in the repository architecture (AI rules §13) but not in the use-case diagram; its folder
contains only a README explaining the intended boundary. `carts` was approved by the owner and is now implemented
(D-81); it is mapped to the Traveler "Book tour" flow above.

## ADMIN-01 reporting/filter extension
Admin dashboard accepts paired `from`/`to` (max 366 days), returns previous-period comparison and a bounded zero-filled UTC monthly series. Admin user list supports createdAt date filters; promotion lists support literal q, discountType and overlapping validity bounds. All filtering happens before pagination and uses the original admin role/permission guards.
