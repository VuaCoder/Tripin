# Tour Guide — Profile & Assigned Tours (end-to-end walkthrough)

Browser + API evidence for the Tour-guide use cases **View Profile**, **Update Profile**,
**View Assigned Tours** and **Verify Assigned Tours**, captured with a real Chromium against a
**local** stack. Nothing here was run against the Neon production branch that the repo `.env`
points at: `DATABASE_URL` was overridden per command, which wins because `dotenv` does not replace
an already-set variable.

## Environment

| Piece | Where |
| --- | --- |
| PostgreSQL 18 | `:5433`, throwaway database `tripri_guide_e2e` (started from the repo's own `embedded-postgres` binaries, no Docker) |
| Backend | `:3001` — `DATABASE_URL="postgresql://postgres@127.0.0.1:5433/tripri_guide_e2e" npx tsx src/server.ts` |
| Frontend | `:3100` — `npx next dev -p 3100` (`:3000` was already taken by an unrelated Vite app) |
| Schema | `prisma migrate deploy` (2 migrations) |
| Driver | `.playwright-cli/verify-guide-profile-tours.mjs` (headless Chromium, no network mocks apart from the two deliberately injected failures) |

`.playwright-cli/` is a gitignored dev scratch area (the existing `verify-real-review.mjs` lives
there too), so the driver is not committed — the fixture below is, and the driver is a thin
Playwright script over the same flow.

## Fixtures

Created by `backend/src/scripts/dev-guide-fixture.ts create` (dev-only; `clean` removes exactly
those rows again — it is idempotent, so re-running `create` always starts from the same state).

- 1 `VERIFIED` agency (`dev.guide.agency@tripri.test`) owning 4 `APPROVED` tours, each with 2 future departures
- `dev.guide@tripri.test` — the guide under test, with a **half-filled** guide profile so one screen
  shows both a real value and `Chưa cập nhật`
- `dev.guide.foreign@tripri.test` — owns the 4th tour, used to prove a guide cannot answer an assignment outside their scope
- `dev.guide.none@tripri.test` — no assignment at all, for the empty state
- `dev.guide.traveler@tripri.test` — a `TRAVELER`, for the role guard
- All accounts share the password `DevGuide!2026`

Assignments on the guide under test: `Hạ Long 2N1Đ` = **PENDING**, `Đà Nẵng – Hội An 3N2Đ` =
**ACCEPTED**, `Phú Quốc 4N3Đ` = **DECLINED** (the declined row carries a note from the fixture).

## The run

```bash
node .playwright-cli/verify-guide-profile-tours.mjs
```

`42/42 checks passed` — 16 screenshots written next to this file.

## What was exercised

| # | Step | Expected | Observed |
| --- | --- | --- | --- |
| `01` | Guest opens `/guide/profile` | bounced to the login screen | ✅ redirect to `/login`, no profile data leaked |
| `02` | View profile as the guide | own profile read from `GET /users/me` (200) | ✅ name, email, role badge, `Tiếng Việt`, and exactly 3 fields as `Chưa cập nhật` |
| `03` | Open the edit form | only editable fields are inputs | ✅ email rendered disabled; `fullName`, `phone`, `guideProfile.*` editable |
| `04` | Save with name `A` and phone `abc` | blocked client-side, no request sent | ✅ both messages shown, **0** `PATCH /users/me` calls |
| `05` | Fill every editable field | form holds the new values | ✅ name, phone, 7 years, licence, 3 languages, 3 specialties, bio |
| `06` | Save | `PATCH /users/me` → 200, success banner, summary shows the new values | ✅ 1 PATCH (200), 0 fields left as `Chưa cập nhật` |
| `07` | Full page reload | values come back from the backend, not from client state | ✅ licence, experience, and all 3 languages still present |
| `08` | Open `/guide/tours` with the response held 2.5 s | loading state | ✅ `Đang tải danh sách tour được phân công...` |
| `09` | Assigned tours list | `GET /guide/tours` (200), one row per assignment | ✅ 3 rows with `Chờ bạn xác nhận` / `Đã nhận tour` / `Đã từ chối`, fee + next departure from the API, accept/decline **only** on the PENDING row, and the other guide's tour absent |
| `10` | Click "Nhận tour" | confirmation dialog with an optional note | ✅ dialog names the tour, note counter `0/500` |
| `11` | Confirm while the API answers `409` | the backend error is shown, the list is refreshed | ✅ `The assignment changed, please retry` banner |
| `12` | Confirm for real | `POST /guide/tours/:tourId/verification` → 200, row flips, no actions left | ✅ 200, two `Đã nhận tour` badges, 0 accept buttons |
| `13` | Full page reload | the answer survived | ✅ still `Đã nhận tour`, still 0 accept buttons |
| `14` | Reload with the list API answering `500` | error state with a retry action | ✅ `Không thể tải danh sách tour` + `Thử lại` |
| `15` | A guide with no assignment opens `/guide/tours` | empty state, no actions | ✅ `Chưa có tour nào được phân công` |
| `16` | A `TRAVELER` opens `/guide/tours` | pushed out of the guide area | ✅ landed on `/home`, `/guide/*` never rendered |

Database after the run (`Hạ Long` answered through the UI, profile edited through the UI):

```
 [DEV-GUIDE] Hạ Long 2N1Đ          | ACCEPTED | Đã sắp xếp lịch, sẵn sàng nhận tour. | responded=t
 [DEV-GUIDE] Đà Nẵng – Hội An 3N2Đ | ACCEPTED | Đã sắp xếp lịch.                    | responded=t
 [DEV-GUIDE] Phú Quốc 4N3Đ         | DECLINED | Trùng lịch dẫn tour khác.           | responded=t

 dev.guide@tripri.test | languages={Tiếng Việt,English,Français}
                       | specialties={Trekking,"Văn hóa bản địa","Ẩm thực đường phố"}
                       | experienceYears=7 | licenseNumber=GPL-2026-0091
```

## Authorization (checked over the API, same fixture)

| Attempt | Result |
| --- | --- |
| Guide answers a tour assigned to **another** guide | `404 NOT_FOUND` "Assigned tour not found" (404, not 403, so ids are not confirmed) |
| Guide sends an `agencyProfile` section in `PATCH /users/me` | `403 FORBIDDEN` "Only agencies can edit an agency profile" |
| Guide sends `extraPermissions: ["admin:dashboard"]` | `400 VALIDATION_ERROR` (strict schema — unknown key, nothing to update) |
| `TRAVELER` calls `GET /guide/tours` | `403 FORBIDDEN` |
| Guide reads a profile | `GET /users/me` carries no id at all, so there is no route to another account's profile |

The screenshots only cover the guide's **own** profile: the UI never sends a user id anywhere — every
profile call goes to `/users/me`, and the tour pages only ever use ids handed back by
`GET /guide/tours`.

## Console

No page errors. The filtered console noise is pre-existing and unrelated: `/auth/refresh` returning
`401` before a session exists, and Google GSI rejecting the `localhost` origin (403). Two further
errors are the deliberate injections used to reach the error states (`409` on verification, `500` on
the list).

## Test suites (same change)

- frontend `npx vitest run` — **130/130** across 25 files (13 under `frontend/features/guide/__tests__`)
- frontend `npx tsc --noEmit` — clean
- frontend `npx next build` — clean, `/guide/profile` and `/guide/tours` in the route manifest
- backend `npx tsc --noEmit` — only 2 pre-existing errors in `bookings.service.test.ts` (untouched by this change)
- backend `npx vitest run src/modules/users` — **24/24** (3 of the unit tests are new, covering the license image)

---

# Ảnh giấy phép hành nghề — upload file hoặc dán link

Follow-up on the same profile screen: the practice-license section now takes an **image**, either
uploaded from the device or pasted as a link.

## What changed

| Layer | Change |
| --- | --- |
| DB | `GuideProfile.licenseImageUrl` (`prisma/migrations/20261007000000_guide_license_image`) |
| API | `guideProfile.licenseImageUrl` on `PATCH /users/me` (nullable http/https URL) |
| API | `POST /users/me/license-image/upload-signature`, `POST /users/me/license-image/complete` |
| Cloudinary | `backend/src/integrations/cloudinary/` is now purpose-scoped (`avatar` \| `licenseImage`); one folder and one deterministic public id per kind, so a signature can only target the caller's own slot |
| UI | `GuideProfileForm` — file picker + live preview + "Gỡ ảnh" + a link box; a chosen file wins over the link |

**Cloudinary keys are absent from the repo `.env`**, so the upload half cannot succeed on this
machine — it fails with `503 SERVICE_UNAVAILABLE` "License image upload is not configured". The
screenshots record exactly that, which is the evidence the flow is wired end-to-end; the link half
is fully functional. Add `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
(the three names already listed in `.env.example`) to make uploads work.

## The run

```bash
PLAYWRIGHT_BROWSERS_PATH=<writable chromium farm> node .playwright-cli/verify-guide-license-image.mjs
```

`25/25 checks passed` — screenshots **17–22**, against the persistent local stack
(Postgres `:5433` / `tripri_local`, backend `:3001`, frontend `:3100`). The driver clears the field
through the real API both before and after the run, so re-runs start from the same state and the
older `verify-guide-profile-tours.mjs` (which counts the summary's `Chưa cập nhật` rows) keeps
working — that count is now **4**, because the summary gained one row for the license image.

| # | Screenshot | Shows |
| --- | --- | --- |
| 17 | `17-guide-license-image-form-empty.png` | the new field: file picker + "Hoặc dán link ảnh", both empty |
| 18 | `18-guide-license-image-link-invalid.png` | a half-typed link is refused client-side, no `PATCH` sent |
| 19 | `19-guide-license-image-file-selected.png` | a chosen file previews and disables the link box |
| 20 | `20-guide-license-image-upload-not-configured.png` | saving a file reaches the signature endpoint and surfaces the `503` |
| 21 | `21-guide-license-image-saved.png` | the pasted link saved (`PATCH` 200) and rendered in the profile |
| 22 | `22-guide-license-image-persisted.png` | after a reload the image is still there — it came from `GET /users/me` |

## Authorization (checked over the API)

| Attempt | Result |
| --- | --- |
| `TRAVELER` calls `POST /users/me/license-image/upload-signature` | `403 FORBIDDEN` "Only tour guides can manage a license image" |
| `TRAVELER` sends a `guideProfile` section in `PATCH /users/me` | `403 FORBIDDEN` "Only tour guides can edit a guide profile" |
| `PATCH` with `licenseImageUrl: "ftp://x/y.jpg"` | `400 VALIDATION_ERROR` (http/https only) |
| `POST /users/me/license-image/complete` with another user's public id | refused by `verifyImageUpload`'s ownership check (a `503` here, because the config check runs first and no keys exist) |
| Clearing an uploaded image | the Cloudinary asset is destroyed; a **pasted** link is not touched |

The public guide profile (`GET /tour-guides/:id`) still exposes neither `licenseNumber` nor the new
`licenseImageUrl` — a license is private to the guide and the agency that assigned them.

