# Kế hoạch booking đoàn qua chat

> Trạng thái: đề xuất, chưa triển khai. Chỉ bắt đầu khi chủ dự án yêu cầu.
> Phạm vi: web khách hàng + agency và backend; không triển khai giao diện Flutter trong đợt này.
> Các nhận xét về mã nguồn dựa trên lần khảo sát ngày 11/11/2026; cần kiểm tra lại trước khi thực hiện.

## 1. Mục tiêu

Khách gửi yêu cầu booking đoàn từ tour đang xem. Agency nhận hoặc từ chối; nếu nhận, hệ thống tạo một tour riêng kế thừa tour gốc. Hai bên thương lượng qua chat, khách xem nội dung agency chỉnh sửa và chấp nhận thỏa thuận trước khi nhập danh sách thành viên, tạo đơn và thanh toán bằng luồng hiện có.

Thoát trang, đóng panel, tải lại hoặc quay về sau đó phải có vị trí để tiếp tục đúng tiến trình; không tạo trùng tour, booking hoặc thanh toán.

## 2. Quyết định đã được người dùng xác nhận

| Nội dung | Quyết định |
| --- | --- |
| Nền tảng | Web trước; giữ tương thích API mobile hiện có |
| Quy mô | 2–50 thành viên; không mở giới hạn booking lẻ |
| Giá | Theo nhóm người lớn, trẻ em, em bé |
| Giấy tờ | Mọi thành viên bắt buộc họ tên, CCCD và SĐT |
| Ngày khởi hành | Có thể chốt ngày riêng trong quá trình thương lượng |
| Duyệt tour | Hai bên chốt trực tiếp, không cần admin duyệt tour riêng |
| Form yêu cầu ban đầu | Chỉ số thành viên và ghi chú yêu cầu |

**Hệ quả cần giữ nguyên:** trẻ em/em bé chưa có CCCD sẽ không thể hoàn tất booking theo yêu cầu hiện tại. Không tự thay bằng giấy khai sinh hoặc bỏ bắt buộc nếu chưa được người dùng đổi yêu cầu.

### Giả định đề xuất, cần xác nhận khi bắt đầu

- Tour đoàn chỉ dành cho khách tổ chức gửi yêu cầu, không xuất hiện công khai.
- Chỉ agency đã xác minh được nhận yêu cầu và chốt tour riêng.
- Giá đã thương lượng không cộng voucher, ưu đãi tự động hoặc khuyến mãi khác.
- Ít nhất một thành viên là người lớn, theo bộ tính giá hiện có.
- Sau khi khách chấp nhận, không được tự đổi nội dung, lịch, cơ cấu đoàn hoặc giá; thương lượng lại sau chốt nằm ngoài phạm vi đợt đầu.
- Khách xem toàn bộ thông tin tour **đã lưu**; không truyền thao tác gõ dở của agency.

## 3. Hiện trạng và điểm tái sử dụng

