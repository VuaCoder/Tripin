# Kịch bản test full flow Moderator (local)

Fixture: `backend/src/scripts/dev-moderator-fixture.ts`. Chỉ chạy với PostgreSQL local, trên database mới dùng riêng cho QA. Mọi dữ liệu có tiền tố `[QA-MOD]`; script từ chối ghi đè tài khoản đã tồn tại. Chạy lại từ đầu bằng database disposable mới. Không dùng URL production trong `.env`.

## 1. Chuẩn bị

1. Ở terminal PowerShell thứ nhất, chạy `pnpm.cmd --filter backend exec tsx src/scripts/dev-local-pg.ts`. Giữ terminal này mở. Lệnh tự tạo PostgreSQL tạm **và áp dụng migrations**; sao chép URL ở dòng `READY`.
2. Ở terminal PowerShell thứ hai, đặt `$env:DATABASE_URL = '<URL ở dòng READY>'`. Kiểm tra `([uri]$env:DATABASE_URL).Host` phải là `127.0.0.1` hoặc `localhost`. Chạy `pnpm.cmd --filter backend seed` với chính biến này.
3. Trong cùng terminal thứ hai, đặt `$env:DEV_MODERATOR_PASSWORD = 'QaModerator!2026'` (hoặc mật khẩu test riêng tối thiểu 8 ký tự), rồi chạy `pnpm.cmd --filter backend fixture:moderator:create`. Giữ JSON output: chứa ID của từng bản ghi.
4. Khởi động backend trong terminal thứ hai bằng `pnpm.cmd --filter backend dev` để giữ cùng `DATABASE_URL`. Khởi động frontend trong terminal thứ ba bằng `pnpm.cmd --filter frontend dev`, trỏ `NEXT_PUBLIC_API_URL` đến API local. Mặc định thường là `http://localhost:3000` và `http://localhost:3001/api/v1`; xác nhận theo cấu hình thực tế.

Nếu dùng một PostgreSQL local có sẵn thay cho script tạm, tự tạo database trống, đặt `DATABASE_URL` tới đó rồi mới chạy `pnpm.cmd --filter backend db:deploy`. **Không chạy `db:deploy`, `seed` hoặc fixture khi terminal vẫn trỏ tới Neon/production.**

Tất cả tài khoản dưới đây dùng mật khẩu ở `DEV_MODERATOR_PASSWORD`:

| Email | Vai trò | Mục đích |
| --- | --- | --- |
| `qa.mod.moderator@tripri.test` | MODERATOR | Toàn bộ bàn làm việc moderator; đăng nhập `/login` |
| `qa.mod.agency@tripri.test` | AGENCY, verified | Chủ tour, xem kết quả; đăng nhập `/agency/login` |
| `qa.mod.agency2@tripri.test` | AGENCY, pending | Hồ sơ chờ xác minh; `/agency/login` |
| `qa.mod.traveler@tripri.test` | TRAVELER | Người báo cáo và gửi hỗ trợ; `/login` |
| `qa.mod.violator@tripri.test` | TRAVELER | Tác giả review, mục tiêu khóa tài khoản; `/login` |

## 2. Dữ liệu đã có

| Dữ liệu | Trạng thái ban đầu | Dùng cho |
| --- | --- | --- |
| `[QA-MOD] Pending Travel` | `PENDING` | Yêu cầu bổ sung thông tin hoặc phê duyệt agency |
| `[QA-MOD] Verified Travel` | `VERIFIED` | Chủ các tour và complaint |
| `[QA-MOD] APPROVE Ha Long 3N2D` | `PENDING_REVIEW` | Duyệt tour |
| `[QA-MOD] REJECT Ha Long 3N2D` | `PENDING_REVIEW` | Từ chối tour |
| `[QA-MOD] SUSPEND Ha Long 3N2D` | `APPROVED` | Tạm dừng tour, báo cáo tour |
| `[QA-MOD] REVIEW Ha Long 3N2D` | `APPROVED` | Booking hoàn tất và review 1 sao |
| Báo cáo TOUR / REVIEW / USER | 3 bản ghi `OPEN` | Hàng đợi báo cáo và quyết định riêng biệt |
| Yêu cầu hỗ trợ `Ho tro dat tour` | `OPEN`, 1 tin nhắn | Trả lời, đổi trạng thái |
| Khiếu nại `Khieu nai lich trinh` | `ESCALATED`, `HIGH` | Phân xử tranh chấp tour |

Các tour có departure tương lai. Fixture in ID để truy cập URL trực tiếp nếu cần. Lọc/tìm theo `[QA-MOD]` để không nhầm với dữ liệu seed chung.

## 3. Kịch bản theo thứ tự

Ghi lại cho mỗi bước: kết quả thực tế, HTTP status, ảnh màn hình và bug ID nếu có. Sau thao tác thành công, tải lại trang để xác nhận trạng thái lưu trong DB.

| # | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 01 | Đăng nhập Moderator, mở `/moderator` | Dashboard có số liệu hàng đợi, các liên kết tới tour, agency, review, report, complaint, support. Không hiện chức năng Super Admin. |
| 02 | Mở `/moderator/tours`, lọc `PENDING_REVIEW`, tìm `[QA-MOD]` | Hai tour APPROVE/REJECT xuất hiện, mở chi tiết thấy thông tin agency, giá và lịch trình. |
| 03 | Duyệt tour `APPROVE` | Chuyển `APPROVED`; tìm theo trạng thái mới và reload vẫn thấy. Agency có thông báo kết quả nếu luồng thông báo được bật. |
| 04 | Từ chối tour `REJECT`: thử để trống lý do, sau đó nhập `Nội dung mô tả chưa đủ để xác minh lịch trình.` | Trống lý do bị chặn; quyết định hợp lệ chuyển `REJECTED`, lưu lý do. |
| 05 | Tạm dừng tour `SUSPEND` với lý do `Tạm dừng để xác minh báo cáo về an toàn dịch vụ.` | Chuyển `SUSPENDED`, lý do còn sau reload; tour không còn là tour được bán công khai. |
| 06 | Mở `/moderator/agencies`, lọc `PENDING`, mở `[QA-MOD] Pending Travel` | Hiện tên công ty, đại diện, địa chỉ, số giấy phép và ngày nộp. |
| 07 | Chọn **Yêu cầu bổ sung thông tin**, ghi `Vui lòng bổ sung bản giấy phép kinh doanh rõ nét.` | Trống note bị chặn; hồ sơ chuyển `INFORMATION_REQUESTED`; agency thấy yêu cầu. Agency cập nhật hồ sơ và gửi lại thì quay về `PENDING`, moderator mới có thể phê duyệt. |
| 08 | Sau khi agency gửi lại, phê duyệt | Chuyển `VERIFIED`; chỉ một quyết định cuối cùng được áp dụng nếu hai tab moderator xử lý cùng lúc. |
| 09 | Mở `/moderator/reviews`, chọn review 1 sao trên tour REVIEW | Thấy tác giả `QA Review Author`, nội dung và tour. Ẩn với lý do `Nội dung cần xác minh và không phù hợp quy định đánh giá.` |
| 10 | Xem review ở tour public và tài khoản tác giả | Review không còn công khai; tác giả vẫn thấy review của mình và lý do ẩn. Khôi phục review cần lý do và phải xác nhận nội dung chưa đổi. |
| 11 | Mở `/moderator/reports`, lọc lần lượt TOUR, REVIEW, USER | Có ba báo cáo riêng. Mở REVIEW: có nội dung review và thao tác ẩn/khôi phục. Ẩn review không tự đóng báo cáo. |
| 12 | Xử lý báo cáo TOUR bằng `RESOLVED`, note `Đã xác minh nội dung báo cáo và tạm dừng tour.` | Trạng thái `RESOLVED`, người báo cáo thấy quyết định ở `/settings/reports`. |
| 13 | Xử lý báo cáo REVIEW bằng `REJECTED`, note `Chưa đủ chứng cứ xác nhận nội dung vi phạm.` | Trạng thái `REJECTED`; review chỉ đổi trạng thái nếu moderator thao tác ẩn/khôi phục riêng. |
| 14 | Xử lý báo cáo USER; sau đó khóa `qa.mod.violator@tripri.test` với lý do `Tài khoản đăng nội dung vi phạm nhiều lần.` | Báo cáo được đóng; tài khoản `BANNED`, phiên cũ bị chặn ở request tiếp theo, đăng nhập mới trả `ACCOUNT_BANNED`. Moderator không có quyền mở khóa; chỉ Super Admin được dùng unban. |
| 15 | Mở `/moderator/support-tickets`, chọn `Ho tro dat tour` | Xem được người gửi và tin nhắn. Trả lời `Chúng tôi đã tiếp nhận và đang kiểm tra lịch trình.` rồi đánh dấu đã giải quyết, ghi note nếu UI yêu cầu. Reload thấy phản hồi và trạng thái `RESOLVED`. |
| 16 | Mở `/moderator/complaints`, tab vụ việc leo thang, chọn `Khieu nai lich trinh` | Thấy ticket `ESCALATED`, dữ liệu traveler/agency/tour và hội thoại. Phân xử với lý do/quyết định rõ ràng; sau reload ticket không còn ở hàng đợi leo thang, các bên thấy kết quả. |
| 17 | Mở URL moderator khi chưa đăng nhập và khi đăng nhập Traveler/Agency | Guest bị 401/đưa về login; role thường bị 403 hoặc trang từ chối quyền, không hiện dữ liệu riêng tư. |
| 18 | Thử thao tác lại trên tour/report/ticket đã đóng; thử lý do quá ngắn | API trả lỗi validation/conflict phù hợp; không có quyết định thứ hai hoặc thông báo thành công giả. |

Lưu ý: bước 07 cần agency thực hiện gửi lại hồ sơ trên portal để hoàn tất nhánh request-information → resubmit → approve. Fixture khởi tạo một hồ sơ `PENDING`; nếu chỉ muốn test approve trực tiếp, thực hiện ở bước 07 thay cho nhánh yêu cầu bổ sung, sau đó tạo lại database để test nhánh còn lại.

## 4. Kiểm tra chéo API

Base URL: `/api/v1`. Với token Moderator, kiểm tra `GET /moderation/tours`, `/moderation/agencies?status=PENDING`, `/moderation/reviews`, `/moderation/reports`, `/moderation/support-tickets`, và `GET /moderation/complaint-tickets?status=ESCALATED`. Các mutation tương ứng nằm ở `backend/src/modules/moderation/moderation.routes.ts` và `backend/src/modules/complaints/complaints.routes.ts`. Kiểm tra audit/notification phát sinh cho từng quyết định trong DB local. `POST /moderation/users/:id/unban` phải trả 403 với Moderator.

## 5. Kết thúc

Đây là fixture có thao tác thay đổi trạng thái thật. Dùng database tạm riêng và dừng PostgreSQL tạm sau buổi test; không chạy script trên DB dùng chung. Script chỉ tạo dữ liệu; kết quả pass/fail cần ghi từ walkthrough thực tế.
