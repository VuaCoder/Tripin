# Reports, Complaints & Dispute Resolution Flow — end-to-end walkthrough

Browser evidence for the report / dispute / review-moderation / complaint flow, captured with
`playwright-cli` against a **local** stack (throwaway embedded PostgreSQL on `:5433`, backend `:3001`,
frontend `:3000`). Nothing here was run against the Neon production branch that the repo `.env` points
at: `DATABASE_URL` was overridden per command, which wins because `dotenv` does not replace an
already-set variable. The database is an in-memory-style temp cluster (`dev-local-pg.ts`), discarded
when the process exits.

Muốn tự bấm lại toàn bộ luồng trên máy: xem [`WORKFLOW.md`](./WORKFLOW.md) (tài khoản test + từng bước).

## Fixtures

Seeded through `prisma` in `dev-reports-fixture.ts` (a throwaway copy lives in `.playwright-cli/`), so
the run is reproducible. Everything is marked `[DEV-REPORTS]` and `clean` removes exactly those rows.

| Row | Why it exists |
| --- | --- |
| `dev.reports.moderator@tripri.test` (MODERATOR) | the actor of every moderation screen |
| `dev.reports.traveler@tripri.test` (TRAVELER) | files the report in the UI, wrote the review that is reported as untrue, owns the support ticket |
| `dev.reports.violator@tripri.test` (TRAVELER) | wrote the review that is hidden from the review queue, then banned |
| `dev.reports.agency@tripri.test` (AGENCY, VERIFIED) | owner of both tours; disputes a review in part D |
| 2 `APPROVED` tours + departures | one is reported from the tour page, one carries the review |
| 2 `VISIBLE` reviews on `COMPLETED` bookings | one per flow, so the review queue and the report flow each act on a VISIBLE review |
| 1 `OPEN` support ticket with 1 message | the complaint row |
| 1 `OPEN` + 1 `AGENCY_RESPONDED` + 1 `REVIEW` report | the queue is not empty on first paint, and "judge a review" has a row |

## What was exercised

| Step | Expected | Observed |
| --- | --- | --- |
| Guest opens the tour page | no report entry point at all | ✅ `01` — 0 report buttons in the DOM |
| Traveler opens the same page | report button appears | ✅ `02` — 1 report button |
| Open the report dialog | category + description form | ✅ `03` |
| Submit `"Tour tệ"` | refused client-side, backend never called | ✅ `04` — "ít nhất 10 ký tự" |
| Submit a valid description | `POST /reports` → 201, success banner | ✅ `05` |
| Traveler's own list | the new report as **Đang mở** | ✅ `06` |
| Moderator dashboard | the two tiles that were dead placeholders now carry real counts and link | ✅ `07` — Báo cáo 5, Khiếu nại 1 |
| `/moderator/reports` | the traveler's report in the queue, three filters | ✅ `08` |
| Report detail | target / reporter / agency / tour **by name**, accept + reject actions | ✅ `09` — `Tour · [DEV-REPORTS] Vịnh Hạ Long…`, `Trần Văn Khách`, `Dev Reports Travel`; no uuid anywhere |
| Accept with a note | `POST /moderation/reports/:id/resolve` → success | ✅ `10` |
| `/moderator/reviews` | both reviews | ✅ `11` |
| Review detail | rating, comment, author / agency / tour **by name**, hide + ban actions | ✅ `12` — `Lê Văn Vi Phạm`, `Dev Reports Travel`; no uuid |
| Hide with a reason | `POST /moderation/reviews/:id/moderate` → success | ✅ `13` |
| Ban the author | `POST /moderation/users/:id/ban` → success | ✅ `14` |
| `/moderator/support-tickets` | the ticket, status + category filters | ✅ `15` |
| Ticket detail | sender **by name**, the conversation, reply box, "đã giải quyết" checkbox, status action | ✅ `16` — `Trần Văn Khách`; no uuid |
| Reply + mark resolved | `POST /moderation/support-tickets/:id/reply` → success | ✅ `17` |
| Traveler reloads their reports | **Đã giải quyết** plus the moderator's note | ✅ `18` |
| Report **about a review** | the review itself is in the dialog, with a hide action beside accept/reject | ✅ `19` — stars, `Trần Văn Khách`, the comment, `Đang hiển thị`, and `Ẩn đánh giá` |
| Hide it from the report dialog | `POST /moderation/reviews/:id/moderate` → success, no second screen | ✅ `20` |
| Uphold the report | `POST /moderation/reports/:id/resolve` → success | ✅ `21` |
| Agency `/agency/reviews` | the reviews of its own tours, each with a dispute action | ✅ `22` — masked authors (`Trần K.`, `Lê P.`) |
| Agency disputes one | category + description, sent to moderation | ✅ `23` |
| The dispute is filed | `POST /agency/review-disputes/:reviewId` → 201, listed as **Đang mở** | ✅ `24` |
| Moderator decides it | the dispute reaches the same queue | ✅ step 8d of the run |
| Agency reloads | **Đã giải quyết** plus the moderator's note | ✅ `25` — "Đối tác phản ánh đúng: …" |

## A report about a review

A `targetType: REVIEW` report is a `Report` row, so it appears in **`/moderator/reports`** (filter "Đánh giá"),
never in `/moderator/reviews` — that queue reads the `Review` table. Since the moderator has to judge the
review, the queue row now carries the review itself (rating, comment, status, last hidden reason, author) and
the dialog offers **Ẩn / Khôi phục đánh giá** next to accept/reject, so the decision needs no second screen.
The two decisions stay separate: hiding the review does not close the report.

## An agency disputing a review

