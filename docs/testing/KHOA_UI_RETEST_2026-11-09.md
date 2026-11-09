# Khoa — đợt sửa UI sau kiểm thử localhost (09/11/2026)

Nhánh: `remake-report-feature`. Phạm vi đợt sửa: tìm kiếm/đặt tour, chi tiết đơn và hồ sơ; kèm test hồi quy và hướng dẫn kiểm thử lại.

## Các phần đã sửa trong code

| Phần | Sửa đổi | Kiểm thử lại trên localhost |
| --- | --- | --- |
| Tìm kiếm → tour → form đặt | Truyền riêng `adults`, `children`, `infants`; tổng khách tính cả em bé. Giữ số khách khi đổi lịch khởi hành. Chọn lịch theo khoảng ngày tìm kiếm nếu có lịch phù hợp. | Home chọn 2 người lớn + 1 trẻ em + 1 em bé. `/tours`, chi tiết và form đặt phải giữ 2/1/1, tổng 4 người. |
| Chưa đăng nhập → đặt tour | Đưa URL form đặt, ngày và số khách vào `next`, giữ qua bước OTP. | Chọn ngày 14/01/2027 và 2 khách, đăng nhập, phải về đúng form đặt với lựa chọn đó. |
| `/tours` | Bỏ dòng đếm kết quả; thêm list/grid; bộ lọc riêng ba nhóm khách. | Đổi kiểu hiển thị, bộ lọc và trang kết quả; số khách vẫn giữ đúng. |
| Chi tiết đơn | Lấy ảnh từ API tour; tên tour và nút xem tour mở tab mới; đưa dòng voucher trước tạm tính; hiển thị đánh giá đã gửi dưới lịch sử trạng thái. | Kiểm tra `TRP-LNZ7WTZC` (voucher) và `TRP-3R5GHK8N` (không voucher); cần thêm đơn đã có đánh giá. |
| Xác nhận đặt | Khóa submit trong suốt bước kiểm tra chỗ và tạo đơn; dùng kết quả kiểm tra voucher vừa nhận; chỉ trừ giảm giá agency một lần trước khi kiểm tra mã nền tảng. | Bấm xác nhận một lần phải nhận phản hồi rõ. Nếu thử bấm nhanh hai lần thì không gửi hai yêu cầu tạo đơn đồng thời. |
| Hồ sơ | Nút sửa chỉ có icon và nhãn hỗ trợ đọc màn hình; bỏ hai khối ví voucher và xác thực hai lớp trong nội dung hồ sơ. | Kiểm tra icon vẫn mở form; các mục điều hướng ví và bảo mật vẫn sử dụng được. |

## Kết quả kiểm tra tự động

- 49 test trong 10 file liên quan đã qua: tìm kiếm, đặt tour, đường dẫn sau đăng nhập, chi tiết đơn, voucher và hồ sơ.
- `git diff --check` qua.
- TypeScript toàn frontend còn lỗi `code?: string` so với `code: string` tại `features/agency-reviews/__tests__/AgencyReviewsPage.test.tsx:42` và `features/moderation/__tests__/moderation.flows.test.tsx:51`. Hai file này không nằm trong thay đổi đợt này.
- Chưa kiểm tra trực quan trong trình duyệt: công cụ Browser không khởi động được do lỗi cấu hình `agents` trong môi trường.
- Các test dùng dữ liệu giả lập; không tạo, thanh toán hoặc hủy thêm đơn thật.

## Các điểm còn cần kiểm thử/dữ liệu

- Tour chưa công bố chính sách giá theo tuổi: giữ lựa chọn trẻ em/em bé và báo lý do không thể đặt, không tự chuyển các nhóm này thành người lớn hoặc về 1 khách. Cần chọn tour có chính sách giá phù hợp để kiểm tra luồng 2/1/1 hoàn chỉnh.
- Ảnh chi tiết đơn phụ thuộc API tour hiện tại và URL ảnh còn truy cập được; tour bị ẩn/xóa có thể không trả về ảnh.
- Tên `Đỗ H.`, `Phạm H.`, `Lê V.`: backend rút gọn tên tại `backend/src/modules/reviews/reviews.mapper.ts`. Script `backend/src/scripts/demo-tour-reviews.ts` tạo người dùng demo và lưu đánh giá qua Prisma. Chưa truy vấn database của localhost để xác minh từng bản ghi; chưa đổi cách hiển thị tên trong đợt này.
- Voucher home/ví: chưa có dữ liệu để kiểm tra lưu voucher, ẩn voucher đã lưu, layout 1/2/3/4+, màu premium, đã dùng và hết hạn.
- Premium: cần kiểm tra gói và giá thực sự gửi khi khởi tạo thanh toán; chưa khởi tạo thanh toán thật trong đợt này.

## Thứ tự bạn nên test lại

1. Tìm kiếm 2/1/1 → tour có giá theo tuổi → form đặt; báo lỗi đầu tiên nếu có.
2. Đăng xuất → chọn ngày/số khách → đăng nhập → kiểm tra khôi phục lựa chọn.
3. List/grid và bộ lọc số khách.
4. Hai đơn đối chiếu và trang hồ sơ.
5. Xác nhận đơn, nếu cần test lại hiện tượng bấm hai lần. Ghi lại thông báo hoặc phản hồi request đầu tiên nếu vẫn xảy ra.
