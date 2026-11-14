# Kế hoạch end to end: Staff vận hành tour trên cấu trúc Agency đa thành viên

## Mục tiêu và hiện trạng (12/11/2026)

Triển khai quyền sửa nội dung tour cho STAFF, danh sách hành khách theo chuyến, tra cứu booking, khiếu nại và voucher trên nền Agency đa thành viên vừa được merge. Không dùng global role `AGENCY` hoặc giả định `agencyId === userId` để quyết định quyền nghiệp vụ.

- `AgencyProfile` là tenant; `AgencyMember` chứa `userId`, `agencyId`, `role`, `status`. `resolveAgencyContext` xác định agency đang chọn qua `X-Agency-Id`; context có `actorUserId`, `memberRole`, `permissions`. Frontend dùng active agency và tự gắn header này.
- `AGENCY_ROLE_PERMISSIONS.STAFF` hiện có `tour:update-own`, `tour:set-availability`, `agency:bookings-view`, `agency:export-customers`, `complaint:respond`; không có `promotion:agency-manage`, `tour:delete-own`. Owner và Manager có quyền quản lý voucher.
- Tour, calendar, bookings đã được đánh dấu integrated tại `routes/registry.ts`. Promotions và complaint-tickets còn bị `requireLegacyOwnerIntegration` chặn với member không phải legacy owner, dù đã có permission; phải tích hợp tenant trước khi coi hai luồng này hoàn tất.
- PDF hiện là `GET /api/v1/agency/tours/:id/customers.pdf?departureId=...`, một dòng mỗi booking, có người liên hệ, SĐT, số khách, ghi chú. UI đã có nút tải tại tour operations. Booking chưa có danh sách hành khách, năm sinh/nhóm tuổi, điểm đón hoặc ghi chú riêng từng người.
- `AgencyTourEditorPage` hiện gửi toàn bộ `TourContentInput` khi PATCH; backend chỉ kiểm tra `tour:update-own`. Cần sửa cả payload, validation và service.
- Khiếu nại có route frontend `/agency/complaints`, API `/agency/complaint-tickets` và luồng phản hồi. Voucher có `/agency/promotions` và Promotion API. Hai phần này là tích hợp với membership, không phải tạo module mới.

## Trạng thái triển khai (13/11/2026)

- Đã chọn ranh giới STAFF theo allowlist nội dung; bổ sung `Tour.highlights`, dùng `inclusions`/`exclusions` cho dịch vụ bao gồm/không bao gồm. `itinerary` cập nhật qua PATCH và endpoint riêng. STAFF không có quyền availability/giá chuyến, submit, archive hoặc restore.
- Đã thêm `Booking.passengers` dạng JSON snapshot để giữ dữ liệu từng khách từ checkout mà không tạo bảng mới; booking cũ vẫn dùng dòng người liên hệ tổng hợp. PDF theo departure có cột tên, năm sinh/nhóm tuổi, SĐT, điểm đón và ghi chú. Booking detail cho agency xem được danh sách này và có nút tải PDF.
- Đã tích hợp membership cho complaint-tickets và promotions; STAFF xử lý complaint, Owner/Manager quản lý voucher. Các route cũ của PDF được giữ để tương thích.
- `TourUpdateLog` chưa triển khai vì là mục tùy chọn. Các test integration mới chạy trên PostgreSQL mẫu được migrate; migration chưa áp dụng lên database triển khai.
- Kiểm chứng 13/11: backend unit 774/774, frontend 728/728, typecheck hai phía và các suite integration trực tiếp cho tour/booking/PDF/complaint/voucher đều qua. Toàn bộ integration backend còn 12 test lỗi ở 7 file ngoài các suite mới (maintenance, error contract, finance fixture, audit, dashboard, reviews, admin); cần xử lý riêng trước khi coi gate phát hành tổng thể đạt.

## Điều kiện tiên quyết và quyết định nghiệp vụ

