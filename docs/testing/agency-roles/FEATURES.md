# Danh mục tính năng & ma trận quyền — vai trò Agency

Tài liệu này là đầu vào của lượt kiểm thử E2E tại [`REPORT.md`](./REPORT.md). Nguồn quyền:

- `backend/src/modules/agencies/agency.policy.ts` → `AGENCY_ROLE_PERMISSIONS`, `effectiveAgencyPermissions`.
- `frontend/features/agency/agencyRoutePermission.ts` + gate `useAgencyPermission` trong từng trang.
- Guard backend: `resolveAgencyContext`, `requireAgencyPermission`, `requirePermission` (dùng `req.agencyContext.permissions`), `requireVerifiedAgency`, `requireLegacyOwnerIntegration` (`backend/src/routes/registry.ts`).

Cổng đối tác có 4 vai trò thành viên (`AgencyMember.role`), độc lập với role toàn cục `AGENCY` của tài khoản:

| Vai trò | Quyền nghiệp vụ (tóm tắt) |
|---|---|
| OWNER | Toàn bộ quyền của MANAGER + `tour:delete-own`, `tour:import`, `agency:team-*`, `agency:permissions-manage`, `agency:finance-*` |
| MANAGER | Tour (trừ xoá/import), lịch, booking, xuất khách, khiếu nại, phản ánh đánh giá, voucher, dashboard; **không** có team/finance/premium |
| STAFF | `agency:tour-view`, `agency:tour-content-update`, `agency:booking-monitor`, `custom-tour:*`; không có tour CRUD, lịch, booking đầy đủ, voucher, khiếu nại, team |
| ACCOUNTANT | `agency:bookings-view`, `agency:dashboard`, `agency:finance-view`; không có tour/team/voucher/khiếu nại |

## 1. Bản đồ trang và quyền

| Trang | API chính | Gate | OWNER | MANAGER | STAFF | ACCOUNTANT |
|---|---|---|---|---|---|---|
| `/agency` | `GET /agency/dashboard` | `agency:dashboard` | ✓ | ✓ | ✗ | ✓ |
| `/agency/tours` | `GET /agency/tours` | `agency:tour-view` | ✓ | ✓ | ✓ | ✗ |
| `/agency/tours/new` | `POST /agency/tours` | `tour:create` | ✓ | ✓ | ✗ | ✗ |
| `/agency/tours/import` | `POST /agency/tours/import` | `tour:import` | ✓ | ✗ | ✗ | ✗ |
| `/agency/tours/:id` | `GET /agency/tours/:id` | page: `agency:tour-view` (read-only; nút sửa cần `tour:update-own`) | ✓ | ✓ | ✓ | ✗ |
| `/agency/tours/:id/edit` | `PATCH /agency/tours/:id` | `tour:update-own` | ✓ | ✓ | ✗ | ✗ |
| `/agency/calendar` | `GET/POST/PATCH/DELETE /agency/calendar` | `tour:update-own` / `tour:set-availability` | ✓ | ✓ | ✗ | ✗ |
| `/agency/bookings`, `/:id` | `GET /agency/bookings` | `agency:bookings-view` | ✓ | ✓ | ✗ | ✓ |
| `/agency/work/tours` | `GET/PATCH /agency/work/tours` | `agency:tour-view` / `agency:tour-content-update` | ✓ | ✓ | ✓ | ✗ |
| `/agency/work/bookings` | `GET /agency/work/bookings` | `agency:booking-monitor` | ✓ | ✓ | ✓ | ✗ |
| `/agency/team`, `/agency/settings/team` | `GET /agency/members` | `agency:team-view` | ✓ | ✗ | ✗ | ✗ |
| `/agency/team/requests` | `GET /agency/join-requests` | OWNER (server) | ✓ | ✗ | ✗ | ✗ |
| `/agency/promotions` | `/agency/promotions` | `promotion:agency-manage` | ✓ | ✓\* | ✗ | ✗ |
| `/agency/complaints` | `/agency/complaint-tickets` | `complaint:respond` | ✓ | ✓\* | ✗ | ✗ |
| `/agency/reviews` | `/agency/review-disputes` | `review:dispute` | ✓ | ✓† | ✗ | ✗ |
| `/agency/premium` | `/agency/premium/*` | `premium:contribute` | ✓ | ✗† | ✗ | ✗ |
| `/agency/custom-tours` | `/custom-tours` | `custom-tour:view` | ✓ | ✓‡ | ✓‡ | ✗ |
| `/agency/notifications` | `/agency/notifications` | `agency:context-view` | ✓ | ✓ | ✓ | ✓ |
| `/agency/settings/profile` | `PATCH /users/me` | không gate (sửa: legacy owner) | ✓ | xem | xem | xem |
| `/agency/settings/commission` | `GET /agency/commission`, `POST /agency/commission/requests`, `POST /agency/commission/requests/:id/cancel` | đọc: `agency:context-view`; gửi/huỷ: `agency:finance-manage` (OWNER) | ✓ | ✓ (chỉ xem) | ✗ (layout) | ✓ (chỉ xem) |
| `/workplaces`, `/workplaces/join` | `/users/me/agencies`, `/agency-join-requests` | — | ✓ | ✓ | ✓ | ✓ |
| `/agency/invitations/accept` | `/agency-invitations/accept` | — | ✓ | ✓ | ✓ | ✓ |
| `/agency/application/*` | `/agency/application` | OWNER + verified gate | ✓ | ✗ | ✗ | ✗ |

