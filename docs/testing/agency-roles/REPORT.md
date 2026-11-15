# Báo cáo kiểm thử E2E — vai trò Agency (Playwright)

Ngày chạy: **14/11/2026** · Môi trường: **local throwaway** · Trình duyệt: Chromium (playwright-cli 0.1.21), viewport 1440×1000.

## 1. Môi trường và phạm vi

| Thành phần | Giá trị |
|---|---|
| Database | PostgreSQL 18.6 embedded, `127.0.0.1:5433/tripri_dev`, 38 migration của lượt đầu (+2 migration sửa F2/F8 khi chạy lại) |
| Backend | `tsx src/server.ts`, `http://localhost:3001/api/v1`, `JOBS_ENABLED=false` |
| Frontend | Next.js production preview build (`preview.mjs`), `http://localhost:3000` |
| Tài khoản | 11 tài khoản fixture, mật khẩu chung lấy từ fixture local (không commit) |
| Dữ liệu | 1 agency VERIFIED dạng legacy (id = userId) + 1 agency đối chứng + 1 agency UNVERIFIED; 7 tour; 6 booking; 2 review; 2 khiếu nại; 5 voucher; 2 yêu cầu đoàn; 2 yêu cầu tham gia; 3 thông báo |
| Nguồn quyền | `AGENCY_ROLE_PERMISSIONS` (`backend/src/modules/agencies/agency.policy.ts`), route map (`frontend/features/agency/agencyRoutePermission.ts`), guard backend |

**Không chạy trên Neon**: `.env` của repo trỏ database dùng chung; mọi lệnh test đều override `DATABASE_URL` sang cluster tạm. Không sửa source sản phẩm trong lượt chạy đầu.

**Trạng thái sau báo cáo**: F1–F10 đã được sửa trong cùng ngày; xem §10. Các bảng ở §3–§4 vẫn là kết quả của lượt chạy **trước** khi sửa.

**Ngoài phạm vi**: đăng ký + OTP qua email thật, Google OAuth, thanh toán, upload Cloudinary thật (dùng ảnh URL), responsive/mobile, portal moderator.

## 2. Cách tái lập

```bash
# 1. Postgres tạm (in ra READY <url>)
cd backend && npx tsx src/scripts/dev-local-pg.ts

# 2. Fixture (lưu ID vào fixture.json rồi đồng bộ vào scenarios)
cp .playwright-cli/agency-roles/fixture.ts backend/src/scripts/dev-agency-role-fixture.ts
cd backend && DATABASE_URL=<READY> npx tsx src/scripts/dev-agency-role-fixture.ts create \
  | sed -n '/^{/,$p' > ../.playwright-cli/agency-roles/fixture.json
rm backend/src/scripts/dev-agency-role-fixture.ts
cd .. && node .playwright-cli/agency-roles/sync-fixture-ids.js

# 3. Backend + frontend
# NODE_ENV=test tắt auth rate limiter (20 lượt/15 phút) để chạy hết 200+ lượt đăng nhập.
cd backend && NODE_ENV=test DATABASE_URL=<READY> JOBS_ENABLED=false npx tsx src/server.ts
cd frontend && TRIPRI_PREVIEW_PORT=3000 node scripts/preview.mjs start   # đã build trước bằng preview.mjs build

# 4. Kịch bản (mỗi kịch bản mở/đóng browser riêng)
bash .playwright-cli/agency-roles/run.sh all
# hoặc: run.sh matrix | verify-fixes | verify-commission | verify-agency-chat | flows-owner | ...
```

Kết quả JSON: `.playwright-cli/agency-roles/results/*.json` · Ảnh: `docs/testing/agency-roles/screenshots/<feature>/` (xem §11); ảnh trước sửa ở `screenshots/archive/`.

## 3. Tổng hợp kết quả