- [TourBookingCard](../../frontend/features/tours/components/detail/TourBookingCard.tsx): vị trí thêm nút yêu cầu đoàn cạnh phần số người; giữ nguyên nút booking lẻ.
- [Custom tours README](../../backend/src/modules/custom-tours/README.md): module hiện là placeholder; chưa có API, state machine hoặc dữ liệu.
- [Schema Prisma](../../prisma/schema.prisma): chưa có visibility tour riêng, yêu cầu đoàn, danh sách hành khách hoặc bản nháp checkout.
- [Chat policy](../../backend/src/modules/chat/chat.policy.ts), [chat service](../../backend/src/modules/chat/chat.service.ts), [ChatProvider](../../frontend/features/chat/ChatProvider.tsx) và [chat route guard](../../frontend/app/conversations/layout.tsx): hiện giới hạn khách ↔ hướng dẫn viên, cần mở đồng bộ cho agency.
- [ConversationPage](../../frontend/features/chat/ConversationPage.tsx): tái sử dụng inbox/thread, bổ sung thẻ ghim và panel.
- [AgencyTourEditorPage](../../frontend/features/tours/components/AgencyTourEditorPage.tsx) và [tour editor validation](../../frontend/features/tours/components/tourEditorValidation.ts): tái sử dụng trường, component và kiểm tra hợp lệ; không sao chép nguyên trang editor vào chat.
- [Age pricing](../../packages/constants/src/age-pricing.ts): đã hỗ trợ cơ cấu độ tuổi, giá riêng cho trẻ/em bé và giới hạn 50 người.
- [BookingEntryPage](../../frontend/features/booking/components/BookingEntryPage.tsx): hiện chỉ nhập người liên hệ; cần nhánh tour đoàn và danh sách từng thành viên.
- [IncompleteBookingBanner](../../frontend/features/booking/components/IncompleteBookingBanner.tsx): đã có banner đơn chưa hoàn tất nhưng chỉ xét một phần lịch sử; không dùng làm đường quay lại duy nhất.
- [Bookings service](../../backend/src/modules/bookings/bookings.service.ts) và [payments service](../../backend/src/modules/payments/payments.service.ts): tái sử dụng tính tiền phía server, giữ chỗ, chống trùng, PayOS, đối soát và vé. Booking hiện có hạn giữ chỗ 15 phút.

Không tạo hệ thống thanh toán riêng, không thêm dependency nếu component/thư viện hiện tại đáp ứng.

## 4. Phân rã phạm vi và thứ tự

| Phần | Trách nhiệm | Phụ thuộc |
| --- | --- | --- |
| `group-request` | Yêu cầu, quyền sở hữu, clone riêng và state machine | Tour/users hiện có |
| `group-negotiation` | Chat agency, chỉnh tour, gửi và chấp nhận thỏa thuận | `group-request` |
| `group-checkout` | Lưu danh sách, snapshot giá, tạo booking, tiếp tục thanh toán | `group-negotiation`, bookings/payments hiện có |

Thực hiện tuần tự theo bảng. Đây là các phần của cùng luồng nghiệp vụ, không tạo framework cộng tác hoặc dịch vụ mới.

## 5. Mô hình dữ liệu và trạng thái

### 5.1. CustomTourRequest

Thêm model yêu cầu đoàn, tối thiểu gồm:

- `id`, `travelerId`, `agencyId`, `sourceTourId`, `conversationId`.
- `participants`, `notes`, cơ cấu `adults/children/infants` được chốt trong thương lượng.
- Lịch gốc tham khảo nếu có; ngày khởi hành riêng khi agency cấu hình.
- `privateTourId` duy nhất, lịch riêng liên quan.
- `status`, `revision`, thời điểm tạo/cập nhật/gửi thỏa thuận/chấp nhận.
- Snapshot thỏa thuận được chấp nhận: nội dung, chính sách, ngày, cơ cấu, đơn giá từng nhóm và tổng tiền.
- Bản nháp checkout, phiên bản bản nháp, bước đang làm và liên kết booking hiện hành.
- Khóa yêu cầu để chống tạo trùng khi gửi lại.

Liên kết request với từng lần booking để truy vết các lần hết hạn/hủy; booking mới không xóa lịch sử cũ.

### 5.2. State machine

```text
SUBMITTED → NEGOTIATING → OFFERED → ACCEPTED
    ├────→ DECLINED
    └────→ CANCELLED (khách rút khi chưa được nhận)

OFFERED → NEGOTIATING (agency sửa lại, phải gửi thỏa thuận mới)
```

- Agency nhận yêu cầu: clone tour + liên kết conversation + chuyển trạng thái trong một transaction.
- Agency chỉnh bản nháp: tăng revision. Cơ cấu độ tuổi phải khớp tổng người yêu cầu.
- Agency bấm **Gửi thỏa thuận**: kiểm tra đủ nội dung, chính sách, ngày và giá trước khi chuyển `OFFERED`.
- Khách bấm **Chấp nhận thỏa thuận**: compare-and-set đúng revision, khóa snapshot và chuyển `ACCEPTED` trong transaction.
- Sửa hoặc chấp nhận bản cũ trả conflict, không tự ghi đè hoặc chấp nhận giá mới.
- Thanh toán lấy trạng thái từ booking/payment, không tạo trạng thái tiền độc lập trên request.
- Từ chối hoặc rút yêu cầu không tạo tour riêng.