\* Đã sửa: sidebar chỉ dựa vào `agency.permissions`, không còn điều kiện legacy `memberRole === 'OWNER' && agencyId === user.id`.
† Đã sửa: hai module nằm trong danh sách `integrated` và dùng `agencyContext.agencyId`. MANAGER không có `premium:contribute` theo policy nên `/agency/premium` vẫn bị chặn đúng quyền.
‡ Đã sửa: router resolve agency context theo membership; service scope theo `agencyId` của context và ACCOUNTANT bị 403.

## 2. Tính năng chi tiết theo màn hình

### Tổng quan `/agency`
KPI khách hàng / đơn / doanh thu gộp / hoa hồng / thực nhận, chuyển kỳ 7 ngày – 30 ngày – 6 tháng, biểu đồ doanh thu, top tour bán chạy, số khiếu nại mở, link nhanh tới tour/booking.

### Quản lý tour `/agency/tours`
- Lọc theo trạng thái, tìm kiếm, phân trang; badge trạng thái; ảnh bìa (tải file hoặc URL).
- Tạo tour: stepper 4 bước (nội dung → hình ảnh → dịch vụ bao gồm/không bao gồm → chính sách & giá), lưu nháp hoặc gửi duyệt.
- Sửa tour: cùng editor; STAFF bị khoá mọi trường ngoài `title`, `description`, `images`, `highlights`, `inclusions`, `exclusions`.
- Lưu trữ / khôi phục tour; tour `PENDING_REVIEW` và `ARCHIVED` bị khoá nội dung.
- Import nhiều tour từ tài liệu (chỉ OWNER).
- Workspace chi tiết: thông tin tour, lịch trình (thêm/sửa/xoá ngày), khởi hành & giá vé, phân công hướng dẫn viên, xuất PDF danh sách khách.

### Lịch khởi hành `/agency/calendar`
Xem lịch tháng, thêm lịch khởi hành, lặp hàng tuần, sửa ngày/giá/sức chứa/trạng thái mở bán, xoá ngày khởi hành; kiểm tra chồng lấn và ngày quá khứ.

### Đơn đặt chỗ `/agency/bookings`
Lọc theo trạng thái, tour, khoảng ngày khởi hành; danh sách có mã, khách, số khách, thanh toán, hoa hồng; chi tiết booking hiển thị người liên hệ, hành khách (năm sinh/nhóm tuổi/điểm đón/ghi chú), trạng thái hoàn tiền; xuất PDF theo departure hoặc toàn tour.

### Việc được giao `/agency/work/tours`, `/agency/work/bookings`
- Nội dung tour: chỉ hiện tour được giao scope; sửa đúng các trường `allowedFields`; tour `ARCHIVED`/`PENDING_REVIEW` chỉ xem.
- Theo dõi booking: 50 dòng/trang, chỉ thông tin liên hệ tối thiểu, không tài chính/không xuất khách.