| Kịch bản | Checks | Pass | Fail | Ghi chú |
|---|---:|---:|---:|---|
| `matrix` — 4 vai trò × 23 route + nav | 116 | 109 | 7 | 6 do drift quyền custom-tour, 1 do legacy gate review |
| `flows-owner` — luồng ghi của OWNER | 24 | 19 | 5 | 2 do complaint 403, 2 do custom-tour, 1 do fixture đã cạn (xem §3.1) |
| `flows-manager` | 14 | 12 | 2 | sidebar ẩn voucher; legacy gate review |
| `flows-staff` | 9 | 8 | 1 | API custom-tour trả rỗng |
| `flows-accountant` | 8 | 7 | 1 | API custom-tour cho phép sai |
| `invitation` — mời → nhận → 2 doanh nghiệp | 5 | 5 | 0 | |
| `isolation` — cách ly tenant A/B | 5 | 5 | 0 | |
| `states` — chưa xác minh / bị khoá / sai mật khẩu / cổng du khách / form đăng ký | 8 | 7 | 1 | tài khoản AGENCY vào được cổng du khách |
| `team-requests` — duyệt yêu cầu tham gia | 2 | 2 | 0 | chạy riêng sau khi fixture cạn |
| **Tổng** | **191** | **174** | **17** | 16 lỗi sản phẩm (6 nhóm) + 1 do fixture cạn |

### 3.1 Vì sao `owner-team-requests` fail ở lần chạy cuối

Fixture chỉ tạo 2 yêu cầu tham gia; các lần chạy lặp lại đã duyệt hết. Kịch bản riêng `team-requests` (tạo lại 1 yêu cầu PENDING) **pass 2/2** — xem [`team-requests-approved.png`](./screenshots/team-requests/team-requests-approved.png). Đây không phải lỗi sản phẩm.

## 4. Ma trận quyền — kết quả thực tế

Ký hiệu: ✅ đúng kỳ vọng · ⚠️ mở được nhưng có khiếm khuyết · ❌ bị chặn ngoài kỳ vọng.

| Trang | OWNER | MANAGER | STAFF | ACCOUNTANT |
|---|---|---|---|---|
| `/agency` (dashboard) | ✅ | ✅ | ➡️ về `/agency/work/tours` (đúng) | ✅ |
| `/agency/tours` | ✅ | ✅ | ✅ (read-only) | ❌ chặn (đúng) |
| `/agency/tours/new` | ✅ | ✅ | ❌ (đúng) | ❌ (đúng) |
| `/agency/tours/import` | ✅ | ❌ (đúng) | ❌ | ❌ |
| `/agency/tours/:id` | ✅ | ✅ | ❌ **dead-end** — xem F6 | ❌ |
| `/agency/tours/:id/edit` | ✅ | ✅ | ❌ (đúng) | ❌ |
| `/agency/calendar` | ✅ | ✅ | ❌ (đúng) | ❌ |
| `/agency/bookings` + `/:id` | ✅ | ✅ | ❌ (đúng) | ✅ |
| `/agency/work/tours` | ✅ | ✅ | ✅ | ❌ |
| `/agency/work/bookings` | ✅ | ✅ | ✅ | ❌ |
| `/agency/team`, `/settings/team` | ✅ | ❌ (đúng) | ❌ | ❌ |
| `/agency/team/requests` | ✅ | ❌ | ❌ | ❌ |
| `/agency/promotions` | ✅ | ⚠️ mở bằng URL được, **sidebar ẩn** (F5) | ❌ | ❌ |
| `/agency/complaints` | ✅ list, ❌ chi tiết (F1) | ✅ list, ❌ chi tiết (F1) | ❌ | ❌ |
| `/agency/reviews` | ✅ | ❌ API 403 (F4) | ❌ | ❌ |
| `/agency/premium` | ✅ | ❌ API 403 (F4) | ❌ API 403 | ❌ API 403 |
| `/agency/custom-tours` | ❌ **denied** (F2) | ❌ denied (F2) | ❌ denied (F2) | ❌ denied (đúng UI) |
| `/agency/notifications` | ✅ | ✅ | ✅ | ✅ |
| `/agency/application/workplace` (profile) | ✅ wizard | ✅ chỉ xem | ✅ chỉ xem | ✅ chỉ xem |
| `/agency/settings/commission` | ✅ | ✅ | ❌ (đúng) | ✅ (mô phỏng) |
| `/workplaces` | ✅ | ✅ | ✅ | ✅ |

Landing sau đăng nhập: OWNER/MANAGER/ACCOUNTANT → `/agency`; STAFF → `/agency/work/tours`; user có 2 doanh nghiệp → `/workplaces` chọn doanh nghiệp (đã kiểm chứng ở kịch bản `invitation`).

