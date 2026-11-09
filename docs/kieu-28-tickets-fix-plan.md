# Kế hoạch xử lý 28 ticket của Kiều

> Đã triển khai: xem [báo cáo kết quả và giới hạn kiểm chứng](kieu-implementation-report.md). Các mô tả lỗi và trạng thái chưa chạy test dưới đây ghi nhận thời điểm lập kế hoạch, trước khi sửa.

Ngày rà soát: 04/11/2026. Phạm vi: danh sách KIEU-01 đến KIEU-28 trong file task được cung cấp.

## 1. Cách đọc kết quả

Đã khảo sát cấu trúc backend, frontend, packages, mobile và truy vết các flow liên quan đến 28 ticket qua route → controller → service → repository → schema, cùng UI/API client và test liên quan. Đây là review tĩnh theo phạm vi ticket, không phải khẳng định đã đọc từng dòng của toàn bộ repository. Chưa chạy ứng dụng, khai thác endpoint hay chạy test; các bước tái hiện dưới đây là ca kiểm chứng cần thực hiện khi triển khai.

Phân loại:

- **Lỗi xác định từ code:** đường thực thi hiện tại cho phép hành vi trái acceptance criteria.
- **Có một phần:** đã có hạ tầng hoặc chức năng, cần sửa/mở rộng.
- **Thiếu chức năng:** chưa thấy model/contract/flow đáp ứng yêu cầu trong phần source đã rà soát.

Các đường dẫn trong tài liệu tính từ gốc repo.

## 2. Những khác biệt giữa ticket và repo phải biết trước khi sửa

1. Backend là Express, không có `backend/src/common/guards/auth.guard.ts` hay `permissions.guard.ts`. Auth nằm ở `backend/src/middlewares/authenticate.ts`; guard quyền ở `backend/src/middlewares/authorize.ts`.
2. Schema chuẩn nằm ở **`prisma/schema.prisma`**; migration ở `prisma/migrations`. Không sửa generated Prisma client bằng tay.
3. Role quản trị là `SUPER_ADMIN`, không phải `ADMIN`. Agency đang dùng `UNVERIFIED / PENDING / VERIFIED / REJECTED`; `PENDING_REVIEW` hiện là trạng thái tour.
4. Tên trường thực tế: `extraPermissions`, `licenseNumber`, `businessLicenseUrl`, `assignedToId`. Không tạo thêm trường đồng nghĩa chỉ để giống mô tả ticket.
5. Có ba thực thể riêng: `Report` = báo cáo vi phạm/tranh chấp, `SupportTicket` = yêu cầu hỗ trợ, `ComplaintTicket` = khiếu nại tour với Agency và CSAT. `ComplaintTicket` đã có `ticketCode`; `SupportTicket` chưa có. KIEU-22/28 áp dụng cho SupportTicket; KIEU-08/23 liên quan ComplaintTicket.
6. DELETE `/api/v1/users/me/avatar` **đã có**. Lỗi Agency nằm trong `removeTravelerAvatar()` gọi `assertTraveler()`, không phải thiếu route.
7. Đã có integration test cho admin/moderation/audit, kể cả concurrency hạ quyền. Không thể đánh dấu KIEU-15 là chưa có test nào.
8. `SELECT COUNT(*) ... FOR UPDATE` trong ticket không phải cách khóa hợp lệ cho truy vấn aggregate PostgreSQL. Chọn SERIALIZABLE với retry có giới hạn hoặc khóa một hàng điều phối cố định rồi đọc/ghi trong transaction.
9. Key policy hiện dùng camelCase và chỉ có `cancellation/refund/terms/privacy`; schema params không chấp nhận dấu `_`. `moderation_sla_hours` chưa phải cấu hình chính thức có sẵn. Cần định nghĩa contract SLA nhất quán trước khi nối vào complaint.

## 3. Bản đồ các flow đang lỗi

### A. Unban và session: KIEU-01, 02

`moderation.routes.ts` → `ModerationService.unbanUser()` → `UsersService.unbanUser()` → `updateStatusIf()` → `audit.record()`.

