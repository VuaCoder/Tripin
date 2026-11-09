# Đối chiếu 51 task Kiều và Khiêm với code đã commit

Ngày kiểm tra: 09/11/2026 (Asia/Saigon). Nhánh `kieu_fixtaskbug`, HEAD `d66379a6582f6deca1d6db36131136aecfc4b945`.
Nguồn yêu cầu: `C:/Users/ASUS/Downloads/BUG_FIX_ASSIGNMENT_AND_COMMIT_PLAN.md`.
Working tree ban đầu sạch. Không sửa chức năng, database ứng dụng hay deploy trong lượt audit này.

## Cách đọc kết quả

- “Có code và regression phù hợp AC” nghĩa là đã đối chiếu đường thực thi và test tương ứng; không đồng nghĩa staging/production hay thiết bị thật đã được nghiệm thu.
- “Một phần” chỉ ra phần triển khai sai/thiếu so với yêu cầu. Tách AC hẹp khỏi công việc rộng hơn để không tự ý đổi tiêu chuẩn.
- “Chưa xác minh” không có nghĩa chắc chắn code lỗi, nhưng chưa đủ bằng chứng để báo hoàn thành.
- Tên/mã commit không phải bằng chứng đủ; báo cáo cũ chỉ là nguồn tìm kiếm, không thay thế lần đọc code và chạy test này.

## Phát hiện cần xử lý trước

1. **P1 — KHIEM-11:** mobile trả thu nhập giả khi API lỗi hoặc dữ liệu rỗng. `_mockSummary` tổng 18.500.000, bảy khoản giả. API 401/403 cũng đi qua catch `DioException` và thành số liệu giả. Đây là code cũ từ `0d92d96` bị bỏ sót khi sửa task, không phải thay đổi mới của `bcce41a`.
2. **P1 — KHIEM-11:** booking COMPLETED đã commit trước notification/event. Nếu notification lỗi thì event có thể chưa phát; listener ghi earning lỗi chỉ log và không replay. Sweep completion chỉ tìm CONFIRMED nên completed thiếu earning không được tự chạy bù. Ledger transaction chỉ bảo đảm earning/ledger cùng nhau, chưa bảo đảm chúng tồn tại cho mọi completed booking.
3. **P2 — KHIEM-18:** web có preview/2FA nhưng mobile thiếu; public guide page chưa có danh sách tour phụ trách tiêu chuẩn như phần công việc yêu cầu.
4. **P2 — KHIEM-06:** scan lưu usedAt/checkedIn và giữ status VALID, khác AC USED/CHECKED_IN. Không tự đổi sang USED vì trong code USED nghĩa là tour hoàn tất; cần đồng bộ contract/check-in state rõ ràng và kiểm thử camera/rung/âm thanh.
5. **P2 — KHIEM-07:** cache không đủ chứng minh mở URL web từ cold start khi offline; màn list mobile mới chưa có kiểm thử offline UI đầy đủ. QR hiện encode mã vé cố định.
6. **P2 — KIEU-08 / trang policies:** defaults và migration đều content rỗng; trang không có nội dung để đọc/chấp thuận. Reload mất nhãn đã đồng ý vì state chỉ ở React, không đọc consent từ server. Đây không phải AC SLA thất bại, nhưng là thiếu sót sản phẩm/luồng consent không được bỏ qua.
7. **P2 — khoảng trống kiểm thử:** email thật KIEU-04/28/KHIEM-16, Cloudinary/gallery KHIEM-03, IndexedDB File review, idle 60 phút KIEU-27 và Anthropic max_tokens trực tiếp chưa đủ bằng chứng.
8. **Code giả còn trong guide API:** `answerAssignment` bỏ qua HTTP với id bắt đầu `tour-`; `fetchTourDetail` trả mô tả trekking giả và group size 15 khi Dio lỗi. Mock có từ `0d92d96`, vẫn còn ở HEAD sau các commit fix.
9. **Integration fail tái hiện được ngoài 51 AC:** Agency dashboard tổng `last6Months.net` nhận 2.250.000, mong đợi 3.150.000; chạy riêng vẫn fail. Xem `backend/src/modules/dashboards/__tests__/dashboards.integration.test.ts:99`, `bookings.repository.ts:258`, `bookings.service.ts:530`. Nghi vấn ngày bị lệch giữa SQL `AT TIME ZONE`/to_char và lọc ngày UTC trong service, đúng lúc Việt Nam đã sang ngày 09 nhưng UTC còn ngày 08; chưa chạy chẩn đoán timezone DB riêng nên đây là giả thuyết nguyên nhân, không phải kết luận đã sửa.

## Kiểm chứng chạy lại

| Bộ kiểm tra chạy lại | Kết quả quan sát |
|---|---|
| Backend unit | 55 suite, **739 pass** |
| Frontend toàn bộ | 90 suite, **600 pass** |
| Backend integration toàn bộ | 45 suite, **274 pass, 1 fail** |
| Integration dashboard chạy lại riêng | **3 pass, 1 fail**, cùng lỗi 2.250.000/3.150.000 |
| Mobile tập trung profile/guide/earnings/chat/AI/support/bookings/review | **118 pass** |
| Report benchmark | 10.000 rows, 100 targets, 10 mẫu sau 2 warmup, **p95 42,02ms local** |

Integration dùng PostgreSQL tạm riêng và migrations từ repo, không database ứng dụng. Mail/AI/cloud upload trong test dùng capture/mock. Frontend có cảnh báo jsdom navigation chưa hỗ trợ; integration có cảnh báo pg client.query concurrent; các cảnh báo không bị che thành kết luận production sạch. Lệnh integration wrapper trả exit code 0 dù Vitest in 1 failed; báo cáo lấy kết quả test thực tế, không lấy exit code làm bằng chứng pass.

Lệnh từ repo root (PowerShell, dùng pnpm.cmd để tránh execution policy của pnpm.ps1):

```powershell
pnpm.cmd --filter backend test:unit
pnpm.cmd --filter frontend test
pnpm.cmd --filter backend test:integration --maxWorkers=2
pnpm.cmd --filter backend test:integration dashboards.integration.test.ts --maxWorkers=1
```

Mobile dùng SDK riêng có sẵn Flutter 3.47.9/Dart 3.13.7, từ thư mục mobile:

```powershell
& ../.tmp-sdk/flutter-3.47.9/flutter/bin/flutter.bat test --no-pub --concurrency=1 test/features/profile test/features/guide test/features/earnings test/features/chat test/features/ai test/features/support test/features/bookings test/features/tours/tour_review_bloc_test.dart test/features/tours/tour_review_model_test.dart test/features/tours/tour_review_draft_test.dart
```

Flutter lần đầu bị sandbox chặn ghi telemetry trong Windows user profile; lượt chạy lại ngoài sandbox đã hoàn tất 118 tests. Không chạy lại toàn bộ mobile suite, build production, browser/device smoke hoặc provider thật. `git diff --check` sạch ở đầu audit; cuối audit chỉ thêm tài liệu này.

## Bảng tra nhanh