## 5. Chức năng đã chạy đúng

**OWNER** — dashboard + top tour; tạo tour qua stepper 4 bước (chọn danh mục bằng bàn phím, giá, xác nhận); sửa mô tả; lưu trữ → khôi phục; chặn gửi duyệt khi chưa có ngày khởi hành mở bán (đúng thông điệp `NO_OPEN_DEPARTURE`); thêm ngày khởi hành từ lịch rồi gửi duyệt thành công; danh sách booking + hồ sơ hành khách (năm sinh, điểm đón, ghi chú) + xuất PDF 200; mời thành viên + thu hồi; duyệt yêu cầu tham gia; tắt/bật voucher (có modal lý do); gửi phản ánh đánh giá; premium; inbox thông báo + đánh dấu đã đọc; lưu hồ sơ doanh nghiệp (persist qua API); mô phỏng chiết khấu; probe API finance 200, custom-tour 200, PDF 200.

**MANAGER** — dashboard; sửa tour; lịch khởi hành; booking + PDF; voucher và khiếu nại mở bằng URL; bị chặn import/team/không có nút lưu trữ; API PDF 200, finance 403, members 403.

**STAFF** — `/agency/work/tours`: sửa đúng trường được giao (title/summary) và lưu; `/agency/work/bookings` không lộ tài chính; danh sách tour read-only (không nút tạo/sửa); bị chặn editor/calendar/bookings/voucher/khiếu nại/team; API work 200, tạo tour 403, bookings 403, finance 403.

**ACCOUNTANT** — dashboard; booking + chi tiết; không có nút xuất PDF; bị chặn tour/work/calendar/team/voucher/khiếu nại; finance 200; PDF 403; hồ sơ chỉ xem.

**Mời & chuyển doanh nghiệp** — OWNER mời email; invitee (đang là STAFF của agency B) nhận tại `/workplaces` → "Lời mời của tôi" → chấp nhận → có 2 doanh nghiệp → mở agency A → landing `/agency/work/tours`, nav không có team/voucher/khiếu nại.

**Cách ly tenant** — agency B không mở được tour/booking của A (404), không thấy tên A trên dashboard, tự gửi `X-Agency-Id` của A bị 403, dữ liệu của B vẫn nguyên.

**Trạng thái** — agency UNVERIFIED bị chặn tính năng vận hành; membership SUSPENDED không vào được; sai mật khẩu bị từ chối; form đăng ký agency render.

## 6. Lỗi phát hiện

### F1 — [P1] Agency không mở được chi tiết khiếu nại (403)

- **Tái lập**: đăng nhập OWNER → `/agency/complaints` → bấm một phiếu ("Xe đón muộn 45 phút").
- **Kỳ vọng**: mở hội thoại để trả lời/đề xuất giải pháp.
- **Thực tế**: "Không thể tải thông tin phiếu khiếu nại"; network `GET /api/v1/complaints/<id>` → **403**. Ảnh: [`owner-complaint-detail.png`](./screenshots/owner/owner-complaint-detail.png).
- **Nguyên nhân**: UI dùng chung endpoint duyệt khách cho mọi vai trò — `frontend/features/complaints/api/complaintsApi.ts:83` gọi `/complaints/:id`. Router `/complaints` (`backend/src/routes/index.ts:100`) **không** gắn `resolveAgencyContext`, nên `requireAnyPermission(REPORT_CREATE, COMPLAINT_RESPOND, DISPUTE_RESOLVE)` (`backend/src/modules/complaints/complaints.routes.ts:42-47`) rơi về quyền global của role `AGENCY` — không có `complaint:respond` → 403. Service đã hỗ trợ agency (`complaints.service.ts:176-189` kiểm tra `actor.agencyId`) nhưng context chưa bao giờ được resolve.
- **Ảnh hưởng**: chặn toàn bộ luồng xử lý khiếu nại của OWNER/MANAGER trên UI.
- **Hướng sửa**: cho agency page dùng `GET /agency/complaint-tickets/:id` (đã có, đã gắn agency context). **Đã sửa** — `complaintsApi` chọn endpoint theo role, nên detail, gửi tin nhắn và escalate của AGENCY đều đi `/agency/complaint-tickets`.

