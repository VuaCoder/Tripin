# Duyệt nội dung tour trước, xếp lịch sau

> Cập nhật yêu cầu 15/11/2026: giai đoạn tiếp theo đưa **lịch trình từng ngày** vào onboarding tạo/sửa tour và bỏ UI **Khởi hành & Giá vé** khỏi trang chi tiết quản lý. Xem [kế hoạch giai đoạn 2](tour-itinerary-onboarding.md). Các mục bên dưới lưu lại phạm vi đã triển khai ở giai đoạn 1; việc cho gửi duyệt với itinerary rỗng sẽ được xem xét thay bằng quy tắc nội dung hoàn chỉnh tại giai đoạn 2, không khôi phục yêu cầu có departure.

Trạng thái: đã triển khai và kiểm tra theo phương án giữ giá cơ bản. Không sửa calendar hoặc dữ liệu hiện có. Phần rà soát dưới đây mô tả trạng thái trước thay đổi.

## Mục tiêu

Agency hoàn thành thông tin tour rồi gửi kiểm duyệt, không cần tạo lịch trình từng ngày, ngày khởi hành, số chỗ hay giá từng đợt trước. Sau khi được duyệt mới dùng calendar hiện có để xếp lịch và chỉnh giá. Được duyệt không đồng nghĩa đã có chuyến để đặt.

## Kết quả rà soát code

- `backend/src/modules/tours/tours.service.ts`, `submitForReview`: kiểm tra agency đã xác minh, quyền sở hữu/trạng thái hợp lệ, có danh mục và có đợt mở trong tương lai (`NO_OPEN_DEPARTURE`). Không kiểm tra phải có itinerary.
- `decideReview`: không đòi hỏi lịch khởi hành hoặc itinerary. `applyContentChange` hiện giữ trạng thái APPROVED khi sửa nội dung; không đổi chính sách này trong tác vụ.
- `frontend/features/tours/components/AgencyTourEditorPage.tsx`: nút và thông báo tạo tour đang hướng sang thiết lập lịch trình/khởi hành. Workspace có nút gửi duyệt riêng.
- Trang quản lý hiển thị cả chương trình từng ngày (`itinerary`) và lịch vận hành (`departures`): đây là hai khái niệm khác nhau, không xóa chương trình tour vì đã có calendar.
- Public search hiện có thể trả về tour APPROVED/PUBLIC chưa có lịch nếu không lọc ngày/số khách. Booking thường vẫn yêu cầu departure hợp lệ, mở, tương lai và còn chỗ.
- `basePrice` là cột BigInt bắt buộc, dùng cho giá hiển thị và fallback khi departure không có priceOverride. Không thể bỏ toàn bộ giá bằng cách chỉ xóa một validation.

## Phương án đề xuất

### 1. Tách điều kiện gửi duyệt và điều kiện nhận booking

- Bỏ kiểm tra `NO_OPEN_DEPARTURE` khỏi gửi duyệt; không thêm yêu cầu itinerary, giá từng đợt hay số chỗ.
- Giữ kiểm tra xác minh agency, quyền, loại tour public/private, trạng thái chuyển đổi và nội dung hợp lệ.
- Không tự tạo departure/giá/số chỗ giả để qua kiểm duyệt.
- Giữ nguyên kiểm tra booking, giữ chỗ, thanh toán và snapshot booking cũ.

### 2. Điều chỉnh luồng tạo tour, không sửa calendar

- Hai lựa chọn rõ ràng: “Lưu bản nháp” và “Lưu & gửi duyệt”.
- Lưu & gửi duyệt: validate nội dung → tạo/lưu tour → gọi API gửi duyệt → về chi tiết quản lý tour.
- Nếu lưu thành công nhưng gửi duyệt lỗi: giữ ID tour vừa lưu, báo bản nháp đã lưu và cho gửi lại; không tạo tour trùng.
- Bỏ nhãn “Tạo tour & Thiết lập lịch trình” và các thông báo khiến xếp lịch trông như bước bắt buộc.
- Trong trang chi tiết, itinerary và khởi hành vẫn xem được nhưng là phần bổ sung, không nằm trong checklist gửi duyệt. Nếu chưa có lịch, hướng người dùng sang calendar bằng route hiện hữu sau khi xác minh route; không dựng editor hoặc API mới cho calendar.
- Giữ khóa sửa nội dung khi đang chờ duyệt và quyền truy cập hiện có.

