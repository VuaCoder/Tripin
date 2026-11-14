# Data test quản lý tour đại lý

Fixture: `backend/src/scripts/dev-tour-management-fixture.ts`. Mặc định chỉ chạy với PostgreSQL trên `localhost` hoặc `127.0.0.1`. Để nạp vào database Neon của môi trường test, đặt `DEV_TOUR_TEST_ALLOW_REMOTE=1` trước khi chạy; chỉ dùng khi ứng dụng đang kết nối đúng database đó.

Ngày 14/11/2026, hai migration còn thiếu đã được áp lên Neon đang cấu hình; `prisma migrate status` báo schema đã cập nhật. Fixture đã tạo đủ 5 tài khoản và 6 tour có tiền tố `[TEST-TOUR-UX]` trên database này.

Fixture kiểm tra cột `Tour.highlights` trước khi tạo tài khoản. Nếu DB còn thiếu migration, chuẩn bị một DB test đã migrate đầy đủ rồi chạy lại. Không chạy migration lên DB có lịch sử migration khác repo khi chưa đối chiếu.

Mật khẩu mặc định của toàn bộ tài khoản test: **`TripriTourTest@2026!`**. Có thể thay bằng biến môi trường `DEV_TOUR_TEST_PASSWORD` (ít nhất 8 ký tự).

Từ thư mục gốc `E:\CN\Tripin`, trỏ `DATABASE_URL` đến DB local đã migrate, rồi chạy:

```powershell
npm.cmd --prefix backend run fixture:tour-ux:create
```

Lệnh in email, ID và URL của từng tour. Mọi tài khoản dùng mật khẩu từ biến môi trường trên. Xóa đúng bộ data này bằng:

```powershell
npm.cmd --prefix backend run fixture:tour-ux:clean
```

| Tài khoản | Vai trò | Luồng cần thử |
|---|---|---|
| `test.tour.owner@tripri.local` | Owner | Tạo, sửa, gửi duyệt, lưu trữ, khôi phục |
| `test.tour.manager@tripri.local` | Manager | Các thao tác quản lý tour |
| `test.tour.staff@tripri.local` | Staff | Sửa nội dung/lịch trình; không tạo tour hay quản lý khởi hành |
| `test.tour.accountant@tripri.local` | Accountant | Không truy cập module tour |
| `test.tour.traveler@tripri.local` | Traveler | Booking mẫu trên tour BOOKED |

| Tên tour chứa | Trạng thái/data | Kiểm thử chính |
|---|---|---|
| `DRAFT` | Nháp, lịch trình 2/3 ngày, khởi hành mở | Xem/sửa/lưu, thêm ngày thứ 3, dữ liệu chưa lưu |
| `PENDING_REVIEW` | Chờ duyệt, khởi hành mở | Khóa nội dung/lịch trình; vẫn sửa khởi hành |
| `APPROVED` | Đã duyệt, khởi hành mở | Nội dung/lịch trình vẫn sửa được |
| `ARCHIVED` | Lưu trữ, khởi hành đóng | Khóa sửa, khôi phục |
| `BOOKED` | Đã duyệt, ngày khởi hành 20 chỗ, còn 18, booking xác nhận 2 khách | Không đổi/gỡ ngày; không hạ sức chứa dưới 2; vẫn đóng nhận khách |
| `NO_OPEN_DEPARTURE` | Nháp, chỉ có ngày khởi hành đóng | Gửi duyệt báo cần ngày mở bán |

Các lỗi nhập liệu cần tạo trực tiếp trên form (fixture chỉ lưu data hợp lệ): tiêu đề ngày 1 ký tự, ngày vượt 3, khoảng ngày chồng nhau, ngày khởi hành trùng/quá khứ, sức chứa 0 hoặc trên 10.000, giá ngoài giới hạn. Lỗi cập nhật đồng thời cần mở cùng một tour trong hai phiên và lưu lần lượt.