### F2 — [P1] Role hệ thống seed thiếu quyền so với policy → custom-tour bị khoá

- **Tái lập**: mở `/agency/custom-tours` bằng OWNER/MANAGER/STAFF.
- **Kỳ vọng**: trang mở (policy cấp `custom-tour:view` cho cả 3 vai trò).
- **Thực tế**: "Bạn không có quyền truy cập chức năng này."; sidebar không có "Yêu cầu đoàn". Ảnh: [`matrix-owner-custom-tours.png`](./screenshots/archive/matrix-owner-custom-tours.png), [`owner-custom-tours.png`](./screenshots/archive/owner-custom-tours.png).
- **Nguyên nhân**: `effectiveAgencyPermissions` ưu tiên `assignedRole.permissions` (`backend/src/modules/agencies/agency.policy.ts:51`). Các role được seed bởi migration `20261113000100_agency_flexible_permissions` (`agency_seed_access_roles`) **thiếu** `custom-tour:view`/`custom-tour:respond` ở OWNER/MANAGER/STAFF, trong khi `AGENCY_ROLE_PERMISSIONS` có. Kiểm tra DB của fixture:
  - OWNER: 24 quyền, không có `custom-tour:*`.
  - MANAGER: 15 quyền, không có `custom-tour:*`.
  - STAFF: 4 quyền, không có `custom-tour:*`.
- **Ảnh hưởng**: tính năng yêu cầu đoàn không dùng được trên UI.
- **Hướng sửa**: đồng bộ mảng quyền trong migration/seed với policy (thêm custom-tour cho OWNER/MANAGER/STAFF). **Đã sửa** — migration `20261114000100_agency_seed_custom_tour_permissions` cập nhật cả function cho agency mới và các role hiện có, chỉ thêm quyền còn thiếu.

### F3 — [P2] `/custom-tours` scope sai tenant và lọt quyền cho ACCOUNTANT

- **Tái lập**: STAFF gọi `GET /custom-tours` → 200 nhưng `data: []`; ACCOUNTANT gọi cùng endpoint → **200** dù không có `custom-tour:view` trên UI.
- **Nguyên nhân**: router mount không có agency context (`backend/src/routes/index.ts:84`), nên `requirePermission` dùng quyền global (`backend/src/middlewares/authorize.ts:30-36`); role `AGENCY` toàn cục có `custom-tour:view`/`respond` (`packages/constants/src/permissions.ts:104`). Service lại scope `agencyId: actor.userId` (`backend/src/modules/custom-tours/custom-tours.service.ts:114`) — giả định legacy `agencyId === userId`; member thường có `userId ≠ agencyId` nên thấy rỗng.
- **Ảnh hưởng**: MANAGER/STAFF không thấy yêu cầu đoàn của doanh nghiệp; ACCOUNTANT đọc/ghi được dữ liệu ngoài quyền (API-level).
- **Hướng sửa**: mount `/custom-tours` với `resolveAgencyContext`, scope theo `ctx.agencyId`, và kiểm tra permission theo membership.

### F4 — [P2] Legacy gate vẫn chặn review disputes và premium của MANAGER

- **Tái lập**: MANAGER mở `/agency/reviews` → danh sách rỗng, `GET /agency/review-disputes` **403**; `/agency/premium` → API **403**.
- **Nguyên nhân**: `/agency/review-disputes` và `/agency/premium` không nằm trong danh sách `integrated` của `backend/src/routes/registry.ts:13-17`, nên bị `requireLegacyOwnerIntegration` (`backend/src/middlewares/agency-context.ts`) — đòi `memberRole === 'OWNER' && agencyId === actorUserId`. Policy cấp `review:dispute` cho MANAGER; `premium:contribute` chỉ OWNER.
- **Ảnh hưởng**: MANAGER không dùng được phản ánh đánh giá; OWNER của agency không-legacy cũng bị chặn khỏi premium.
- **Hướng sửa**: tích hợp tenant cho 2 module (service dùng `agencyContext.agencyId`/actor) rồi thêm vào danh sách `integrated`. **Đã sửa** — cả hai dùng `agencyContext(req).agencyId` và đã vào `integrated`. MANAGER vẫn bị chặn premium **đúng policy** (không phải lỗi legacy gate).