- Unban dùng `ACCOUNT_BAN`, vốn thuộc quyền mặc định Moderator.
- Route chỉ validate params; service không nhận `reason` và audit không có lý do.
- `resolveUserActor()` đọc trạng thái user mỗi request nên ban có tác dụng khi đang BANNED. Tuy nhiên JWT chỉ có sub/role, không có generation; unban phục hồi ACTIVE làm token cũ hợp lệ trở lại nếu chưa hết hạn.
- Có sẵn `RefreshTokenRepository.revokeAllForUser()`, nhưng ban/unban không gọi.
- Test moderation hiện còn khẳng định Moderator unban thành công và token cũ gọi `/users/me` lại được 200. Phải đổi kỳ vọng này.

### B. Quyền và quản lý staff: KIEU-03, 04, 05, 11, 12, 13, 15

`AdminUsersPage` → PATCH `/admin/users/:id/access` → `assignAccess()` → `resolvePermissions()` → `requirePermission()`.

- `resolvePermissions()` hợp role defaults + extras; không có revoke, nên không tạo được Moderator chỉ có vài quyền.
- `assignAccess()` chưa buộc email đã verify và dùng count → write → count → compensation cho Super Admin cuối cùng.
- `banUser()` cho Super Admin ban Moderator; sai yêu cầu tách staff disable.
- Chưa thấy model/route invitation và trạng thái lifecycle staff riêng.
- Menu chung lấy theo role. Dashboard Moderator có `allowed` nhưng vẫn render tile không được phép, chỉ bỏ link.
- Backend dashboard không nhận actor, cache chung khóa `'all'`, trả toàn bộ queues. Admin dashboard tài chính đã có `requireSuperAdmin`; không nên mô tả nhầm là Moderator đã đọc được doanh thu qua route admin.

### C. Policy, booking và SLA: KIEU-06, 07, 08, 14, 25

`AdminPoliciesPage` → `setPolicy()` → upsert `SystemSetting`; `BookingsService.cancel()` → `getPolicyNumber()` đọc policy hiện tại.

- Commission đã snapshot trên booking, cancellation policy thì chưa.
- SystemSetting bị ghi đè; chưa có PolicyVersion, effectiveFrom, rollback hoặc CAS version.
- Có trả `updatedAt` để hiển thị nhưng request lưu không mang expected version; hai người lưu có thể ghi đè.
- ComplaintTicket có mốc firstResponse/resolved/escalated nhưng không có deadline/policy version SLA. Dashboard chất lượng hiện tập trung CSAT và tỷ lệ xử lý, chưa đáp ứng trend SLA.

### D. Agency onboarding và profile: KIEU-09, 10, 16, 17, 18, 24

`auth.routes.ts` → `AgencyApprovalController` → `resolveEmail()` → get/update application.

- `resolveEmail()` chấp nhận email tự truyền trước cả session userId. Guest có thể đọc hồ sơ; hồ sơ REJECTED có thể bị ghi lại và chuyển về PENDING.
- `/agency/application-status` cũng dùng resolver này và trả status token. Chỉ chặn GET/PUT application là chưa đủ: đường lấy token theo email vẫn có thể đi vòng.
- Status token hiện ký HMAC từ email, không có expiry/purpose/version. Cần thay bằng onboarding credential có scope và vòng đời rõ ràng.
- Profile `updateMe()` ghi `companyName/licenseNumber` mà không kiểm tra VERIFIED. `taxId/businessLicenseUrl` không được PATCH schema hiện tại nhận, nên không gán nhầm tất cả trường này là đang sửa được qua `/users/me`.
- AgencyProfile không có submittedAt; repository user list sắp `createdAt DESC`.
- Website UI clear gửi `''` nhưng validator yêu cầu URL. Avatar clear gọi đúng DELETE, service lại chặn Agency.
- Private DTO có `permissions` và `extraPermissions`; cũng được dùng cho auth/session và admin. Không xóa bừa hai trường khỏi mapper dùng chung vì frontend kiểm tra quyền bằng session user.

### E. Audit và hàng đợi: KIEU-19, 20, 21, 26