| Task | Kết luận | Commit triển khai liên quan |
|---|---|---|
| [KIEU-01](#kieu-01) | Có code và regression phù hợp AC | 9a9b2c9 c036283 |
| [KIEU-02](#kieu-02) | Có code và regression phù hợp AC | 9a9b2c9 |
| [KIEU-03](#kieu-03) | Có code và regression phù hợp AC | 9a9b2c9 27353f2 |
| [KIEU-04](#kieu-04) | Chưa xác minh đủ AC email thật | 9a9b2c9 27353f2 |
| [KIEU-05](#kieu-05) | Có code và regression phù hợp AC | 9a9b2c9 |
| [KIEU-06](#kieu-06) | Có code và regression phù hợp AC | 4165ca6 |
| [KIEU-07](#kieu-07) | Có code và regression phù hợp AC | 4165ca6 27353f2 |
| [KIEU-08](#kieu-08) | Có code và regression phù hợp AC SLA | 4165ca6 27353f2 |
| [KIEU-09](#kieu-09) | Có code và regression phù hợp AC | 650df4c 9a9b2c9 c036283 27353f2 |
| [KIEU-10](#kieu-10) | Có code và regression phù hợp AC | 650df4c 9a9b2c9 |
| [KIEU-11](#kieu-11) | Có code và regression phù hợp AC | c036283 27353f2 |
| [KIEU-12](#kieu-12) | Có code và regression phù hợp AC | 9a9b2c9 |
| [KIEU-13](#kieu-13) | Có code và regression phù hợp AC | 9a9b2c9 |
| [KIEU-14](#kieu-14) | Có code và regression phù hợp AC | 4165ca6 27353f2 |
| [KIEU-15](#kieu-15) | Có suite đúng mục tiêu; dùng lệnh workspace thực tế | 6901ab8 |
| [KIEU-16](#kieu-16) | Có code và regression phù hợp AC | 9a9b2c9 |
| [KIEU-17](#kieu-17) | Có code và regression phù hợp AC | 9a9b2c9 |
| [KIEU-18](#kieu-18) | Có code và regression phù hợp AC | 9a9b2c9 |
| [KIEU-19](#kieu-19) | Có code và regression phù hợp AC | 0a2df4a c036283 27353f2 |
| [KIEU-20](#kieu-20) | Có code và regression phù hợp AC | 0a2df4a c036283 |
| [KIEU-21](#kieu-21) | Có code; hiệu năng chỉ được kiểm chứng local | c036283 6901ab8 |
| [KIEU-22](#kieu-22) | Có code và regression phù hợp AC | c036283 27353f2 |
| [KIEU-23](#kieu-23) | Có code và regression phù hợp AC chính | 27353f2 |
| [KIEU-24](#kieu-24) | Đạt phần raw internals; cần làm rõ phạm vi permissions | 9a9b2c9 |
| [KIEU-25](#kieu-25) | Có code và regression phù hợp AC | 4165ca6 27353f2 |
| [KIEU-26](#kieu-26) | Có code và regression phù hợp AC | 0a2df4a 27353f2 |
| [KIEU-27](#kieu-27) | Có code; thiếu mô phỏng đủ 60 phút | 27353f2 |
| [KIEU-28](#kieu-28) | Chưa xác minh đủ AC email thật | 650df4c 0a2df4a c036283 |
| [KHIEM-01](#khiem-01) | Có code và regression phù hợp AC; cần cấu hình môi trường | 57fd720 db6e95d |
| [KHIEM-02](#khiem-02) | Có code và regression phù hợp AC | a554f2f |
| [KHIEM-03](#khiem-03) | Chưa xác minh đủ AC thiết bị/upload thật | db6e95d |
| [KHIEM-04](#khiem-04) | Có code và regression phù hợp AC | a554f2f db6e95d |
| [KHIEM-05](#khiem-05) | Có code và regression phù hợp AC bộ lọc | f8ff819 |
| [KHIEM-06](#khiem-06) | Một phần; contract trạng thái lệch và thiết bị chưa xác minh | a554f2f f8ff819 |
| [KHIEM-07](#khiem-07) | Có code; offline từ cold start chưa xác minh | 1d5e146 |
| [KHIEM-08](#khiem-08) | Có code và regression phù hợp AC | a554f2f |
| [KHIEM-09](#khiem-09) | Có code và regression phù hợp AC | a554f2f 02c95b7 |
| [KHIEM-10](#khiem-10) | Có code và regression phù hợp AC | 57fd720 a554f2f |
| [KHIEM-11](#khiem-11) | Một phần; không đạt để nghiệm thu màn thu nhập | 57fd720 bcce41a |
| [KHIEM-12](#khiem-12) | Có code và regression phù hợp AC | 02c95b7 |
| [KHIEM-13](#khiem-13) | Có code và regression phù hợp AC | 02c95b7 |
| [KHIEM-14](#khiem-14) | Có code và regression phù hợp AC | 02c95b7 |
| [KHIEM-15](#khiem-15) | Có code và regression phù hợp AC | 02c95b7 |
| [KHIEM-16](#khiem-16) | Có code và regression phù hợp AC in-app; email thật chưa xác minh | 02c95b7 |
| [KHIEM-17](#khiem-17) | Có code và regression phù hợp AC | 02c95b7 |
| [KHIEM-18](#khiem-18) | Một phần so với phạm vi task; AC web có code | db6e95d |
| [KHIEM-19](#khiem-19) | Có code và regression phù hợp AC | 1d5e146 |
| [KHIEM-20](#khiem-20) | AC text/rating có code; scope ảnh chưa xác minh đủ | b678c5e |
| [KHIEM-21](#khiem-21) | Có code và regression phù hợp AC | 8ab8cc8 |
| [KHIEM-22](#khiem-22) | Có code và regression phù hợp AC | cd33158 |
| [KHIEM-23](#khiem-23) | Có code phù hợp AC; thiếu regression Anthropic max_tokens trực tiếp | cd33158 |

## Đối chiếu từng task

<a id="kieu-01"></a>

### KIEU-01 — Chặn quyền Unban của Moderator thông thường và bắt buộc nhập lý do (ADMIN-002, MOD-001)

**Công việc gốc**

- Tại `backend/src/modules/moderation/moderation.controller.ts`, gắn guard `requireSuperAdmin` hoặc kiểm tra quyền chuyên biệt `account:unban`.
  - Validate payload yêu cầu trường `reason` bắt buộc (tối thiểu 10 ký tự, không được để trống).
  - Ghi nhận `reason` vào bảng Audit Log và gửi thông báo giải thích cho người dùng.

**Acceptance criteria gốc**

1. Moderator thông thường gọi POST `/api/v1/moderation/users/:id/unban` nhận mã lỗi `403 Forbidden`.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.
2. Super Admin gọi unban không truyền `reason` nhận mã lỗi `400 Bad Request`.
   - **Đánh giá AC 2:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.
3. Unban thành công với lý do hợp lệ: Tài khoản chuyển sang `ACTIVE` và bản ghi audit log được lưu đầy đủ.
   - **Đánh giá AC 3:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Guard Super Admin, reason >=10, ACTIVE, audit before/after/reason và revoke trong transaction. admin-staff.integration kiểm tra 403/400/200 và audit. Thông báo unban dùng mail outbox; chưa xác minh hộp thư thật.

**Bằng chứng source:** [backend/src/modules/users/users.service.ts:404](../backend/src/modules/users/users.service.ts#L404), [backend/src/modules/users/users.repository.ts:82](../backend/src/modules/users/users.repository.ts#L82), [backend/src/modules/moderation/moderation.validation.ts:54](../backend/src/modules/moderation/moderation.validation.ts#L54).

**Commit liên quan:** 9a9b2c9 c036283.

<a id="kieu-02"></a>

### KIEU-02 — Thu hồi phiên làm việc và kiểm tra token generation khi unban (ADMIN-003)

**Công việc gốc**

- Cập nhật trường `tokenGeneration` hoặc `tokenVersion` trên model `User` khi tài khoản bị ban hoặc unban.
  - Cập nhật `backend/src/common/guards/auth.guard.ts` để kiểm tra `tokenVersion` trong JWT payload có khớp với DB hay không.
  - Thu hồi toàn bộ Refresh Token family của tài khoản khi unban.

**Acceptance criteria gốc**

1. Token cũ trước thời điểm ban khi gửi kèm header `Authorization: Bearer <old-token>` bị từ chối với mã lỗi `401 Unauthorized`.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.
2. Bắt buộc người dùng phải đăng nhập lại để nhận token mới.
   - **Đánh giá AC 2:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Ban/unban tăng tokenVersion và revoke mọi refresh family. Middleware đọc user hiện tại và từ chối token cũ 401. Test admin-staff kiểm tra token cũ sau unban và refresh đã revoke.

**Bằng chứng source:** [backend/src/middlewares/authenticate.ts:18](../backend/src/middlewares/authenticate.ts#L18), [backend/src/modules/users/users.repository.ts:90](../backend/src/modules/users/users.repository.ts#L90).

**Commit liên quan:** 9a9b2c9.

<a id="kieu-03"></a>

### KIEU-03 — Hỗ trợ cấu hình phân quyền chi tiết (Granular Grants) cho nhân viên (ADMIN-005)

**Công việc gốc**

- Mở rộng model phân quyền nhân viên để lưu danh sách quyền ghi đè (`grantedPermissions`, `revokedPermissions`).
  - Cập nhật `backend/src/common/guards/permissions.guard.ts` để ưu tiên effective grants thay vì chỉ kiểm tra role mặc định.

**Acceptance criteria gốc**

1. Khi gán Moderator chỉ có quyền `tour:validate`, Moderator truy cập endpoint tranh chấp nhận `403 Forbidden`.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.
2. Dashboard và UI ẩn các menu chức năng không thuộc effective permissions.
   - **Đánh giá AC 2:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Có extraPermissions + revokedPermissions và effective permission; có form cấp/thu hồi và menu gắn permission. Không phải mô hình chỉ set grantedPermissions là tự xóa hết role defaults: phải thu hồi rõ các quyền mặc định không muốn giữ. Integration kiểm tra revoked dispute/complaint và dashboard không lộ queue; cần smoke cấu hình chỉ duyệt tour từ UI.

**Bằng chứng source:** [backend/src/modules/users/users.mapper.ts:7](../backend/src/modules/users/users.mapper.ts#L7), [frontend/features/admin/components/AdminUsersPage.tsx:17](../frontend/features/admin/components/AdminUsersPage.tsx#L17), [frontend/components/layout/navigation-config.ts:61](../frontend/components/layout/navigation-config.ts#L61).

**Commit liên quan:** 9a9b2c9 27353f2.

<a id="kieu-04"></a>

### KIEU-04 — Xây dựng vòng đời tạo, kích hoạt và vô hiệu hóa tài khoản Moderator (ADMIN-006)

**Công việc gốc**

- Tạo endpoint POST `/api/v1/admin/staff/invite` gửi email chứa token kích hoạt an toàn (hết hạn sau 24h).
  - Tạo trang/endpoint kích hoạt để nhân viên thiết lập mật khẩu lần đầu.
  - Hỗ trợ trạng thái nhân viên: `INVITED`, `ACTIVE`, `DISABLED`.

**Acceptance criteria gốc**

1. Email gửi thư mời kích hoạt thành công kèm URL token một lần.
   - **Đánh giá AC 1:** Chưa xác minh giao email thật; test capture/outbox có.
2. Nhân viên ở trạng thái `DISABLED` bị thu hồi toàn bộ session và không thể đăng nhập.
   - **Đánh giá AC 2:** Có triển khai và regression disable/revoke/login.

**Đối chiếu:** Chưa xác minh đủ AC email thật.

Có invite token random/hash, hết hạn 24h, activate một lần, reinvite và disable/revoke/login guard. Test dùng mail capture/outbox, không chứng minh provider giao email thành công hoặc link tới được trên môi trường chạy thật.

**Bằng chứng source:** [backend/src/modules/users/staff.routes.ts:1](../backend/src/modules/users/staff.routes.ts#L1), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:89](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L89).

**Commit liên quan:** 9a9b2c9 27353f2.

<a id="kieu-05"></a>

### KIEU-05 — Khóa Database Transaction bảo vệ tài khoản Super Admin cuối cùng (ADMIN-007)

**Công việc gốc**

- Dùng transaction cấp `SERIALIZABLE` hoặc câu lệnh `SELECT COUNT(*) ... FOR UPDATE` trong Prisma raw query khi cập nhật role Super Admin.
  - Ném lỗi `Cannot demote the last active Super Admin` ngay trong transaction trước khi commit.

**Acceptance criteria gốc**

1. Chạy đồng thời 2 request hạ cấp khi chỉ còn 1 Super Admin hoạt động: 1 request bị từ chối và hệ thống luôn đảm bảo còn ít nhất 1 Super Admin.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Dùng advisory transaction lock chung 54821 trước đọc/count/update, kiểm tra lại actor và last admin trong transaction. Khác ví dụ SERIALIZABLE nhưng giải quyết cùng race trong các writer tuân thủ lock. Test hai admin hạ quyền chéo giữ lại đúng một admin hoạt động.

**Bằng chứng source:** [backend/src/modules/users/users.repository.ts:62](../backend/src/modules/users/users.repository.ts#L62), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:78](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L78).

**Commit liên quan:** 9a9b2c9.

<a id="kieu-06"></a>

### KIEU-06 — Snapshot phiên bản chính sách hủy tour tại thời điểm Booking (ADMIN-008)

**Công việc gốc**

- Thêm trường `cancellationPolicySnapshot` (JSON) vào bảng `Booking`.
  - Khi tạo booking, lưu nguyên vẹn chính sách hủy đang có hiệu lực.
  - Hàm hủy tour kiểm tra điều kiện hoàn tiền dựa trên snapshot này thay vì query chính sách mới nhất.

**Acceptance criteria gốc**

1. Booking tạo lúc chính sách 24h vẫn được phép hủy trước 30h mặc dù chính sách hệ thống vừa được nâng lên 48h.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Booking lưu cancellationPolicySnapshot; hủy đọc snapshot, không lấy setting mới. Integration dựng departure khoảng 30h, đổi 24 thành 48 rồi vẫn hủy được. Booking lịch sử thiếu snapshot dùng fallback 24h, không phục hồi được lịch sử thật.

**Bằng chứng source:** [backend/src/modules/bookings/bookings.service.ts:208](../backend/src/modules/bookings/bookings.service.ts#L208), [backend/src/modules/bookings/bookings.service.ts:281](../backend/src/modules/bookings/bookings.service.ts#L281), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:166](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L166).

**Commit liên quan:** 4165ca6.

<a id="kieu-07"></a>

### KIEU-07 — Quản lý phiên bản chính sách hệ thống dạng Append-only và Rollback (ADMIN-009)

**Công việc gốc**

- Xây dựng model `PolicyVersion` với `versionNumber`, `effectiveFrom`, `reason`, `changesJson`.
  - Hỗ trợ thao tác rollback tạo ra một version mới thay vì sửa đổi bản ghi cũ.

**Acceptance criteria gốc**

1. Mỗi lần chỉnh sửa chính sách sinh ra 1 version mới.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.
2. Có thể tra cứu lịch sử thay đổi chính sách qua API và giao diện Admin.
   - **Đánh giá AC 2:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Mỗi save tạo PolicyVersion; trigger append-only; history API/UI; rollback gọi setPolicy tạo version mới. Trường JSON tên value thay vì changesJson. Test version/stale-save/rollback và lịch hiệu lực. Nội dung mặc định rỗng là thiếu dữ liệu công khai, không phải bằng chứng versioning chưa được viết.

**Bằng chứng source:** [backend/src/modules/system-settings/system-settings.repository.ts:10](../backend/src/modules/system-settings/system-settings.repository.ts#L10), [backend/src/modules/system-settings/policy-history.routes.ts:14](../backend/src/modules/system-settings/policy-history.routes.ts#L14), [frontend/features/admin/components/PolicyHistory.tsx:1](../frontend/features/admin/components/PolicyHistory.tsx#L1).

**Commit liên quan:** 4165ca6 27353f2.

<a id="kieu-08"></a>

### KIEU-08 — Đồng bộ cấu hình SLA kiểm duyệt và chấp thuận điều khoản (ADMIN-010)

**Công việc gốc**

- Đọc cấu hình `moderation_sla_hours` từ bảng settings để tính toán `deadlineAt` khi khiếu nại được tạo hoặc leo thang.
  - Lưu version chính sách mà Agency/Traveler đã ấn đồng ý.

**Acceptance criteria gốc**

1. Khiếu nại tạo mới có trường `slaDeadlineAt` được tính chính xác theo cấu hình hệ thống hiện tại.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC SLA.

Có snapshot deadline từ settings cho tạo/escalate; regression admin-staff dùng 12h/4h rồi đổi cấu hình. Acceptance lưu user/version bằng upsert khi chủ động đồng ý. Phạm vi ngoài AC SLA: trang công khai hiện nội dung rỗng, không có nút đồng ý khi chưa có nội dung; state đã đồng ý chỉ nằm trong React, reload không đọc lại acceptance từ server. Không được mô tả consent UI đã hoàn thiện.

**Bằng chứng source:** [backend/src/modules/complaints/complaints.repository.ts:1](../backend/src/modules/complaints/complaints.repository.ts#L1), [backend/src/modules/system-settings/policy-history.routes.ts:28](../backend/src/modules/system-settings/policy-history.routes.ts#L28), [frontend/app/policies/page.tsx:7](../frontend/app/policies/page.tsx#L7).

**Commit liên quan:** 4165ca6 27353f2.

<a id="kieu-09"></a>

### KIEU-09 — Bổ sung trạng thái "Yêu cầu bổ sung thông tin" (Information Requested) cho Agency (ADMIN-011)

**Công việc gốc**

- Bổ sung trạng thái `INFORMATION_REQUESTED` vào `AgencyVerificationStatus`.
  - Cho phép Moderator nhập phản hồi yêu cầu tài liệu cụ thể.
  - Mở lại quyền nộp bổ sung hồ sơ cho Agency trên Portal.

**Acceptance criteria gốc**

1. Admin có nút "Yêu cầu bổ sung" kèm form nhập lý do.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.
2. Agency nhận thông báo, hồ sơ chuyển sang trạng thái cần bổ sung và cho phép cập nhật lại tài liệu.
   - **Đánh giá AC 2:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Có INFORMATION_REQUESTED, nút/form lý do, notification, scoped owner resubmit và hiển thị verificationNote. Test backend chuyển trạng thái rồi resubmit. Notification sau mutation là luồng riêng; chưa smoke email và trình duyệt Agency thật.

**Bằng chứng source:** [frontend/features/moderation/components/ModerationAgencyListPage.tsx:65](../frontend/features/moderation/components/ModerationAgencyListPage.tsx#L65), [backend/src/modules/moderation/moderation.service.ts:58](../backend/src/modules/moderation/moderation.service.ts#L58), [frontend/app/agency/application/edit/page.tsx:1](../frontend/app/agency/application/edit/page.tsx#L1).

**Commit liên quan:** 650df4c 9a9b2c9 c036283 27353f2.

<a id="kieu-10"></a>

### KIEU-10 — Sắp xếp hàng đợi xét duyệt Agency theo thứ tự nộp cũ nhất trước (ADMIN-012)

**Công việc gốc**

- Bổ sung trường `submittedAt` vào bảng hồ sơ Agency.
  - Sắp xếp hàng đợi theo `submittedAt ASC` (hồ sơ nộp trước duyệt trước - FIFO).

**Acceptance criteria gốc**

1. Danh sách hồ sơ chờ duyệt hiển thị theo thứ tự nộp tăng dần theo thời gian.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Có submittedAt, cập nhật lại khi nộp và FIFO theo submittedAt; test thứ tự hai agency. Dữ liệu cũ backfill ước lượng và UI gắn nhãn ước lượng.

**Bằng chứng source:** [backend/src/modules/users/users.repository.ts:1](../backend/src/modules/users/users.repository.ts#L1), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:140](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L140).

**Commit liên quan:** 650df4c 9a9b2c9.

<a id="kieu-11"></a>

### KIEU-11 — Lọc các Widget trên Admin Dashboard theo quyền thực tế của nhân viên (ADMIN-013)

**Công việc gốc**

- Phân tích quyền của token tại server và chỉ trả về dữ liệu của các widget được phép xem.
  - Ẩn component widget tương ứng ở phía frontend.

**Acceptance criteria gốc**

1. Moderator chỉ có quyền duyệt tour không thấy số liệu doanh thu hoặc số lượng tranh chấp tài chính.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Backend chỉ query/return queue theo quyền, cache key bao gồm quyền; UI filter cả widget và skip complaint query khi thiếu quyền. admin-staff và kieu-dashboard.test kiểm tra payload/ẩn tile. Admin dashboard riêng chỉ Super Admin.

**Bằng chứng source:** [backend/src/modules/dashboards/dashboards.service.ts:73](../backend/src/modules/dashboards/dashboards.service.ts#L73), [frontend/features/moderation/components/ModerationDashboardPage.tsx:23](../frontend/features/moderation/components/ModerationDashboardPage.tsx#L23).

**Commit liên quan:** c036283 27353f2.

<a id="kieu-12"></a>

### KIEU-12 — Chặn Super Admin ban tài khoản nhân viên (ADMIN-014)

**Công việc gốc**

- Kiểm tra `role` của target user trong API ban tài khoản; nếu là `MODERATOR` hoặc `ADMIN` thì ném lỗi `400 Bad Request`.
  - Điều hướng thao tác sang endpoint `/api/v1/admin/staff/:id/disable`.

**Acceptance criteria gốc**

1. Gọi ban một Moderator trả về lỗi yêu cầu dùng chức năng vô hiệu hóa nhân sự chuyên biệt.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

changeBan từ chối MODERATOR/SUPER_ADMIN và hướng dẫn staff disable. Integration gọi ban staff nhận 400, disable đúng endpoint.

**Bằng chứng source:** [backend/src/modules/users/users.repository.ts:86](../backend/src/modules/users/users.repository.ts#L86), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:67](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L67).

**Commit liên quan:** 9a9b2c9.

<a id="kieu-13"></a>

### KIEU-13 — Bắt buộc email đã xác thực trước khi cấp quyền Staff (ADMIN-015)

**Công việc gốc**

- Trong hàm gán role (`assignAccess`), kiểm tra `emailVerifiedAt != null`.
  - Trả về mã lỗi `400 Bad Request` kèm thông báo nếu email chưa xác thực.

**Acceptance criteria gốc**

1. Gán quyền nhân viên cho tài khoản chưa verify email bị chặn và thông báo rõ ràng.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Service và transaction repository chặn cấp role staff khi chưa verified email; regression 400 rồi verify và 200. Tên role thực tế SUPER_ADMIN, khác ADMIN trong mô tả.

**Bằng chứng source:** [backend/src/modules/users/users.repository.ts:70](../backend/src/modules/users/users.repository.ts#L70), [backend/src/modules/users/users.service.ts:368](../backend/src/modules/users/users.service.ts#L368).

**Commit liên quan:** 9a9b2c9.

<a id="kieu-14"></a>

### KIEU-14 — Bảo vệ form chỉnh sửa cấu hình hệ thống bằng Optimistic Lock (ADMIN-016)

**Công việc gốc**

- Gửi kèm `version` hoặc `updatedAt` khi lưu cài đặt.
  - Nếu `version` gửi lên khác với DB, trả về lỗi `409 Conflict`.

**Acceptance criteria gốc**

1. Người lưu sau nhận thông báo dữ liệu đã bị thay đổi bởi quản trị viên khác kèm tùy chọn nạp lại dữ liệu.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

expectedVersion bắt buộc ở HTTP; lock + version comparison trả SETTINGS_CONFLICT 409. UI giữ editor và có Nạp lại dữ liệu. Test stale policy/settings. Cần browser smoke hai cửa sổ; chưa coi cấu hình options trong test là chứng minh thao tác thật.

**Bằng chứng source:** [backend/src/modules/system-settings/system-settings.repository.ts:13](../backend/src/modules/system-settings/system-settings.repository.ts#L13), [frontend/features/admin/components/AdminPoliciesPage.tsx:29](../frontend/features/admin/components/AdminPoliciesPage.tsx#L29), [frontend/features/admin/components/AdminCommissionPage.tsx:1](../frontend/features/admin/components/AdminCommissionPage.tsx#L1).

**Commit liên quan:** 4165ca6 27353f2.

<a id="kieu-15"></a>

### KIEU-15 — Bổ sung Integration Test Suite cho quyền Staff và Unban Guards (ADMIN-017, ADMIN-018)

**Công việc gốc**

- Tạo file test `backend/tests/integration/admin-staff.test.ts`.
  - Viết test case: Moderator không thể unban, không thể unban thiếu lý do, không thể hạ quyền Super Admin cuối cùng.

**Acceptance criteria gốc**

1. Chạy `pnpm test admin-staff` pass 100% trên môi trường test database.
   - **Đánh giá AC 1:** Suite thật đã chạy và pass trong integration; lệnh gốc phải đổi sang lệnh workspace ghi bên dưới.

**Đối chiếu:** Có suite đúng mục tiêu; dùng lệnh workspace thực tế.

Suite nằm src/modules/users/__tests__, không phải backend/tests/integration. Lệnh đúng: pnpm.cmd --filter backend test:integration admin-staff. Root không có script test nên nguyên văn pnpm test admin-staff không đúng contract workspace. Có CI nhưng lượt này không xác minh GitHub CI remote; kết quả local bên dưới.

**Bằng chứng source:** [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:1](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L1), [.github/workflows/kieu-regressions.yml:1](../.github/workflows/kieu-regressions.yml#L1), [backend/vitest.config.mts:1](../backend/vitest.config.mts#L1).

**Commit liên quan:** 6901ab8.

<a id="kieu-16"></a>

### KIEU-16 — Bảo mật Endpoint đăng ký Agency, loại bỏ quyền ghi qua Email (AUTH-001)

**Công việc gốc**

- Xóa bỏ cơ chế ủy quyền chỉ qua email ở route `/auth/agency/application`.
  - Bắt buộc phải có scoped onboarding token hoặc session đăng nhập của chính Agency đó.

**Acceptance criteria gốc**

1. Khách gọi GET hoặc PUT `/auth/agency/application?email=...` không có token trả về `401 Unauthorized`.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Email-only GET/status/PUT bị 401; session dùng id owner hoặc onboarding token scope/version. Test cross-account không đọc hồ sơ nạn nhân.

**Bằng chứng source:** [backend/src/modules/auth/agency-approval.service.ts:1](../backend/src/modules/auth/agency-approval.service.ts#L1), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:26](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L26).

**Commit liên quan:** 9a9b2c9.

<a id="kieu-17"></a>

### KIEU-17 — Khóa chỉnh sửa thông tin pháp lý của Agency đã được Verified (AUTH-007)

**Công việc gốc**

- Tạo danh sách các trường nhạy cảm: `companyName`, `businessLicense`, `taxId`.
  - Nếu Agency đang ở trạng thái `VERIFIED` mà chỉnh sửa các trường này, tự động chuyển trạng thái về `PENDING_REVIEW` hoặc chặn cập nhật trực tiếp.

**Acceptance criteria gốc**

1. Sửa thông tin pháp lý yêu cầu nộp hồ sơ xét duyệt lại, không duy trì tick xanh trái phép.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

VERIFIED chặn thay đổi companyName/licenseNumber và các legal fields trong service, trả 409 yêu cầu reverify; HTTP schema strict không cho taxId/businessLicenseUrl sửa qua profile. Phương án chặn phù hợp công việc cho phép chặn hoặc chuyển pending. Chưa có đầy đủ UX nộp sửa pháp lý mới, không cần để chứng minh chặn bypass.

**Bằng chứng source:** [backend/src/modules/users/users.service.ts:104](../backend/src/modules/users/users.service.ts#L104), [backend/src/modules/users/users.validation.ts:30](../backend/src/modules/users/users.validation.ts#L30).

**Commit liên quan:** 9a9b2c9.

<a id="kieu-18"></a>

### KIEU-18 — Chuẩn hóa endpoint xóa Website và Avatar của Agency (AUTH-014)

**Công việc gốc**

- Cho phép truyền giá trị `null` hoặc chuỗi rỗng đối với trường `website` trong schema validation.
  - Cung cấp endpoint DELETE `/users/me/avatar` hỗ trợ role Agency.

**Acceptance criteria gốc**

1. Agency có thể xóa website hoặc xóa ảnh đại diện thành công mà không gặp lỗi server.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

website empty/null normalize null; DELETE avatar Agency được phép. Integration xác minh DB website/avatar sau request. Chưa test xóa asset Cloudinary thật.

**Bằng chứng source:** [backend/src/modules/users/users.validation.ts:35](../backend/src/modules/users/users.validation.ts#L35), [backend/src/modules/users/users.service.ts:152](../backend/src/modules/users/users.service.ts#L152), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:132](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L132).

**Commit liên quan:** 9a9b2c9.

<a id="kieu-19"></a>

### KIEU-19 — Bổ sung Diff Before/After vào Audit Log kiểm duyệt (MOD-012)

**Công việc gốc**

- Bổ sung schema lưu payload: `{ before: {...}, after: {...}, reason: string }`.
  - Tự động lọc bỏ các trường nhạy cảm (password, token) trước khi ghi log.

**Acceptance criteria gốc**

1. Bản ghi audit hiển thị rõ ràng giá trị cũ và giá trị mới của các trường đã được sửa đổi.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Audit metadata before/after/reason và recursive redact keys nhạy cảm; UI details hiển thị JSON. Có audit writer tests và coverage integration cho các quyết định. Không kết luận mọi mutation toàn repo đều được chuẩn hóa chỉ vì có helper.

**Bằng chứng source:** [backend/src/modules/audit/audit.writer.ts:4](../backend/src/modules/audit/audit.writer.ts#L4), [frontend/features/admin/components/AdminAuditPage.tsx:19](../frontend/features/admin/components/AdminAuditPage.tsx#L19), [backend/src/modules/users/users.repository.ts:95](../backend/src/modules/users/users.repository.ts#L95).

**Commit liên quan:** 0a2df4a c036283 27353f2.

<a id="kieu-20"></a>

### KIEU-20 — Đảm bảo ghi Audit Log nguyên tử cùng Transaction với trạng thái kiểm duyệt (PROFILE-002, MOD-008)

**Công việc gốc**

- Đưa thao tác insert `AuditLog` vào chung khối `prisma.$transaction` với thao tác cập nhật trạng thái đối tượng.

**Acceptance criteria gốc**

1. Nếu ghi log thất bại, toàn bộ cập nhật bị rollback, đảm bảo không có trạng thái kiểm duyệt nào thiếu audit log.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

State và writeAudit dùng cùng tx cho ban/unban, agency decision, tour moderation, report resolution, review. Có failure injection rollback ban và review. Notification sau transaction ở một số luồng không cùng đảm bảo; AC yêu cầu audit chứ không hứa mọi side effect.

**Bằng chứng source:** [backend/src/modules/users/users.repository.ts:82](../backend/src/modules/users/users.repository.ts#L82), [backend/src/modules/tours/tours.repository.ts:1](../backend/src/modules/tours/tours.repository.ts#L1), [backend/src/modules/reports/reports.repository.ts:88](../backend/src/modules/reports/reports.repository.ts#L88), [backend/src/modules/reviews/reviews.repository.ts:44](../backend/src/modules/reviews/reviews.repository.ts#L44).

**Commit liên quan:** 0a2df4a c036283.

<a id="kieu-21"></a>

### KIEU-21 — Bổ sung bộ lọc chỉ mục, tìm kiếm và số lượng báo cáo cho Moderation List (MOD-009)

**Công việc gốc**

- Viết câu query tối ưu có kèm index cho các trường `status`, `targetType`, `createdAt`.
  - Trả về trường `totalReportsCount` đi kèm từng mục cần duyệt.

**Acceptance criteria gốc**

1. Moderator lọc được danh sách theo số lượng báo cáo giảm dần, thời gian xử lý nhanh dưới 200ms.
   - **Đánh giá AC 1:** Đạt benchmark local p95 42,02ms; chưa có bằng chứng latency production.

**Đối chiếu:** Có code; hiệu năng chỉ được kiểm chứng local.

Filter/status/type/category/date/search, totalReportsCount aggregate trước LIMIT và reports_desc có thật. Có benchmark 10.000 report/100 target và p95; con số lượt hiện tại ghi riêng dưới kết quả test. Không dùng benchmark local để cam kết production dưới 200ms.

**Bằng chứng source:** [backend/src/modules/reports/reports.repository.ts:110](../backend/src/modules/reports/reports.repository.ts#L110), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:234](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L234), [prisma/migrations/202611040001_kieu_admin_workflows/migration.sql:1](../prisma/migrations/202611040001_kieu_admin_workflows/migration.sql#L1).

**Commit liên quan:** c036283 6901ab8.

<a id="kieu-22"></a>

### KIEU-22 — Yêu cầu nhận xử lý (Claim) và ghi chú khi đóng Support Ticket (MOD-010)

**Công việc gốc**

- Bắt buộc vé phải được gán `assignedToStaffId` trước khi giải quyết.
  - Yêu cầu nhập trường `resolutionNote` khi chuyển sang `RESOLVED`.

**Acceptance criteria gốc**

1. Vé chưa được claim hoặc đóng không có lý do sẽ bị server từ chối với thông báo hướng dẫn cụ thể.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

staffTransition dùng CAS assignee/status, bắt claim và note >=10 ở cả setStatus và reply resolve. Concurrent claim chỉ một người thắng; người không được gán bị từ chối.

**Bằng chứng source:** [backend/src/modules/support/support.repository.ts:20](../backend/src/modules/support/support.repository.ts#L20), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:177](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L177).

**Commit liên quan:** c036283 27353f2.

<a id="kieu-23"></a>

### KIEU-23 — Xử lý trạng thái lỗi độc lập cho Widget khiếu nại leo thang (MOD-011)

**Công việc gốc**

- Tách biệt trạng thái `isError` và hiển thị badge "Lỗi tải dữ liệu - Bấm để thử lại" thay vì ép về số 0.

**Acceptance criteria gốc**

1. Mock lỗi mạng API khiếu nại: Widget hiển thị icon cảnh báo và nút thử lại, không hiển thị số 0 giả mạo.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC chính.

Complaint query có loading/error riêng, lỗi hiện chữ và Thử lại, không ép 0; widget khác vẫn giữ dữ liệu. UI có role=alert nhưng chưa có icon cảnh báo riêng như cách diễn đạt AC; đây là sai khác trình bày nhỏ.

**Bằng chứng source:** [frontend/features/moderation/components/ModerationDashboardPage.tsx:29](../frontend/features/moderation/components/ModerationDashboardPage.tsx#L29), [frontend/features/moderation/__tests__/kieu-dashboard.test.tsx:18](../frontend/features/moderation/__tests__/kieu-dashboard.test.tsx#L18).

**Commit liên quan:** 27353f2.

<a id="kieu-24"></a>

### KIEU-24 — Loại bỏ trường nội bộ phân quyền khỏi Private Profile DTO (PROFILE-015)

**Công việc gốc**

- Dùng DTO serializer loại bỏ các trường nội bộ của hệ thống phân quyền trước khi trả về cho client thông thường.

**Acceptance criteria gốc**

1. Kiểm tra response GET `/users/me`: Chỉ chứa thông tin profile cá nhân hợp lệ, không chứa internals.
   - **Đánh giá AC 1:** Raw internals đã loại; permissions hiệu lực vẫn có, cần làm rõ cách hiểu internals.

**Đối chiếu:** Đạt phần raw internals; cần làm rõ phạm vi permissions.

toProfileDto loại extraPermissions/revokedPermissions/staffStatus. Vẫn trả permissions hiệu lực cùng role/status/twoFactorEnabled. Nếu AC không chứa internals nghĩa là loại raw grant/lifecycle thì đạt; nếu bao gồm mọi danh sách quyền của Traveler thì chưa đạt. Không tự đổi nghĩa AC thành đã pass toàn bộ.

**Bằng chứng source:** [backend/src/modules/users/users.mapper.ts:14](../backend/src/modules/users/users.mapper.ts#L14), [backend/src/modules/users/users.controller.ts:23](../backend/src/modules/users/users.controller.ts#L23).

**Commit liên quan:** 9a9b2c9.

<a id="kieu-25"></a>

### KIEU-25 — Bổ sung biểu đồ xu hướng SLA và tải công việc trên Dashboard (DASH-001)

**Công việc gốc**

- Tạo service aggregate số lượng vụ việc theo trạng thái (`ON_TIME`, `NEAR_OVERDUE`, `BREACHED`).
  - Dựng component biểu đồ trực quan hóa dữ liệu trên Admin Dashboard.

**Acceptance criteria gốc**

1. Dashboard hiển thị biểu đồ thống kê SLA trực quan theo các mốc 7 ngày / 30 ngày.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Có biểu đồ stacked bars + table và select 7/30 ngày; cohort theo createdAt giờ Việt Nam, đúng/gần/quá hạn/unknown. Dữ liệu từ ComplaintTicket, không aggregate mọi loại moderation entity. API regression có 7 ngày; chưa thấy test UI tương tác riêng đầy đủ 7 sang 30.

**Bằng chứng source:** [backend/src/modules/complaints/sla.routes.ts:10](../backend/src/modules/complaints/sla.routes.ts#L10), [frontend/features/moderation/components/SlaTrends.tsx:6](../frontend/features/moderation/components/SlaTrends.tsx#L6).

**Commit liên quan:** 4165ca6 27353f2.

<a id="kieu-26"></a>

### KIEU-26 — Xây dựng chức năng xuất dữ liệu kiểm duyệt và Audit Log an toàn (DASH-002)

**Công việc gốc**

- Tạo endpoint GET `/api/v1/admin/export/audit-logs` có phân quyền chặt chẽ (`requireSuperAdmin`).
  - Hỗ trợ xuất dữ liệu dạng stream để tránh tràn bộ nhớ khi dữ liệu lớn.

**Acceptance criteria gốc**

1. Xuất file CSV thành công, dữ liệu được format đúng chuẩn tiếng Việt UTF-8.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Guard Super Admin + permission, CSV UTF-8 BOM, quote/escape, formula neutralization; batches 500/backpressure/disconnect. Có endpoint audit-logs và moderation; integration 403/200 và tiếng Việt. Chưa thử file lớn trong Excel thật.

**Bằng chứng source:** [backend/src/modules/audit/audit-export.routes.ts:15](../backend/src/modules/audit/audit-export.routes.ts#L15), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:192](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L192).

**Commit liên quan:** 0a2df4a 27353f2.

<a id="kieu-27"></a>

### KIEU-27 — Tự động làm mới dữ liệu Dashboard mỗi giờ trên màn hình nhàn rỗi (DASH-003)

**Công việc gốc**

- Cấu hình polling interval an toàn (hoặc revalidate on window focus) với chu kỳ 1 giờ.
  - Hiển thị nhãn "Dữ liệu cập nhật lúc: hh:mm".

**Acceptance criteria gốc**

1. Màn hình tự động refetch số liệu mới sau 60 phút nhàn rỗi mà không làm mất trạng thái bộ lọc đang chọn.
   - **Đánh giá AC 1:** Có polling 60 phút và giữ state; chưa có test timer/browser đủ thời gian.

**Đối chiếu:** Có code; thiếu mô phỏng đủ 60 phút.

pollingInterval 3.600.000 + refetchOnFocus, setupListeners, generatedAt freshness và state filter không reset theo render. Test hiện chủ yếu kiểm tra options hook; chưa chạy fake timer 60 phút hoặc idle browser để xác nhận AC thời gian từ đầu đến cuối.

**Bằng chứng source:** [frontend/features/moderation/components/ModerationDashboardPage.tsx:29](../frontend/features/moderation/components/ModerationDashboardPage.tsx#L29), [frontend/features/moderation/components/SlaTrends.tsx:8](../frontend/features/moderation/components/SlaTrends.tsx#L8), [frontend/store/Providers.tsx:12](../frontend/store/Providers.tsx#L12), [frontend/features/moderation/__tests__/kieu-dashboard.test.tsx:31](../frontend/features/moderation/__tests__/kieu-dashboard.test.tsx#L31).

**Commit liên quan:** 27353f2.

<a id="kieu-28"></a>

### KIEU-28 — Gửi email thông báo và mã theo dõi khi xử lý xong yêu cầu hỗ trợ (SUP-001, SUP-002)

**Công việc gốc**

- Sinh mã theo dõi dạng ngắn dễ đọc khi tạo vé (ví dụ: `SUP-2026-8891`).
  - Bắn email thông báo cho người dùng khi vé được đánh dấu hoàn thành kèm mã tra cứu.

**Acceptance criteria gốc**

1. Người dùng nhận email thông báo kết quả giải quyết có chứa mã vé định dạng chuẩn.
   - **Đánh giá AC 1:** Mã và mail outbox có; chưa chứng minh người dùng nhận email thật.

**Đối chiếu:** Chưa xác minh đủ AC email thật.

Có supportCode SUP-..., unique/retry và enqueue email result/code trong cùng transaction resolve; worker retry/dedupe. Test kiểm tra nội dung outbox, chưa chứng minh người dùng nhận được thư qua provider thật.

**Bằng chứng source:** [backend/src/modules/support/support.repository.ts:36](../backend/src/modules/support/support.repository.ts#L36), [backend/src/modules/notifications/mail-outbox.ts:1](../backend/src/modules/notifications/mail-outbox.ts#L1), [backend/src/modules/users/__tests__/admin-staff.integration.test.ts:177](../backend/src/modules/users/__tests__/admin-staff.integration.test.ts#L177).

**Commit liên quan:** 650df4c 0a2df4a c036283.

<a id="khiem-01"></a>

### KHIEM-01 — Xây dựng luồng đăng ký và xác thực tài khoản nhận Payout của Hướng dẫn viên (GUIDE-001)

**Công việc gốc**

- Tạo model `GuidePayoutAccount` liên kết với Guide (tên ngân hàng, số tài khoản, tên thụ hưởng).
  - Viết API đọc/cập nhật thông tin tài khoản với mã hóa dữ liệu nhạy cảm.

**Acceptance criteria gốc**

1. Hướng dẫn viên cập nhật được tài khoản ngân hàng, thông tin được che mờ (masking) khi hiển thị lại.
   - **Đánh giá AC 1:** Có update/masking và regression; chưa xác minh cấu hình/key/backfill môi trường app.

**Đối chiếu:** Có code và regression phù hợp AC; cần cấu hình môi trường.

Model GuidePayoutAccount, AES-GCM/key version/AAD, masked DTO và form web/mobile. Không có key trả 503, không tự fallback secret. Legacy plaintext còn phải chạy backfill; chưa xác minh key/backfill trên database app. Chỉ validate định dạng, không xác thực chủ tài khoản qua ngân hàng.

**Bằng chứng source:** [backend/src/modules/users/payout-account.crypto.ts:1](../backend/src/modules/users/payout-account.crypto.ts#L1), [backend/src/modules/users/users.service.ts:115](../backend/src/modules/users/users.service.ts#L115), [mobile/lib/features/earnings/widgets/bank_account_sheet.dart:1](../mobile/lib/features/earnings/widgets/bank_account_sheet.dart#L1).

**Commit liên quan:** 57fd720 db6e95d.

<a id="khiem-02"></a>

### KHIEM-02 — Kiểm tra xung đột lịch trình và tính khả dụng của HDV khi Booking (GUIDE-002)

**Công việc gốc**

- Kiểm tra tính sẵn sàng của HDV trước khi xác nhận tạo đơn hàng giữ chỗ.
  - Nếu HDV bị bận, cảnh báo cho điều hành tour hoặc ngăn chặn đặt lịch trùng lặp.

**Acceptance criteria gốc**

1. Đặt tour có HDV đã có lịch phân công trùng ngày sẽ bị chặn với thông báo phù hợp.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Chung schedule lock trước assign/accept/edit/reserve, overlap [start,end), chặn GUIDE_SCHEDULE_CONFLICT và rollback ghế. Coarse advisory lock toàn lịch có thể ảnh hưởng throughput; chưa load test.

**Bằng chứng source:** [backend/src/modules/tours/guide-availability.ts:5](../backend/src/modules/tours/guide-availability.ts#L5), [backend/src/modules/tours/tours.repository.ts:289](../backend/src/modules/tours/tours.repository.ts#L289), [backend/src/modules/tours/__tests__/guide-availability.integration.test.ts:1](../backend/src/modules/tours/__tests__/guide-availability.integration.test.ts#L1).

**Commit liên quan:** a554f2f.

<a id="khiem-03"></a>

### KHIEM-03 — Hỗ trợ tải lên và xóa ảnh đại diện Hướng dẫn viên qua Cloudinary Picker (GUIDE-003)

**Công việc gốc**

- Bổ sung quyền thao tác avatar trong media controller cho role `TOUR_GUIDE`.
  - Cập nhật UI màn hình hồ sơ HDV trên Flutter để chọn ảnh từ thư viện và gọi API cập nhật.

**Acceptance criteria gốc**

1. HDV có thể thay đổi hoặc xóa ảnh đại diện thành công trên ứng dụng di động.
   - **Đánh giá AC 1:** Có API/UI/test; chưa xác minh gallery/Cloudinary trên thiết bị thật.

**Đối chiếu:** Chưa xác minh đủ AC thiết bị/upload thật.

Guide được signed upload/verify/remove, UI gallery/action có code. Unit/widget tests không thay thế gallery permission, Cloudinary upload/delete và refresh avatar thật trên thiết bị.

**Bằng chứng source:** [backend/src/modules/users/users.service.ts:136](../backend/src/modules/users/users.service.ts#L136), [mobile/lib/features/profile/screens/edit_profile_screen.dart:1](../mobile/lib/features/profile/screens/edit_profile_screen.dart#L1), [mobile/test/features/profile/guide_avatar_actions_test.dart:1](../mobile/test/features/profile/guide_avatar_actions_test.dart#L1).

**Commit liên quan:** db6e95d.

<a id="khiem-04"></a>

### KHIEM-04 — Ràng buộc chặt chẽ định dạng giờ phút trong bộ chọn lịch rảnh của HDV (PROFILE-005)

**Công việc gốc**

- Sử dụng Zod/Regex kiểm tra định dạng giờ `HH:mm` (giờ: 00-23, phút: 00-59).
  - Đảm bảo `startTime < endTime` và không chồng lấn khung giờ trong cùng 1 ngày.

**Acceptance criteria gốc**

1. Nhập giờ `99:99` bị validator từ chối ngay tại backend với lỗi rõ ràng.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Regex HH:mm, start<end, không overlap enabled slots, cho adjacent; test 99:99/24:00/12:60/9:00/negative. Slot đang là preference lặp mỗi ngày, không phải lịch theo ngày cụ thể.

**Bằng chứng source:** [backend/src/modules/users/users.validation.ts:100](../backend/src/modules/users/users.validation.ts#L100), [backend/src/modules/users/__tests__/users.preferences.test.ts:7](../backend/src/modules/users/__tests__/users.preferences.test.ts#L7).

**Commit liên quan:** a554f2f db6e95d.

<a id="khiem-05"></a>

### KHIEM-05 — Nâng cấp bộ lọc trạng thái và thanh tác vụ danh sách Tour được phân công của HDV (PROFILE-012)

**Công việc gốc**

- Cập nhật giao diện `guide_tours_screen.dart` với thanh tab filter trực quan.
  - Bổ sung nút "Xem danh sách đoàn" và "Mở quét QR vé".

**Acceptance criteria gốc**

1. HDV chuyển đổi mượt mà giữa các tab tour và lọc chính xác các chuyến đi.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC bộ lọc.

Có 3 filter, expand tour theo departure, load đủ page, quick roster/QR. Unit/widget kiểm tra lifecycle/filters. Ngoài AC: api vẫn có nhánh giả lập answerAssignment với tour- và fetchTourDetail trả mô tả giả khi lỗi, không được coi luồng này sạch mock.

**Bằng chứng source:** [mobile/lib/features/guide/screens/guide_tours_screen.dart:57](../mobile/lib/features/guide/screens/guide_tours_screen.dart#L57), [mobile/lib/features/guide/cubit/guide_tours_cubit.dart:21](../mobile/lib/features/guide/cubit/guide_tours_cubit.dart#L21), [mobile/lib/features/guide/api/guide_check_in_api.dart:1](../mobile/lib/features/guide/api/guide_check_in_api.dart#L1).

**Commit liên quan:** f8ff819.

<a id="khiem-06"></a>

### KHIEM-06 — Xây dựng máy quét QR vé và bảng danh sách đoàn bảo mật thông tin (BOOK-008)

**Công việc gốc**

- Tạo màn hình quét QR dùng camera trên app Flutter, gọi API POST `/api/v1/e-tickets/scan`.
  - Roster chỉ hiển thị: Tên khách, số lượng ghế, trạng thái vé (`VALID`, `CHECKED_IN`), ẩn bớt SĐT.

**Acceptance criteria gốc**

1. Quét mã QR hợp lệ: Đổi trạng thái vé sang `USED`/`CHECKED_IN`, rung phản hồi và phát âm thanh thành công. Quét lại lần 2 báo `TICKET_ALREADY_USED`.
   - **Đánh giá AC 1:** Một phần: chống quét lại có; status giữ VALID/usedAt khác AC; camera/feedback chưa test thiết bị.

**Đối chiếu:** Một phần; contract trạng thái lệch và thiết bị chưa xác minh.

Camera/scan/roster masking/rung/âm thanh có code; usedAt CAS chặn scan lần 2 TICKET_ALREADY_USED. Nhưng scan KHÔNG đổi status sang USED/CHECKED_IN như AC: giữ VALID và dùng usedAt/checkedIn để phân biệt check-in với completed. Chức năng tương đương chống quét lại, contract vẫn cần thống nhất; chưa test camera/rung/âm thanh thật.

**Bằng chứng source:** [backend/src/modules/e-tickets/e-tickets.repository.ts:161](../backend/src/modules/e-tickets/e-tickets.repository.ts#L161), [backend/src/modules/e-tickets/e-tickets.service.ts:129](../backend/src/modules/e-tickets/e-tickets.service.ts#L129), [mobile/lib/features/guide/screens/qr_check_in_screen.dart:1](../mobile/lib/features/guide/screens/qr_check_in_screen.dart#L1), [mobile/lib/features/guide/widgets/check_in_result_dialog.dart:7](../mobile/lib/features/guide/widgets/check_in_result_dialog.dart#L7).

**Commit liên quan:** a554f2f f8ff819.

<a id="khiem-07"></a>

### KHIEM-07 — Xây dựng màn hình danh sách và lịch sử vé điện tử dành cho Traveler (BOOK-013)

**Công việc gốc**

- Tạo trang `/traveler/tickets` trên web và màn hình vé trên mobile.
  - Hiển thị danh thiếp vé điện tử có mã QR động, tên tour, ngày khởi hành và điểm đón.

**Acceptance criteria gốc**

1. Khách du lịch mở được vé điện tử offline/online và hiển thị rõ ràng mã QR cho HDV quét.
   - **Đánh giá AC 1:** Có code QR/cache và test một phần; offline cold start/list UI chưa đủ bằng chứng.

**Đối chiếu:** Có code; offline từ cold start chưa xác minh.

Có list/history/filter/page/QR/meeting point web/mobile và cache theo owner. Test web cache và mobile repository offline; chưa có test đầy đủ màn list mobile mới online->offline/cold start. Web localStorage chỉ giúp khi app đã tải được; chưa thấy service worker để bảo đảm reload URL khi mất mạng. QR encode code cố định, không phải token QR xoay vòng nếu hiểu chữ động theo nghĩa đó.

**Bằng chứng source:** [frontend/app/traveler/tickets/page.tsx:1](../frontend/app/traveler/tickets/page.tsx#L1), [frontend/features/e-ticket/components/ETicketList.tsx:17](../frontend/features/e-ticket/components/ETicketList.tsx#L17), [mobile/lib/features/bookings/screens/tickets_screen.dart:23](../mobile/lib/features/bookings/screens/tickets_screen.dart#L23), [mobile/test/features/bookings/offline_ticket_test.dart:1](../mobile/test/features/bookings/offline_ticket_test.dart#L1).

**Commit liên quan:** 1d5e146.

<a id="khiem-08"></a>

### KHIEM-08 — Chặn xung đột phát hành vé khi đơn hàng bị hủy đồng thời (BOOK-003)

**Công việc gốc**

- Kiểm tra trạng thái đơn hàng là `CONFIRMED` ngay trong câu lệnh tạo vé điện tử.
  - Nếu đơn hàng đã chuyển `CANCELLED`, hủy ngay tiến trình xuất vé.

**Acceptance criteria gốc**

1. Mô phỏng request hủy đơn trước khi xuất vé: Vé không được tạo và hệ thống báo lỗi xung đột.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

FOR UPDATE booking, check paid+CONFIRMED và insert ticket cùng tx; cancel cập nhật booking và vô hiệu VALID ticket trong transaction. Có thứ tự cancel-before-issue, issue-before-cancel và concurrent.

**Bằng chứng source:** [backend/src/modules/e-tickets/e-tickets.repository.ts:43](../backend/src/modules/e-tickets/e-tickets.repository.ts#L43), [backend/src/modules/e-tickets/__tests__/e-tickets.lifecycle.integration.test.ts:1](../backend/src/modules/e-tickets/__tests__/e-tickets.lifecycle.integration.test.ts#L1).

**Commit liên quan:** a554f2f.

<a id="khiem-09"></a>

### KHIEM-09 — Chặn hoàn thành tour và mở khóa đánh giá khi chuyến đi chưa kết thúc (BOOK-012, TOUR-008)

**Công việc gốc**

- Trong logic hoàn thành tour (`completeMine` / `completeTour`), kiểm tra `departure.endDate <= now()`.
  - Chỉ mở quyền tạo review khi chuyến đi đã thực sự kết thúc về mặt thời gian.

**Acceptance criteria gốc**

1. Bấm hoàn thành tour cho departure ngày mai sẽ bị từ chối với thông báo "Chuyến đi chưa kết thúc".
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Service + DB guard endDate; guide complete theo departure, review/upload không mở với legacy completed sớm. Có integration và unit cho future end/ambiguous departure. endDate tính departure + durationDays*24h, chưa xác nhận lại ý nghĩa ngày lịch trong SRS.

**Bằng chứng source:** [backend/src/modules/bookings/bookings.service.ts:315](../backend/src/modules/bookings/bookings.service.ts#L315), [backend/src/modules/bookings/bookings.repository.ts:130](../backend/src/modules/bookings/bookings.repository.ts#L130), [backend/src/modules/reviews/reviews.service.ts:57](../backend/src/modules/reviews/reviews.service.ts#L57).

**Commit liên quan:** a554f2f 02c95b7.

<a id="khiem-10"></a>

### KHIEM-10 — Tự động thử lại khi tiến trình phát hành vé điện tử gặp sự cố (PAY-004)

**Công việc gốc**

- Lưu trạng thái thực hiện (`fulfillmentStatus: PENDING | COMPLETED | FAILED`).
  - Xây dựng cron worker quét lại các đơn thanh toán thành công nhưng chưa có vé sau 3 phút để tự động bù vé.

**Acceptance criteria gốc**

1. Khi cố tình ngắt kết nối lúc tạo vé, worker nền tự động chạy bù vé sau khi kết nối phục hồi.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Worker mỗi phút, booking paid thiếu vé quá 3 phút, persist FAILED/attempt/nextAttemptAt, row lock + unique idempotent. Failure injection/recovery/concurrent sweep có test. Không bao gồm retry email phát vé sau khi ticket đã tạo.

**Bằng chứng source:** [backend/src/modules/e-tickets/e-tickets.fulfillment.ts:1](../backend/src/modules/e-tickets/e-tickets.fulfillment.ts#L1), [backend/src/jobs/maintenance.ts:29](../backend/src/jobs/maintenance.ts#L29), [backend/src/modules/e-tickets/__tests__/e-tickets.lifecycle.integration.test.ts:79](../backend/src/modules/e-tickets/__tests__/e-tickets.lifecycle.integration.test.ts#L79).

**Commit liên quan:** 57fd720 a554f2f.

<a id="khiem-11"></a>

### KHIEM-11 — Xây dựng Ledger bảng kê rút tiền và theo dõi thanh toán cho HDV (PAY-018)

**Công việc gốc**

- Tạo model `GuidePayoutLedger` (mã giao dịch, HDV ID, số tiền, tour ID, ngày chi trả).
  - Cung cấp API và giao diện màn hình theo dõi thu nhập trên app HDV.

**Acceptance criteria gốc**

1. HDV xem được chi tiết từng khoản thu nhập theo từng tour đã hoàn thành.
   - **Đánh giá AC 1:** Không đủ để đạt: có ledger nhưng UI có thể hiện thu nhập giả và completion có thể thiếu earning.

**Đối chiếu:** Một phần; không đạt để nghiệm thu màn thu nhập.

Ledger/model/API/UI payout có thật. Lỗi P1: API lỗi hoặc danh sách/tổng rỗng bị thay bằng fake earnings, tổng giả 18.500.000; filtering/page cũng không còn phản ánh server. Lỗi P1 khác: booking hoàn thành đã commit trước notify/event; listener lỗi chỉ log, không có durable retry/backfill runtime cho missing earning. Có thể completed mà không có khoản thu. Mock fallback có từ 0d92d96, bị bỏ sót khi fix, không phải do commit ledger thêm mới.

**Bằng chứng source:** [mobile/lib/features/earnings/api/earnings_api.dart:56](../mobile/lib/features/earnings/api/earnings_api.dart#L56), [backend/src/modules/earnings/earnings.repository.ts:23](../backend/src/modules/earnings/earnings.repository.ts#L23), [backend/src/modules/earnings/index.ts:11](../backend/src/modules/earnings/index.ts#L11), [backend/src/modules/bookings/bookings.events.ts:43](../backend/src/modules/bookings/bookings.events.ts#L43).

**Commit liên quan:** 57fd720 bcce41a.

<a id="khiem-12"></a>

### KHIEM-12 — Tính toán lại điểm trung bình đánh giá (Rating) nguyên tử (REVIEW-001)

**Công việc gốc**

- Đưa việc lưu review và tính lại `averageRating`, `totalReviews` vào chung transaction hoặc queue xử lý đáng tin cậy.

**Acceptance criteria gốc**

1. Gửi review thành công luôn cập nhật đúng số sao trung bình trên trang chi tiết tour.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Review insert + rating aggregate/update cùng tx, khóa Tour serialize concurrent writer; có concurrent five ratings và failure injection rollback. Public tour đọc rating đã commit.

**Bằng chứng source:** [backend/src/modules/reviews/reviews.repository.ts:28](../backend/src/modules/reviews/reviews.repository.ts#L28), [backend/src/modules/reviews/__tests__/reviews.atomic.integration.test.ts:44](../backend/src/modules/reviews/__tests__/reviews.atomic.integration.test.ts#L44).

**Commit liên quan:** 02c95b7.

<a id="khiem-13"></a>

### KHIEM-13 — Bổ sung kiểm tra Revision Token khi duyệt đánh giá của khách (REVIEW-002)

**Công việc gốc**

- Gửi kèm `contentVersion` hoặc hash nội dung khi Moderator bấm phê duyệt.
  - Nếu nội dung đã bị thay đổi, từ chối quyết định duyệt và yêu cầu tải lại.

**Acceptance criteria gốc**

1. Phê duyệt trên bản cũ bị từ chối với mã lỗi `409 Conflict`.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

contentVersion hash, service check và SQL CAS comment/rating/images sau đọc chống TOCTOU; stale ->409. Web gửi token từ item. Test stale hash và content đổi sau service read.

**Bằng chứng source:** [backend/src/modules/reviews/reviews.service.ts:165](../backend/src/modules/reviews/reviews.service.ts#L165), [backend/src/modules/reviews/reviews.repository.ts:44](../backend/src/modules/reviews/reviews.repository.ts#L44), [backend/src/modules/reviews/__tests__/reviews.atomic.integration.test.ts:26](../backend/src/modules/reviews/__tests__/reviews.atomic.integration.test.ts#L26).

**Commit liên quan:** 02c95b7.

<a id="khiem-14"></a>

### KHIEM-14 — Ghi nhận Audit Log nguyên tử khi ẩn hoặc hiển thị đánh giá (REVIEW-003)

**Công việc gốc**

- Gộp thao tác đổi `visibility` và tạo bản ghi `AuditLog` vào một transaction.

**Acceptance criteria gốc**

1. Mọi thao tác ẩn/hiện đánh giá luôn có vết trong Audit Log với ID của Moderator thực hiện.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Visibility + audit actor + rating + notification/outbox cùng tx; inject audit trigger failure rollback tất cả. Không phải chỉ audit call sau update.

**Bằng chứng source:** [backend/src/modules/reviews/reviews.repository.ts:44](../backend/src/modules/reviews/reviews.repository.ts#L44), [backend/src/modules/reviews/__tests__/reviews.atomic.integration.test.ts:62](../backend/src/modules/reviews/__tests__/reviews.atomic.integration.test.ts#L62).

**Commit liên quan:** 02c95b7.

<a id="khiem-15"></a>

### KHIEM-15 — Bắt buộc nhập lý do giải thích khi khôi phục đánh giá bị ẩn (REVIEW-008)

**Công việc gốc**

- Thêm trường `restorationReason` bắt buộc trong body của request bỏ ẩn review.

**Acceptance criteria gốc**

1. Bỏ ẩn review mà không điền lý do sẽ nhận lỗi `400 Bad Request`.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Restore bắt restorationReason trimmed 3..1000; thiếu trả 400 qua schema; UI gửi restorationReason và contentVersion. Unit/routes tests có contract quyết định.

**Bằng chứng source:** [backend/src/modules/moderation/moderation.validation.ts:48](../backend/src/modules/moderation/moderation.validation.ts#L48), [backend/src/modules/reviews/reviews.service.ts:167](../backend/src/modules/reviews/reviews.service.ts#L167).

**Commit liên quan:** 02c95b7.

<a id="khiem-16"></a>

### KHIEM-16 — Gửi thông báo đến người đánh giá và Agency khi review được kiểm duyệt (REVIEW-009)

**Công việc gốc**

- Tích hợp notification service bắn thông báo in-app và email cho cả hai bên khi có quyết định kiểm duyệt.

**Acceptance criteria gốc**

1. Khi review bị ẩn vì vi phạm, khách nhận được thông báo nêu rõ điều khoản vi phạm.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC in-app; email thật chưa xác minh.

Hai bên nhận notification + mail outbox cùng transaction; nội dung có reason. Test hai recipient và nội dung điều khoản bằng reason mẫu. Không có chọn điều khoản cấu trúc; chất lượng lý do phụ thuộc Moderator. Chưa chứng minh delivery provider thật.

**Bằng chứng source:** [backend/src/modules/reviews/reviews.repository.ts:54](../backend/src/modules/reviews/reviews.repository.ts#L54), [backend/src/modules/notifications/notifications.writer.ts:6](../backend/src/modules/notifications/notifications.writer.ts#L6), [backend/src/modules/reviews/__tests__/reviews.atomic.integration.test.ts:87](../backend/src/modules/reviews/__tests__/reviews.atomic.integration.test.ts#L87).

**Commit liên quan:** 02c95b7.

<a id="khiem-17"></a>

### KHIEM-17 — Tách riêng hàng đợi xử lý đánh giá bị báo cáo với hành động Giữ/Gỡ (REVIEW-007)

**Công việc gốc**

- Xây dựng component `ReviewModerationQueue.tsx` hiển thị số lượt báo cáo, lý do báo cáo và 2 nút hành động "Giữ lại" / "Gỡ bỏ".

**Acceptance criteria gốc**

1. Moderator xử lý khiếu nại review dễ dàng với đầy đủ ngữ cảnh báo cáo.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Queue review riêng, count/category/description, Giữ/Gỡ, reason, contentVersion và reportIds snapshot; không đóng report mới chưa xem. Có frontend + integration. Quyền cần cả review:moderate và dispute:resolve.

**Bằng chứng source:** [frontend/features/moderation/components/ReviewModerationQueue.tsx:7](../frontend/features/moderation/components/ReviewModerationQueue.tsx#L7), [backend/src/modules/reviews/review-triage.routes.ts:1](../backend/src/modules/reviews/review-triage.routes.ts#L1), [backend/src/modules/reviews/__tests__/review-triage.integration.test.ts:1](../backend/src/modules/reviews/__tests__/review-triage.integration.test.ts#L1).

**Commit liên quan:** 02c95b7.

<a id="khiem-18"></a>

### KHIEM-18 — Bổ sung giao diện xem trước hồ sơ công khai của HDV và chỉ số 2FA (REVIEW-004)

**Công việc gốc**

- Tạo component preview trang công khai của HDV (kinh nghiệm, tour phụ trách, đánh giá của khách).
  - Hiển thị huy hiệu "Đã kích hoạt bảo mật 2 lớp" nếu HDV đã bật 2FA.

**Acceptance criteria gốc**

1. HDV bấm xem trước trang cá nhân thấy đúng giao diện khách nhìn thấy.
   - **Đánh giá AC 1:** Web mở đúng public route; mobile và phạm vi tour phụ trách còn thiếu.

**Đối chiếu:** Một phần so với phạm vi task; AC web có code.

Web preview link mở đúng public route và badge 2FA từ user server; test chỉ kiểm tra link và badge. Mobile không thấy preview/2FA flow. Public profile có kinh nghiệm/reviews, chưa có danh sách tour phụ trách tiêu chuẩn cho mọi Guide (premium portfolio là luồng riêng). AC bấm preview ở web có, toàn phạm vi task chưa đầy đủ.

**Bằng chứng source:** [frontend/features/guide/components/GuideProfilePage.tsx:115](../frontend/features/guide/components/GuideProfilePage.tsx#L115), [frontend/features/public-profiles/PublicProfilePage.tsx:63](../frontend/features/public-profiles/PublicProfilePage.tsx#L63), [mobile/lib/features/profile/screens/guide_profile_screen.dart:16](../mobile/lib/features/profile/screens/guide_profile_screen.dart#L16).

**Commit liên quan:** db6e95d.

<a id="khiem-19"></a>

### KHIEM-19 — Xây dựng màn hình gửi yêu cầu hỗ trợ (Support Ticket) cho Traveler (BOOK-004)

**Công việc gốc**

- Tạo màn hình `traveler_support_ticket_screen.dart` trên Flutter với danh mục hỗ trợ: Đặt tour, Thanh toán, Tài khoản, Khác.
  - Kết nối với API tạo vé hỗ trợ khách hàng.

**Acceptance criteria gốc**

1. Khách gửi yêu cầu hỗ trợ thành công và nhận mã phản hồi.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

4 category đúng, POST support, show supportCode server, giữ form lỗi và chống double tap. Widget test success/failure dùng seam; backend support integration kiểm tra route. Chưa smoke ứng dụng kết nối backend thật.

**Bằng chứng source:** [mobile/lib/features/support/screens/traveler_support_ticket_screen.dart:25](../mobile/lib/features/support/screens/traveler_support_ticket_screen.dart#L25), [mobile/lib/features/profile/screens/profile_screen.dart:516](../mobile/lib/features/profile/screens/profile_screen.dart#L516), [mobile/test/features/support/traveler_support_ticket_screen_test.dart:1](../mobile/test/features/support/traveler_support_ticket_screen_test.dart#L1).

**Commit liên quan:** 1d5e146.

<a id="khiem-20"></a>

### KHIEM-20 — Lưu bản nháp đánh giá vào bộ nhớ cục bộ tránh mất dữ liệu khi rerender (BOOK-009, BOOK-010)

**Công việc gốc**

- Lưu nội dung đang nhập vào SharedPreferences / LocalStorage theo `bookingId`.
  - Khôi phục nội dung tự động khi mở lại dialog đánh giá.

**Acceptance criteria gốc**

1. Đóng dialog đánh giá và mở lại: Nội dung và số sao đã chọn vẫn còn nguyên vẹn.
   - **Đánh giá AC 1:** AC text/rating có code và test; ảnh là phần phạm vi rộng chưa xác minh đủ.

**Đối chiếu:** AC text/rating có code; scope ảnh chưa xác minh đủ.

Web localStorage rating/text và IndexedDB File; mobile SharedPreferences chỉ rating/comment, modal mobile hiện không có picker attachment. AC đóng/mở giữ chữ/sao có regression. Không được gọi toàn bộ phần ảnh đã được kiểm chứng: web IndexedDB cần browser runtime, không thấy test lưu bytes File qua reload; mobile không hỗ trợ ảnh ở modal này.

**Bằng chứng source:** [frontend/features/review/components/WriteReviewDialog.tsx:67](../frontend/features/review/components/WriteReviewDialog.tsx#L67), [frontend/features/review/utils/draftStorage.ts:1](../frontend/features/review/utils/draftStorage.ts#L1), [mobile/lib/features/tours/widgets/tour_review_form_modal.dart:105](../mobile/lib/features/tours/widgets/tour_review_form_modal.dart#L105).

**Commit liên quan:** b678c5e.

<a id="khiem-21"></a>

### KHIEM-21 — Tích hợp chỉ báo đang soạn tin nhắn (Typing Indicator) cho HDV (CHAT-002)

**Công việc gốc**

- Bắt sự kiện `onChanged` trên ô chat, emit socket event `typing` (có debounce 500ms).
  - Hiển thị animation 3 dấu chấm khi đối phương đang soạn thảo.

**Acceptance criteria gốc**

1. Khi khách đang gõ tin nhắn, app HDV hiển thị chỉ báo đang nhập trong thời gian thực.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Debounce 500ms, cancel khi clear/send/disconnect/dispose, receive TTL 3s và animation 3 dots. Test cubit/timer/widget; chưa xác minh hai thiết bị socket thật. Trailing debounce chỉ emit sau pause 500ms, không phát liên tục khi người dùng gõ không ngừng.

**Bằng chứng source:** [mobile/lib/features/chat/bloc/chat_cubit.dart:240](../mobile/lib/features/chat/bloc/chat_cubit.dart#L240), [mobile/lib/features/chat/widgets/typing_bubble.dart:1](../mobile/lib/features/chat/widgets/typing_bubble.dart#L1), [mobile/lib/features/chat/screens/chat_screen.dart:97](../mobile/lib/features/chat/screens/chat_screen.dart#L97).

**Commit liên quan:** 8ab8cc8.

<a id="khiem-22"></a>

### KHIEM-22 — Tích hợp hộp thư hội thoại và trạng thái đọc cho Trợ lý ảo AI (AI-001)

**Công việc gốc**

- Tạo danh sách các cuộc hội thoại AI đã lưu theo chủ đề (ví dụ: "Lịch trình Đà Nẵng 3N2Đ").
  - Quản lý trạng thái đọc cho các tin nhắn do AI phản hồi.

**Acceptance criteria gốc**

1. Khách du lịch xem lại được lịch sử các đoạn chat cũ với AI và tiếp tục cuộc trò chuyện.
   - **Đánh giá AC 1:** Có triển khai phù hợp; bằng chứng và giới hạn kiểm chứng ghi bên dưới.

**Đối chiếu:** Có code và regression phù hợp AC.

Server list/detail owner, inbox/page/unread/read boundary, mở transcript và tiếp tục conversationId; revision tránh hydrate cũ. Integration ownership/read và mobile tests. Chưa gọi provider AI thật trong lần audit này.

**Bằng chứng source:** [mobile/lib/features/ai/bloc/ai_cubit.dart:41](../mobile/lib/features/ai/bloc/ai_cubit.dart#L41), [mobile/lib/features/ai/screens/ai_chat_screen.dart:1](../mobile/lib/features/ai/screens/ai_chat_screen.dart#L1), [backend/src/modules/ai/__tests__/ai.integration.test.ts:88](../backend/src/modules/ai/__tests__/ai.integration.test.ts#L88).

**Commit liên quan:** cd33158.

<a id="khiem-23"></a>

### KHIEM-23 — Xử lý lỗi phản hồi bị cắt cụt từ nhà cung cấp Anthropic AI (PROFILE-003)

**Công việc gốc**

- Kiểm tra `stop_reason` trong kết quả trả về từ Anthropic API.
  - Nếu là `max_tokens`, gắn cờ yêu cầu tiếp tục sinh câu trả lời hoặc báo cho client biết nội dung chưa hoàn chỉnh.

**Acceptance criteria gốc**

1. Tin nhắn bị cắt ngắn không được xem là hoàn tất và có nút "Tiếp tục tạo..." cho người dùng.
   - **Đánh giá AC 1:** Có xử lý incomplete và nút tiếp tục; thiếu test max_tokens trực tiếp provider Anthropic.

**Đối chiếu:** Có code phù hợp AC; thiếu regression Anthropic max_tokens trực tiếp.

Anthropic stop_reason max_tokens -> incomplete nếu allowPartial; JSON/non-partial reject; persist incomplete và nút tiếp tục cùng thread web/mobile. Tests service/history giả lập incomplete và Gemini MAX_TOKENS; chưa thấy test trực tiếp mock Anthropic stop_reason=max_tokens cả hai mode. Test pass hiện có không chứng minh nhánh provider này đã được exercise.

**Bằng chứng source:** [backend/src/modules/ai/providers/anthropic.provider.ts:46](../backend/src/modules/ai/providers/anthropic.provider.ts#L46), [backend/src/modules/ai/ai.service.ts:66](../backend/src/modules/ai/ai.service.ts#L66), [mobile/lib/features/ai/screens/ai_chat_screen.dart:563](../mobile/lib/features/ai/screens/ai_chat_screen.dart#L563).

**Commit liên quan:** cd33158.

## Thứ tự đóng các điểm thiếu

1. Loại dữ liệu thu nhập giả, test trực tiếp Dio adapter cho 200 empty/401/403/network và filters/pagination; giữ empty/error đúng thực tế.
2. Bảo đảm earning/ledger không mất sau completion bằng transaction/outbox hoặc reconcile worker idempotent; fault-injection sau commit/trước event và lỗi insert earning rồi recovery.
3. Hoàn thiện guide preview mobile và dữ liệu tour phụ trách, thống nhất trạng thái check-in với contract AC.
4. Xác minh ticket online/offline cold start, attachment draft thật, polling 60 phút và Anthropic max_tokens bằng regression đúng tầng.
5. Chuẩn bị nội dung policies được duyệt, xác minh publish/version/consent và đọc lại acceptance sau reload; không tự điền chính sách pháp lý tùy ý để che nội dung trống.
6. Smoke email/Cloudinary/camera trên môi trường và thiết bị có cấu hình thật trước khi nghiệm thu các AC liên quan.

Không có task nào được đổi thành “production hoàn tất” chỉ vì suite pass. Audit này không áp migration, không đọc/in secrets, không gọi dịch vụ ngân hàng/provider AI/email trả phí và không push commit.