### F5 — [P2] Sidebar ẩn "Khuyến mãi & Voucher" và "Khiếu nại" với MANAGER

- **Tái lập**: đăng nhập MANAGER → nav chỉ có Tổng quan/Đơn đặt chỗ/Theo dõi booking/Quản lý tour/Nội dung được giao/Lịch khởi hành/Chiết khấu. Mở trực tiếp `/agency/promotions` và `/agency/complaints` thì dùng được bình thường.
- **Nguyên nhân**: điều kiện legacy trong `frontend/features/agency/components/AgencyRightSidebar.tsx:120` chỉ hiện 2 mục khi `memberRole === 'OWNER' && agencyId === user.id`.
- **Ảnh hưởng**: MANAGER không tìm thấy 2 chức năng được cấp quyền.
- **Hướng sửa**: bỏ điều kiện legacy, chỉ dựa vào `agency.permissions`. **Đã sửa**.

### F6 — [P3] STAFF bấm vào tour trong danh sách bị chặn ở trang chi tiết

- **Tái lập**: STAFF → `/agency/tours` → bấm một tour.
- **Thực tế**: trang `/agency/tours/:id` hiện "Bạn không có quyền truy cập chức năng này." Ảnh: [`staff-tour-detail-denied.png`](./screenshots/archive/staff-tour-detail-denied.png); check `staff-tour-workspace` trong `matrix.json`.
- **Nguyên nhân**: workspace gate `tour:update-own` (`frontend/features/tours/components/AgencyTourWorkspacePage.tsx:33`) trong khi STAFF chỉ có `agency:tour-view` + `agency:tour-content-update`; danh sách vẫn `router.push('/agency/tours/:id')` (`AgencyTourListPage.tsx:437,585`).
- **Ảnh hưởng**: dead-end UX; STAFF phải tự biết vào `/agency/work/tours`.
- **Hướng sửa**: cho workspace dùng `agency:tour-view` để xem (ẩn nút sửa theo quyền). **Đã sửa** — trang xem được read-only; link "Sửa nội dung tour" chỉ hiện với `tour:update-own`.

### F7 — [P3] Tài khoản AGENCY đăng nhập được cổng du khách

- **Tái lập**: mở `/login`, nhập `qa.agency.owner@tripri.test` và mật khẩu fixture local.
- **Thực tế**: đăng nhập thành công, chuyển tới `/workplaces` (không có `AGENCY_PORTAL_REQUIRED`). Ảnh: [`state-traveler-portal.png`](./screenshots/account-states/state-traveler-portal.png).
- **Nguyên nhân**: `loginAgency` và `login` dùng chung luồng; chỉ đăng ký/Google bị chặn (`backend/src/modules/auth/auth.service.ts:79,308`). Tài liệu cũ (`docs/testing/reports/WORKFLOW.md`) nói tài khoản AGENCY gọi `/login` sẽ 403 — không còn đúng.
- **Ảnh hưởng**: đối tác có thể vào bề mặt du khách; không leo thang quyền nhưng sai định tuyến và gây nhầm lẫn. Ảnh trước sửa: [`state-traveler-portal.png`](./screenshots/account-states/state-traveler-portal.png); sau sửa: [`verify-fix-traveler-portal.png`](./screenshots/fixes/verify-fix-traveler-portal.png).
- **Hướng sửa**: chặn `login` theo portal. **Đã sửa** — `/auth/login` trả `AGENCY_PORTAL_REQUIRED`; `/auth/agency/login` vẫn nhận tài khoản AGENCY, và chặn tài khoản AGENCY chưa hoàn tất onboarding bằng `AGENCY_ONBOARDING_REQUIRED`. Form đối tác trước đây gọi nhầm `/auth/login`, nên đã chuyển sang `/auth/agency/login` (`useLoginForm` nhận `portal: 'agency'`).

### F8 — [P3] Trang chiết khấu hoa hồng chỉ lưu localStorage