### 5.3. Tour riêng

- Thêm visibility `PUBLIC/PRIVATE`, mặc định `PUBLIC` để giữ nguyên tour cũ.
- Clone nội dung, ảnh, lịch trình, danh mục và chính sách từ tour gốc tại thời điểm agency nhận.
- Không clone ID, đánh giá, doanh số, tồn chỗ đã bán, metadata duyệt hoặc trạng thái nhận phân công của hướng dẫn viên.
- Tạo một lịch riêng có capacity bằng quy mô đoàn, remaining mới; ngày tour gốc chỉ là gợi ý ban đầu.
- Giữ `DRAFT` khi thương lượng. Khi khách chấp nhận, chuyển sang trạng thái bookable hiện có nhưng vẫn `PRIVATE`.
- Cổng này chỉ dùng cho request hợp lệ của agency đã xác minh; không mở quyền tự duyệt tour công khai.
- Sau khi chấp nhận, chặn mọi thay đổi làm sai thỏa thuận qua cả API đoàn lẫn API quản lý tour thường.

### 5.4. Hành khách và bảo vệ dữ liệu

Thêm danh sách hành khách gắn booking: thứ tự, nhóm tuổi, họ tên, CCCD và SĐT. Trường mới không bắt buộc đối với booking lẻ.

- Danh sách phải đủ và đúng số lượng/cơ cấu đã chốt.
- Đề xuất validate CCCD 12 chữ số, SĐT theo validator chung và CCCD không trùng trong đoàn.
- Bản nháp được lưu server trước khi tạo booking; khi tạo đơn, sao chép thành snapshot gắn booking.
- Chỉ khách chủ đơn và agency phụ trách được đọc dữ liệu cần thiết theo quyền đối tượng.
- Không đưa CCCD vào URL, message chat, thông báo, log hoặc localStorage; không phát CCCD trong sự kiện socket.
- Kiểm tra chính sách bảo vệ/lưu giữ dữ liệu nhạy cảm của dự án trước triển khai; tài liệu này không coi kiểm soát quyền truy cập là thay thế cho chính sách bảo mật dữ liệu.

## 6. API và backend

Dùng cấu trúc controller/service/repository/validation của dự án trong module custom-tours. Thêm permissions tập trung, DTO, validation và lỗi theo chuẩn hiện tại.

Các endpoint đề xuất dưới `/api/v1/custom-tours`:

| Endpoint | Chức năng và dữ liệu chính |
| --- | --- |
| `POST /` | Gửi `{sourceTourId, participants, notes, clientRequestId}`; lịch gốc tùy chọn, agency suy ra phía server |
| `GET /` | Danh sách theo actor, phân trang, lọc conversation/trạng thái |
| `GET /:id` | Chi tiết request và tour riêng theo quyền |
| `PATCH /:id/decision` | Agency nhận/từ chối hoặc khách rút yêu cầu đang chờ; kiểm tra actor, trạng thái, revision |
| `PATCH /:id/draft` | Agency lưu nội dung/lịch/cơ cấu/giá kèm revision |
| `POST /:id/offers` | Agency gửi thỏa thuận đã hoàn chỉnh |
| `POST /:id/acceptance` | Khách chấp nhận chính xác revision đang xem |
| `PATCH /:id/checkout-draft` | Lưu liên hệ, hành khách, bước hiện tại và phiên bản bản nháp |
| `POST /:id/bookings` | Trả booking còn hiệu lực hoặc tạo lần booking mới từ snapshot server |

### Quy tắc bắt buộc

