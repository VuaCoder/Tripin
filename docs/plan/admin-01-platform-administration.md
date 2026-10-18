# [ADMIN-01] Platform Administration Flow — kế hoạch triển khai

Ngày khảo sát: 18/10/2026. Cập nhật triển khai: **đã triển khai source và kiểm thử tự động liên quan; chưa Done toàn bộ vì QA trình duyệt và các lỗi kiểm tra toàn hệ thống còn mở**.

Kết quả triển khai ngày 18/10/2026: sáu màn hình quản trị đã nối backend; mọi admin router yêu cầu role Super Admin cùng permission; cancellation hours đã có validation nghiệp vụ. Frontend 301 test pass, riêng ADMIN-01 47 test pass; backend unit 511 test pass, nhóm integration ADMIN-01 25 test pass; frontend TypeScript và hai production builds pass. Full backend typecheck còn lỗi baseline; full integration còn 7 test fail ở 5 file ngoài phần ADMIN-01 sửa. Browser inventory rỗng và iab không khả dụng nên chưa có walkthrough/screenshots. Xem [báo cáo QA](../testing/admin-01/README.md) và [flow đã triển khai](../flows/platform-administration.md).

Bổ sung theo phản hồi UI ngày 18/10/2026: đã mở rộng API date range/comparison và server filters, thêm chọn ngày/preset, biểu đồ tương tác, tìm kiếm/lọc các danh sách, sidebar và bố cục bảng/card. Kết quả mới nhất: frontend 310 test pass (riêng admin 56), backend unit 512 test pass và nhóm integration 29 assertion pass; hai builds pass. Giới hạn browser/teardown và lỗi baseline vẫn được giữ rõ trong báo cáo QA.

Cập nhật bố cục tiếp theo: bỏ sidebar quản trị theo yêu cầu, dùng menu header hiện có trên desktop/mobile và mở rộng nội dung thành một cột. Search/filter dữ liệu trong từng trang được giữ nguyên.

Phần khảo sát ban đầu bên dưới mô tả hiện trạng trước triển khai. Phạm vi vẫn là workspace và database test disposable, chưa gọi backend đang deploy hoặc kiểm tra production. Kết quả chạy mới nằm trong báo cáo QA; không dùng mô tả coverage ban đầu thay cho bằng chứng chạy test.

## 1. Kết luận khảo sát

Backend đã có route, validation, service, repository và test cho cả sáu use case. Phần thiếu lớn nhất là frontend quản trị và việc nối dữ liệu thật. Tuy nhiên, **không thể coi đây là task chỉ frontend**: yêu cầu chỉ Super Admin được thao tác chưa được bảo đảm bởi mô hình quyền cộng thêm hiện tại.

`frontend/app/super-admin/page.tsx` hiện là trang khung: số liệu `--`, trạng thái hệ thống/cảnh báo viết cố định và audit empty state không gọi API. `layout.tsx` đã có `RoleGuard` cho `SUPER_ADMIN`. Navigation có liên kết `/super-admin/users` nhưng chưa có page tương ứng; chưa có các page quản lý còn lại.

`docs/backend/USE_CASE_MAP.md` đánh dấu các use case là `done` theo phạm vi backend. Trạng thái này **không chứng minh ADMIN-01 end-to-end đã hoàn thành**.

## 2. Nguồn đối chiếu và quy tắc áp dụng

Đã kiểm kê tài liệu Markdown trong `docs/`, README các module backend, README frontend hiện có và các package dùng chung; đọc sâu source của những module ADMIN-01 và các điểm tích hợp. Sơ đồ `docs/architecture/TripRi.json` và `docs/use-cases/README.md` xác nhận đúng sáu use case; `docs/flows/README.md` mới liệt kê flow, chưa định nghĩa quy trình duyệt cấu hình chi tiết.

