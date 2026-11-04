# BẢNG PHÂN CHIA NHIỆM VỤ DỰ ÁN TRIPRI (JIRA FORMAT)

> **Dự án**: TripRi Travel Platform (WDP302)  
> **Tổng số Jira Tickets**: **86 Tickets** (tương ứng 86 Commits)  
> **Mỗi Ticket bao gồm đúng 4 mục**:
> 1. **Mô tả**
> 2. **Công việc**
> 3. **Acceptance Criteria**
> 4. **Commit**

---

## 📑 MỤC LỤC THEO THÀNH VIÊN
- [1. Phân công Kiều (`diemkieu888`) - 28 Tickets](#1-phan-cong-kieu-diemkieu888---28-tickets)
- [2. Phân công Khiêm (`Danny Loid`) - 23 Tickets](#2-phan-cong-khiem-danny-loid---23-tickets)
- [3. Phân công Khoa (`khoale142`) - 22 Tickets](#3-phan-cong-khoa-khoale142---22-tickets)
- [4. Phân công Toàn (`toan215`) - 13 Tickets](#4-phan-cong-toan-toan215---13-tickets)

---

## 1. PHÂN CÔNG KIỀU (`diemkieu888`) - 28 TICKETS
*Lĩnh vực: Admin & Staff Management, Moderation Engine, Audit Log, System Policies, Verification*

---

### [KIEU-01] Chặn quyền Unban của Moderator thông thường và bắt buộc nhập lý do (ADMIN-002, MOD-001)
- **Mô tả**: Moderator thông thường hiện tại có quyền mở khóa tài khoản bị cấm mà không cần thẩm quyền Super Admin và không bị bắt buộc nhập lý do unban.
- **Công việc**:
  - Tại `backend/src/modules/moderation/moderation.controller.ts`, gắn guard `requireSuperAdmin` hoặc kiểm tra quyền chuyên biệt `account:unban`.
  - Validate payload yêu cầu trường `reason` bắt buộc (tối thiểu 10 ký tự, không được để trống).
  - Ghi nhận `reason` vào bảng Audit Log và gửi thông báo giải thích cho người dùng.
- **Acceptance Criteria**:
  - Moderator thông thường gọi POST `/api/v1/moderation/users/:id/unban` nhận mã lỗi `403 Forbidden`.
  - Super Admin gọi unban không truyền `reason` nhận mã lỗi `400 Bad Request`.
  - Unban thành công với lý do hợp lệ: Tài khoản chuyển sang `ACTIVE` và bản ghi audit log được lưu đầy đủ.
- **Commit**: `feat(admin): enforce requireSuperAdmin and mandatory reason for account unban (ADMIN-002, MOD-001)`

---

### [KIEU-02] Thu hồi phiên làm việc và kiểm tra token generation khi unban (ADMIN-003)
- **Mô tả**: Sau khi tài khoản bị ban rồi được unban, access token cũ đã cấp trước thời điểm ban vẫn tiếp tục sử dụng được mà không cần đăng nhập lại.
- **Công việc**:
  - Cập nhật trường `tokenGeneration` hoặc `tokenVersion` trên model `User` khi tài khoản bị ban hoặc unban.
  - Cập nhật `backend/src/common/guards/auth.guard.ts` để kiểm tra `tokenVersion` trong JWT payload có khớp với DB hay không.
  - Thu hồi toàn bộ Refresh Token family của tài khoản khi unban.
- **Acceptance Criteria**:
  - Token cũ trước thời điểm ban khi gửi kèm header `Authorization: Bearer <old-token>` bị từ chối với mã lỗi `401 Unauthorized`.
  - Bắt buộc người dùng phải đăng nhập lại để nhận token mới.
- **Commit**: `feat(admin): implement session revocation and token generation check on unban (ADMIN-003)`

---

### [KIEU-03] Hỗ trợ cấu hình phân quyền chi tiết (Granular Grants) cho nhân viên (ADMIN-005)
- **Mô tả**: Moderator hiện bị áp đặt floor permission mặc định, không thể cấu hình phân quyền riêng lẻ (ví dụ chỉ cho duyệt tour `tour:validate` mà không cho phép giải quyết tranh chấp `dispute:resolve`).
- **Công việc**:
  - Mở rộng model phân quyền nhân viên để lưu danh sách quyền ghi đè (`grantedPermissions`, `revokedPermissions`).
  - Cập nhật `backend/src/common/guards/permissions.guard.ts` để ưu tiên effective grants thay vì chỉ kiểm tra role mặc định.
- **Acceptance Criteria**:
  - Khi gán Moderator chỉ có quyền `tour:validate`, Moderator truy cập endpoint tranh chấp nhận `403 Forbidden`.
  - Dashboard và UI ẩn các menu chức năng không thuộc effective permissions.
- **Commit**: `feat(admin): support granular staff permission grants overriding role defaults (ADMIN-005)`

---

### [KIEU-04] Xây dựng vòng đời tạo, kích hoạt và vô hiệu hóa tài khoản Moderator (ADMIN-006)
- **Mô tả**: Chưa có luồng mời và kích hoạt nhân viên chuẩn; hiện tại Admin chỉ đổi role của tài khoản có sẵn.
- **Công việc**:
  - Tạo endpoint POST `/api/v1/admin/staff/invite` gửi email chứa token kích hoạt an toàn (hết hạn sau 24h).
  - Tạo trang/endpoint kích hoạt để nhân viên thiết lập mật khẩu lần đầu.
  - Hỗ trợ trạng thái nhân viên: `INVITED`, `ACTIVE`, `DISABLED`.
- **Acceptance Criteria**:
  - Email gửi thư mời kích hoạt thành công kèm URL token một lần.
  - Nhân viên ở trạng thái `DISABLED` bị thu hồi toàn bộ session và không thể đăng nhập.
- **Commit**: `feat(admin): implement staff invitation and lifecycle activation tokens (ADMIN-006)`

---

### [KIEU-05] Khóa Database Transaction bảo vệ tài khoản Super Admin cuối cùng (ADMIN-007)
- **Mô tả**: Kiểm tra hạ cấp Super Admin hiện dựa trên đếm trước rồi cập nhật và rollback sau (post-write compensation), dễ bị race condition khi 2 admin cùng hạ quyền nhau.
- **Công việc**:
  - Dùng transaction cấp `SERIALIZABLE` hoặc câu lệnh `SELECT COUNT(*) ... FOR UPDATE` trong Prisma raw query khi cập nhật role Super Admin.
  - Ném lỗi `Cannot demote the last active Super Admin` ngay trong transaction trước khi commit.
- **Acceptance Criteria**:
  - Chạy đồng thời 2 request hạ cấp khi chỉ còn 1 Super Admin hoạt động: 1 request bị từ chối và hệ thống luôn đảm bảo còn ít nhất 1 Super Admin.
- **Commit**: `fix(admin): guard last Super Admin demotion with database serialization lock (ADMIN-007)`

---

### [KIEU-06] Snapshot phiên bản chính sách hủy tour tại thời điểm Booking (ADMIN-008)
- **Mô tả**: Khi Admin thay đổi chính sách hủy tour từ 24h lên 48h, chính sách mới bị áp dụng hồi tố cho cả các booking đã tạo trước đó.
- **Công việc**:
  - Thêm trường `cancellationPolicySnapshot` (JSON) vào bảng `Booking`.
  - Khi tạo booking, lưu nguyên vẹn chính sách hủy đang có hiệu lực.
  - Hàm hủy tour kiểm tra điều kiện hoàn tiền dựa trên snapshot này thay vì query chính sách mới nhất.
- **Acceptance Criteria**:
  - Booking tạo lúc chính sách 24h vẫn được phép hủy trước 30h mặc dù chính sách hệ thống vừa được nâng lên 48h.
- **Commit**: `feat(admin): snapshot dynamic cancellation policy version at booking time (ADMIN-008)`

---

### [KIEU-07] Quản lý phiên bản chính sách hệ thống dạng Append-only và Rollback (ADMIN-009)
- **Mô tả**: Cài đặt hệ thống ghi đè trực tiếp, thiếu lịch sử phiên bản, ngày có hiệu lực và chức năng rollback an toàn.
- **Công việc**:
  - Xây dựng model `PolicyVersion` với `versionNumber`, `effectiveFrom`, `reason`, `changesJson`.
  - Hỗ trợ thao tác rollback tạo ra một version mới thay vì sửa đổi bản ghi cũ.
- **Acceptance Criteria**:
  - Mỗi lần chỉnh sửa chính sách sinh ra 1 version mới.
  - Có thể tra cứu lịch sử thay đổi chính sách qua API và giao diện Admin.
- **Commit**: `feat(admin): implement append-only system policy versions and rollback workflow (ADMIN-009)`

---

### [KIEU-08] Đồng bộ cấu hình SLA kiểm duyệt và chấp thuận điều khoản (ADMIN-010)
- **Mô tả**: Cấu hình thời hạn SLA lưu dạng JSON nhưng chưa được kết nối vào luồng đếm giờ xử lý khiếu nại thực tế.
- **Công việc**:
  - Đọc cấu hình `moderation_sla_hours` từ bảng settings để tính toán `deadlineAt` khi khiếu nại được tạo hoặc leo thang.
  - Lưu version chính sách mà Agency/Traveler đã ấn đồng ý.
- **Acceptance Criteria**:
  - Khiếu nại tạo mới có trường `slaDeadlineAt` được tính chính xác theo cấu hình hệ thống hiện tại.
- **Commit**: `feat(admin): wire SLA settings and policy acceptance tracking into moderation (ADMIN-010)`

---

### [KIEU-09] Bổ sung trạng thái "Yêu cầu bổ sung thông tin" (Information Requested) cho Agency (ADMIN-011)
- **Mô tả**: Hiện quy trình duyệt Agency chỉ có Duyệt (Approve) hoặc Từ chối (Reject), thiếu bước yêu cầu bổ sung giấy phép/thông tin.
- **Công việc**:
  - Bổ sung trạng thái `INFORMATION_REQUESTED` vào `AgencyVerificationStatus`.
  - Cho phép Moderator nhập phản hồi yêu cầu tài liệu cụ thể.
  - Mở lại quyền nộp bổ sung hồ sơ cho Agency trên Portal.
- **Acceptance Criteria**:
  - Admin có nút "Yêu cầu bổ sung" kèm form nhập lý do.
  - Agency nhận thông báo, hồ sơ chuyển sang trạng thái cần bổ sung và cho phép cập nhật lại tài liệu.
- **Commit**: `feat(admin): add Agency Information-Requested workflow with comment submission (ADMIN-011)`

---

### [KIEU-10] Sắp xếp hàng đợi xét duyệt Agency theo thứ tự nộp cũ nhất trước (ADMIN-012)
- **Mô tả**: Hàng đợi duyệt Agency hiện sắp xếp theo ngày tạo tài khoản và lấy mới nhất lên đầu, khiến hồ sơ nộp từ lâu bị tồn đọng.
- **Công việc**:
  - Bổ sung trường `submittedAt` vào bảng hồ sơ Agency.
  - Sắp xếp hàng đợi theo `submittedAt ASC` (hồ sơ nộp trước duyệt trước - FIFO).
- **Acceptance Criteria**:
  - Danh sách hồ sơ chờ duyệt hiển thị theo thứ tự nộp tăng dần theo thời gian.
- **Commit**: `fix(admin): sort pending verification queue by oldest submission date (ADMIN-012)`

---

### [KIEU-11] Lọc các Widget trên Admin Dashboard theo quyền thực tế của nhân viên (ADMIN-013)
- **Mô tả**: Tất cả nhân viên đều thấy toàn bộ widget tổng quan dù không có quyền xem tài chính hay khiếu nại.
- **Công việc**:
  - Phân tích quyền của token tại server và chỉ trả về dữ liệu của các widget được phép xem.
  - Ẩn component widget tương ứng ở phía frontend.
- **Acceptance Criteria**:
  - Moderator chỉ có quyền duyệt tour không thấy số liệu doanh thu hoặc số lượng tranh chấp tài chính.
- **Commit**: `feat(admin): filter dashboard tiles and metrics by effective staff permissions (ADMIN-013)`

---

### [KIEU-12] Chặn Super Admin ban tài khoản nhân viên (ADMIN-014)
- **Mô tả**: Luồng Ban tài khoản thông thường (UC-54) áp dụng cho người dùng nhưng hiện tại gọi được cho cả Moderator, gây nhầm lẫn quy trình kỷ luật nhân sự.
- **Công việc**:
  - Kiểm tra `role` của target user trong API ban tài khoản; nếu là `MODERATOR` hoặc `ADMIN` thì ném lỗi `400 Bad Request`.
  - Điều hướng thao tác sang endpoint `/api/v1/admin/staff/:id/disable`.
- **Acceptance Criteria**:
  - Gọi ban một Moderator trả về lỗi yêu cầu dùng chức năng vô hiệu hóa nhân sự chuyên biệt.
- **Commit**: `fix(admin): prevent direct ban on staff accounts and enforce dedicated disable action (ADMIN-014)`

---

### [KIEU-13] Bắt buộc email đã xác thực trước khi cấp quyền Staff (ADMIN-015)
- **Mô tả**: Tài khoản người dùng chưa xác thực email vẫn có thể được Super Admin gán quyền Moderator.
- **Công việc**:
  - Trong hàm gán role (`assignAccess`), kiểm tra `emailVerifiedAt != null`.
  - Trả về mã lỗi `400 Bad Request` kèm thông báo nếu email chưa xác thực.
- **Acceptance Criteria**:
  - Gán quyền nhân viên cho tài khoản chưa verify email bị chặn và thông báo rõ ràng.
- **Commit**: `feat(admin): require verified email before granting staff privileges (ADMIN-015)`

---

### [KIEU-14] Bảo vệ form chỉnh sửa cấu hình hệ thống bằng Optimistic Lock (ADMIN-016)
- **Mô tả**: Hai Admin cùng mở trang cài đặt, người thứ hai lưu sẽ ghi đè toàn bộ thay đổi của người thứ nhất mà không có cảnh báo.
- **Công việc**:
  - Gửi kèm `version` hoặc `updatedAt` khi lưu cài đặt.
  - Nếu `version` gửi lên khác với DB, trả về lỗi `409 Conflict`.
- **Acceptance Criteria**:
  - Người lưu sau nhận thông báo dữ liệu đã bị thay đổi bởi quản trị viên khác kèm tùy chọn nạp lại dữ liệu.
- **Commit**: `feat(admin): implement optimistic concurrency lock on admin settings editors (ADMIN-016)`

---

### [KIEU-15] Bổ sung Integration Test Suite cho quyền Staff và Unban Guards (ADMIN-017, ADMIN-018)
- **Mô tả**: Các điều kiện biên kiểm soát phân quyền staff và unban chưa có test tự động trong CI.
- **Công việc**:
  - Tạo file test `backend/tests/integration/admin-staff.test.ts`.
  - Viết test case: Moderator không thể unban, không thể unban thiếu lý do, không thể hạ quyền Super Admin cuối cùng.
- **Acceptance Criteria**:
  - Chạy `pnpm test admin-staff` pass 100% trên môi trường test database.
- **Commit**: `test(admin): add regression test suites for staff permissions and unban guards (ADMIN-017, ADMIN-018)`

---

### [KIEU-16] Bảo mật Endpoint đăng ký Agency, loại bỏ quyền ghi qua Email (AUTH-001)
- **Mô tả**: Khách vãng lai có thể đọc và ghi đè hồ sơ đăng ký Agency bị từ chối chỉ bằng việc truyền query `?email=...` mà không cần token xác thực.
- **Công việc**:
  - Xóa bỏ cơ chế ủy quyền chỉ qua email ở route `/auth/agency/application`.
  - Bắt buộc phải có scoped onboarding token hoặc session đăng nhập của chính Agency đó.
- **Acceptance Criteria**:
  - Khách gọi GET hoặc PUT `/auth/agency/application?email=...` không có token trả về `401 Unauthorized`.
- **Commit**: `fix(auth): secure agency application endpoints and eliminate guest email rewrites (AUTH-001)`

---

### [KIEU-17] Khóa chỉnh sửa thông tin pháp lý của Agency đã được Verified (AUTH-007)
- **Mô tả**: Agency đã có tick xanh (`VERIFIED`) có thể tự ý sửa tên công ty và số giấy phép kinh doanh qua PATCH `/users/me` mà không cần duyệt lại.
- **Công việc**:
  - Tạo danh sách các trường nhạy cảm: `companyName`, `businessLicense`, `taxId`.
  - Nếu Agency đang ở trạng thái `VERIFIED` mà chỉnh sửa các trường này, tự động chuyển trạng thái về `PENDING_REVIEW` hoặc chặn cập nhật trực tiếp.
- **Acceptance Criteria**:
  - Sửa thông tin pháp lý yêu cầu nộp hồ sơ xét duyệt lại, không duy trì tick xanh trái phép.
- **Commit**: `fix(auth): restrict verified agency identity edits without re-verification (AUTH-007)`

---

### [KIEU-18] Chuẩn hóa endpoint xóa Website và Avatar của Agency (AUTH-014)
- **Mô tả**: Thao tác xóa website và avatar của Agency trên UI gọi contract API không hợp lệ gây lỗi `403/400`.
- **Công việc**:
  - Cho phép truyền giá trị `null` hoặc chuỗi rỗng đối với trường `website` trong schema validation.
  - Cung cấp endpoint DELETE `/users/me/avatar` hỗ trợ role Agency.
- **Acceptance Criteria**:
  - Agency có thể xóa website hoặc xóa ảnh đại diện thành công mà không gặp lỗi server.
- **Commit**: `fix(auth): align agency website clearing and avatar removal endpoints (AUTH-014)`

---

### [KIEU-19] Bổ sung Diff Before/After vào Audit Log kiểm duyệt (MOD-012)
- **Mô tả**: Audit Log hiện chỉ lưu tên hành động mà không lưu chi tiết dữ liệu trước và sau khi thay đổi, gây khó khăn cho việc truy vết vi phạm.
- **Công việc**:
  - Bổ sung schema lưu payload: `{ before: {...}, after: {...}, reason: string }`.
  - Tự động lọc bỏ các trường nhạy cảm (password, token) trước khi ghi log.
- **Acceptance Criteria**:
  - Bản ghi audit hiển thị rõ ràng giá trị cũ và giá trị mới của các trường đã được sửa đổi.
- **Commit**: `feat(audit): ensure moderation audit logs record before-and-after change diffs (MOD-012)`

---

### [KIEU-20] Đảm bảo ghi Audit Log nguyên tử cùng Transaction với trạng thái kiểm duyệt (PROFILE-002, MOD-008)
- **Mô tả**: Hiện tại việc ghi log thực hiện độc lập sau khi đổi trạng thái; nếu logger lỗi thì trạng thái đã đổi nhưng audit log bị mất hoàn toàn.
- **Công việc**:
  - Đưa thao tác insert `AuditLog` vào chung khối `prisma.$transaction` với thao tác cập nhật trạng thái đối tượng.
- **Acceptance Criteria**:
  - Nếu ghi log thất bại, toàn bộ cập nhật bị rollback, đảm bảo không có trạng thái kiểm duyệt nào thiếu audit log.
- **Commit**: `fix(audit): persist moderation audit atomically in transaction with state update (PROFILE-002, MOD-008)`

---

### [KIEU-21] Bổ sung bộ lọc chỉ mục, tìm kiếm và số lượng báo cáo cho Moderation List (MOD-009)
- **Mô tả**: Danh sách kiểm duyệt thiếu bộ lọc theo loại vi phạm, khoảng thời gian và số lượng báo cáo tích lũy.
- **Công việc**:
  - Viết câu query tối ưu có kèm index cho các trường `status`, `targetType`, `createdAt`.
  - Trả về trường `totalReportsCount` đi kèm từng mục cần duyệt.
- **Acceptance Criteria**:
  - Moderator lọc được danh sách theo số lượng báo cáo giảm dần, thời gian xử lý nhanh dưới 200ms.
- **Commit**: `feat(moderation): add server-side indexed filters, search and report counts (MOD-009)`

---

### [KIEU-22] Yêu cầu nhận xử lý (Claim) và ghi chú khi đóng Support Ticket (MOD-010)
- **Mô tả**: Nhân viên có thể trực tiếp đổi trạng thái vé hỗ trợ thành `RESOLVED` mà không cần nhận vé và không để lại ghi chú giải quyết.
- **Công việc**:
  - Bắt buộc vé phải được gán `assignedToStaffId` trước khi giải quyết.
  - Yêu cầu nhập trường `resolutionNote` khi chuyển sang `RESOLVED`.
- **Acceptance Criteria**:
  - Vé chưa được claim hoặc đóng không có lý do sẽ bị server từ chối với thông báo hướng dẫn cụ thể.
- **Commit**: `feat(moderation): require staff claim and mandatory resolution note for support tickets (MOD-010)`

---

### [KIEU-23] Xử lý trạng thái lỗi độc lập cho Widget khiếu nại leo thang (MOD-011)
- **Mô tả**: Khi API lấy số lượng khiếu nại leo thang bị lỗi mạng, dashboard tự ý hiển thị số 0 khiến Moderator tưởng không có ca nào cần xử lý.
- **Công việc**:
  - Tách biệt trạng thái `isError` và hiển thị badge "Lỗi tải dữ liệu - Bấm để thử lại" thay vì ép về số 0.
- **Acceptance Criteria**:
  - Mock lỗi mạng API khiếu nại: Widget hiển thị icon cảnh báo và nút thử lại, không hiển thị số 0 giả mạo.
- **Commit**: `fix(moderation): display distinct error state for failed escalated-complaint queries (MOD-011)`

---

### [KIEU-24] Loại bỏ trường nội bộ phân quyền khỏi Private Profile DTO (PROFILE-015)
- **Mô tả**: Endpoint GET `/users/me` của Traveler vô tình trả về các cờ nội bộ về quyền hạn hệ thống không cần thiết.
- **Công việc**:
  - Dùng DTO serializer loại bỏ các trường nội bộ của hệ thống phân quyền trước khi trả về cho client thông thường.
- **Acceptance Criteria**:
  - Kiểm tra response GET `/users/me`: Chỉ chứa thông tin profile cá nhân hợp lệ, không chứa internals.
- **Commit**: `fix(profile): sanitize private profile DTO to exclude internal permissions (PROFILE-015)`

---

### [KIEU-25] Bổ sung biểu đồ xu hướng SLA và tải công việc trên Dashboard (DASH-001)
- **Mô tả**: Dashboard của Moderator thiếu biểu đồ theo dõi xu hướng xử lý vi phạm và tỷ lệ đáp ứng cam kết SLA theo ngày/tuần.
- **Công việc**:
  - Tạo service aggregate số lượng vụ việc theo trạng thái (`ON_TIME`, `NEAR_OVERDUE`, `BREACHED`).
  - Dựng component biểu đồ trực quan hóa dữ liệu trên Admin Dashboard.
- **Acceptance Criteria**:
  - Dashboard hiển thị biểu đồ thống kê SLA trực quan theo các mốc 7 ngày / 30 ngày.
- **Commit**: `feat(dashboard): add SLA workload trends and isolated aggregation metrics (DASH-001)`

---

### [KIEU-26] Xây dựng chức năng xuất dữ liệu kiểm duyệt và Audit Log an toàn (DASH-002)
- **Mô tả**: Quản trị viên chưa có công cụ xuất báo cáo kiểm duyệt ra định dạng CSV/Excel để phục vụ thanh tra.
- **Công việc**:
  - Tạo endpoint GET `/api/v1/admin/export/audit-logs` có phân quyền chặt chẽ (`requireSuperAdmin`).
  - Hỗ trợ xuất dữ liệu dạng stream để tránh tràn bộ nhớ khi dữ liệu lớn.
- **Acceptance Criteria**:
  - Xuất file CSV thành công, dữ liệu được format đúng chuẩn tiếng Việt UTF-8.
- **Commit**: `feat(dashboard): implement secure moderation and audit log data export (DASH-002)`

---

### [KIEU-27] Tự động làm mới dữ liệu Dashboard mỗi giờ trên màn hình nhàn rỗi (DASH-003)
- **Mô tả**: Màn hình Dashboard mở liên tục trên máy trực ban của Moderator không tự động cập nhật số liệu mới nếu không F5.
- **Công việc**:
  - Cấu hình polling interval an toàn (hoặc revalidate on window focus) với chu kỳ 1 giờ.
  - Hiển thị nhãn "Dữ liệu cập nhật lúc: hh:mm".
- **Acceptance Criteria**:
  - Màn hình tự động refetch số liệu mới sau 60 phút nhàn rỗi mà không làm mất trạng thái bộ lọc đang chọn.
- **Commit**: `feat(dashboard): implement idle screen hourly refresh and freshness indicator (DASH-003)`

---

### [KIEU-28] Gửi email thông báo và mã theo dõi khi xử lý xong yêu cầu hỗ trợ (SUP-001, SUP-002)
- **Mô tả**: Khi nhân viên đổi trạng thái vé hỗ trợ xong, người dùng không nhận được email thông báo và hệ thống thiếu mã tracking code thân thiện (`TRIP-xxxx`).
- **Công việc**:
  - Sinh mã theo dõi dạng ngắn dễ đọc khi tạo vé (ví dụ: `SUP-2026-8891`).
  - Bắn email thông báo cho người dùng khi vé được đánh dấu hoàn thành kèm mã tra cứu.
- **Acceptance Criteria**:
  - Người dùng nhận email thông báo kết quả giải quyết có chứa mã vé định dạng chuẩn.
- **Commit**: `feat(support): add email notification on support resolution and track human codes (SUP-001, SUP-002)`

---

## 2. PHÂN CÔNG KHIÊM (`Danny Loid`) - 23 TICKETS
*Lĩnh vực: Tour Guide Workflow, E-Tickets & Check-in Roster, Payouts, Reviews & AI Assistant*

---

### [KHIEM-01] Xây dựng luồng đăng ký và xác thực tài khoản nhận Payout của Hướng dẫn viên (GUIDE-001)
- **Mô tả**: Hướng dẫn viên chưa có giao diện và API an toàn để nhập/sửa thông tin tài khoản ngân hàng nhận lương/thù lao.
- **Công việc**:
  - Tạo model `GuidePayoutAccount` liên kết với Guide (tên ngân hàng, số tài khoản, tên thụ hưởng).
  - Viết API đọc/cập nhật thông tin tài khoản với mã hóa dữ liệu nhạy cảm.
- **Acceptance Criteria**:
  - Hướng dẫn viên cập nhật được tài khoản ngân hàng, thông tin được che mờ (masking) khi hiển thị lại.
- **Commit**: `feat(guide): implement guide payout account registration and validation flow (GUIDE-001)`

---

### [KHIEM-02] Kiểm tra xung đột lịch trình và tính khả dụng của HDV khi Booking (GUIDE-002)
- **Mô tả**: Hệ thống cho phép thanh toán tour ngay cả khi HDV được phân công đã bị trùng lịch với chuyến đi khác trong cùng khung giờ.
- **Công việc**:
  - Kiểm tra tính sẵn sàng của HDV trước khi xác nhận tạo đơn hàng giữ chỗ.
  - Nếu HDV bị bận, cảnh báo cho điều hành tour hoặc ngăn chặn đặt lịch trùng lặp.
- **Acceptance Criteria**:
  - Đặt tour có HDV đã có lịch phân công trùng ngày sẽ bị chặn với thông báo phù hợp.
- **Commit**: `feat(guide): validate guide availability and itinerary collision during booking (GUIDE-002)`

---

### [KHIEM-03] Hỗ trợ tải lên và xóa ảnh đại diện Hướng dẫn viên qua Cloudinary Picker (GUIDE-003)
- **Mô tả**: Chức năng upload/xóa avatar trên app HDV bị chặn quyền do chưa định nghĩa quyền thao tác media cho role Guide.
- **Công việc**:
  - Bổ sung quyền thao tác avatar trong media controller cho role `TOUR_GUIDE`.
  - Cập nhật UI màn hình hồ sơ HDV trên Flutter để chọn ảnh từ thư viện và gọi API cập nhật.
- **Acceptance Criteria**:
  - HDV có thể thay đổi hoặc xóa ảnh đại diện thành công trên ứng dụng di động.
- **Commit**: `feat(guide): support secure avatar upload and removal via Cloudinary picker (GUIDE-003)`

---

### [KHIEM-04] Ràng buộc chặt chẽ định dạng giờ phút trong bộ chọn lịch rảnh của HDV (PROFILE-005)
- **Mô tả**: Validator cho phép lưu khung giờ bất hợp lý như `99:99` hoặc giờ bắt đầu lớn hơn giờ kết thúc.
- **Công việc**:
  - Sử dụng Zod/Regex kiểm tra định dạng giờ `HH:mm` (giờ: 00-23, phút: 00-59).
  - Đảm bảo `startTime < endTime` và không chồng lấn khung giờ trong cùng 1 ngày.
- **Acceptance Criteria**:
  - Nhập giờ `99:99` bị validator từ chối ngay tại backend với lỗi rõ ràng.
- **Commit**: `fix(guide): validate hour and minute range strictly in free-time slot picker (PROFILE-005)`

---

### [KHIEM-05] Nâng cấp bộ lọc trạng thái và thanh tác vụ danh sách Tour được phân công của HDV (PROFILE-012)
- **Mô tả**: Màn hình danh sách tour của HDV thiếu bộ lọc theo trạng thái (Sắp diễn ra, Đang diễn ra, Đã hoàn tất) và thiếu nút mở nhanh danh sách khách.
- **Công việc**:
  - Cập nhật giao diện `guide_tours_screen.dart` với thanh tab filter trực quan.
  - Bổ sung nút "Xem danh sách đoàn" và "Mở quét QR vé".
- **Acceptance Criteria**:
  - HDV chuyển đổi mượt mà giữa các tab tour và lọc chính xác các chuyến đi.
- **Commit**: `feat(guide): enhance assigned-tour filters, status badges, and action bar (PROFILE-012)`

---

### [KHIEM-06] Xây dựng máy quét QR vé và bảng danh sách đoàn bảo mật thông tin (BOOK-008)
- **Mô tả**: HDV chưa có giao diện quét mã QR vé của khách và danh sách đoàn để điểm danh bảo mật (không lộ SĐT/Email nhạy cảm của khách).
- **Công việc**:
  - Tạo màn hình quét QR dùng camera trên app Flutter, gọi API POST `/api/v1/e-tickets/scan`.
  - Roster chỉ hiển thị: Tên khách, số lượng ghế, trạng thái vé (`VALID`, `CHECKED_IN`), ẩn bớt SĐT.
- **Acceptance Criteria**:
  - Quét mã QR hợp lệ: Đổi trạng thái vé sang `USED`/`CHECKED_IN`, rung phản hồi và phát âm thanh thành công. Quét lại lần 2 báo `TICKET_ALREADY_USED`.
- **Commit**: `feat(guide): implement QR ticket scanner and privacy-preserving roster view (BOOK-008)`

---

### [KHIEM-07] Xây dựng màn hình danh sách và lịch sử vé điện tử dành cho Traveler (BOOK-013)
- **Mô tả**: Khách du lịch thiếu trang tổng hợp toàn bộ vé điện tử đã mua và mã QR để xuất trình khi lên xe.
- **Công việc**:
  - Tạo trang `/traveler/tickets` trên web và màn hình vé trên mobile.
  - Hiển thị danh thiếp vé điện tử có mã QR động, tên tour, ngày khởi hành và điểm đón.
- **Acceptance Criteria**:
  - Khách du lịch mở được vé điện tử offline/online và hiển thị rõ ràng mã QR cho HDV quét.
- **Commit**: `feat(e-tickets): implement dedicated /traveler/tickets list and history view (BOOK-013)`

---

### [KHIEM-08] Chặn xung đột phát hành vé khi đơn hàng bị hủy đồng thời (BOOK-003)
- **Mô tả**: Khi thanh toán chậm, tiến trình phát hành vé có thể chạy song song với tiến trình hủy đơn hết hạn, dẫn đến tình trạng đơn bị hủy nhưng vé vẫn ở trạng thái `VALID`.
- **Công việc**:
  - Kiểm tra trạng thái đơn hàng là `CONFIRMED` ngay trong câu lệnh tạo vé điện tử.
  - Nếu đơn hàng đã chuyển `CANCELLED`, hủy ngay tiến trình xuất vé.
- **Acceptance Criteria**:
  - Mô phỏng request hủy đơn trước khi xuất vé: Vé không được tạo và hệ thống báo lỗi xung đột.
- **Commit**: `fix(e-tickets): prevent ticket issuance race condition against cancellation (BOOK-003)`

---

### [KHIEM-09] Chặn hoàn thành tour và mở khóa đánh giá khi chuyến đi chưa kết thúc (BOOK-012, TOUR-008)
- **Mô tả**: Khách hoặc Agency có thể bấm hoàn thành tour và gửi review ngay trong khi ngày khởi hành vẫn còn ở tương lai.
- **Công việc**:
  - Trong logic hoàn thành tour (`completeMine` / `completeTour`), kiểm tra `departure.endDate <= now()`.
  - Chỉ mở quyền tạo review khi chuyến đi đã thực sự kết thúc về mặt thời gian.
- **Acceptance Criteria**:
  - Bấm hoàn thành tour cho departure ngày mai sẽ bị từ chối với thông báo "Chuyến đi chưa kết thúc".
- **Commit**: `fix(e-tickets): prevent completion and review unlock before tour departure ends (BOOK-012, TOUR-008)`

---

### [KHIEM-10] Tự động thử lại khi tiến trình phát hành vé điện tử gặp sự cố (PAY-004)
- **Mô tả**: Sau khi thanh toán thành công, nếu listener xuất vé bị crash thì đơn hàng bị đánh dấu hoàn tất nhưng khách không bao giờ nhận được vé.
- **Công việc**:
  - Lưu trạng thái thực hiện (`fulfillmentStatus: PENDING | COMPLETED | FAILED`).
  - Xây dựng cron worker quét lại các đơn thanh toán thành công nhưng chưa có vé sau 3 phút để tự động bù vé.
- **Acceptance Criteria**:
  - Khi cố tình ngắt kết nối lúc tạo vé, worker nền tự động chạy bù vé sau khi kết nối phục hồi.
- **Commit**: `fix(payout): retry failed e-ticket issuance and mark fulfillment asynchronously (PAY-004)`

---

### [KHIEM-11] Xây dựng Ledger bảng kê rút tiền và theo dõi thanh toán cho HDV (PAY-018)
- **Mô tả**: Chưa có sổ cái ghi nhận lịch sử các khoản thù lao tour của HDV, trạng thái chuyển tiền (`PENDING`, `TRANSFERRED`).
- **Công việc**:
  - Tạo model `GuidePayoutLedger` (mã giao dịch, HDV ID, số tiền, tour ID, ngày chi trả).
  - Cung cấp API và giao diện màn hình theo dõi thu nhập trên app HDV.
- **Acceptance Criteria**:
  - HDV xem được chi tiết từng khoản thu nhập theo từng tour đã hoàn thành.
- **Commit**: `feat(payout): introduce payout ledger database model and monitor endpoints (PAY-018)`

---

### [KHIEM-12] Tính toán lại điểm trung bình đánh giá (Rating) nguyên tử (REVIEW-001)
- **Mô tả**: Khi người dùng gửi đánh giá, review được lưu nhưng bước tính lại điểm trung bình tour bị lỗi khiến số sao hiển thị sai lệch vĩnh viễn.
- **Công việc**:
  - Đưa việc lưu review và tính lại `averageRating`, `totalReviews` vào chung transaction hoặc queue xử lý đáng tin cậy.
- **Acceptance Criteria**:
  - Gửi review thành công luôn cập nhật đúng số sao trung bình trên trang chi tiết tour.
- **Commit**: `feat(reviews): atomic rating recalculation and durable review persistence (REVIEW-001)`

---

### [KHIEM-13] Bổ sung kiểm tra Revision Token khi duyệt đánh giá của khách (REVIEW-002)
- **Mô tả**: Moderator phê duyệt một nội dung đánh giá dựa trên bản xem cũ, trong khi khách đã kịp sửa nội dung sang ngôn từ vi phạm trước thời điểm duyệt.
- **Công việc**:
  - Gửi kèm `contentVersion` hoặc hash nội dung khi Moderator bấm phê duyệt.
  - Nếu nội dung đã bị thay đổi, từ chối quyết định duyệt và yêu cầu tải lại.
- **Acceptance Criteria**:
  - Phê duyệt trên bản cũ bị từ chối với mã lỗi `409 Conflict`.
- **Commit**: `feat(reviews): add revision token validation to review moderation decisions (REVIEW-002)`

---

### [KHIEM-14] Ghi nhận Audit Log nguyên tử khi ẩn hoặc hiển thị đánh giá (REVIEW-003)
- **Mô tả**: Thao tác ẩn đánh giá vi phạm lưu thành công trạng thái `HIDDEN` nhưng audit log thất bại khiến không ai biết ai đã ẩn đánh giá đó.
- **Công việc**:
  - Gộp thao tác đổi `visibility` và tạo bản ghi `AuditLog` vào một transaction.
- **Acceptance Criteria**:
  - Mọi thao tác ẩn/hiện đánh giá luôn có vết trong Audit Log với ID của Moderator thực hiện.
- **Commit**: `fix(reviews): audit review visibility hide/restore decisions atomically (REVIEW-003)`

---

### [KHIEM-15] Bắt buộc nhập lý do giải thích khi khôi phục đánh giá bị ẩn (REVIEW-008)
- **Mô tả**: Moderator có thể mở lại một đánh giá từng bị báo cáo vi phạm mà không cần ghi rõ lý do tại sao review đó hợp lệ.
- **Công việc**:
  - Thêm trường `restorationReason` bắt buộc trong body của request bỏ ẩn review.
- **Acceptance Criteria**:
  - Bỏ ẩn review mà không điền lý do sẽ nhận lỗi `400 Bad Request`.
- **Commit**: `feat(reviews): require mandatory explanation reason when restoring hidden reviews (REVIEW-008)`

---

### [KHIEM-16] Gửi thông báo đến người đánh giá và Agency khi review được kiểm duyệt (REVIEW-009)
- **Mô tả**: Khi đánh giá bị gỡ bỏ hoặc chấp thuận, cả người viết và chủ tour đều không nhận được thông báo giải thích.
- **Công việc**:
  - Tích hợp notification service bắn thông báo in-app và email cho cả hai bên khi có quyết định kiểm duyệt.
- **Acceptance Criteria**:
  - Khi review bị ẩn vì vi phạm, khách nhận được thông báo nêu rõ điều khoản vi phạm.
- **Commit**: `feat(reviews): send notifications to reviewer and agency upon review action (REVIEW-009)`

---

### [KHIEM-17] Tách riêng hàng đợi xử lý đánh giá bị báo cáo với hành động Giữ/Gỡ (REVIEW-007)
- **Mô tả**: Các review bị khách/Agency báo cáo đang nằm lẫn với hàng đợi duyệt tour chung, thiếu nút xử lý nhanh (Giữ lại hoặc Gỡ bỏ).
- **Công việc**:
  - Xây dựng component `ReviewModerationQueue.tsx` hiển thị số lượt báo cáo, lý do báo cáo và 2 nút hành động "Giữ lại" / "Gỡ bỏ".
- **Acceptance Criteria**:
  - Moderator xử lý khiếu nại review dễ dàng với đầy đủ ngữ cảnh báo cáo.
- **Commit**: `feat(reviews): separate reported-review triage queue with Keep/Remove actions (REVIEW-007)`

---

### [KHIEM-18] Bổ sung giao diện xem trước hồ sơ công khai của HDV và chỉ số 2FA (REVIEW-004)
- **Mô tả**: HDV không có màn hình xem trước trang cá nhân của mình hiển thị thế nào trong mắt khách du lịch và thiếu trạng thái bảo mật 2 lớp.
- **Công việc**:
  - Tạo component preview trang công khai của HDV (kinh nghiệm, tour phụ trách, đánh giá của khách).
  - Hiển thị huy hiệu "Đã kích hoạt bảo mật 2 lớp" nếu HDV đã bật 2FA.
- **Acceptance Criteria**:
  - HDV bấm xem trước trang cá nhân thấy đúng giao diện khách nhìn thấy.
- **Commit**: `feat(guide): add public guide profile preview and 2FA indicator (REVIEW-004)`

---

### [KHIEM-19] Xây dựng màn hình gửi yêu cầu hỗ trợ (Support Ticket) cho Traveler (BOOK-004)
- **Mô tả**: Khách du lịch hiện chỉ có form báo cáo vi phạm/khiếu nại tranh chấp, thiếu form gửi thắc mắc hỗ trợ dịch vụ thông thường.
- **Công việc**:
  - Tạo màn hình `traveler_support_ticket_screen.dart` trên Flutter với danh mục hỗ trợ: Đặt tour, Thanh toán, Tài khoản, Khác.
  - Kết nối với API tạo vé hỗ trợ khách hàng.
- **Acceptance Criteria**:
  - Khách gửi yêu cầu hỗ trợ thành công và nhận mã phản hồi.
- **Commit**: `feat(support): implement traveler support ticket submission UI (BOOK-004)`

---

### [KHIEM-20] Lưu bản nháp đánh giá vào bộ nhớ cục bộ tránh mất dữ liệu khi rerender (BOOK-009, BOOK-010)
- **Mô tả**: Khi đang viết đánh giá dở mà component nhận prop mới hoặc người dùng vô tình bấm tải lại, toàn bộ nội dung đánh giá và ảnh đính kèm bị xóa sạch.
- **Công việc**:
  - Lưu nội dung đang nhập vào SharedPreferences / LocalStorage theo `bookingId`.
  - Khôi phục nội dung tự động khi mở lại dialog đánh giá.
- **Acceptance Criteria**:
  - Đóng dialog đánh giá và mở lại: Nội dung và số sao đã chọn vẫn còn nguyên vẹn.
- **Commit**: `fix(reviews): persist review draft in local storage across prop rerenders (BOOK-009, BOOK-010)`

---

### [KHIEM-21] Tích hợp chỉ báo đang soạn tin nhắn (Typing Indicator) cho HDV (CHAT-002)
- **Mô tả**: Khung chat giữa HDV và khách chưa hiển thị hiệu ứng "Đang nhập tin nhắn...", gây khó khăn khi giao tiếp trực tiếp.
- **Công việc**:
  - Bắt sự kiện `onChanged` trên ô chat, emit socket event `typing` (có debounce 500ms).
  - Hiển thị animation 3 dấu chấm khi đối phương đang soạn thảo.
- **Acceptance Criteria**:
  - Khi khách đang gõ tin nhắn, app HDV hiển thị chỉ báo đang nhập trong thời gian thực.
- **Commit**: `feat(chat): wire real-time typing indicators into guide chat transport (CHAT-002)`

---

### [KHIEM-22] Tích hợp hộp thư hội thoại và trạng thái đọc cho Trợ lý ảo AI (AI-001)
- **Mô tả**: Chưa có giao diện lưu lịch sử các phiên chat với AI và quản lý trạng thái đã đọc/chưa đọc cho các gợi ý từ trợ lý.
- **Công việc**:
  - Tạo danh sách các cuộc hội thoại AI đã lưu theo chủ đề (ví dụ: "Lịch trình Đà Nẵng 3N2Đ").
  - Quản lý trạng thái đọc cho các tin nhắn do AI phản hồi.
- **Acceptance Criteria**:
  - Khách du lịch xem lại được lịch sử các đoạn chat cũ với AI và tiếp tục cuộc trò chuyện.
- **Commit**: `feat(ai): integrate AI assistant conversation inbox and unread state management (AI-001)`

---

### [KHIEM-23] Xử lý lỗi phản hồi bị cắt cụt từ nhà cung cấp Anthropic AI (PROFILE-003)
- **Mô tả**: Khi câu trả lời của Claude/Anthropic bị chạm trần token (`stop_reason: max_tokens`), hệ thống vẫn lưu câu trả lời dở dang vào DB như một phản hồi thành công.
- **Công việc**:
  - Kiểm tra `stop_reason` trong kết quả trả về từ Anthropic API.
  - Nếu là `max_tokens`, gắn cờ yêu cầu tiếp tục sinh câu trả lời hoặc báo cho client biết nội dung chưa hoàn chỉnh.
- **Acceptance Criteria**:
  - Tin nhắn bị cắt ngắn không được xem là hoàn tất và có nút "Tiếp tục tạo..." cho người dùng.
- **Commit**: `fix(ai): validate Anthropic stop reason to reject truncated AI responses (PROFILE-003)`

---

## 3. PHÂN CÔNG KHOA (`khoale142`) - 22 TICKETS
*Lĩnh vực: Promotions & Vouchers, Financial Commission, Complaints Lifecycle, Tour Re-moderation*

---

### [x] [KHOA-01] Mở rộng phạm vi lưu trữ tiền tệ vượt giới hạn số nguyên 32-bit (ADMIN-004, PAY-008) *(Đã xử lý)*
- **Trạng thái**: ✅ Đã xử lý (PR #61 - `18f7063`)
- **Mô tả**: Tổng giá tiền cho đoàn đông người (ví dụ: 50 khách × 50,000,000 VND = 2,500,000,000 VND) vượt quá cận trên của kiểu `Int32` (2.14 tỷ), gây lỗi tràn số ở DB.
- **Công việc**:
  - Thay đổi kiểu dữ liệu cột giá tiền và chiết khấu trong Prisma schema sang `BigInt` hoặc `Decimal`.
  - Validate giá trị hợp lệ ở tầng ứng dụng với giá trị tối đa 100 tỷ VND.
- **Acceptance Criteria**:
  - Đặt tour với tổng giá trị trên 2.5 tỷ VND lưu trữ thành công vào cơ sở dữ liệu mà không bị crash.
- **Commit**: `fix(pricing): expand monetary bounds and arithmetic beyond Int32 limit (ADMIN-004, PAY-008)`

---

### [x] [KHOA-02] Lưu bản ghi riêng biệt cho từng Voucher khi áp dụng đồng thời (PAY-001, PAY-014) *(Đã xử lý)*
- **Trạng thái**: ✅ Đã xử lý (`75bb8c5` / `0b86a72`)
- **Mô tả**: Khi người dùng áp dụng gộp 1 mã của sàn và 1 mã của Agency, hệ thống chỉ lưu ID của mã Agency, làm mất thông tin hoàn mã sàn khi hủy đơn và bypass giới hạn 1 lần/khách.
- **Công việc**:
  - Tạo bảng `PromotionRedemption` lưu từng voucher được áp dụng cho mỗi đơn hàng (`bookingId`, `promotionId`, `discountAmount`).
  - Khi hủy đơn, hoàn lại tất cả các mã có trong bảng redemption.
- **Acceptance Criteria**:
  - Khách áp dụng 2 mã giảm giá cùng lúc: Cả 2 mã đều được ghi nhận vào lịch sử dùng và không thể dùng lại mã sàn vượt quá giới hạn cho phép.
- **Commit**: `feat(promotions): record separate PromotionRedemption instances for stacked vouchers (PAY-001, PAY-014)`

---

### [x] [KHOA-03] Tiêu thụ nguyên tử mã giảm giá phát hành theo đợt duy nhất (PAY-013) *(Đã xử lý)*
- **Trạng thái**: ✅ Đã xử lý (PR #61 - `5bb570a`)
- **Mô tả**: Mã voucher phát hành dạng batch (mỗi khách 1 code riêng) không bao giờ bị đánh dấu là đã sử dụng (`consumeCodeInstance` không được gọi), dẫn đến mã có thể tái sử dụng vô hạn.
- **Công việc**:
  - Gọi hàm `consumeCodeInstance(codeId, userId)` trong cùng transaction tạo đơn hàng.
  - Đánh dấu trạng thái mã thành `USED` và lưu thời gian sử dụng.
- **Acceptance Criteria**:
  - Thử dùng lại một mã unique code sau khi đã đặt hàng: Hệ thống báo lỗi "Mã giảm giá đã được sử dụng".
- **Commit**: `fix(promotions): atomically consume and track unique-batch voucher instances (PAY-013)`

---

### [x] [KHOA-04] Ràng buộc hạn mức sử dụng và Quota khuyến mãi trong một Transaction duy nhất (PAY-017) *(Đã xử lý)*
- **Trạng thái**: ✅ Đã xử lý (`eda2388` / `40ef02d`)
- **Mô tả**: Việc kiểm tra số lượng mã còn lại thực hiện bằng lệnh đọc riêng rẽ trước khi tạo đơn, gây lỗi Race condition khi hàng trăm người cùng ấn áp dụng mã flash sale.
- **Công việc**:
  - Sử dụng câu lệnh cập nhật có điều kiện: `UPDATE promotions SET used_count = used_count + 1 WHERE id = :id AND used_count < total_quota`.
- **Acceptance Criteria**:
  - Mô phỏng 20 request đồng thời cho mã chỉ còn 1 lượt dùng: Đúng 1 request thành công, 19 request còn lại nhận thông báo "Mã đã hết lượt sử dụng".
- **Commit**: `feat(promotions): enforce atomic user usage limit and quota check in single transaction (PAY-017)`

---

### [x] [KHOA-05] Khóa các trường quan trọng của khuyến mãi đang chạy (PAY-019) *(Đã xử lý)*
- **Trạng thái**: ✅ Đã xử lý (`8ddf342` / `e901729`)
- **Mô tả**: Agency có thể chỉnh sửa giá trị giảm giá (`discountValue`) của một chương trình khuyến mãi đã bắt đầu có hiệu lực và đang có người lưu voucher.
- **Công việc**:
  - Nếu `startsAt <= now()`, cấm sửa các trường: `discountValue`, `discountType`, `minOrderValue`.
  - Chỉ cho phép sửa: Tên hiển thị, ngày kết thúc gia hạn thêm.
- **Acceptance Criteria**:
  - Gửi request sửa giảm giá của voucher đang chạy bị từ chối với lỗi `400 Bad Request`.
- **Commit**: `fix(promotions): lock immutable fields for active started promotions (PAY-019)`

---

### [x] [KHOA-06] Bổ sung giao diện xem trước phạm vi áp dụng và lý do hủy kích hoạt khuyến mãi (PAY-020) *(Đã xử lý trên branch khác)*
- **Trạng thái**: 🔄 Đã xử lý trên branch khác
- **Mô tả**: Agency chưa có màn hình xem trước những tour nào sẽ được áp dụng mã giảm giá và thiếu ô nhập lý do khi buộc phải dừng sớm khuyến mãi.
- **Công việc**:
  - Thêm modal xem danh sách tour áp dụng theo điều kiện lọc của voucher.
  - Thêm popup yêu cầu nhập lý do khi bấm "Dừng chương trình khuyến mãi".
- **Acceptance Criteria**:
  - Agency thấy rõ danh sách tour đủ điều kiện áp mã trước khi bấm xuất bản khuyến mãi.
- **Commit**: `feat(promotions): add promotion targeting scope preview and deactivation reason (PAY-020)`

---

### [x] [KHOA-07] Thiết lập mức hoa hồng nền tảng mặc định chuẩn 12% theo SRS (PAY-003, PAY-015) *(Đã xử lý trên branch khác)*
- **Trạng thái**: 🔄 Đã xử lý trên branch khác
- **Mô tả**: Khi hệ thống chưa cài đặt cấu hình hoa hồng riêng, mức chiết khấu bị fallback về 0% thay vì mức 12% đã quy định trong tài liệu đặc tả (SRS).
- **Công việc**:
  - Đặt hằng số fallback `DEFAULT_PLATFORM_COMMISSION_BPS = 1200` (tương đương 12.00%).
  - Cập nhật hàm tính toán doanh thu nền tảng khi thanh toán booking.
- **Acceptance Criteria**:
  - Đơn hàng mới tạo khi chưa cấu hình tỷ lệ hoa hồng riêng sẽ tự động trích đúng 12% phí dịch vụ nền tảng.
- **Commit**: `feat(finance): set authoritative default platform commission to 12% (PAY-003, PAY-015)`

---

### [x] [KHOA-08] Khắc phục lỗi Voucher sàn làm giảm doanh thu thực nhận của Agency (PAY-012) *(Đã xử lý)*
- **Trạng thái**: ✅ Đã xử lý
- **Mô tả**: Khi người dùng áp dụng mã giảm giá do sàn tài trợ (Platform Promo), hệ thống lại trừ thẳng vào tiền trả cho Agency thay vì sàn tự bù tiền.
- **Công việc**:
  - Tách bạch cấu trúc tài chính: `AgencyDiscount` do Agency chịu, `PlatformSubsidy` do sàn tài trợ.
  - Công thức: `AgencyReceivable = TourPrice - AgencyDiscount - Commission(TourPrice - AgencyDiscount)`.
- **Acceptance Criteria**:
  - Áp dụng mã sàn 100k: Tiền thanh toán của khách giảm 100k nhưng số tiền Agency nhận về không bị giảm.
- **Commit**: `fix(finance): prevent platform discounts from decreasing agency revenue (PAY-012)`

---

### [KHOA-09] Hỗ trợ cấu hình tỷ lệ hoa hồng linh hoạt theo danh mục tour và từng Agency (PAY-016)
- **Mô tả**: Chưa thể cấu hình mức hoa hồng ưu đãi cho các Agency đối tác chiến lược hoặc các tour đặc biệt (ví dụ tour thiện nguyện 5%).
- **Công việc**:
  - Xây dựng bảng quy tắc hoa hồng có thứ tự ưu tiên: `Agency Override` > `Category Override` > `Default (12%)`.
- **Acceptance Criteria**:
  - Agency có thỏa thuận riêng 8% sẽ được áp dụng đúng 8% hoa hồng khi khách đặt tour.
- **Commit**: `feat(finance): support category and agency-specific commission overrides (PAY-016)`

---

### [KHOA-10] Bảo vệ thao tác giải quyết khiếu nại bằng kiểm tra Expected-Status nguyên tử (MOD-002, MOD-006)
- **Mô tả**: Hai Moderator cùng mở một khiếu nại tranh chấp và cùng ấn duyệt giải pháp khác nhau; quyết định sau ghi đè quyết định trước mà không báo lỗi xung đột.
- **Công việc**:
  - Sử dụng cơ chế Compare-And-Swap (CAS): `UPDATE complaints SET status = 'RESOLVED', resolution = :res WHERE id = :id AND status = 'ESCALATED'`.
  - Nếu số dòng ảnh hưởng bằng 0, ném lỗi `409 Conflict`.
- **Acceptance Criteria**:
  - Moderator thứ hai bấm duyệt sẽ nhận cảnh báo: "Khiếu nại này đã được xử lý bởi nhân viên khác".
- **Commit**: `feat(complaints): guard complaint resolution with atomic expected-status CAS (MOD-002, MOD-006)`

---

### [KHOA-11] Tách biệt độc lập giữa giải quyết Báo cáo (Report) và Khiếu nại (Complaint) (BOOK-005, MOD-007)
- **Mô tả**: Logic đóng khiếu nại liên quan sử dụng điều kiện `OR agencyId = :agencyId` quá lỏng lẻo, khiến việc giải quyết báo cáo tour A vô tình đóng nhầm khiếu nại của tour B.
- **Công việc**:
  - Loại bỏ điều kiện OR lỏng lẻo; chỉ liên kết đóng khiếu nại khi có khóa ngoại `complaintId` hoặc `bookingId` khớp chính xác 100%.
- **Acceptance Criteria**:
  - Giải quyết báo cáo vi phạm không làm thay đổi trạng thái của các khiếu nại khác của cùng Agency.
- **Commit**: `fix(complaints): isolate report resolution from closing unrelated complaints (BOOK-005, MOD-007)`

---

### [KHOA-12] Chuẩn hóa quy trình thụ lý khiếu nại: Nhận việc, Hợp nhất và Chuyển tiếp (MOD-004)
- **Mô tả**: Hệ thống xử lý khiếu nại bị phân mảnh, thiếu các hành động nghiệp vụ chuẩn: Nhận xử lý (Claim), Gộp khiếu nại trùng (Merge) và Chuyển cấp trên (Forward).
- **Công việc**:
  - Tạo các endpoint chuyển đổi trạng thái khiếu nại có ghi log chi tiết.
  - Cập nhật giao diện modal chi tiết khiếu nại để Moderator thao tác.
- **Acceptance Criteria**:
  - Moderator có thể gộp 2 khiếu nại trùng nội dung về chung 1 vụ việc chính.
- **Commit**: `feat(complaints): implement formal claim, merge, and forward case lifecycle (MOD-004)`

---

### [KHOA-13] Hiển thị đồng hồ đếm ngược SLA và nhãn cảnh báo quá hạn khiếu nại (MOD-005)
- **Mô tả**: Danh sách khiếu nại không hiển thị thời gian còn lại để giải quyết theo cam kết dịch vụ (SLA 48h).
- **Công việc**:
  - Tạo component `SlaBadge.tsx` tính toán thời gian chênh lệch giữa `now()` và `slaDeadlineAt`.
  - Đổi màu nhãn: Xanh (> 24h), Vàng (< 12h), Đỏ (Đã quá hạn).
- **Acceptance Criteria**:
  - Các vụ việc sắp quá hạn SLA hiển thị nổi bật trên đầu danh sách kiểm duyệt.
- **Commit**: `feat(complaints): wire resolution SLA timers and overdue escalation views (MOD-005)`

---

### [KHOA-14] Bắt buộc kiểm duyệt lại khi Agency sửa nội dung quan trọng của Tour đã duyệt (TOUR-007, MOD-003)
- **Mô tả**: Tour đang ở trạng thái `APPROVED`, Agency sửa đổi tiêu đề, lịch trình hoặc chính sách tour thì hệ thống vẫn giữ nguyên `APPROVED` mà không cần duyệt lại.
- **Công việc**:
  - Định nghĩa danh sách trường trọng yếu: `title`, `description`, `itinerary`, `policy`, `price`.
  - Nếu tour đã `APPROVED` mà các trường này thay đổi, tự động chuyển tour về trạng thái `PENDING_REVIEW`.
- **Acceptance Criteria**:
  - Sửa lịch trình của tour đã duyệt: Trạng thái tour chuyển ngay về chờ duyệt và tour tạm ẩn khỏi trang tìm kiếm công khai.
- **Commit**: `fix(tours): require re-moderation when editing approved tour critical fields (TOUR-007, MOD-003)`

---

### [KHOA-15] Khóa phiên bản chống ghi đè khi sửa thông tin Departure đồng thời (TOUR-016)
- **Mô tả**: Hai nhân viên của Agency cùng mở trang sửa ngày khởi hành; người thứ hai lưu sẽ ghi đè giá và số chỗ mà không biết người thứ nhất vừa đổi.
- **Công việc**:
  - Thêm trường `version` trên bảng `TourDeparture`.
  - Kiểm tra `WHERE id = :id AND version = :version` khi cập nhật.
- **Acceptance Criteria**:
  - Người lưu sau nhận cảnh báo xung đột dữ liệu và yêu cầu tải lại thông tin mới nhất.
- **Commit**: `feat(tours): implement optimistic concurrency version for departure metadata (TOUR-016)`

---

### [KHOA-16] Kiểm tra đầy đủ Checklist (Ảnh, Lịch trình, Chính sách) trước khi nộp Tour (TOUR-017)
- **Mô tả**: Tour thiếu ảnh bìa hoặc thiếu các mốc lịch trình chi tiết vẫn gửi duyệt thành công do backend chỉ validate các trường tối thiểu.
- **Công việc**:
  - Kiểm tra điều kiện nộp duyệt: Ít nhất 3 ảnh chất lượng cao, lịch trình có ít nhất 1 hoạt động/ngày, có đầy đủ chính sách hoàn hủy.
- **Acceptance Criteria**:
  - Nộp tour thiếu ảnh hoặc thiếu lịch trình sẽ bị chặn lại kèm danh sách các tiêu chí còn thiếu.
- **Commit**: `feat(tours): validate complete checklist for media, itinerary and policies on submit (TOUR-017)`

---

### [KHOA-17] Sắp xếp hàng đợi duyệt Tour ưu tiên hồ sơ nộp trước (TOUR-018)
- **Mô tả**: Danh sách tour chờ duyệt sắp xếp lộn xộn hoặc lấy tour mới nhất, khiến các tour nộp trước bị chậm trễ thời gian duyệt.
- **Công việc**:
  - Sắp xếp hàng đợi mặc định: `status = 'PENDING'` lên đầu, sau đó `submittedAt ASC`.
- **Acceptance Criteria**:
  - Tour nộp trước luôn hiển thị ở trang đầu của danh sách kiểm duyệt.
- **Commit**: `fix(tours): prioritize pending submissions chronologically in review queue (TOUR-018)`

---

### [KHOA-18] Chặn Agency kích hoạt lại danh mục Tour đã bị Admin vô hiệu hóa (TOUR-011)
- **Mô tả**: Khi Admin đã tắt một danh mục tour, Agency dùng API gợi ý danh mục gửi cùng tên thì hệ thống lại tự động chuyển danh mục đó thành `ACTIVE`.
- **Công việc**:
  - Bỏ logic tự động kích hoạt lại danh mục cũ trong API tạo/tìm danh mục của Agency.
  - Báo lỗi nếu Agency cố tình chọn danh mục đã bị Admin ngưng hỗ trợ.
- **Acceptance Criteria**:
  - Agency không thể kích hoạt lại các danh mục đã bị Admin vô hiệu hóa.
- **Commit**: `fix(categories): prevent agency helper from reactivating disabled categories (TOUR-011)`

---

### [KHOA-19] Sửa lỗi phân trang và giới hạn hiển thị danh mục theo thứ tự sắp xếp (TOUR-019)
- **Mô tả**: Khi danh mục có giá trị `sortOrder >= 200`, câu query danh mục công khai vô tình lọc bỏ danh mục này khỏi kết quả hiển thị.
- **Công việc**:
  - Sửa lại câu query hiển thị danh mục: Sắp xếp theo `sortOrder ASC`, loại bỏ điều kiện hardcode `<= 199`.
- **Acceptance Criteria**:
  - Các danh mục có sortOrder lớn vẫn hiển thị đầy đủ trên thanh điều hướng trang chủ.
- **Commit**: `fix(categories): fix category pagination query and sort order visibility cutoff (TOUR-019)`

---

### [KHOA-20] Hỗ trợ cấu trúc phân cấp danh mục Tour cha - con (TOUR-020)
- **Mô tả**: Hệ thống hiện tại chỉ có danh mục phẳng 1 cấp, thiếu quan hệ danh mục cha - con (ví dụ: Du lịch Miền Bắc $\rightarrow$ Tour Hà Giang).
- **Công việc**:
  - Thêm trường `parentId` vào bảng `TourCategory`.
  - Xây dựng API lấy cây danh mục dạng lồng nhau (Tree structure).
- **Acceptance Criteria**:
  - Tạo và quản lý được danh mục con trực thuộc danh mục cha trên hệ thống.
- **Commit**: `feat(categories): support hierarchical category taxonomy and parent-child relations (TOUR-020)`

---

### [KHOA-21] Bắt buộc chọn lại danh mục hợp lệ khi chỉnh sửa Tour có danh mục bị khóa (TOUR-021)
- **Mô tả**: Tour cũ gắn với danh mục đã bị vô hiệu hóa khi đem ra chỉnh sửa vẫn lưu thành công mà không bị yêu cầu chuyển sang danh mục đang hoạt động.
- **Công việc**:
  - Khi Agency lưu tour, gọi hàm `assertActiveCategories(categoryIds)`.
  - Nếu chứa danh mục bị vô hiệu hóa, thông báo yêu cầu chọn danh mục mới.
- **Acceptance Criteria**:
  - Không thể lưu tour nếu vẫn giữ danh mục đã bị ngưng hoạt động.
- **Commit**: `fix(categories): enforce active category validation on tour editing (TOUR-021)`

---

### [KHOA-22] Xây dựng quy trình yêu cầu chỉnh sửa (Request Changes) và xem tác động khi đình chỉ Tour (REVIEW-005, REVIEW-006)
- **Mô tả**: Moderator khi thấy tour thiếu thông tin chỉ có thể Từ chối thẳng tay; chưa có nút Yêu cầu sửa đổi và chưa xem được danh sách các đơn đã đặt trước khi tạm dừng tour vi phạm.
- **Công việc**:
  - Thêm trạng thái `CHANGES_REQUESTED` cho Tour kèm form nhập ghi chú yêu cầu.
  - Hiển thị thống kê số lượng booking đã xác nhận sẽ bị ảnh hưởng nếu bấm tạm dừng tour.
- **Acceptance Criteria**:
  - Moderator gửi yêu cầu sửa đổi thành công; Agency nhận email hướng dẫn bổ sung thông tin.
- **Commit**: `feat(moderation): add Request Changes workflow and listing suspension impact view (REVIEW-005, REVIEW-006)`

---

## 4. PHÂN CÔNG TOÀN (`toan215`) - 13 TICKETS
*Lĩnh vực: Booking Hold/Expiration, Seat Rollback, Payment Polling & Refund Outbox, Notifications & Auth Security*

---

### [TOAN-01] Giải phóng chỗ ngồi an toàn khi lưu thông tin đơn đặt tour thất bại (BOOK-001)
- **Mô tả**: Hàm đặt tour gọi `reserveSeats` thành công nhưng bước kiểm tra khách hàng mới hoặc lưu `Booking` gặp lỗi; chỗ ngồi đã giữ không bao giờ được nhả lại kho ghế.
- **Công việc**:
  - Đặt khối `try...catch` bao bọc toàn bộ tiến trình sau khi giữ chỗ.
  - Gọi `releaseSeats` trong khối bù trừ nếu có bất kỳ exception nào xảy ra trước khi commit đơn hàng.
- **Acceptance Criteria**:
  - Mô phỏng crash DB khi lưu đơn: Số ghế còn lại của tour được hoàn trả nguyên vẹn về kho.
- **Commit**: `fix(bookings): compensate and release reserved seats if booking persistence fails (BOOK-001)`

---

### [TOAN-02] Từ chối xác nhận thanh toán muộn cho đơn hàng đã hết hạn giữ chỗ (BOOK-002, BOOK-006)
- **Mô tả**: Khách thanh toán sau thời hạn 15 phút, webhook ngân hàng trả về thành công thì hệ thống vẫn chuyển đơn sang `CONFIRMED` dù chỗ ngồi có thể đã bị bán cho người khác.
- **Công việc**:
  - Khi nhận callback thanh toán, kiểm tra `now() <= booking.paymentExpiresAt`.
  - Nếu đã quá hạn, chuyển trạng thái đơn sang `EXPIRED_PAYMENT_RECEIVED`, đánh dấu cờ `refundRequired = true` và không xác nhận vé.
- **Acceptance Criteria**:
  - Thanh toán cho đơn đã hết hạn không làm phát hành vé và kích hoạt quy trình hoàn tiền tự động.
- **Commit**: `fix(bookings): reject late payment settlement on expired pending bookings (BOOK-002, BOOK-006)`

---

### [TOAN-03] Kiểm tra quyền hạn Traveler và xác thực Email tại ranh giới đặt tour (BOOK-007, BOOK-011)
- **Mô tả**: Người dùng có role `TOUR_GUIDE` hoặc tài khoản chưa xác thực email vẫn có thể gọi API đặt tour; giao diện thiếu ô đính kèm mã đơn hàng bằng chứng khi khiếu nại.
- **Công việc**:
  - Bổ sung guard kiểm tra role `TRAVELER` và `emailVerifiedAt != null` ở route tạo booking.
  - Thêm ô chọn đơn hàng đính kèm trên giao diện khiếu nại.
- **Acceptance Criteria**:
  - Tài khoản chưa verify email bị chặn ở bước bấm nút thanh toán kèm thông báo xác thực email.
- **Commit**: `feat(bookings): verify actor role and verified email at booking boundary (BOOK-007, BOOK-011)`

---

### [TOAN-04] Thực hiện giải phóng ghế và hoàn Voucher nguyên tử khi hủy đặt tour (PAY-002)
- **Mô tả**: Khi hủy đơn hàng, hệ thống đổi trạng thái đơn sang `CANCELLED` trước; nếu việc gọi service kho ghế gặp lỗi mạng thì ghế và voucher bị kẹt vĩnh viễn.
- **Công việc**:
  - Sử dụng Transactional Outbox hoặc gộp thao tác cập nhật đơn, nhả ghế và hoàn voucher vào chung một database transaction.
- **Acceptance Criteria**:
  - Hủy đơn thành công đảm bảo kho ghế tăng lên ngay lập tức và voucher mở lại trạng thái khả dụng.
- **Commit**: `fix(payments): execute transactional inventory and voucher release upon cancellation (PAY-002)`

---

### [TOAN-05] Xử lý trạng thái bất định khi tạo đơn thanh toán trên cổng PayOS (PAY-005)
- **Mô tả**: Khi gọi PayOS tạo link thanh toán mà bị timeout, hệ thống tự động gán trạng thái `FAILED`; khách bấm thử lại sẽ tạo ra 2 đơn hàng thanh toán riêng biệt trên cổng.
- **Công việc**:
  - Sử dụng `orderCode` ổn định (dựa trên bookingId) làm khóa Idempotency khi gọi PayOS.
  - Kiểm tra đơn hàng trên cổng trước khi tạo link mới.
- **Acceptance Criteria**:
  - Bấm thanh toán nhiều lần không sinh ra nhiều mã giao dịch rác trên PayOS.
- **Commit**: `fix(payments): reconcile uncertain gateway creation state via idempotent order code (PAY-005)`

---

### [TOAN-06] Xây dựng Worker tự động Polling đối soát các đơn thanh toán bị rớt Webhook (PAY-006, PROFILE-008)
- **Mô tả**: Nếu webhook từ ngân hàng bị chặn bởi tường lửa hoặc rớt mạng, đơn hàng của khách bị treo ở trạng thái `PENDING` mãi mãi dù khách đã bị trừ tiền.
- **Công việc**:
  - Viết background worker định kỳ 2 phút truy vấn trạng thái từ PayOS cho các đơn hàng `PENDING` đã quá 5 phút.
  - Tự động hoàn tất đơn khi cổng báo trạng thái đã thanh toán.
- **Acceptance Criteria**:
  - Giả lập chặn webhook: Đơn hàng tự động chuyển sang `CONFIRMED` sau khi worker quét đối soát.
- **Commit**: `feat(payments): add automated background polling for terminal webhook misses (PAY-006, PROFILE-008)`

---

### [TOAN-07] Xây dựng cấu trúc mốc hoàn tiền và tự động tính toán số tiền hoàn (PAY-009)
- **Mô tả**: Chính sách hoàn tiền hiện chỉ là đoạn văn bản hiển thị trên UI, logic hủy tour backend chưa tự động tính ra số tiền hoàn theo mốc thời gian (ví dụ: hủy trước 7 ngày hoàn 100%, trước 3 ngày hoàn 50%).
- **Công việc**:
  - Tạo cấu trúc dữ liệu JSON lưu các mốc thời gian và tỷ lệ phần trăm hoàn tiền.
  - Tính toán số tiền hoàn thực tế dựa trên thời gian bấm hủy so với ngày khởi hành.
- **Acceptance Criteria**:
  - Hủy tour trước 5 ngày tự động tính đúng 50% tiền hoàn theo đúng chính sách đã snapshot của tour.
- **Commit**: `feat(payments): introduce structured refund milestones and policy calculation (PAY-009)`

---

### [TOAN-08] Xây dựng Sổ cái hoàn tiền (Refund Ledger) và luồng giải quyết tranh chấp tài chính (PAY-007, PAY-010, PAY-011)
- **Mô tả**: Khi Moderator đồng ý giải quyết khiếu nại bằng phương án "Hoàn tiền cho khách", hệ thống chỉ lưu câu chữ mà không hề tạo lệnh hoàn tiền hay lưu sổ sách tài chính.
- **Công việc**:
  - Tạo bảng `RefundLedger` (mã giao dịch gốc, số tiền hoàn, tài khoản nhận, trạng thái `PENDING | PROCESSED`).
  - Tích hợp API chuyển tiền hoàn tự động hoặc tạo bảng kê cho kế toán xử lý.
- **Acceptance Criteria**:
  - Quyết định hoàn tiền sinh ra bản ghi tài chính hợp lệ và có thể đối soát được dòng tiền.
- **Commit**: `feat(payments): implement durable financial refund ledger and dispute settlement (PAY-007, PAY-010, PAY-011)`

---

### [TOAN-09] Xóa dữ liệu mẫu Fallback ở Header thông báo và xử lý trạng thái hộp thư rỗng (NOTIF-001)
- **Mô tả**: Khi API thông báo trả về rỗng hoặc gặp lỗi đọc mạng, header ứng dụng tự động hiển thị 3 thông báo mẫu hardcode trong code khiến khách tưởng là thông báo thật.
- **Công việc**:
  - Loại bỏ hoàn toàn mảng `mockNotifications` trên production.
  - Hiển thị giao diện hộp thư rỗng ("Bạn chưa có thông báo nào") và nút thử lại khi có lỗi mạng.
- **Acceptance Criteria**:
  - Tài khoản mới tạo mở chuông thông báo thấy màn hình rỗng chuẩn UX, không xuất hiện dữ liệu ảo.
- **Commit**: `fix(notifications): remove mock fallback data and handle empty inbox states cleanly (NOTIF-001)`

---

### [TOAN-10] Đảm bảo tính nguyên tử khi gửi tin nhắn chat và cập nhật số tin chưa đọc (CHAT-001, PROFILE-010)
- **Mô tả**: Khi gửi tin nhắn đồng thời với thao tác đánh dấu đã đọc của đối phương, bộ đếm số tin chưa đọc (`unreadCount`) bị reset về 0 mặc dù trong hộp thư vẫn còn tin nhắn mới.
- **Công việc**:
  - Dùng cơ chế Watermark: Đánh dấu đã đọc theo mốc `lastReadMessageId` hoặc `lastReadAt`.
  - Đưa thao tác tạo tin nhắn và tăng bộ đếm vào chung một transaction.
- **Acceptance Criteria**:
  - Vừa mở chat vừa nhận tin nhắn mới: Số đếm tin chưa đọc cập nhật chính xác, không bị nuốt mất tin.
- **Commit**: `fix(chat): transact message insert and inbox counter with read watermark (CHAT-001, PROFILE-010)`

---

### [TOAN-11] Khóa kiểm tra giới hạn 200 Tour yêu thích (Wishlist Cap) chống Race Condition (WISH-001)
- **Mô tả**: Khi danh sách yêu thích đang có 199 tour, người dùng mở 2 tab và bấm thêm 2 tour khác nhau cùng một thời điểm: Số lượng tour trong wishlist nhảy lên 201, phá vỡ hạn mức trần 200 món.
- **Công việc**:
  - Đặt transaction có khóa cấp người dùng (`SELECT count(*) FROM wishlists WHERE user_id = :userId FOR UPDATE`).
  - Chặn thêm mới nếu count đã đạt 200.
- **Acceptance Criteria**:
  - Bấm thêm 2 tour cùng lúc khi đang có 199 tour: Đúng 1 tour được thêm vào (đạt 200), tour còn lại báo "Danh sách yêu thích đã đầy".
- **Commit**: `fix(wishlist): enforce atomic 200-item cap check using serializable transaction (WISH-001)`

---

### [TOAN-12] Bảo mật vòng đời cấp phát OTP và loại bỏ việc in OTP dạng Plaintext trong Log (AUTH-002, AUTH-003, AUTH-010)
- **Mô tả**: Mã OTP gửi cho khách bị in nguyên văn ra file console log của server ở môi trường production; endpoint gửi lại OTP có thể bị lạm dụng để đăng nhập mà không cần mật khẩu.
- **Công việc**:
  - Xóa bỏ mọi dòng lệnh `logger.info("OTP is: " + otp)`.
  - Bắt buộc kiểm tra mật khẩu trước khi cấp challenge OTP đối với luồng đăng nhập 2 lớp (2FA).
- **Acceptance Criteria**:
  - Log server hoàn toàn không chứa mã OTP thô; không thể đăng nhập tài khoản chỉ bằng thao tác gọi gửi lại OTP.
- **Commit**: `fix(auth): secure OTP issue-consume lifecycle and eliminate plaintext email logs (AUTH-002, AUTH-003, AUTH-010)`

---

### [TOAN-13] Thu hồi Access Token cũ khi người dùng đăng xuất hoặc đổi mật khẩu (AUTH-005, AUTH-012, PROFILE-011)
- **Mô tả**: Khi người dùng ấn Đăng xuất hoặc thực hiện Đổi mật khẩu, chỉ có Refresh token bị xóa; Access token cũ vẫn tiếp tục gọi được API lấy dữ liệu riêng tư cho đến khi hết hạn (15-60 phút sau).
- **Công việc**:
  - Tăng `tokenVersion` trong bảng `User` khi đăng xuất hoặc đổi mật khẩu.
  - Ngắt kết nối WebSocket của phiên làm việc đó ngay lập tức.
- **Acceptance Criteria**:
  - Sau khi đăng xuất, dùng token cũ gọi GET `/users/me` bị từ chối ngay lập tức với mã lỗi `401 Unauthorized`.
- **Commit**: `fix(auth): invalidate old JWT access tokens upon logout and password reset (AUTH-005, AUTH-012, PROFILE-011)`
