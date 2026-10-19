# Public agency and tour guide profiles

- `/agencies/[id]` reads `GET /agencies/:id`.
- `/tour-guides/[id]` reads `GET /tour-guides/:id`.
- Tour details link to both profiles when an agency/guide is present.

These pages and their reviews are available without a session. They use only the public profile DTOs; email, phone, license documents and private account data are not displayed. Existing active-account checks remain in the backend. Booking and review creation retain their existing authentication and permission checks.

Reviews use `GET /reviews` with exactly one of `tourId`, `agencyId`, or `guideId`, plus `page`, `limit`, and `sort` (`newest`, `rating_desc`, `rating_asc`). The profile pages show ten per page and reset to the first page when sorting changes. Hidden reviews are excluded and author names remain masked by the backend.

Guide reviews are trip reviews, not a separate guide rating. The filter matches the booking's recorded `Earning.guideId`, preserving the guide recorded at trip completion even if the tour is subsequently reassigned. Bookings without an earning record cannot be attributed to a guide and are excluded. The interface explains that the rating describes the whole tour experience.

The shared profile surface handles loading, missing/unavailable profiles, network retries, missing optional biography fields, and empty reviews. External website links allow only HTTP(S).

Validation: frontend profile component tests, tour detail tests, backend review HTTP integration tests, route audit, review service tests, and TypeScript checks for both applications. Browser visual validation could not be completed because the available browser could not connect to localhost.