1. **Nguồn quyền:** dùng `AgencyContext` của request và membership ACTIVE; mọi truy vấn/ghi theo `agencyContext.agencyId`, người thao tác theo `actorUserId`. Không lấy `agencyId` từ body/query. Cache frontend phải tách theo active agency và xóa khi đổi agency.
2. **Ranh giới STAFF:** giữ đúng allowlist cập nhật nội dung: `title`, `description`, `images`, `highlights`, `itinerary`, `inclusions`, `exclusions`. `highlights String[]` đã được bổ sung; `includedUtilities`/`excludedUtilities` tương ứng `inclusions`/`exclusions` ở API hiện tại. `summary`, `destination`, `durationDays`, `categoryIds`, `meetingPoint`, `travelNotes`, `requiredDocuments`, `maxGroupSize` nằm ngoài allowlist và bị khóa đối với STAFF.
3. **Trạng thái mở bán:** đã gỡ `tour:set-availability` khỏi STAFF, giữ `tour:configure-itinerary`. STAFF không đổi `isOpen`, `priceOverride`, submit/publish, archive hay restore.
4. **Dữ liệu hành khách:** checkout gửi `Booking.passengers` snapshot gồm tên, năm sinh/nhóm tuổi, SĐT liên hệ, điểm đón và ghi chú đặc biệt. Booking cũ hiển thị người liên hệ là dữ liệu chưa đủ, không tự suy diễn tên của các khách còn lại. Cơ chế cập nhật hồ sơ sau khi đặt chưa nằm trong task này.
5. **Chính sách truy cập:** STAFF xem toàn bộ tour/booking của active agency theo quyền hiện tại. Nếu cần phân công theo từng tour, phải có model assignment và guard riêng; không suy ra quyền từ `TourGuideAssignment` (đó là phân công hướng dẫn viên).

## Các giai đoạn triển khai

### 0. Cố định nền Agency đa thành viên

- Kiểm tra migration `20261112000100_agency_multimember_foundation` và onboarding, dữ liệu owner/membership sau pull; chạy migration trên DB nhánh thử nghiệm trước khi phát hành.
- Thêm test route xuyên suốt cho active/suspended/removed membership, agency switching, cùng user thuộc hai agency, và tenant isolation đối với tour, booking, export. Kiểm tra `X-Agency-Id` thiếu/sai theo contract của `agencyService.resolve`.
- Rà `routes/registry.ts`: bỏ legacy-owner gate **theo từng module sau khi** service/controller của module dùng `agencyContext.agencyId` và actor riêng. Đặc biệt promotions và complaint-tickets. Không bỏ gate hàng loạt.

### 1. Field authorization cho Tour (ưu tiên bảo mật)

- Định nghĩa một allowlist canonical trong backend cho STAFF. Kiểm tra **raw keys trước khi Zod parse** để payload có trường cấm, kể cả giá trị không đổi hoặc trường lạ, trả 403 thay vì bị strip/400. Sau đó mới validate giá trị của các trường hợp lệ; lỗi dữ liệu hợp lệ về quyền trả 400. Với Owner/Manager, giữ schema cập nhật đầy đủ.
- Truyền `AgencyContext`/actor vào `tours.controller` → `tours.service.updateTour`; không chỉ truyền `agencyId`. Chạy guard ngay trước mutation; repository vẫn scope theo tenant. Nếu bật audit log, ghi trong cùng transaction với cập nhật tour.
- Rà mọi đường thay đổi giá/trạng thái: PATCH, DELETE, restore, submit, availability/departures, import/create, itinerary, upload image. Chặn khả năng STAFF đi đường vòng để thay `basePrice`, `agePricing`, `cancellationPolicy`, `childPricingPolicy`, `priceOverride`, `isOpen`, status hoặc xóa/đóng tour. Quyền itinerary cần nhất quán với PATCH allowlist.
- Test matrix: STAFF allowed từng trường và kết hợp; forbidden key/mixed payload/unknown key trả 403 và không ghi; Owner/Manager allowed; membership suspended/cross-agency bị chặn; endpoint phụ không bypass.

### 2. Editor theo membership

- `AgencyTourEditorPage` lấy role/permissions của **active agency**. STAFF xem các trường được phép; khóa toàn bộ trường còn lại, hiện badge khóa và ẩn các hành động status/xóa. Owner/Manager giữ trải nghiệm quản lý hiện hành.
- Tách `create` và `edit` payload; STAFF edit gửi PATCH tối thiểu chỉ gồm trường đã sửa và được phép. Không gửi lại giá/chính sách từ giá trị form. Validation theo đúng field STAFF đang chỉnh, không bắt họ sửa trường bị khóa.
- Kiểm tra bước stepper, preview, save, lỗi 403, đổi agency trong khi đang mở editor, và màn hình responsive/keyboard. Test request payload thực tế cùng UI.

### 3. Booking và dữ liệu hành khách

- Thêm cột JSONB `Booking.passengers` và validation năm sinh/nhóm tuổi; không lưu CCCD/hộ chiếu vào snapshot roster.
- Cập nhật checkout/API tạo booking và màn hình nhập khách; ghi passenger snapshot cùng booking theo transaction, kiểm tra lại khi khách đổi/cancel booking. Xác định cách xử lý trẻ em/infant từ `guestPricing` hiện hữu và booking cũ.
- `AgencyBookingsPage` hiển thị chi tiết khách, `status`, `isPaid` và trạng thái hoàn tiền nếu có. Mọi detail/list query theo active agency; STAFF chỉ đọc, không lộ dữ liệu của agency khác.