- Actor lấy từ session, không tin `agencyId`, `travelerId`, số tiền hoặc tour riêng do client tự gửi.
- Kiểm tra tour nguồn hợp lệ, agency hoạt động/đã xác minh và tài khoản khách đáp ứng điều kiện booking.
- Unique constraint và transaction chống nhận hai lần tạo hai clone; không dùng heuristic chống trùng 5 giây của form tour thường.
- Khóa retry ổn định cho một ý định; cùng khóa khác payload bị từ chối.
- Tách khóa của request khỏi khóa từng lần booking. Booking hết hạn phải tạo ý định mới, không replay mãi booking đã hủy.
- Tất cả thao tác chỉnh sửa dùng revision; xung đột trả `409` và giữ dữ liệu người dùng để tải lại/đối chiếu.
- Không truy cập được request/tour riêng của người khác, kể cả biết UUID; dùng quy ước 404 của dự án.
- Public search/list/destinations/cards/recommendations/detail phải loại tour riêng phía server.
- Cổng booking chung phải kiểm tra khách được chỉ định và request đã chốt; không cho bypass qua POST booking trực tiếp hoặc giỏ hàng.
- Chặn đổi thỏa thuận qua content/availability/itinerary/guide mutation nếu thay đổi đó tác động cam kết, cũng như submit/archive/restore. Nghiệp vụ vận hành không đổi cam kết được giữ theo quyền hiện có.

## 7. Chat agency và đồng bộ

- Mở agency trong permissions, REST service/policy, socket, frontend provider, route guard và navigation; không chỉ sửa `canConverse`.
- Giữ nguyên hoạt động chat khách ↔ hướng dẫn viên và các DTO cũ.
- Phương án ít thay đổi đề xuất: giữ cột `guideId` làm vị trí nhà cung cấp nội bộ vì hiện không có FK giới hạn role; kiểm tra role thực tế và ghi rõ ý nghĩa mở rộng. Không đổi tên toàn bộ schema/API chat trong đợt này.
- Request liên kết conversation riêng. Không dùng `Conversation.tourId` làm nguồn duy nhất vì một cặp khách–agency có thể có nhiều yêu cầu/tour.
- Thông báo trong app khi có yêu cầu, quyết định và thỏa thuận mới; nội dung không chứa giấy tờ hành khách.
- Sau transaction thành công, socket hiện có phát tín hiệu thay đổi theo người tham gia; frontend invalidates/refetch dữ liệu thật.
- Reconnect, chuyển lại tab và polling phải khôi phục trạng thái nếu bỏ lỡ sự kiện. REST/database là nguồn dữ liệu chính, socket không quyết định giá hoặc trạng thái.

## 8. Giao diện

### 8.1. Tại tour gốc

- Nút **Yêu cầu booking đoàn** cạnh khu vực chọn số người; không thay nút booking lẻ.
- Form chỉ có số người 2–50 và ghi chú; lấy số người hiện chọn làm gợi ý hợp lệ.
- Nút yêu cầu đoàn không phụ thuộc lịch bán lẻ còn ghế vì đoàn dùng lịch riêng.
- Nếu chưa đăng nhập, đưa về đúng tour sau đăng nhập; không đưa ghi chú/giấy tờ vào URL.
- Gửi thành công dẫn tới conversation có request tương ứng. Gửi lỗi giữ nguyên input để thử lại.

### 8.2. Danh sách yêu cầu

- Agency có mục **Yêu cầu đoàn**: trạng thái, khách, tour nguồn, số người, hành động nhận/từ chối và vào chat.
- Khách có **Yêu cầu của tôi** với trạng thái và hành động tiếp tục theo tiến trình.
- Dùng pagination và filter sẵn có; không phụ thuộc request phải nằm trong trang đầu mới tìm lại được.

### 8.3. Thẻ ghim và panel trong chat

