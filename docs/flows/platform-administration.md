# Platform Administration — ADMIN-01

1. Staff signs in through existing authentication. `homeForRole(SUPER_ADMIN)` sends the session to `/super-admin`; staff self-registration is not added.
2. RoleGuard waits for bootstrap and blocks all other roles. Pages request data through RTK Query only for a ready Super Admin session.
3. Backend resolves current user role/status from PostgreSQL on every HTTP request. All `/admin/*` routers require Super Admin plus their original permission. Delegating an extra admin permission does not bypass this boundary.
4. Admin loads a dashboard or current configuration. Lists use backend pagination only where available (users/promotions). Public policies are used for current policy values.
5. Admin edits a local draft. Client validation gives feedback; backend validates again. Role and commission changes are reviewed/confirmed; category/promotion state changes use confirmation dialogs.
6. While saving, duplicate actions are disabled. On confirmed success the UI uses backend DTOs/cache refetch and reports saved state. On validation/conflict/network/server failure it retains the draft and never reports success.
7. A network error may hide a completed server write. Read back before retrying; POST creation is not automatically retried. If saving succeeds but subsequent refresh fails, the UI distinguishes confirmed persistence from stale list data.
8. Commission changes affect later bookings only. Categories deactivate rather than delete references. Policies update immediately, and cancellation hours affect booking cancellation rules. Dashboard figures can remain cached for 30 seconds.
9. A 403 removes private screen content/dialogs. Logout/account switch clears private cached query results. Backend still blocks every request independently of frontend state.

Audit recording remains in the owning backend services; failures are logged rather than rolling back completed business writes. Audit viewer, policy approval/versioning and scoped commission remain outside this flow.

Update 18/10/2026: custom dashboard ranges are now included by user request. Select paired Vietnam calendar dates (max 366 days) or a preset; backend filters financial data and returns the previous equally long period. Current global snapshots remain clearly labeled separately. Users support creation-date ranges; promotions support code/title, discount type and overlapping validity windows. Both use server filtering before pagination; all authorization and mutation confirmation behavior above remains in force.