Các service users/tours/reviews/reports gọi cập nhật domain trước rồi `audit.record()`.

- Audit đã có `metadata Json`, nhiều mutation ghi lý do/decision; chưa chuẩn hóa before/after.
- `AuditService.record()` chủ động catch lỗi và chỉ logger.error. Gọi hàm này bên trong transaction mà vẫn nuốt lỗi sẽ **không** đảm bảo rollback.
- Một số repository đã có transaction/CAS cho domain; audit vẫn nằm ngoài. Cần giữ cơ chế chống double decision khi đưa audit vào.
- Report list đã lọc status/targetType/category và có index status/createdAt, nhưng thiếu tìm kiếm/ngày/report count. Không cần làm lại bộ lọc đã có.
- Audit có GET phân trang, requireSuperAdmin và audit:view; chưa thấy export stream.

### F. Support và dashboard: KIEU-22, 23, 27, 28

- `SupportService.setStatus(_actor, ...)` không dùng actor, không claim, không bắt resolutionNote.
- `replyAsStaff()` tự gán người trả lời đầu tiên và có thể resolve; phải sửa cả đường này để không bypass claim/note.
- Resolve bằng reply đã gửi email (`{ email: true }`); resolve bằng setStatus chỉ notify in-app. Không phải toàn bộ hệ thống support chưa gửi email.
- `ModerationDashboardPage` chỉ lấy `data` từ query complaint rồi dùng `?.meta.total ?? 0` cả tile lẫn link; lỗi query bị hiển thị thành 0.
- Dashboard đã có generatedAt/freshness text, nút refresh và invalidation sau mutation; chưa có polling 1 giờ tại các hook dashboard đã đọc. `setupListeners` đã có trong Providers.

## 4. Plan cho từng ticket