| Nhóm nguồn | Tài liệu / mã nguồn chính | Cách sử dụng |
|---|---|---|
| Quy tắc | `docs/AI_RULES.md`, root `README.md` | Minimal change; không bỏ qua validation/authorization; không thêm framework, module trùng hoặc Custom Tour |
| Kiến trúc | `docs/architecture/README.md`, `docs/backend/ARCHITECTURE.md`, `backend/README.md` | Monorepo pnpm; Next.js + RTK Query; Express theo domain và phân lớp |
| Hợp đồng backend | `docs/api/{README,ENDPOINTS,ERRORS}.md`, `docs/backend/USE_CASE_MAP.md` | URL, HTTP method, permission, response/error; kiểm chứng lại với router và DTO thực |
| Hiện trạng / quyết định | `docs/backend/{PROGRESS,HANDOVER,DECISIONS}.md` | Hiểu lịch sử; các quyết định D-4, D-16, D-17, D-24–26, D-31, D-53 liên quan trực tiếp |
| Database | `prisma/schema.prisma`, migrations, `docs/database/README.md`, ADR 0004/0005 | Schema chạy thực là Prisma; design SQL không tự động được áp dụng |
| Module | README + source `users`, `dashboards`, `promotions`, `categories`, `system-settings`, `audit` | Tái sử dụng nghiệp vụ, kiểm tra chênh lệch README/source |
| Tích hợp | `auth`, `bookings`, `tours`, `payments`, `subscriptions`, `earnings`, các module moderation | Xác nhận tác động commission/policy/promotion/category và dữ liệu dashboard |
| Frontend | `docs/frontend/DESIGN.md`, `features/auth`, `features/agency-promotions`, `store/api`, shared UI/layout | Giữ design system, auth flow, API base và component sẵn có |
| Tham khảo phạm vi khác | `docs/plan/*`, `docs/testing/*`, README các module còn lại | Nhận biết tính năng đã có và công việc đang diễn ra; không kéo sang ADMIN-01 |

Những khác biệt tài liệu phải xử lý khi triển khai:

- README `users`, `categories`, `promotions`, `system-settings` còn nhắc `*.model.ts`, document/embedded data, sparse index hoặc regex theo kiến trúc cũ. Source hiện dùng Prisma/PostgreSQL; `SystemSetting.value` là JSON. Không tạo lại model MongoDB.
- `PROGRESS.md`, `HANDOVER.md`, một số quyết định lịch sử còn nhắc MongoDB/mongod. Giữ lịch sử, thêm chỉ dẫn hiện trạng khi cần; ưu tiên ADR mới và code thực. Không dùng số test lịch sử làm bằng chứng hiện tại.
- `docs/database/design/` là tầm nhìn marketplace lịch sử; `scope/` là tài liệu đối chiếu, không phải yêu cầu migrate toàn bộ. Không nhập SQL design vào migration ADMIN-01.
- `DESIGN.md` có ví dụ UI và package hiện có có Ant Design; task này tiếp tục dùng shared UI + Tailwind theo rule, không mở rộng framework.
- `packages/shared-types` và `shared-validation` không được mặc định là đã có đầy đủ contract. Kiểm tra export trước khi dùng; không import backend service/Prisma vào frontend.

## 3. Cấu trúc và tính năng hệ thống đang có

```text
frontend/                  Next.js App Router, feature components, Redux/RTK Query
backend/src/modules/       Các domain: auth, users, tours, bookings, payments, ...
backend/src/middlewares/   authenticate, authorize, validate, error handling
backend/src/routes/        Registry route, introspection, security/contract tests
packages/                  constants, shared-types, shared-validation
prisma/                    Schema và migrations duy nhất của application
docs/                      Rules, architecture, use cases, API, database, plans, QA
```

Hệ thống đã có backend cho xác thực JWT/refresh, OTP/Google/2FA, hồ sơ và xác minh agency, tour/discovery/guide assignment, promotion, wishlist/cart, booking/payment/e-ticket, review, subscription/earnings, chat/notifications, AI, reports/support/moderation, dashboard và cấu hình nền tảng. Custom Tour còn là placeholder và bị loại khỏi phạm vi hiện tại. Frontend đã có nhiều flow Traveler/Agency/Guide và một phần Moderator; sự tồn tại module backend không đồng nghĩa mọi UI đã hoàn tất.