- "Gửi yêu cầu điều chỉnh" ghi `tripri_agency_discount_request_*` vào localStorage (`frontend/features/agency/components/AgencyCommissionSettings.tsx:24-25,61-78`); không có API, không có phê duyệt. Test chỉ xác nhận dialog hoạt động, dữ liệu không tồn tại sau khi đổi máy. **Đã sửa** — model `AgencyCommissionRequest`, API gửi/huỷ cho OWNER, hàng đợi duyệt cho Super Admin; duyệt ghi `AgencyProfile.commissionRateBps` + tăng `commissionVersion` nên chỉ booking tạo sau mới dùng mức mới. Trang đọc mức thật từ API (không còn hardcode 10%).

### F9 — [P3] Route map có `/agency/finance` nhưng không có trang

- `frontend/features/agency/agencyRoutePermission.ts` khai báo `/agency/finance` → `agency:finance-view`, nhưng `frontend/app/agency` không có thư mục `finance`. Dữ liệu tài chính chỉ có qua API `/agency/finance/summary` (đã probe 200 cho OWNER/ACCOUNTANT, 403 cho STAFF). **Đã sửa** — bỏ entry chết khỏi route map (và test tương ứng); khi có trang finance thì thêm lại cùng lúc.

### F10 — [P3] `.playwright-cli/run-agency.sh` đã lỗi thời

- Script dùng `getByLabel('Email doanh nghiệp')` và nút `Đăng nhập Agency`; form hiện tại là `#credential`, `#password`, nút `Đăng nhập` (`frontend/features/agency-auth/PartnerAccountPage.tsx`). Chạy lại script này sẽ fail ngay bước đăng nhập. **Đã sửa** selector.

### F11 — [P3] Mục "Tin nhắn" không bao giờ hiện với vai trò agency

- Sidebar lọc `chat:use` theo quyền của active agency; template role agency (policy và seed) không có `chat:use` (đây là quyền global của role `AGENCY`). Kết quả: nav không có "Tin nhắn" ở cả 4 vai trò (xem danh sách nav trong `matrix.json`). **Đã sửa** — chat có tenant thật: `Conversation.agencyId`, endpoint `/agency/chat/*`, `chat:use` trong role OWNER/MANAGER/STAFF (ACCOUNTANT không có), màn `/agency/conversations` trong agency shell. Thread cũ của owner được backfill sang agency; custom tour giờ tạo được conversation.

## 7. Khác biệt so với tài liệu / ghi chú

- `docs/testing/reports/WORKFLOW.md` nói AGENCY gọi `/login` bị 403 — nay đã đúng lại sau khi sửa F7.
- `docs/plan/agency-staff-tour-operations-e2e.md` coi promotions/complaint-tickets đã tích hợp; đúng, nhưng sidebar vẫn dùng điều kiện legacy (F5) và complaint **detail** vẫn đi endpoint du khách (F1) — cả hai đã sửa.
- Thông báo agency là inbox **theo user + agency**: thông báo của OWNER không hiện cho MANAGER (đúng thiết kế, không phải lỗi).
- `/agency/settings/profile` là redirect sang `/agency/application/workplace`; non-owner thấy "Chỉ chủ doanh nghiệp được cập nhật hồ sơ." (đúng thiết kế).
- Console errors ghi nhận trong lúc chạy chủ yếu là `401 /auth/refresh` trước đăng nhập và `403` của các màn hình bị chặn — không có lỗi runtime/hydration.

## 8. Hạn chế của lượt test

- Chỉ Chromium desktop; không kiểm tra mobile/tablet, bàn phím toàn trình, screen reader.
- Không kiểm tra đăng ký + OTP (OTP hash, cần đọc MailOutbox), Google, thanh toán, upload ảnh Cloudinary thật.
- Fixture bị mutate trong lúc chạy (tạo tour, duyệt yêu cầu, mời thành viên); các lần chạy lặp có thể cạn dữ liệu — dùng `fixture clean` + `create` trước mỗi lượt chính thức.
- Đã sửa F1–F12 sau lượt chạy (xem §10).
- Các scenario cũ vẫn mang kỳ vọng **trước** khi sửa (ví dụ coi custom-tours bị chặn là đúng); dùng `scenarios/verify-fixes.js` cho lượt xác minh sau sửa.
- Các scenario dùng ID tour/booking trong `.playwright-cli/agency-roles/fixture.json`; sau khi seed lại fixture, chạy `node .playwright-cli/agency-roles/sync-fixture-ids.js` để cập nhật `TOURS`/`BOOKINGS`/`AGENCY_A` trong `scenarios/*.js`.