| Ticket | Hiện trạng và bằng chứng | Việc sửa cụ thể | Ca kiểm chứng bắt buộc |
|---|---|---|---|
| **01** | Lỗi xác định. `moderation.routes.ts`, `moderation.service.ts`, `users.service.ts`: ACCOUNT_BAN, không reason. | Chọn requireSuperAdmin để đúng AC Moderator luôn 403; thêm unbanBody trim/min 10/max; truyền reason xuyên controller/service; audit và notification chứa lý do. | Guest 401; Moderator 403; admin thiếu/rỗng/9 ký tự 400; reason hợp lệ ACTIVE + một audit + notification. |
| **02** | Lỗi xác định. `authenticate.ts`, `auth.tokens.ts`, User schema không có version. | Thêm tokenVersion; mọi điểm cấp JWT lấy version DB; ban/unban tăng version + revokeAllForUser trong cùng transaction; kiểm tra version khi resolve actor và đường refresh có thể chạy đồng thời. | Token trước ban vẫn 401 sau unban; refresh cũ bị từ chối; đăng nhập mới dùng được; handshake socket token cũ thất bại. |
| **03** | Có một phần. `packages/constants/src/permissions.ts` chỉ cộng extraPermissions. | Giữ extras làm grant hiện tại, thêm revokedPermissions; effective=(defaults+grants)-revokes, revokes thắng; Super Admin có nguyên tắc riêng; cập nhật admin form/types/mapper/session/menu. Không cần lưu trùng extraPermissions và grantedPermissions. | Moderator được cấp duyệt tour + quyền đọc phụ thuộc nhưng dispute bị 403; revoke có tác dụng HTTP/UI; không mất PROFILE_* ngoài ý muốn. |
| **04** | Thiếu chức năng staff lifecycle trong schema/routes đã rà. | Tạo StaffInvitation và lifecycle riêng cho staff; token random chỉ lưu hash, hạn 24h, consume một lần; invite/activate/disable; active kiểm tra ở login/Google/OTP/session/refresh/HTTP/socket; disable tăng version + revoke sessions + audit. | Token hết hạn/replay fail; activate đặt mật khẩu; disable không còn đường đăng nhập/refresh; gửi lại thư không tạo nhiều invitation hợp lệ. |
| **05** | Lỗi thiết kế concurrency. `assignAccess()` dùng compensation. | Đưa đọc target/count/write/audit vào transaction có SERIALIZABLE và retry giới hạn khi serialization failure; tái đọc actor khi cần bảo vệ hành động đang chạy. Dùng cùng invariant cho disable staff Super Admin. | Hai admin demote nhau bằng barrier đồng thời, luôn còn >=1 active admin; audit fail không làm mất admin; không dựa vào timing Promise.all đơn thuần. |
| **06** | Lỗi xác định. `bookings.service.ts` cancel đọc settings mới nhất. | Lưu snapshot effective policy + version khi create booking, không lúc thanh toán; cancel đọc snapshot. Chốt quy tắc legacy booking trước khi backfill. Kiểm tra retry/idempotency không thay snapshot đã tạo. | Tạo lúc 24h, đổi 48h, hủy trước 30h vẫn được; booking tạo sau áp dụng 48h; test sát ranh giờ. |
| **07** | Thiếu version history. `system-settings.repository.ts` upsert ghi đè. | PolicyVersion append-only lưu toàn bộ nội dung/params, versionNumber theo key, effectiveFrom, reason, actor, rollbackOf; history/detail/rollback API + UI. Rollback tạo version mới, không sửa lịch sử. | Hai version có hiệu lực khác nhau được chọn đúng thời gian; rollback giữ nguyên bản cũ; không có hai version trùng số cùng key. |
| **08** | Thiếu wiring/model SLA và acceptance. `complaints.*`, `system-settings.types.ts`. | Định nghĩa policy moderation SLA theo camelCase; snapshot version/duration + slaDeadlineAt khi create/escalate. Thêm PolicyAcceptance user/version/acceptedAt cho điều khoản, gắn vào luồng đồng ý thật. | Thay SLA chỉ ảnh hưởng case mới; escalation dùng mốc quy định; acceptance tham chiếu đúng nội dung/version đã xem; không tự gán đã đồng ý cho user cũ. |
| **09** | Thiếu trạng thái. Enum và `verifyAgencyBody` chỉ approve boolean. | Thêm INFORMATION_REQUESTED đồng bộ Prisma/constants/frontend; decision enum APPROVE/REJECT/REQUEST_INFORMATION; note bắt buộc cho hai loại sau; state machine, email/in-app, portal sửa và resubmit an toàn. | Request info không thành rejection; Agency đúng chủ sửa được rồi về PENDING; user khác/guest bị chặn; hai moderator quyết định chỉ một thắng. |
| **10** | Lỗi xác định. `UsersRepository.list()` createdAt DESC, AgencyProfile thiếu submittedAt. | Ghi submittedAt trong mọi đường nộp hồ sơ/OTP hoàn tất/resubmit; queue chuyên biệt submittedAt ASC + userId ASC; composite index verificationStatus/submittedAt/userId; backfill có đánh dấu giá trị ước lượng. | Tài khoản cũ nộp sau không lên trước hồ sơ nộp sớm; phân trang ổn định khi cùng timestamp; resubmit có quy tắc rõ ràng. |
| **11** | Có một phần. Frontend allowed chỉ bỏ link; backend trả tất cả queues. | Controller truyền actor; service chỉ query/serialize nhóm được phép; ẩn cả tile/chart; cache theo quyền hiệu lực hoặc cache aggregate nội bộ rồi project trước trả response. | Hai staff khác quyền không đọc lẫn cache; payload không chứa metric bị cấm; không gọi nguồn dữ liệu không có quyền. |
| **12** | Lỗi xác định. `banUser()` cho admin ban moderator. | Chặn mọi target staff ở ban API; trả 400 hướng dẫn disable sau khi qua kiểm tra self; UI chuyển sang thao tác lifecycle staff. | Admin ban Moderator bị chặn; ban Traveler vẫn đúng; disable sử dụng flow 04 và bảo vệ last admin của 05. |
| **13** | Lỗi xác định. `assignAccess()` thiếu email check. | Check emailVerifiedAt khi cấp role staff; với grants cho role thường cần quy định quyền staff nào cũng đòi verify để tránh bypass; invitation activate phải chứng minh sở hữu email. | User chưa verify không lên MODERATOR/SUPER_ADMIN; user verify cấp được; không chỉ kiểm tra status ACTIVE. |
| **14** | Thiếu optimistic lock. `system-settings.validation.ts` không nhận expectedVersion. | Thêm version revision và expectedVersion cho policy/commission editors; CAS ở DB cùng version/audit transaction; UI 409 giữ draft, cho nạp lại. Ghép thiết kế policy revision với 07. | Hai tab cùng revision: lần đầu thành công, lần sau 409; tạo setting mặc định đồng thời cũng không ghi đè; không kiểm tra bằng read-then-write. |
| **15** | Có một phần. users/admin.integration, moderation.integration, audit.coverage đã có. | Mở rộng test hiện có và thêm `backend/src/modules/users/__tests__/admin-staff.integration.test.ts` nếu cần; sửa fixture và expected behavior cũ; CI chạy project integration. | Guards/reason/token/revocation/grants/email/last-admin/lifecycle đầy đủ; route metadata và audit coverage theo contract mới. |
| **16** | Lỗi xác định, ưu tiên cao nhất. `agency-approval.service.ts:resolveEmail()` và getStatus trả token. | Bỏ email làm authorization ở mọi application/status resolver; chỉ own Agency session hoặc onboarding token có scope, expiry và revocation/version. Không để status endpoint cấp token chỉ bằng email; sửa frontend onboarding/status/resubmit. | Guest email-only GET/PUT/status không lấy hồ sơ/token; token A không sửa B; sai scope/hết hạn 401; session A + email B không đổi principal. |
| **17** | Lỗi xác định cho companyName/licenseNumber qua `updateMe()`. | Đề xuất bản đầu chặn thay đổi thực sự của trường pháp lý khi VERIFIED, hướng dẫn xin duyệt lại; tập sensitive dùng tên schema thực tế; không chặn gửi lại giá trị y hệt. Re-verification lưu hồ sơ mới riêng nếu mở rộng sau. | Sửa pháp lý bị từ chối rõ ràng; sửa website/description được; không thể giữ VERIFIED sau một đường đổi legal khác. |
| **18** | Lỗi xác định. `AgencyProfileSettings.tsx` clear ''; validator URL; `removeTravelerAvatar()` chặn Agency. | Normalize website ''/null về null và đồng bộ input types; mở rộng service xóa avatar theo role hỗ trợ; giữ DELETE có sẵn và kiểm tra ownership asset khi cleanup. | Agency clear website ở nút xóa và form save đều thành công; reload không hiện lại; DELETE avatar thành công, Traveler regression pass. |
| **19** | Có metadata nhưng chưa có diff chuẩn. users/tours/reviews/reports services. | Chuẩn hóa metadata `{ before, after, reason }` bằng allowlist từng action, chỉ field thay đổi; redaction đệ quy phòng dữ liệu lồng; audit UI hiển thị diff. Dùng JSON hiện có, chưa cần cột mới. | Role/status/verification/review/tour/report đều có diff; không passwordHash/token/secret; reason đầy đủ; log cũ vẫn đọc được. |
| **20** | Lỗi xác định. `audit.service.ts` nuốt lỗi, mutation commit trước audit. | Thêm strict transactional writer nhận tx; repository mutation + audit dùng cùng tx, lỗi phải throw; áp dụng users/tours/reviews/reports/settings thuộc phạm vi; notification ngoài tx qua outbox/retry nếu cần độ tin cậy. | Ép insert AuditLog fail: domain và audit rollback; no-op/refused không log; double decision không tạo hai audit. |
| **21** | Có filter/index cơ bản. `moderation.validation.ts`, `reports.repository.ts`, schema Report. | Bổ sung q/from/to/sort hợp lệ; thống nhất totalReportsCount là count theo (targetType,targetId), nêu rõ gồm status nào; aggregate và sort trước pagination; index theo query thực tế, không N+1. | Count/sort đúng qua nhiều trang; bộ lọc kết hợp; EXPLAIN ANALYZE trên dữ liệu đại diện + đo p95 mục tiêu <200ms, không tuyên bố đạt chỉ vì thêm index. |
| **22** | Lỗi xác định. `SupportService.setStatus()` bỏ actor. | Claim endpoint CAS gán assignedToId, chỉ assignee được resolve theo quy tắc chốt; resolutionNote trim bắt buộc; gom setStatus và reply(resolve=true) về cùng transition domain. | Unclaimed/no-note bị chặn; staff khác không chiếm vé; hai claim chỉ một thắng; reply+resolve không bypass. |
| **23** | Lỗi xác định. `ModerationDashboardPage.tsx` fallback 0. | Tách loading/error/data của complaint query; cảnh báo + retry riêng tile và link; khi có dữ liệu cũ thì ghi stale rõ; refresh tổng refetch cả hai query. | Mock complaint 500/network fail, các tile khác còn dùng được; lỗi không hiện 0; retry thành công hiện số thật. |
| **24** | Có phần lộ internals: `toPrivateUserDto()` trả extras. | Tách Profile DTO, Session/Access DTO, AdminUser DTO; bỏ raw grants/revokes khỏi profile thường; giữ effective permissions ở contract session/access mà UI cần; cập nhật boot/refresh và mobile parse. | GET me Traveler không raw grants/revokes/token fields; đăng nhập, reload, route guard/menu vẫn hoạt động; admin xem/cấu hình grants qua DTO riêng. |
| **25** | Thiếu trend SLA; đã có dashboard CSAT. | Dựa deadline/history của 08, aggregate workload và outcomes theo ngày 7/30 ngày; định nghĩa near-overdue threshold, timezone Asia/Ho_Chi_Minh và cohort; permission filter, isolated error states; biểu đồ UI. | Boundary on-time/near/breached đúng; không đếm lại một case nhiều lần; dữ liệu chưa có deadline không bị mặc định on-time; chart fail không làm mất dashboard. |
| **26** | Có audit list bảo vệ; thiếu export. `audit.routes.ts`. | Thêm export audit + moderation đúng phạm vi ticket, requireSuperAdmin và permission; keyset page/stream có backpressure, cutoff thời gian cố định; allowlist columns, UTF-8 BOM, CSV quote/formula escaping; audit việc export. | Guest 401/staff 403; tiếng Việt/quote/newline/formula an toàn; export lớn không load hết RAM; cancel client dừng query; export có bộ lọc ổn định. |
| **27** | Có timestamp/manual refresh, thiếu lịch 1h ở dashboard hook. | Thêm pollingInterval 3_600_000 và refetchOnFocus phù hợp cho cả query dashboard/complaint; tận dụng setupListeners; hiển thị last success riêng khi query lỗi; giữ nguyên filter args. | Fake timer qua 60 phút refetch; focus tải lại theo quy tắc; filter và selected range không reset; không tạo timer trùng mỗi render. |
| **28** | Có một phần. Support reply resolve email=true, setStatus thiếu email; SupportTicket chưa code. | Thêm supportCode unique dễ đọc, generator retry collision và backfill; dùng flow resolve thống nhất 22 để gửi email kèm code/note; notification outbox hoặc retry có idempotency, không email trước commit. | Resolve từ mọi đường gửi email đúng người + code; retry không gửi trùng; email lỗi không mất kết quả và có retry; phân biệt code ComplaintTicket đã tồn tại. |