- Thẻ chữ nhật dưới tiêu đề chat: tên tour, số người, trạng thái, bảng giá tóm tắt và hành động hiện tại.
- Có nhiều request cùng conversation: bộ chọn request, không ghi đè hoặc làm mất các thỏa thuận trước.
- Desktop: bấm thẻ mở panel trượt từ trái cạnh vùng chat; chat vẫn dùng được.
- Mobile web: panel toàn màn hình, nút đóng/quay lại rõ ràng.
- Agency chỉnh nội dung tour, ảnh, lịch trình, bao gồm/không bao gồm, chính sách, ngày khởi hành, cơ cấu và giá theo nhóm bằng component/validation tái sử dụng.
- Có **Lưu thay đổi** theo phần, trạng thái chưa lưu, cảnh báo đóng/rời trang; không coi việc ẩn panel là hủy request.
- Khách xem toàn bộ nội dung đã lưu; chỉ được chấp nhận khi agency đã gửi thỏa thuận đủ điều kiện.
- Màn xác nhận chấp nhận hiển thị ngày, cơ cấu, giá từng nhóm và tổng tiền. Sau chấp nhận chuyển panel chỉ đọc.
- Xử lý loading, empty, lỗi, retry và thiếu quyền. Hỗ trợ bàn phím, focus mở/đóng, nhãn form và reduced motion.

## 9. Checkout và khả năng tiếp tục

### 9.1. Trước khi tạo booking

URL ổn định đề xuất:

```text
/traveler/bookings/new?customTourRequestId=<id>
```

- Lấy tour qua API request có quyền, không qua public tour detail.
- Khóa số người/cơ cấu/đơn giá theo thỏa thuận.
- Tạo đúng số dòng nhập hành khách; người liên hệ được nhập như booking thường.
- Lưu nháp tự động server với revision, trạng thái **Đang lưu / Đã lưu / Lưu lỗi** và nút thử lại.
- Tuần tự hóa các lần lưu, không để phản hồi cũ ghi đè dữ liệu mới; xung đột đa tab phải được báo.
- Khi rời trang vẫn còn dữ liệu chưa lưu, cảnh báo trước. Không hứa khôi phục phần chưa từng lưu thành công nếu đóng cưỡng bức khi mất mạng.
- Reload, đăng nhập lại hoặc dùng thiết bị khác khôi phục phần đã lưu từ server.

### 9.2. Tạo booking và thanh toán

- Backend kiểm tra đủ thành viên, khóa request khi tạo, sao chép snapshot và reserve inventory trong transaction.
- Tính tiền bằng bộ giá độ tuổi phía server; không nhận giá client và không tự cộng voucher vào giá thỏa thuận.
- Double-click/retry/đa tab chỉ dẫn tới một booking hoạt động cho request.
- Sau tạo đơn, dùng trang chi tiết booking và endpoint PayOS hiện có; không thêm payment purpose riêng.
- Các trang thẻ ghim, yêu cầu của tôi và lịch sử đều chỉ tới bước hiện hành: **Tiếp tục nhập thông tin**, **Tiếp tục thanh toán** hoặc **Xem đơn**.

### 9.3. Hết hạn và kết quả chưa xác định

- Booking/payment còn hiệu lực: trả về cùng đơn/link thanh toán.
- Booking hết 15 phút: giải thích rõ và cho tạo lần booking mới từ thỏa thuận đã khóa nếu ngày khởi hành và các điều kiện còn hợp lệ.
- Không hồi sinh booking cũ; không tự đổi giá khi tạo lần mới.
- Khi kết quả thanh toán chưa xác định, đối soát trước; không mở một lần thu tiền thứ hai do timeout.
- Webhook đến muộn tiếp tục theo xử lý tiền muộn/hoàn tiền hiện có, không tự xác nhận một booking đã hủy.
- Quá ngày khởi hành, tour bị chặn hợp lệ hoặc điều kiện không còn đáp ứng: hiện lý do và hướng về chat, không tạo đơn lỗi.

## 10. Thứ tự triển khai và điểm kiểm chứng

### Giai đoạn 1 — Dữ liệu và request