Luồng giữ nguyên:

```text
Page -> feature component -> RTK Query/baseApi -> /api/v1
     -> authenticate -> authorization -> validate
     -> controller -> service -> repository -> Prisma/PostgreSQL
```

Backend khác domain chỉ gọi public API `index.ts`. Dashboard tiếp tục tổng hợp qua service thống kê của module sở hữu dữ liệu, không viết query DB vào frontend/controller.

## 4. Ma trận hiện trạng và API cần kết nối

Tất cả URL dưới đây nằm sau `/api/v1`.

| Use case | API có sẵn | Permission | Phần phải hoàn thiện |
|---|---|---|---|
| Detailed Dashboards | `GET /admin/dashboard` | `admin:dashboard` | Page dữ liệu thật, KPI, breakdown, chuỗi 12 tháng, refresh/loading/error |
| Platform Promotions | `GET/POST /admin/promotions`; `GET/PATCH /admin/promotions/:id` | `promotion:platform-manage` | List/phân trang/lọc active, xem chi tiết, tạo/sửa/bật tắt |
| Assign User Permissions | `GET /admin/users`; `PATCH /admin/users/:id/access` | `user:assign-permissions` | Tìm/lọc/phân trang, chỉnh role + extraPermissions, phản ánh quyền hiệu lực |
| Platform Commission | `GET/PUT /admin/settings/commission` | `commission:configure` | Đọc/lưu commission nền tảng, validation và thông báo phạm vi áp dụng |
| Tour Categories | `GET/POST /admin/categories`; `PATCH/DELETE /admin/categories/:id` | `category:configure` | Danh sách active/inactive, tạo/sửa/thứ tự/vô hiệu hóa/kích hoạt lại |
| System Policies | `GET /policies`, `GET /policies/:key`; `PUT /admin/policies/:key` | Write: `policy:configure`; read public | Bốn policy, form nội dung/params, lưu và đối chiếu dữ liệu backend |

`GET /admin/audit-logs` có sẵn, permission `audit:view`. Giữ việc ghi audit như backend hiện tại. UI audit riêng là supporting/follow-up, không phải điều kiện bắt buộc mới của sáu use case. Nếu bỏ khối audit giả ở dashboard thì không thay bằng số liệu giả khác.

## 5. Rủi ro và quyết định triển khai

### 5.1. P0 — chỉ Super Admin được quản trị

`requirePermission` chỉ kiểm tra `actor.permissions`. `resolvePermissions` hợp quyền mặc định của role với `extraPermissions`, trong khi `assignAccessBody` cho phép mọi permission hợp lệ. Vì vậy non-admin được cấp `commission:configure`, `policy:configure` hoặc `user:assign-permissions` có thể vượt ý nghĩa “Super Admin only”. Đây là khoảng trống từ source; không cần thử trên production để kết luận.

Hướng thực hiện theo acceptance criteria của task:

1. Thêm guard role tập trung trong authorization middleware; yêu cầu actor là user và role hiện tại là `SUPER_ADMIN`, đồng thời giữ `requirePermission` theo từng chức năng.
2. Gắn vào toàn bộ router `/admin/*` hiện có để tránh đường vòng: users, dashboard, promotions, categories, settings, policies và audit. Không biến API public category/policy thành API riêng tư.
3. Cập nhật metadata guard, `introspect.ts`, route docs generator và test đọc metadata để bảng quyền thể hiện được cả role lẫn permission. Guard mới không được làm route bị phân loại nhầm thành public/login.
4. Giữ extra permissions cho các khả năng khác theo cơ chế cũ. UI đánh dấu quyền admin chỉ hiệu lực với Super Admin; không hứa rằng cấp extra permission sẽ cho non-admin mở khu quản trị. Không tự xóa extra permissions đã lưu hoặc đổi hợp đồng gán quyền toàn hệ thống.
5. Test có sẵn trong `users/__tests__/admin.integration.test.ts` đang cho Traveler được gán `audit:view` gọi audit thành công. Sửa đúng kỳ vọng này và bổ sung bằng chứng quyền không dành riêng cho admin vẫn hoạt động; ghi quyết định thay đổi quyền theo yêu cầu ADMIN-01.