## 5. Thứ tự triển khai đề xuất

### Đợt 1 — Chặn lỗi truy cập và sửa nhanh contract đang hỏng

1. **16** trước: khóa email-only, bao gồm lỗ vòng qua application-status và chỉnh onboarding client cùng lúc.
2. **01 + 02**: guard/reason + session generation/revocation; nối audit strict cho mutation mới, không tạm giữ đường unban thiếu audit.
3. **13 + 17 + 18**: verify trước cấp quyền, khóa legal edits, clear website/avatar.
4. **23**: lỗi complaint widget độc lập, ít phụ thuộc backend.

Mỗi thay đổi có regression test ngay trong commit; 15 không bị dồn đến cuối.

### Đợt 2 — Nền tảng audit và quản trị staff

1. **19 + 20**: transactional audit writer và metadata chuẩn; lần lượt chuyển các mutation liên quan, tránh thay toàn bộ audit API một lần.
2. **05**: serialization bảo vệ last admin, kiểm chứng bằng PostgreSQL thực.
3. **03 + 11 + 24**: model quyền hiệu lực, DTO session/profile, menu/dashboard và cache cùng contract.
4. **04 + 12**: invitation/activation/disable rồi mới thay thao tác ban staff bằng disable trên UI. Có thể thêm ban guard sớm nhưng phải cung cấp đường disable khi hoàn tất nhóm này.
5. **15**: hoàn thiện coverage staff/unban/concurrency và sửa các test cũ toàn bộ.