- [ ] Migration cộng thêm cho request, visibility, snapshot và hành khách; giữ mặc định tương thích dữ liệu cũ.
- [ ] State machine, permissions, repository/service và API gửi/nhận/từ chối.
- [ ] Clone đúng một lần trong transaction; kiểm thử riêng tư và quyền đối tượng.

**Nghiệm thu:** gửi → agency nhận/từ chối hoạt động; tour gốc không đổi, clone không công khai và không tạo trùng.

### Giai đoạn 2 — Chat và thỏa thuận

- [ ] Mở agency chat toàn bộ các lớp; giữ chat hướng dẫn viên.
- [ ] API lưu bản nháp, gửi offer, chấp nhận revision và khóa mọi đường sửa.
- [ ] Socket invalidation và thông báo sau commit.

**Nghiệm thu:** agency sửa, khách xem; sửa/chốt từ hai tab không chấp nhận sai revision hoặc sai tiền.

### Giai đoạn 3 — Giao diện yêu cầu và panel

- [ ] Nút/form tại tour gốc và danh sách yêu cầu hai phía.
- [ ] Thẻ ghim, bộ chọn request và panel desktop/mobile.
- [ ] Loading/error/retry, chưa lưu, keyboard/focus.

**Nghiệm thu:** hai phiên khách–agency dùng được từ yêu cầu đến chấp nhận; đóng panel không mất tiến trình đã lưu.

### Giai đoạn 4 — Checkout và resume

- [ ] Danh sách hành khách, lưu nháp và URL tiếp tục.
- [ ] Booking từ snapshot và liên kết lịch sử các lần đặt.
- [ ] Tái sử dụng PayOS/vé, xử lý hết hạn và kết quả chưa xác định.
- [ ] Liên kết tiếp tục từ chat, danh sách yêu cầu và lịch sử.

**Nghiệm thu:** rời mọi bước đều quay lại đúng nơi; không thu trùng, không mất dữ liệu đã lưu và không thay giá đã chốt.

### Giai đoạn 5 — Hồi quy, tài liệu và chuẩn bị phát hành

- [ ] Cập nhật quyết định D-56 và tài liệu custom-tours/chat/API theo tính năng được phép triển khai.
- [ ] Thay assertion placeholder trong [build smoke test](../../backend/src/scripts/__tests__/build-smoke.integration.test.ts) bằng kiểm tra tính năng/quyền thực tế; không bỏ test để né lỗi.
- [ ] Migration thử trên database kiểm thử trước; không tự chạy migration production.
- [ ] Kiểm thử hồi quy và kiểm tra hai phiên người dùng, tài khoản thứ ba, desktop/mobile web.

## 11. Ma trận kiểm thử bắt buộc

| Nhóm | Ca kiểm thử |
| --- | --- |
| Request | 2/50 hợp lệ; ngoài giới hạn bị chặn; retry không nhân đôi; actor không giả mạo agency |
| Clone | Nhận đồng thời chỉ một clone; từ chối không clone; nội dung kế thừa đúng, không copy inventory/ratings/guide acceptance |
| Privacy | Tour riêng không lộ qua search/list/cards/destinations/detail/recommendations; người ngoài biết ID vẫn bị chặn |
| Chat | Agency dùng REST/socket/inbox; chat hướng dẫn viên vẫn hoạt động; nhiều request cùng cặp không bị ghi đè |
| Revision | Hai agency tab cùng sửa; khách chấp nhận bản cũ; chỉnh offer cần gửi lại; mọi mutation tour tôn trọng khóa |
| Giá | Cơ cấu khớp tổng; có người lớn; bảng giá từng nhóm đúng; integer VND/giới hạn tiền; chặn client sửa tiền và ưu đãi ngoài thỏa thuận |
| Hành khách | Đủ số dòng; thiếu/sai CCCD hoặc SĐT; CCCD trùng; quyền đọc; không lộ dữ liệu qua URL/log/socket |
| Resume | Reload, đóng panel, đổi route, đăng nhập lại, mất mạng, lỗi lưu và xung đột đa tab |
| Booking | Double-click, retry, cạnh tranh tạo đơn; gọi thẳng API/giỏ hàng không bypass private owner |
| Payment | Link còn hạn, hủy, hết hạn, timeout chưa rõ kết quả, đối soát, webhook trùng/muộn và vé một lần |
| Hồi quy | Booking lẻ, promotions thường, chat guide, quản lý tour, export và payment hiện có |
| UI | 320/768/1024/1440px; keyboard, focus, reduced motion, lỗi tải và retry |