Backend đã đọc lại user/role/status mỗi HTTP request nên quyền thay đổi có hiệu lực ở lần gọi tiếp theo. Frontend chỉ là lớp UX; cần xử lý 403 khi session UI còn giữ role cũ. Không refactor auth toàn bộ, không dùng role từ JWT/localStorage làm nguồn quyết định backend.

### 5.2. P1 — validation policy theo ý nghĩa nghiệp vụ

Schema hiện chỉ kiểm tra `params` là map phẳng number/string/boolean, chưa kiểm tra riêng `cancellationWindowHours`. Bookings đọc giá trị number và mặc định 24 nếu không có number; chuỗi hoặc số âm có thể được lưu nhưng không phản ánh ý nghĩa admin mong muốn.

- Bổ sung validation theo key cho knob đang thực sự được dùng: `cancellationWindowHours` phải là số hữu hạn không âm. Không tự thêm giới hạn tối đa hoặc bắt buộc integer khi nghiệp vụ chưa quy định; nếu cần siết thêm phải ghi quyết định rõ.
- Giữ contract title/content/params hiện có và các params khác; chặn invalid ở backend, không chỉ form.
- `setPolicy` thay thế tài liệu lưu; DTO đọc lại merge default params. Form phải giữ những params đang có, gửi đầy đủ trạng thái muốn lưu và nhận DTO phản hồi. Không gửi `params: {}` khi chỉ sửa title vì vô tình xóa params đã lưu.
- Nội dung là text/Markdown; không render raw HTML không kiểm soát. Không xây approval/publish/versioning vì chưa có quy trình đó trong backend.

### 5.3. Tính nhất quán dữ liệu và phạm vi

- Dashboard cache 30 giây; refresh client không bảo đảm bỏ qua cache server. Hiển thị `generatedAt` và ghi chú độ trễ, không hứa realtime.
- Dashboard `users.byRole.AGENCY` không có nghĩa “agency active”; số guide theo role không có nghĩa “đã xác minh”. Label phải đúng metric thực.
- Revenue booking gồm `CONFIRMED/COMPLETED`, tiền nguyên VND; `gross`, `commission`, `net`, subscription amount là các chỉ số khác nhau. Không gọi tổng gross là thu nhập riêng của platform.
- Commission hiện là **một mức toàn nền tảng**, 0–100%, tối đa hai chữ số thập phân; lưu basis points, mặc định 0%. Booking cũ giữ snapshot; không tạo mức riêng agency/category.
- Promotion không có DELETE; tắt bằng PATCH. Code và discountType bất biến. Không có API clear nullable cho một số field optional: UI không được báo đã xóa giới hạn nếu PATCH thực tế chỉ bỏ qua field.
- Category DELETE là deactivate; tour cũ giữ reference. Không hard-delete và không thêm hierarchy/icon.
- Không có optimistic concurrency/version của policy/commission hiện tại; có khả năng last-write-wins khi hai admin sửa cùng lúc. Không hứa có conflict detection. Ghi giới hạn này trong handover, không mở rộng versioning trong scope cơ bản.
- Audit ghi best-effort; lỗi audit được log, không rollback nghiệp vụ đã lưu. Không tuyên bố business mutation và audit là một transaction.
- Working tree đã có thay đổi của task Guide/finance và các file dùng chung (`baseApi.ts`, `navigation-config.ts`, test setup...). Giữ nguyên thay đổi của người dùng, đối chiếu diff trước khi sửa, không reset/ghi đè.

## 6. Cấu trúc frontend đề xuất