## 9. Tệp bằng chứng

- Kết quả JSON: `.playwright-cli/agency-roles/results/{matrix,flows-owner,flows-manager,flows-staff,flows-accountant,invitation,isolation,states,team-requests}.json`; lượt xác minh sau sửa: `results/verify-fixes.json`, `results/verify-commission.json`, `results/verify-agency-chat.json`.
- Kịch bản: `.playwright-cli/agency-roles/scenarios/*.js` · fixture: `.playwright-cli/agency-roles/fixture.ts` · runner: `.playwright-cli/agency-roles/run.sh` · đồng bộ ID: `.playwright-cli/agency-roles/sync-fixture-ids.js`
- Ảnh tiêu biểu: [`matrix-owner-landing.png`](./screenshots/role-matrix/matrix-owner-landing.png), [`owner-dashboard.png`](./screenshots/owner/owner-dashboard.png), [`owner-tour-created.png`](./screenshots/owner/owner-tour-created.png), [`owner-calendar-saved.png`](./screenshots/owner/owner-calendar-saved.png), [`owner-booking-detail.png`](./screenshots/owner/owner-booking-detail.png), [`owner-complaint-detail.png`](./screenshots/owner/owner-complaint-detail.png), [`invitation-staff-landing.png`](./screenshots/invitation/invitation-staff-landing.png), [`isolation-tour.png`](./screenshots/isolation/isolation-tour.png), [`state-unverified.png`](./screenshots/account-states/state-unverified.png), [`team-requests-approved.png`](./screenshots/team-requests/team-requests-approved.png).

## 10. Sửa lỗi sau báo cáo (14/11/2026)

| Lỗi | Cách sửa | Kiểm chứng |
|---|---|---|
| F1 | `complaintsApi` chọn endpoint theo role; AGENCY dùng `/agency/complaint-tickets` cho detail, gửi tin và escalate | `verify-fixes`: chi tiết 200 + hội thoại |
| F2 | migration `20261114000100_agency_seed_custom_tour_permissions`: cập nhật function seed + thêm quyền còn thiếu cho role hiện có | `agency-flexible` 19/19; `verify-fixes`: custom-tours 200 |
| F3 | `resolveAgencyContextIfMember` trên `/custom-tours`; service scope theo `agencyId` của context; ACCOUNTANT bị 403 | test mới `custom-tours.agency-scope` 3/3 |
| F4 | `/agency/review-disputes` và `/agency/premium` dùng `agencyContext.agencyId`, thêm vào `integrated` | `verify-fixes`: disputes 200; `error-contract` 7/7 |
| F5 | bỏ điều kiện legacy trong `AgencyRightSidebar` | `verify-fixes`: nav MANAGER có voucher + khiếu nại |
| F6 | workspace mở bằng `agency:tour-view`; link "Sửa nội dung tour" cần `tour:update-own` | `verify-fixes`: STAFF read-only |
| F7 | `/auth/login` trả `AGENCY_PORTAL_REQUIRED`; form đối tác chuyển sang `/auth/agency/login`; onboarding dở bị `AGENCY_ONBOARDING_REQUIRED` | `error-contract` 7/7; `verify-fixes`: traveler portal bị từ chối |
| F8 | model `AgencyCommissionRequest` + API `/agency/commission` (OWNER gửi/huỷ) và hàng đợi duyệt `/admin/settings/agency-commission-requests`; duyệt ghi `commissionRateBps` + tăng version | integration `agency-commission` 5/5; Playwright `verify-commission` 5/5 |
| F9 | bỏ `/agency/finance` khỏi route map | `agency-layout` 12/12 |
| F10 | selector `#credential`, `#password`, nút `Đăng nhập` | script cập nhật |
| F11 | chat tenant: `Conversation.agencyId` + `guideId` nullable (migration `20261114000300_agency_chat_tenant`), endpoint `/agency/chat/*`, `chat:use` cho OWNER/MANAGER/STAFF, màn `/agency/conversations`, backfill thread owner, custom tour dùng `agencyId` | integration `chat` 8/8 + `chat.realtime` 9/9; Playwright `verify-agency-chat` 8/8 |
| F12 | `/agency/reviews` lấy `selectUser().id` làm `agencyId` nên MANAGER/STAFF thấy danh sách rỗng; đổi sang `selectActiveAgency().agencyId` | `matrix`: `manager-reviews` pass; frontend unit 6/6 |