## 12. Lệnh xác minh dự kiến

Chỉ chạy khi triển khai được cho phép; một số script có thể generate Prisma hoặc chuẩn bị môi trường.

```bash
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter frontend test
pnpm --filter backend typecheck
pnpm --filter frontend exec tsc --noEmit
pnpm --filter backend build
pnpm --filter frontend build
```

Dùng hạ tầng database test sẵn có, không trỏ integration test vào production. Kiểm tra lại script/version và cấu hình browser trước khi chạy. Browser acceptance cần hai phiên đã xác thực khách–agency và tài khoản ngoài cuộc để kiểm tra quyền.

## 13. Ngoài phạm vi và rủi ro

### Không làm trong đợt đầu

- Giao diện Flutter, AI tạo tour, payment provider mới.
- Tour đoàn công khai, marketplace tour tùy chỉnh hoặc framework chỉnh sửa cộng tác.
- Hơn 50 thành viên, nhập danh sách hàng loạt, voucher bổ sung cho giá đoàn.
- Thay đổi thỏa thuận đã chấp nhận hoặc nới yêu cầu CCCD nếu chưa được người dùng xác nhận lại.

### Rủi ro cần biết trước khi bắt đầu

1. CCCD bắt buộc cho mọi người làm thành viên chưa có CCCD không thể hoàn tất đơn.
2. CCCD là dữ liệu nhạy cảm; cần quyền truy cập chặt, hạn chế log và tuân thủ chính sách lưu giữ/bảo vệ của dự án.
3. Trạng thái `APPROVED` hiện đồng nghĩa tour công khai ở nhiều nơi; phải thêm privacy guard toàn bộ, không chỉ ẩn frontend.
4. Tour đã duyệt hiện còn sửa được qua nhiều endpoint; phải khóa đồng bộ để tránh đổi giá/nội dung sau chốt.
5. Cột chat `guideId` mang nghĩa mở rộng nếu tái sử dụng cho agency; cần tài liệu và test role để tránh các caller tiếp tục mặc định luôn là hướng dẫn viên.
6. Booking có hạn 15 phút; hết hạn phải tạo lần đặt mới nhưng không đổi snapshot, không tái thu khi thanh toán trước chưa rõ kết quả.
7. Mất mạng và đóng cưỡng bức trước khi lưu thành công không thể bảo đảm khôi phục từng ký tự; giao diện phải phân biệt rõ đã lưu/chưa lưu.

## 14. Hướng dẫn tiếp tục trong tương lai

Khi chủ dự án yêu cầu bắt đầu:

1. Đọc lại tài liệu này, git status, hướng dẫn repo và code liên quan; không coi đường dẫn/hành vi khảo sát là chắc chắn vẫn đúng.
2. Xác nhận các giả định còn mở ở mục 2 và chính sách dữ liệu nhạy cảm; nếu thay đổi, cập nhật plan trước.
3. Bắt đầu giai đoạn 1, kiểm chứng từng lát cắt rồi mới mở rộng; giữ nguyên hành vi booking/chat/payment cũ.
4. Không tự deploy, migrate production hoặc bắt đầu triển khai chỉ vì tài liệu này đã được lưu.

**Tình trạng lúc lưu:** chỉ khảo sát mã nguồn và viết kế hoạch; chưa triển khai tính năng, chưa chạy test/build/browser hoặc kiểm chứng database runtime.