```text
frontend/app/super-admin/
  layout.tsx                 Giữ RoleGuard và dùng global shell hiện có
  page.tsx                   Dashboard
  promotions/page.tsx
  users/page.tsx
  settings/commission/page.tsx
  categories/page.tsx
  policies/page.tsx
frontend/features/admin/
  api/                       adminDashboardApi, adminPromotionsApi,
                             adminUsersApi, adminSettingsApi, adminCategoriesApi
  components/                Sáu page component + form/dialog liên quan
  types.ts                   DTO/input theo HTTP contract, không import Prisma
  validation.ts              Feedback client; backend luôn kiểm tra lại
  __tests__/                 API contract, interaction và failure states
  index.ts
  README.md
```

Đây là cấu trúc dự kiến, có thể chia file DTO theo chức năng khi đủ lớn; không tạo module backend `admin` gom lại các domain đã có. Dùng `baseApi.injectEndpoints`, shared `Button/Input/FormField/Modal`, `LoadingState/ErrorState/EmptyState/Pagination`. Không bọc AppShell lần hai vì `GlobalSiteShell` đã bọc `/super-admin`.

Form/validation promotion Agency có thể tái sử dụng phần trung tính: đọc props/type hiện tại trước, chỉ tách phần dùng chung cần thiết và giữ regression tests Agency. Không import Agency API vào admin hoặc sao chép cả page để đổi URL. Backend response là envelope `success/data/meta` hoặc `success:false/error`; lỗi phân nhánh theo `error.code`, không parse message.

## 7. Trình tự và gói công việc

### P0 — baseline và khóa hợp đồng (0,5–1 ngày công)

- [x] A01 Ghi trạng thái working tree, kiểm tra scripts/dependencies, chạy baseline frontend/backend; tách lỗi có trước khỏi lỗi ADMIN-01.
- [x] A02 Chốt DTO/envelope/status từ controller/types/source: list users/promotions có `meta`, categories/policies là array, DELETE category trả 204 không parse như DTO bắt buộc.
- [x] A03 Bổ sung role guard và metadata cho toàn bộ admin routers; cập nhật test/document generation theo mục 5.1.
- [x] A04 Bổ sung validation cancellationWindowHours theo key, test API từ chối invalid và không lưu thay đổi.
- [x] A05 Sửa README liên quan kiến trúc cũ; ghi quyết định thay đổi admin-only. Giữ log lịch sử nguyên nghĩa.

**Điều kiện qua bước:** non-admin dù được gán admin extra permissions vẫn bị từ chối ở backend; public policies/categories vẫn đọc được; test route metadata không mất độ chính xác.

### P1 — API, cache và navigation (0,5–1 ngày công)

- [x] A06 Khai báo DTO/input + API hooks sáu use case, giữ access token/refresh/cookie qua baseApi hiện có.
- [x] A07 Thêm cache tags cần thiết với ID phân biệt ADMIN/AGENCY/PUBLIC; chỉ invalidation theo mutation thành công. Categories ảnh hưởng list public/selector tour; policy ảnh hưởng public read; access ảnh hưởng user list/detail. Đối chiếu endpoint đang có trước khi thêm tag.
- [x] A08 Bổ sung sáu liên kết navigation và thin route pages; giữ role login mapping `homeForRole`.
- [x] A09 Xác định UX chung load/refetch/error/save/error-field/403. Query không chạy khi auth chưa sẵn sàng hoặc không đúng role; logout/account switch xóa private API cache qua middleware hiện có.

**Điều kiện qua bước:** API tests chứng minh URL/method/body/query, envelope, pagination, 204 và failure không làm cache hiển thị thành công.

### P2 — Detailed Dashboards (0,5–1 ngày công)

- [x] A10 Thay toàn bộ metric placeholder/cảnh báo cố định bằng `GET /admin/dashboard`; bỏ tuyên bố health/security không có nguồn backend.
- [x] A11 Hiển thị users theo role/status, newLast30Days, tour/booking status, revenue gross/commission/net, subscription amount/count/active, moderation open counts; chuỗi `monthly` 12 tháng theo backend.
- [x] A12 Format VND/UTC bucket đúng contract; hiện generatedAt, nút tải lại, zero khác unavailable. Có thể dùng chart đơn giản theo pattern sẵn có hoặc bảng; không thêm thư viện biểu đồ chỉ cho task này.