### 3. Giá cơ bản: ranh giới cần thống nhất

Đề xuất phạm vi nhỏ: giữ giá cơ bản như thông tin tham khảo của tour, không yêu cầu cấu hình giá vé/giá từng đợt trước gửi duyệt. Calendar tiếp tục chỉnh giá vận hành như hiện tại.

Nếu yêu cầu là không nhập bất kỳ giá nào khi tạo tour: cần một hạng mục riêng cho basePrice nullable, migration, DTO/validation, giá hiển thị/search/sort và fallback booking. Không dùng 0 hoặc giá giả đại diện “chưa có giá”, không tự triển khai mở rộng này. Dù chọn phương án nào cũng không thay code calendar.

### 4. Tour đã duyệt nhưng chưa xếp lịch

- Giữ cơ chế public hiện có, hiển thị “Chưa có lịch khởi hành” và không cho booking thường khi thiếu departure hợp lệ.
- Không thêm trạng thái DB mới; trạng thái duyệt và khả năng đặt là hai điều kiện độc lập.
- Rà UI moderator/notification để không coi thiếu lịch là lỗi hoặc thông báo tour đã mở bán ngay khi được duyệt. Thông báo duyệt nên ghi “Tour đã được duyệt. Bạn có thể xếp lịch khởi hành khi sẵn sàng.”
- Không thay đổi luồng yêu cầu tour đoàn/custom tour trong tác vụ này.

## Thứ tự thực hiện

1. Bỏ điều kiện lịch ở service gửi duyệt, cập nhật unit/integration test và tài liệu rule/API liên quan.
2. Thêm nhánh lưu & gửi duyệt và xử lý retry an toàn tại editor; chỉnh CTA/thông báo workspace.
3. Rà trạng thái chưa có lịch ở moderator/public/notification; giữ các chốt booking hiện tại.
4. Kiểm tra diff bảo đảm không thay `frontend/features/agency-calendar`, calendar API, quyền calendar hoặc logic giá/chỗ calendar.

## Nghiệm thu

- Tour hợp lệ với itinerary=[] và departures=[] gửi duyệt và được duyệt bình thường.
- Lịch chỉ có ngày cũ/đóng/hết chỗ không cản gửi duyệt; nhưng không cho booking thường trên lịch đó.
- Agency chưa xác minh, sai quyền, sai chủ sở hữu hoặc sai trạng thái vẫn bị chặn.
- Lưu thành công/gửi lỗi/retry không tạo thêm tour và không làm mất nội dung.
- Đã duyệt nhưng chưa có lịch: xem được theo chính sách hiện tại, không tạo booking thường được.
- Xếp lịch sau duyệt qua calendar cũ hoạt động nguyên trạng; booking có sẵn không đổi giá/chỗ/snapshot.
- Tour cũ, private/custom tour và phân quyền không bị thay đổi ngoài phạm vi đã nêu.

Không cần migration cho phương án giữ basePrice. Không chạy migration hoặc cập nhật DB trong giai đoạn nghiên cứu.

## Kết quả triển khai và xác minh (15/11/2026)

- Editor có Lưu bản nháp / Lưu & gửi duyệt. Gửi duyệt lỗi sau khi lưu sẽ chuyển về tour đã lưu, có hướng dẫn gửi lại, không tạo bản nháp thứ hai.
- Bỏ điều kiện lịch khởi hành tại service gửi duyệt, giữ quyền, agency verified, danh mục, chuyển trạng thái và chốt booking. Không sửa calendar; workspace chỉ thêm liên kết tới route `/agency/calendar` hiện hữu.
- Unit backend: 49 test qua; frontend editor: 27 test qua; integration tour: 10 test qua; HTTP error contract: 8 test qua. Integration dùng PostgreSQL tạm trên máy, không dùng DB chung. Một test HTTP auth timeout ở lượt chạy song song, chạy lại riêng bộ HTTP với timeout 60 giây/test đã qua cả 8 test.
- Typecheck frontend/backend đã qua. Chưa xác minh trực quan trên trình duyệt.
- Không thay schema, không migration, không ghi dữ liệu DB chung và không commit/push.