### 4. PDF roster theo departure

- Bổ sung `GET /api/v1/agency/tours/:tourId/departures/:departureId/customers.pdf`; xác minh departure thuộc tour và tour thuộc active agency. Giữ endpoint cũ một thời gian để tương thích, rồi cập nhật frontend dùng URL mới.
- Một dòng mỗi hành khách của booking CONFIRMED/COMPLETED; cột họ tên, năm sinh/nhóm tuổi, SĐT, điểm đón, ghi chú đặc biệt; kèm mã booking/liên hệ để đối soát. Chỉ lấy dữ liệu của departure được chọn; nêu rõ booking cũ thiếu hồ sơ, không nhân bản người liên hệ thành nhiều khách.
- Chống xuất quá lớn bằng phân trang/stream hoặc giới hạn có thông báo rõ, bảo đảm chữ Việt/font, ngắt trang, tên file và header PDF. Nút xuất đặt tại từng departure và danh sách booking; dùng permission `agency:export-customers`.
- Test 401/403/404, agency/departure khác, booking chưa thanh toán/cancelled, nhiều hành khách, booking cũ, ký tự Việt và giới hạn dữ liệu.

### 5. Khiếu nại và voucher trên tenant mới

- Chuyển complaint-tickets sang tenant-aware: list/detail/message/resolve scope bằng active agency, actor là nhân viên thực hiện. Bỏ legacy-owner gate cho module sau test cross-tenant. Kiểm tra link `/agency/complaints` ↔ API `/agency/complaint-tickets` và quyền `complaint:respond` của STAFF.
- Chuyển promotions sang tenant-aware: `ownerId`/scope phải là agency profile ID, người tạo/cập nhật là actor nếu nghiệp vụ cần; kiểm tra list/create/update/code instances không rò giữa agency. Bỏ legacy-owner gate sau test. STAFF hiện không có `promotion:agency-manage`: giữ quyền chỉ Owner/Manager; nếu STAFF cần quản lý voucher phải đổi policy riêng và kiểm tra UI/API.

### 6. Audit, kiểm thử và phát hành

- `TourUpdateLog` là scope tùy chọn: `id`, `tourId`, `agencyId`, `updatedByUserId`, `changedFields`, `createdAt`; index theo tour/thời gian; ghi thay đổi thật sau khi mutation thành công. `agencyId` giúp scope và audit khi tour bị archive.
- Chạy Prisma generate/migration trên DB thử nghiệm; unit/integration backend, frontend component/API tests, typecheck/build. Chạy smoke E2E với OWNER, MANAGER, STAFF, ACCOUNTANT, membership bị khóa và user có hai agency: editor → save → booking → PDF → complaint → voucher → đổi agency.
- Rollout theo thứ tự: migration passenger/audit (nếu chọn) → backend guard + tenant integration → frontend editor/checkout/PDF. Kiểm tra dữ liệu booking cũ và phản hồi 403 trước khi bật cho STAFF.

## Điều kiện Done

1. STAFF chỉ sửa được nội dung trong allowlist, mọi payload có trường cấm trả 403 và không đổi dữ liệu; mọi endpoint phụ tuân cùng chính sách.
2. OWNER/MANAGER sửa giá, chính sách, trạng thái theo quyền; STAFF nhìn thấy trạng thái khóa rõ ràng và lưu thành công phần nội dung.
3. Booking detail theo active agency hiển thị khách và thanh toán; PDF theo đúng departure xuất từng hành khách, chỉ từ booking hợp lệ.
4. STAFF xử lý được complaint trong agency; Owner/Manager quản lý được voucher trong agency; không ai truy cập được dữ liệu của agency khác bằng đổi ID/header.
5. Migration, test tự động và smoke E2E trên membership mới qua; endpoint cũ của PDF còn hoạt động trong thời gian chuyển tiếp nếu vẫn có consumer.

## Quyết định đã dùng và phần mở rộng sau này

- `highlights` đã thêm vào Tour. Các trường `summary`, điểm hẹn tour và ghi chú du lịch vẫn thuộc Owner/Manager.
- STAFF chỉ sửa nội dung tour và itinerary; lịch/sức chứa departure, `isOpen`, `priceOverride` thuộc Owner/Manager.
- Hồ sơ hành khách được nhập tùy chọn tại checkout, lưu năm sinh/nhóm tuổi. Booking cũ xuất một dòng liên hệ tổng hợp với số khách. Nếu vận hành yêu cầu đủ tên mọi hành khách, cần thêm bước bổ sung hồ sơ trước ngày đi.
- STAFF xử lý khiếu nại nhưng không quản lý voucher.