An agency holds `review:dispute` (not `report:create`), so it can flag a review of **its own** tour and nothing
else: `POST /agency/review-disputes/:reviewId` verifies ownership and reuses the report pipeline, so the
dispute lands in the same moderator queue, is decided by the same `dispute:resolve`, and notifies the agency of
the outcome. It is filed with `reporterId` = the agency and no `agencyId`, so it never shows up in that
agency's own complaint inbox (`GET /agency/complaints` stays empty for it) — the agency follows it through
`GET /agency/review-disputes`, which the page shows under "Phản ánh tôi đã gửi" (`25`).

The agency page lists only **VISIBLE** reviews (`GET /reviews?agencyId=`), so a review that is already hidden
cannot be disputed — visible in `25`, where both reviews are gone from the list after moderation.


## Names instead of ids

Every moderator detail dialog shows a name or a human code wherever the backend stores an id: the reported
target, the reporter, the responsible agency, the related tour, the ticket sender, the handling moderator and
the related booking (`TRP-…`). The ids stay on the wire — the ban and reply actions are keyed by them — but no
screen renders one. Resolved server-side in batched lookups (`users.getSummaries` + `tours.getTitles`, one
`bookings.getFacts` per distinct booking), so a page of rows costs the same handful of queries whether it
holds one row or ten; an account, tour or booking that no longer exists simply has no name.

The booking row appears only when a booking was attached to the report as evidence. Nothing in the Traveler UI
attaches one today (the report form asks for a category and a description), so `09` does not show it — the row
is covered by `moderation.flows.test.tsx` instead.

## Dialog actions

The decision dialogs (report, review, tour validation, agency verification) share one component. Its action
buttons now carry an icon, a gradient and a shadow, lift on hover, press on click and swap the icon for a
spinner while the backend is working — visible in `09` and `12`. The ticket dialog (`16`) uses the shared
`Button` instead and is unchanged.

## Persisted state

Read back with `psql` after the browser run — every UI success banner corresponds to a row:

| Table | Column | Value |
| --- | --- | --- |
| `Report` (the traveler's tour report) | `status` / `resolutionDecision` / `resolutionNote` | `RESOLVED` / `RESOLVED` / "Đã xác minh cùng đối tác: …" |
| `Report` (the seeded review report) | `status` / `resolutionNote` | `RESOLVED` / "Đánh giá sai sự thật, đã ẩn và thông báo cho các bên." |
| `Report` (the agency's dispute) | `status` / `resolutionNote` | `RESOLVED` / "Đối tác phản ánh đúng: …" |
| `Report` (both review reports) | `agencyId` | `NULL` — a review report is never routed to the agency |
| `Review` (from the review queue) | `status` / `hiddenReason` | `HIDDEN` / "Ngôn từ xúc phạm và cáo buộc lừa đảo không có căn cứ." |
| `Review` (from the report dialog) | `status` / `hiddenReason` | `HIDDEN` / "Đánh giá sai sự thật, đã đối chiếu với nhật ký tour." |
| `User` (violator) | `status` / `banReason` | `BANNED` / "Tài khoản liên tục đăng đánh giá xúc phạm và sai sự thật." |
| `SupportTicket` | `status` / `messageCount` | `RESOLVED` / `2`, with the staff reply stored |

## Scope and authorization (over the API, same run)

| Request | Result |
| --- | --- |
| Traveler → `GET /moderation/reports` | **403** `FORBIDDEN` |
| Moderator → `POST /reports` | **403** `FORBIDDEN` (a moderator holds no `report:create`) |
| Guest → `POST /reports` | **401** |
| Traveler → `GET /reports/me` | 200, only their own reports |
| Moderator → `GET /moderation/reports?status=RESOLVED` | 200, the resolved report is visible |
| Traveler → `POST /agency/review-disputes/:id` | **403** `FORBIDDEN` (no `review:dispute`) |
| Moderator → `GET /agency/review-disputes` | **403** `FORBIDDEN` |
| Agency → `GET /agency/review-disputes` | 200, its own dispute with the moderator's note |
| Agency → dispute a review that is not its own | **404** `NOT_FOUND` |
| Banned violator → `POST /auth/login` | **403** `ACCOUNT_BANNED` |

The UI mirrors this: the report button is rendered from `report:create` and each moderator page renders
`Bạn không có quyền truy cập chức năng này.` and skips its request when the permission is missing
(`moderation.flows.test.tsx`, `report.test.tsx`).

## Console

0 errors across all five parts of the run (traveler, agency, moderator, traveler again, agency again). The only
message is React's development "Download the React DevTools" info line. No failed requests other than the
deliberate 401/403 probes above.

## Test suites (same change)

- frontend `features/report` + `features/moderation` + `features/agency-reviews` — **69/69** (7 files, incl.
  `dispute-flow.integration.test.ts`, which drives one report through the real RTK Query store from
  `POST /reports` to the moderator decision)
- frontend full suite — 273 passed, 2 failed; both failures are pre-existing and unrelated
  (`features/agency/__tests__/agency-download.test.ts`, a jsdom `Blob` gap present before this change)
- backend unit suite — **509/509**
- backend `reports` + `moderation` + `reviews` + `support` integration suites — **19/19**
  (`test:integration modules/reports modules/moderation modules/reviews modules/support`), the same HTTP contract
  against a real database; the backend suite keeps 7 pre-existing failures in `auth` / `bookings` / `routes`
  (verified identical with this change reverted)
- `docs/api/ENDPOINTS.md` regenerated (`pnpm --filter backend docs:routes`, 145 → 147 endpoints) and
  `docs/backend/USE_CASE_MAP.md` gained the "Dispute a review" row — the docs-in-sync test compares both with
  the live route table