**Điều kiện qua bước:** số liệu khớp fixture/backend; lỗi API không chuyển thành KPI 0; không thêm date filter/export khi API chưa hỗ trợ.

### P3 — Platform Promotions (1–1,5 ngày công)

- [x] A13 List phân trang và lọc isActive, hiển thị usedCount/usageLimit/isRunning; GET chi tiết trước khi sửa nếu cần dữ liệu mới.
- [x] A14 Form create/update, khóa code/type, khóa discountValue sau redemption, bật/tắt bằng PATCH; chỉ scope PLATFORM và không gửi owner/scope tự chọn.
- [x] A15 Validation code 3–30 ký tự hợp lệ, title 3–200, description ≤2000; discount nguyên dương, percent 1–100, cap chỉ PERCENT; giới hạn field số theo backend; end > start, promotion mới kết thúc trong tương lai, usageLimit không dưới usedCount.
- [x] A16 Đổi datetime-local thành ISO đúng timezone; phân biệt field bỏ qua và field muốn clear theo API hiện tại. Hiển thị PROMOTION_CODE_EXISTS/PROMOTION_IN_USE và lỗi nghiệp vụ khác; không đóng form khi thất bại.

**Điều kiện qua bước:** tạo/sửa/tắt rồi reload vẫn đúng; agency promotion không lọt list platform; retry sau duplicate không tạo thành công giả; Agency flow tái sử dụng không regress.

### P4 — Assign User Permissions (1–1,5 ngày công)

- [x] A17 List users có q/role/status/page/limit; thay filter reset page; không gửi q rỗng, dùng giới hạn query backend.
- [x] A18 Form role + extraPermissions: tách role defaults chỉ đọc, extra có thể chọn, effective permissions để giải thích. Chỉ persisted roles, không có GUEST; extraPermissions là danh sách thay thế, gửi `[]` khi muốn bỏ hết extra.
- [x] A19 Chặn thao tác tự đổi quyền trên UI và xử lý 403/409 LAST_SUPER_ADMIN/404 từ backend. Hộp xác nhận hiển thị người nhận và thay đổi quyền cụ thể.
- [x] A20 Sau success dùng DTO backend làm nguồn; không ghi user mục tiêu đè lên auth.user của admin đang đăng nhập. Test role/status đổi bởi admin khác, request tiếp theo 403 và nội dung riêng tư không còn hiển thị như đang được phép.

**Điều kiện qua bước:** quyền mới có hiệu lực ở request kế tiếp; không self-edit; còn ít nhất một active Super Admin; không mở đường non-admin tự cấp quyền admin.

### P5 — Commission, Categories và Policies (1,5–2,5 ngày công)

- [x] A21 Commission: load trước khi edit, hiển thị current/updatedAt, không cho save trước khi load thành công; input 0–100, ≤2 decimals, không ép chuỗi rỗng thành 0. Xác nhận thay đổi, nhận lại ratePercent/rateBps; ghi rõ chỉ booking tạo sau thay đổi chịu rate mới.
- [x] A22 Categories: list tất cả, create name/description/sortOrder, update, deactivate/re-activate; label thao tác đúng nghĩa. Name 2–80, description ≤1000, sortOrder integer 0–100000, xử lý empty slug và CATEGORY_EXISTS. List hiện không phân trang backend; không tạo pagination API giả.
- [x] A23 Policies: bốn key cố định cancellation/refund/terms/privacy; load public GET hiện có rồi edit, title 2–200, content ≤50000; giữ params và kiểu dữ liệu, tối đa 30 keys, key pattern theo schema, string value ≤500.
- [x] A24 Dùng input riêng cho cancellationWindowHours; params khác nếu hiển thị sửa thì cần typed fields number/string/boolean, không gửi JSON bất kỳ chưa validate. Form nhận lại DTO backend, giữ draft khi API lỗi; không thêm save-as-draft/publish workflow.

**Điều kiện qua bước:** lưu rồi đọc lại khớp; booking snapshot commission cũ không đổi; cancellation rule nhận cấu hình mới; inactive category biến mất khỏi public list nhưng reference tour không mất.