### Đợt 3 — Policy và workflow Agency

1. **07 + 14**: append-only policy và expected revision trong một thiết kế thống nhất.
2. **06**: snapshot effective cancellation policy khi booking.
3. **08**: SLA deadline/version và policy acceptance.
4. **09 + 10**: request info + resubmit + timestamp FIFO trên cùng state machine.

Snapshot 06 có thể làm sớm hơn 07 nếu cần vá lỗi tiền gấp: snapshot nội dung hiện tại trước, bổ sung versionId sau; tuyệt đối không đợi versioning để tiếp tục áp hồi tố.

### Đợt 4 — Hỗ trợ và vận hành

1. **22 + 28**: claim/resolve/note/code/email chung một flow.
2. **21**: query filter/report count và đo hiệu năng.
3. **25** sau 08: dashboard SLA dựa dữ liệu có thật.
4. **26 + 27**: export an toàn, refresh định kỳ và freshness.

## 6. Thiết kế chung để tránh sửa chồng

- **Mutation quan trọng:** authenticate → authorize → validate → transaction đọc trạng thái/CAS + domain update + audit strict (+ outbox nếu dùng) → commit → xử lý delivery. Không gửi email trong transaction đang khóa DB.
- **Quyền:** server là nơi quyết định. Frontend dùng effective permissions để render; cache server không được trả dữ liệu cấp cao cho user quyền thấp. Khi đổi quyền, cập nhật session/access state và reset/invalidate cache frontend liên quan.
- **Token:** xác định chính sách token cũ không có claim tokenVersion khi rollout; đề xuất buộc đăng nhập lại, không âm thầm mặc định 0 khiến token cũ tiếp tục dùng được. Rà lại socket đang kết nối để disable/ban không chỉ chặn handshake mới.
- **Policy:** tách revision chỉnh sửa khỏi version đang có hiệu lực nếu hỗ trợ lịch tương lai. Booking snapshot là immutable; idempotent retry trả booking cũ phải giữ nguyên snapshot.
- **Agency:** mọi đường register → verify OTP → submit → request info/reject → resubmit phải dùng chung quy tắc ownership, status và submittedAt. Không để auth onboarding và users profile thành hai state machine lệch nhau.
- **Audit:** dùng allowlist giá trị cần chứng minh, không snapshot nguyên UserRecord có passwordHash hoặc preferences ngân hàng. Notification lỗi không được làm API báo thất bại sau khi domain đã commit mà không có cách retry/idempotency.
- **Support:** giữ assignedToId hiện có. Không thêm assignedToStaffId song song. Mã support không phải credential cho phép guest đọc ticket tùy ý.

