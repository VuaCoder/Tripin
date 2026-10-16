# Agency operations UI

- `/agency`: backend dashboard; revenue totals and a separate empty state for the rolling 30-day series.

The overview uses a Tripri-green bento grid: three lifetime financial metrics, a larger revenue chart beside the top-tour ranking, then booking/tour status panels. Chart range is 30 days (backend rolling window) or the last 7 UTC calendar days, grouped into Monday-based weekly bars without changing totals. No month-over-month percentages or six-month figures are inferred. The daily table remains available for exact values; missing tour photographs use ranking markers rather than unrelated stock imagery.
- `/agency/bookings`, `/agency/tours`: permission-scoped operations.
- `/agency/settings`: partner profile and the existing local commission calculator. This calculator does not update contractual commission rates.
- `/agency/notifications`: the authenticated user's inbox, pagination and read actions.

`components/AgencyRightSidebar.tsx` retains its old export for Header compatibility, but renders the **left** navigation rail. Pointer hover opens it and pointer leave collapses it. Keyboard focus, the header toggle and search shortcut remain accessible alternatives; touch uses the toggle/backdrop. The Tripri brand mark remains visible when collapsed. The notification bell sits beside the company name in the footer; the name comes from `agencyProfile.companyName`. The separate profile/settings gear is removed: the company footer opens the profile; commission remains a navigation entry.

Ctrl+K / Cmd+K opens and focuses the function search. It searches permitted navigation labels/groups, ignoring Vietnamese accents; Enter opens the first match. It does not query customer, booking or tour records. Functions navigate to routes; no business forms render inside the sidebar. Collapsed navigation uses equal grid tracks, with group titles hidden instead of reserving blank space. Height-responsive spacing keeps the current functions inside the rail without an internal scrolling region.

Agency layout and Agency AppShell share the sidebar CSS `shell`/`body` classes. The shell reserves the same width as the sidebar using shared CSS variables and `:has([data-expanded=true])`; hover, keyboard search, toggle and Escape therefore update content spacing from the actual sidebar state. Opening pushes/reflows desktop content rather than covering it. Narrow screens keep the content's readable collapsed width and shift it sideways without creating page-wide horizontal scrolling. Transitions share timing and respect reduced motion. Toggle icons use `PanelLeftOpen` / `PanelLeftClose`; collapsed labels use `display:none`.

`notifications.ts` uses the existing `/notifications` endpoints through the shared authenticated RTK base query and connects to the backend Socket.IO gateway with `auth.token` (never in the URL). `notification:new` and reconnect invalidate the inbox/count cache. Visible pages also refresh every 30 seconds and on focus/reconnect to recover missed events/read changes from another session. The shell removes listeners and disconnects when the user/token changes or on unmount. Notification content is not copied to localStorage.

Verification: component/hook tests mock Socket.IO to cover token handshake, push/reconnect, refresh isolation and teardown. A real two-session backend smoke test is still needed to validate the deployment's socket origin/CORS/proxy configuration.

The bell opens an accessible portal dialog backed by the same `AgencyNotificationInbox` as `/agency/notifications`, not a static empty placeholder. Read/delete actions invalidate the shared inbox and unread count. Deletion requires confirmation and backend ownership checks. Sidebar route links opt into the existing Boat preloader using `data-route-preloader`; notifications opt out. Search displays the Command icon + K on every OS and accepts both Ctrl+K and Cmd+K, with an explicit circular clear control.

Tour editing and the per-tour workspace share a horizontal four-step navigator. Forms remain mounted in the workspace while switching steps to preserve unsaved itinerary/availability. The preview is beside the form on desktop and stacks/toggles on smaller screens; it is explicitly a preview and does not imply unsaved changes were persisted.