### P6 — kiểm thử tích hợp, tài liệu và bàn giao (1–2 ngày công)

- [ ] A25 Chạy ma trận AC mục 9; thêm coverage hành vi còn thiếu thay vì viết lại các test service đã có.
- [ ] A26 Browser walkthrough với backend/database test riêng: Super Admin, tất cả role non-admin, reload, network fail, expired token, đổi quyền, mobile/tablet/desktop và keyboard/modal.
- [x] A27 Cập nhật feature README, use-case map và tài liệu API khi contract/guard đổi; ENDPOINTS phải sinh từ script. Ghi evidence QA thật và giới hạn cache/concurrency/audit.
- [ ] A28 Chạy checks mục 10, review diff chỉ liên quan ADMIN-01, rà không còn placeholder thành công, rồi mới đổi task thành Done.

Ước lượng tổng: **6,5–10,5 ngày công cho một người**, phụ thuộc baseline, mức tái sử dụng form và lỗi hồi quy phát hiện. Đây là ước lượng triển khai, không phải cam kết lịch. Thứ tự phụ thuộc: P0 → P1 → P2/P3/P4/P5 → P6; không đánh dấu hoàn tất từng màn hình chỉ dựa vào UI đã render.

## 8. Quy tắc loading/error/success bắt buộc

1. Initial load: skeleton/loading; chưa có dữ liệu thì không cho sửa cấu hình bằng giá trị đoán.
2. Empty hợp lệ khác load failure. Refetch failure có thể giữ dữ liệu trước đó với nhãn chưa cập nhật; đổi filter/user không được trình bày cache cũ như kết quả mới.
3. Submit: disable thao tác trùng, `await mutation(...).unwrap()`. Chỉ đóng dialog/báo thành công/cập nhật saved state sau backend xác nhận thành công; không optimistic update cấu hình nhạy cảm.
4. 400: lỗi field/form theo details và code. 401: dùng refresh hiện có. 403: báo mất quyền và dừng thao tác. 404: dữ liệu không còn/không thuộc scope, reload phù hợp. 409: giải thích xung đột và giữ draft. 429/5xx/network: cho thử lại, không báo lưu thành công.
5. Timeout có thể xảy ra sau khi backend đã commit: báo chưa xác nhận kết quả, cho đọc lại trước khi gửi lại. Không khẳng định rollback hoặc chưa lưu khi chưa biết. Không tự retry POST create một cách mù quáng.
6. Save thành công nhưng refetch thất bại: phân biệt rõ “đã lưu, tải lại chưa thành công”; không gán lỗi save hay success cho toàn bộ flow sai thực tế.
7. Không lấy localStorage làm nguồn config, không hiển thị draft ở khu “đã lưu”, không toast success trong finally. Response thay đổi user mục tiêu không làm thay đổi session của người thực hiện.

## 9. Ma trận acceptance criteria và bằng chứng

| AC | Kiểm chứng bắt buộc | Lớp kiểm thử |
|---|---|---|
| Dashboard từ backend | Khớp DTO/fixture, đủ zero/error/generatedAt; paid-only revenue; UTC monthly | FE API/component + dashboard integration hiện có + browser |
| Promotions hoạt động | Create/edit/toggle platform, pagination/filter, duplicate/used/invalid date; agency scope tách biệt | FE + promotions service/integration + browser |
| Gán quyền đúng quy tắc | Role + extra replacement, unknown permission bị từ chối, self-edit bị chặn, last admin/race, hiệu lực request kế tiếp | FE + users service/admin integration |
| Commission đúng phạm vi | 0/100/12.5 hợp lệ; âm/>100/3 decimals/string invalid; booking cũ giữ snapshot | FE + admin integration |
| Categories đúng nghiệp vụ | Create/rename/duplicate slug/sort, deactivate/re-activate, public active-only, không mất tour reference | FE + categories service/admin integration + browser |
| Policies đúng quy trình | Bốn keys, text/params round-trip, title/content/params limits, cancellation knob invalid bị chặn | FE + settings service/admin integration |
| Thay đổi được lưu thật | Success response, GET lại, hard reload khớp; params không mất | Real-backend walkthrough + API integration |
| Invalid được xử lý | Boundary matrix, body strict, invalid không ghi DB; frontend lỗi đúng field | Validation + API integration + component |
| Không success giả | Mutation 400/403/409/500/network/timeout; không đóng form/đổi saved state; success rồi refetch fail phân biệt đúng | FE interaction/API tests + browser network failure |
| Super Admin only | Guest 401; mọi persisted non-admin role 403, kể cả có cả sáu extra admin permissions/user:assign-permissions; không ghi DB; Super Admin hợp lệ qua guard | Table-driven HTTP integration + guard/metadata tests + RoleGuard |
| Được kiểm tra trước Done | Lệnh chạy có kết quả, browser/API evidence, blockers đóng hoặc ghi rõ task chưa Done | Checklist bàn giao |