## 7. Migration và dữ liệu cũ

Chia migration theo nhóm tính năng để từng đợt có thể review/deploy độc lập:

1. Auth/staff: tokenVersion default 0, revokedPermissions default [], staff lifecycle và invitation hash/expiry/consumedAt. Staff hiện có ACTIVE; không buộc họ qua invitation mới.
2. Policy: PolicyVersion + unique(key, versionNumber), setting revision, booking snapshot/version reference. Baseline cho default policy cũng cần identity ổn định.
3. Agency: enum INFORMATION_REQUESTED, submittedAt/index. Hồ sơ cũ thiếu ngày nộp phải đánh dấu ước lượng, không gọi verifiedAt là ngày nộp chính xác.
4. SLA/acceptance: deadline/duration/version và acceptance record; case cũ được đánh dấu legacy hoặc backfill có provenance.
5. Support: supportCode unique, resolutionNote/resolvedAt nếu cần; backfill code theo lô và kiểm tra unique trước khi NOT NULL.

Booking cũ không có lịch sử policy: không thể khôi phục chính xác policy lúc đặt chỉ từ setting hiện tại. Cần quyết định quy tắc legacy minh bạch và ghi provenance; không lấy policy mới gán ngược rồi gọi đó là snapshot lịch sử.

## 8. Test và điều kiện hoàn thành

