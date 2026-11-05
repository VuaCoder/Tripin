# Tour Guide: gói dịch vụ và thu nhập

## Subscribe to Plan

1. Đăng nhập TOUR_GUIDE → menu **Gói dịch vụ** (`/guide/subscriptions`). GuideLayout chặn guest/role khác; backend kiểm tra `subscription:subscribe` độc lập với UI.
2. Màn hình tải plans, gói đang có hiệu lực và lịch sử riêng bằng ba query độc lập. Lỗi một phần có retry tại phần đó; lỗi không được đổi thành trạng thái rỗng.
3. Chọn plan hoặc tiếp tục một pending → hộp thoại xác nhận → `POST /subscriptions { planId }`. Không gửi identity hoặc giá từ browser.
4. Server snapshot giá/thời hạn, reuse pending cùng plan, tạo/reuse payment. Chỉ mở URL HTTPS do API trả thành công. Gateway lỗi có thể để lại pending: UI tải lại lịch sử và báo lỗi, không báo đăng ký thành công.
5. PayOS quay về `/payment/success?paymentId=...` hoặc `/payment/cancel?paymentId=...`. Cả hai màn hình gọi API payment có ownership. Tên route và query callback không quyết định thành công/hủy.
6. PENDING được kiểm tra định kỳ trong tối đa 20 giây, rồi cho kiểm tra thủ công. CANCELLED, EXPIRED, FAILED hiển thị riêng. SUBSCRIPTION luôn dẫn về `/guide/subscriptions`; thử lại dùng planId từ lịch sử của user, không gọi API checkout booking.
7. PAID xác nhận tiền đã nhận. Với subscription, UI đọc lại lịch sử cá nhân để tìm đúng `referenceId` (duyệt các trang khi cần), chỉ báo kích hoạt nếu subscription đó ACTIVE. Có payment PAID nhưng chưa đọc được ACTIVE thì hiển thị chưa xác nhận kích hoạt/đang đồng bộ, có retry.
8. Kỳ đang chạy có `startsAt <= now < endsAt`. Kỳ gia hạn tương lai đã thanh toán được hiển thị **Chờ hiệu lực**. Backend nối kỳ mới sau kỳ ACTIVE kết thúc xa nhất, gồm các kỳ đã trả trước.

Trạng thái backend: `PENDING_PAYMENT → ACTIVE | CANCELLED`, `CANCELLED → ACTIVE` nếu tiền đến muộn, `ACTIVE → EXPIRED`. Maintenance chạy theo scheduler sẵn có. Không có tự gia hạn, hoàn tiền hoặc hủy kỳ active trong flow này.

## View Earnings

1. TOUR_GUIDE → menu **Thu nhập** (`/guide/earnings`). Backend kiểm tra `earnings:view` và lấy Guide ID từ token.
2. Hai query độc lập: `/earnings/me` lấy các dòng và meta phân trang; `/earnings/me/summary` lấy tổng, số booking và tháng. Không tính tổng bằng các dòng ở trang hiện tại.
3. Áp dụng khoảng ngày theo đầu/cuối ngày Việt Nam UTC+7, gửi ISO về server và reset page = 1. Cả hai query dùng cùng khoảng ngày. Summary vẫn nhóm tháng UTC và có nhãn rõ.
4. Đổi filter/page dùng `currentData`: không hiển thị kết quả của args cũ trong lúc tải args mới. List và summary có loading/error/retry riêng. Không diễn giải API lỗi thành 0.
5. Chưa có thu nhập và filter không có kết quả có thông báo khác nhau. Mỗi dòng hiển thị bookingCode, tên tour, số tiền VND và thời gian ghi nhận. Không dẫn sang chi tiết booking dành cho Traveler.
6. Thu nhập được tạo bởi event booking COMPLETED khi phân công Guide ACCEPTED, một lần/booking. Số tiền là phí Guide trên mỗi booking, không nhân số khách. Chưa biểu thị tiền đã chuyển hoặc có thể rút.
7. Mobile (Flutter): tab **Thu nhập** trong bottom navigation của Guide dùng cùng hai API trên với ba preset **Tháng này / Tháng trước / Toàn bộ** (biên ngày UTC+7, list và summary cùng khoảng). Tab có biểu đồ tròn (donut) tỉ trọng thu nhập từng kỳ, gom từ `byMonth` của summary; nút **Tháng / Quý** chỉ đổi cách gom phía client (cộng dồn tháng thành quý), không gọi thêm API. Tài khoản ngân hàng nhận thù lao được đọc bằng `GET /users/me` và lưu bằng `PATCH /users/me { bankAccount }` (chỉ TOUR_GUIDE; lưu trong `User.preferences`, không migration). Lưu ý backend chưa có payout workflow nên UI không hiển thị số "đã chi trả" hoặc "chờ quyết toán" như một khoản tiền riêng.

## Cách ly dữ liệu

- Query riêng tư chỉ gọi đường dẫn `/me`; input phía client không lựa chọn tài khoản.
- Controller → service → repository luôn truyền actor ID; payment có kiểm tra ownership.
- Middleware `identityIsolation` reset RTK Query khi đổi user/logout. Nội dung hai màn hình và payment return được remount theo user ID để bỏ cả state modal/mutation cũ; response muộn không được chuyển hướng checkout sau unmount.
- `baseQueryWithReauth` bỏ kết quả request/refresh thuộc identity cũ sau khi đổi tài khoản, kể cả refresh thất bại: không khôi phục A hoặc đăng xuất B từ kết quả cũ.
- Route Guard hỗ trợ điều hướng UI; kiểm tra quyền thực tế nằm ở API.