### Đội ngũ `/agency/team`, `/agency/settings/team`, `/agency/team/requests`
- Bảng thành viên (vai trò, trạng thái, ngày tham gia, quyền hiện tại).
- Mời bằng email (role MANAGER/STAFF/ACCOUNTANT hoặc role tuỳ chỉnh), thu hồi lời mời.
- Đổi role/trạng thái thành viên (ACTIVE/SUSPENDED/REMOVED).
- Role tuỳ chỉnh + ma trận quyền, override ALLOW/DENY theo thành viên, gán tour scope (`title`/`summary`/`description`).
- Yêu cầu tham gia: duyệt (kèm role) / từ chối; mã mời (rotate/revoke).

### Voucher `/agency/promotions`
Danh sách + lọc theo hình thức (CODE / AUTO_APPLY / COLLECTABLE / UNIQUE_BATCH), trạng thái, loại giảm; tạo/sửa voucher; bật/tắt; lưu trữ; sinh batch mã dùng một lần.

### Khiếu nại `/agency/complaints`
Thống kê (tổng, đang đối thoại, CSAT), lọc trạng thái/mức độ; hội thoại theo phiếu; trả lời; đề xuất giải pháp & đóng phiếu; leo thang lên sàn; xem CSAT; đính kèm ảnh bằng chứng.

### Đánh giá `/agency/reviews`
Đánh giá của tour thuộc agency (tác giả được che tên), gửi phản ánh kèm loại vấn đề + mô tả; tab phản ánh đã gửi hiển thị trạng thái và quyết định của kiểm duyệt viên.

### Premium `/agency/premium`
Quản lý đóng gói premium của agency: bật/tắt theo vai trò, cấu hình quà tặng, tour áp dụng, phiên bản gói, đóng góp và yêu cầu hoàn tiền.

### Yêu cầu đoàn `/agency/custom-tours`
Danh sách yêu cầu đoàn, mở chi tiết, chat với khách, soạn thỏa thuận (lưu nháp / gửi offer), xem trạng thái chốt đoàn.

### Thông báo & cài đặt
- `/agency/notifications` + popover: inbox theo agency, badge chưa đọc, đánh dấu đã đọc/xoá.
- `/agency/settings/profile`: hồ sơ doanh nghiệp (chỉ legacy owner sửa; thành viên khác chỉ xem).
- `/agency/settings/commission`: đọc mức chiết khấu thật từ API, OWNER gửi/huỷ yêu cầu điều chỉnh; Super Admin duyệt trong `/super-admin/settings/commission`.

## 3. Onboarding & trạng thái tài khoản

| Trạng thái | Hành vi kỳ vọng |
|---|---|
| Agency `VERIFIED` | Mở đầy đủ tính năng theo quyền |
| Agency `UNVERIFIED`/`PENDING` | Layout chặn mọi trang trừ `/agency/team`; hiện "Doanh nghiệp chưa được xác minh" + link hoàn thiện hồ sơ (OWNER) |
| Membership `SUSPENDED`/`REMOVED` | Không được resolve agency context; về `/workplaces` |
| Có 2+ membership | `activeAgencyId = null` → phải chọn doanh nghiệp tại `/workplaces` |
| Lời mời | Tạo ở `/agency/team`; nhận tại `/workplaces` → "Lời mời của tôi"; không có link token trong email |

## 4. Ghi chú kỹ thuật phục vụ kiểm thử

- Mọi request `/agency/*` do frontend tự gắn header `X-Agency-Id` theo active agency (`frontend/store/api/baseApi.ts`).
- `requireLegacyOwnerIntegration` so `ctx.agencyId === ctx.actorUserId`; dữ liệu legacy có `AgencyProfile.id = User.id` (trigger `agency_legacy_identity`).
- Trigger `agency_seed_access_roles` tạo sẵn 4 role hệ thống khi tạo `AgencyProfile`; trigger `agency_assign_default_role` gán `roleId` cho member/invitation.
- Rate limit đăng nhập: 20 lần / 15 phút / IP (`authRateLimiter`).
- PDF dùng font DejaVu để hiển thị tiếng Việt; route: `GET /agency/tours/:tourId/departures/:departureId/customers.pdf` và `GET /agency/tours/:id/customers.pdf`.