### Hạ tầng có sẵn và chỗ cần sửa

- `backend/vitest.config.mts`: unit lấy `src/**/*.test.ts`, integration lấy `src/**/*.integration.test.ts`. File ticket đề xuất ở `backend/tests/integration/admin-staff.test.ts` **không được discover theo cấu hình hiện tại**.
- `backend/src/test/global-setup.ts`: tạo PostgreSQL test cục bộ, apply migration từ `prisma/migrations`; không trỏ test vào production DB.
- `backend/src/modules/users/__tests__/admin.integration.test.ts`: đã có test hai admin demote nhau, cần thêm đồng bộ/barrier và kiểm tra invariant trong transaction.
- `backend/src/modules/moderation/__tests__/moderation.integration.test.ts`: sửa ba kỳ vọng cũ: mọi route đều cho Moderator qua guard; Moderator unban không reason; Super Admin ban Moderator thành công.
- `backend/src/modules/audit/__tests__/audit.coverage.integration.test.ts`: giữ coverage đúng một entry, thêm before/after và failure injection rollback.
- Frontend: mở rộng test moderation/admin/agency cho menu bị ẩn, 409 giữ draft, loading/error/stale và timer refresh. Kiểm tra mobile model khi profile DTO đổi; không bắt buộc xây staff UI trong mobile nếu app không có.

### Lệnh dự kiến khi triển khai

```powershell
pnpm --filter backend typecheck
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter frontend test
pnpm --filter frontend exec tsc --noEmit
```

Có thể chạy hẹp trước, ví dụ sau khi tạo file đúng convention:

```powershell
pnpm --filter backend test:integration admin-staff
```

### Checklist bàn giao mỗi nhóm

- Có bằng chứng tái hiện trước sửa và test pass sau sửa; không chỉ test happy path.
- API contract, constants/types, backend, frontend và fixtures được cập nhật đồng bộ.
- Migration có backfill/legacy strategy; không bịa lịch sử policy/acceptance.
- Audit có lý do/diff phù hợp, nguyên tử với mutation quan trọng; denied/no-op không tạo audit thành công.
- Tests quyền kiểm tra payload và cache, không chỉ trạng thái nút.
- Concurrency dùng database thực; mục tiêu query <200ms có dataset, phép đo và môi trường rõ ràng.

## 9. Các lựa chọn nghiệp vụ đã đề xuất để bắt đầu triển khai

1. Unban chỉ Super Admin, theo AC của KIEU-01; chưa mở quyền unban ủy quyền cho Moderator.
2. Legal edit Agency VERIFIED: chặn trực tiếp trong bản sửa đầu tiên; flow yêu cầu đổi legal/re-verification là phần mở rộng nếu cần.
3. Resubmit Agency đặt submittedAt mới; nếu muốn giữ ưu tiên cũ, thêm firstSubmittedAt riêng thay vì dùng một trường với hai nghĩa.
4. Support resolve chỉ assignee; nếu Super Admin cần override thì thành action riêng có lý do/audit.
5. SLA lần xử lý sau escalation bắt đầu tại escalatedAt, lưu duration/version riêng; policy đổi không đẩy deadline case đã mở.
6. Chưa ước lượng ngày công cố định: 28 ticket gồm cả feature/schema/UI/concurrency, nên tách theo các đợt trên và ước lượng lại sau khi chốt contract policy/staff/SLA. Các lựa chọn này là đề xuất trong plan, chưa phải hành vi đã triển khai.