**Chưa sửa**: không còn — F1–F12 đã xử lý.

**Không đổi**: `premium:contribute` vẫn chỉ OWNER — báo cáo cũ ghi nhầm là MANAGER có; vì vậy `/agency/premium` của MANAGER vẫn 403 **đúng policy**, không phải lỗi legacy gate.

Kiểm tra tự động sau sửa: `tsc --noEmit` backend + frontend pass; backend unit 804/804; frontend 900/900; integration `agency-flexible` 19/19, `custom-tours` 10/10 + `custom-tours.negotiation` 8/8, `error-contract` 7/7, `custom-tours.agency-scope` 3/3, `agency-commission` 5/5, `audit.coverage` 8/8, `chat` 8/8, `chat.realtime` 9/9; Playwright `verify-fixes` **9/9** (chi tiết khiếu nại, custom-tours, nav MANAGER, review disputes, tour STAFF read-only, ACCOUNTANT 403, traveler portal), `verify-commission` **5/5** (OWNER xem/gửi, Super Admin duyệt, mức 20% áp dụng, MANAGER read-only) và `verify-agency-chat` **8/8** (traveler mở thread, OWNER/Manager thấy chung hộp thư, trả lời, ACCOUNTANT bị chặn, agency khác không thấy).

## 11. Lượt chụp lại ảnh theo tính năng (14/11/2026)

Chạy lại toàn bộ 12 kịch bản trên fixture mới; backend `NODE_ENV=test` để tắt auth rate limiter (20 lượt/15 phút) vì lượt này đăng nhập hơn 200 lần. Lượt chạy phát hiện thêm F12 (`/agency/reviews` dùng user id thay vì agency id), đã sửa; kết quả cuối **213/213 checks pass**.

| Kịch bản | Checks | Thư mục ảnh | Số ảnh |
|---|---:|---|---:|
| `matrix` — 4 vai trò × 23 route + nav | 116 | `role-matrix/` | 5 |
| `verify-fixes` — F1–F7 | 9 | `fixes/` | 9 |
| `verify-commission` — F8 | 5 | `commission/` | 5 |
| `verify-agency-chat` — F11 | 8 | `agency-chat/` | 8 |
| `flows-owner` | 24 | `owner/` | 7 |
| `flows-manager` | 14 | `manager/` | 1 |
| `flows-staff` | 9 | `staff/` | 1 |
| `flows-accountant` | 8 | `accountant/` | 1 |
| `invitation` | 5 | `invitation/` | 6 |
| `isolation` | 5 | `isolation/` | 2 |
| `states` | 8 | `account-states/` | 5 |
| `team-requests` | 2 | `team-requests/` | 1 |
| **Tổng** | **213** | **12 thư mục** | **51** |

Mỗi thư mục là một tính năng: `role-matrix/` (ma trận quyền), `owner/` `manager/` `staff/` `accountant/` (luồng từng vai trò), `invitation/` (mời/tham gia), `isolation/` (cách ly tenant), `account-states/` (chưa xác minh/bị khoá/sai mật khẩu/cổng du khách), `team-requests/` (duyệt yêu cầu), `fixes/` (xác minh F1–F7), `commission/` (F8), `agency-chat/` (F11). `archive/` giữ 58 ảnh của lượt chạy trước khi sửa, dùng cho các dẫn chứng F1–F11 ở trên.

Chạy lại:

```bash
node .playwright-cli/agency-roles/sync-fixture-ids.js   # sau khi seed fixture
bash .playwright-cli/agency-roles/run.sh all
```

Tài liệu chức năng đầy đủ (17 nhóm, 23 màn hình, 27 ảnh): [AGENCY-FUNCTIONS.docx](../../agency/AGENCY-FUNCTIONS.docx) · [bản PDF](../../agency/AGENCY-FUNCTIONS.pdf).
