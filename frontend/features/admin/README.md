# Platform administration (ADMIN-01)

Six Super Admin screens use the existing domain APIs through `api/adminApi.ts` and the shared RTK Query `baseApi`:

| Route | Behavior |
|---|---|
| `/super-admin` | Inclusive Vietnam date range, 7/30/90/365-day presets, prior-period comparison, revenue/booking line charts, distribution charts and accessible detail table |
| `/super-admin/promotions` | Server search by code/title, type/activation/validity-overlap filters and pagination; fresh detail before edit, create/edit/activate/deactivate |
| `/super-admin/users` | Server search/role/status/creation-date filters, paginated table, review and confirm role/extra permission replacement |
| `/super-admin/settings/commission` | Read and confirm a global commission rate for new bookings |
| `/super-admin/categories` | Accent-insensitive local search, activation filter, name/display-order sort, create/edit/deactivate/re-activate |
| `/super-admin/policies` | Text/type filters over all four loaded policies; directly update text and typed parameters |

The existing layout `RoleGuard` prevents mounting protected children before authentication or for another role. Every page also skips API queries until an authenticated Super Admin session is ready. Backend admin routers require both the current Super Admin role and the route permission; extra admin permissions alone never authorize another role. A 403 hides the screen's private content and edit dialogs. Public category/policy reads remain public.

Mutations await `.unwrap()` before reporting success. There are no optimistic settings writes. Errors preserve drafts, failed mutations do not invalidate saved caches, and refetch failure keeps confirmed data with an explicit stale-data notice. Network/timeout errors say the outcome is unconfirmed: read again before repeating a write. Account switch/logout uses existing API identity isolation; updating a target user never overwrites the acting admin's auth state.

Public tour categories share the Category cache tag so category changes refresh selectors. Promotion tags distinguish platform and agency lists. Commission and policy tags have their own namespaces. All permissions and role defaults come from the workspace constants package; no duplicated permission catalogue.

Promotion form, validation and payload builders live in `features/promotions`; the former Agency paths re-export them for compatibility. Edit validation does not pretend the current API can clear an existing numeric usage limit/discount cap. Description may be cleared with an empty string. Redeemed discounts are locked, with backend enforcement for races.

Policy editing sends the full current parameter map with explicit number/string/boolean types, preserves params during text-only changes, and refuses invalid cancellation hours. Content is rendered as escaped text, never injected HTML. Backend persistence replaces the stored document; default params are merged in responses. No drafts, publishing, policy versions or approval flow exist.

Limits: dashboard may be cached for 30 seconds; generatedAt is shown. Revenue is integer VND and monthly buckets are UTC. Commission is platform-wide only; old bookings keep their snapshot. Configuration updates currently use last-write-wins, and audit writes are best-effort. No schema migration was added for ADMIN-01.

AdminFrame uses a single-column layout with breadcrumb, aligned header/actions and shared filter/card spacing. Administration navigation uses the existing application header on desktop and mobile. Search and filters remain inside each relevant screen. The dashboard filter remains available during loading/errors. SVG charts use existing dependencies only, with focusable data points, native tooltips, legends and an expandable source table; no raster/third-party chart assets are needed.

Dashboard defaults to the last 30 Vietnam calendar dates. A selected range affects booking revenue (`confirmedAt`), subscription payment revenue (`paidAt`) and booking status counts (`createdAt`); it does not filter platform snapshot figures, which are visibly grouped separately. Backend comparison uses an immediately preceding disjoint interval of equal duration. Missing months in selected ranges are zero-filled. All-time selection retains lifetime financial totals and the backend's last-12-month chart. Date bounds are validated on both sides, with a 366-day dashboard limit. Users/promotions are filtered on the server before pagination; category/policy search is local over their full unpaginated datasets.

Tests: `__tests__/adminApi.test.ts`, `adminPages.test.tsx`, `adminAccess.test.tsx`, `validation.test.ts`. Backend integration covers persistence and authorization on real disposable PostgreSQL. See [QA evidence and remaining checks](../../../docs/testing/admin-01/README.md).