Các test backend đã có để mở rộng/chạy lại:

- `backend/src/modules/users/__tests__/admin.integration.test.ts` (users, commission, policies, categories).
- `backend/src/modules/users/__tests__/users.service.test.ts`.
- `backend/src/modules/dashboards/__tests__/dashboards.{service,routes,integration}.test.ts`.
- `backend/src/modules/promotions/__tests__/promotions.{service,integration}.test.ts`.
- `backend/src/modules/categories/__tests__/categories.service.test.ts`.
- `backend/src/modules/system-settings/__tests__/system-settings.service.test.ts`.
- `backend/src/routes/__tests__/routes.audit.test.ts`, security/error/validation tests; tìm thêm test docs/generated route theo file hiện tại trước khi sửa metadata.

Không ghi đè kỳ vọng quyền cũ chỉ để suite xanh: cập nhật có chủ đích theo yêu cầu Super Admin only, đồng thời giữ coverage extra permissions không dành riêng cho admin.

## 10. Lệnh kiểm tra và Definition of Done

Chạy baseline trước sửa và chạy lại theo ảnh hưởng; cuối task chạy đầy đủ:

```bash
pnpm --filter frontend test
pnpm --filter frontend exec tsc --noEmit
pnpm --filter frontend build
pnpm --filter backend typecheck
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter backend build
pnpm --filter backend docs:routes
```

`frontend` hiện không có script `typecheck`; dùng `exec tsc --noEmit`, không giả định script tồn tại. Kiểm tra script docs:routes ghi file như thế nào trước khi sử dụng. Khi thay metadata phải chạy lại test kiểm tra docs sau khi sinh bảng. Integration suite hiện dùng embedded PostgreSQL với DB riêng theo test file; không trỏ suite vào production. Nếu thiếu binary/dependency hoặc build cần mạng, ghi blocker chính xác, không gọi kết quả là pass.

Task chỉ Done khi:

- [ ] Sáu màn hình dùng backend thật và có navigation tới được.
- [ ] Backend chặn role không phải Super Admin, kể cả admin extra permissions; frontend có guard và phản hồi mất quyền.
- [ ] Validation client/backend và loading/error/empty/saving/success được kiểm chứng.
- [ ] Save/read/reload khớp; không success trước backend; ảnh hưởng booking/category/policy đã được kiểm tra.
- [ ] Tests cần thiết, typecheck, builds và kiểm tra route docs pass; lỗi baseline nếu có được phân loại và xử lý mức ảnh hưởng.
- [ ] Có evidence browser với stack test, không dùng mock làm bằng chứng persistence.
- [ ] README/API/use-case map phản ánh hiện trạng, tách backend done và ADMIN-01 end-to-end done.
- [ ] Diff không ghi đè công việc khác, không có secret, dependency thừa hoặc migration ngoài yêu cầu.

Không có migration bắt buộc được xác định ở bước khảo sát. Nếu triển khai phát hiện cần đổi schema, phải nêu invariant cụ thể, tạo migration theo workflow dự án và test trên database riêng; không mở rộng schema chỉ vì design lịch sử có thêm bảng.
