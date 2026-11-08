# Kết quả triển khai 28 ticket Kiều

Ngày kiểm tra: 04/11/2026. Phạm vi: backend, frontend web, schema/migration và các flow trong [kế hoạch](kieu-28-tickets-fix-plan.md).

## Thay đổi

| Ticket | Phần triển khai |
| --- | --- |
| 01–02 | Unban chỉ Super Admin, bắt buộc lý do; tăng tokenVersion và thu hồi refresh token trong transaction khi ban/unban. Token cũ không được hồi sinh. |
| 03 | Quyền hiệu lực tính từ role + cấp thêm − thu hồi; form quản trị hiển thị quyền hiệu lực. |
| 04 | Staff invitation có token hash, hết hạn, dùng một lần; activate, reinvite, disable và giao diện tương ứng. |
| 05 | Khóa transaction khi đổi quyền/lifecycle; bảo vệ Super Admin hoạt động cuối cùng; ghi audit cùng transaction. |
| 06 | Snapshot cancellation policy tại thời điểm tạo booking. |
| 07 | PolicyVersion bất biến, lịch hiệu lực, lịch sử và rollback bằng phiên bản mới. |
| 08 | Snapshot SLA trên complaint; lưu xác nhận terms/privacy theo đúng phiên bản qua hành động chủ động. |
| 09–10 | Agency INFORMATION_REQUESTED, yêu cầu ghi chú, resubmit có kiểm tra chủ sở hữu; submittedAt và hàng đợi FIFO. |
| 11 | Dashboard lọc truy vấn, cache và dữ liệu theo quyền; UI ẩn toàn bộ widget không được phép. |
| 12–13 | Tách disable staff khỏi ban khách hàng; kiểm tra email đã xác minh khi cấp quyền staff. |
| 14 | expectedVersion và transaction CAS chống ghi đè settings/policy; giữ bản nháp khi xung đột. |
| 15 | Mở rộng regression integration/unit/UI test và thêm workflow CI. |
| 16 | Bỏ truy cập hồ sơ Agency chỉ bằng email; session ownership hoặc scoped onboarding token; sửa khôi phục session và chuyển hướng sau OTP. |
| 17–18 | Chặn sửa thông tin pháp lý của Agency đã duyệt; chuẩn hóa website rỗng; hỗ trợ xóa avatar Agency. |
| 19–20 | Audit before/after/reason, che trường nhạy cảm; các mutation đặc quyền được sửa ghi audit trong cùng transaction và rollback khi audit lỗi. |
| 21 | Report filter/sort, tổng hợp theo target trước phân trang; thêm index và benchmark dữ liệu lớn. |
| 22 | Claim/assignee/transition support ticket nguyên tử; bắt buộc resolution note ở cả hai đường resolve. |
| 23 | Complaint widget có loading/error/retry độc lập, không hiển thị số 0 giả khi lỗi. |
| 24 | Profile/session DTO không trả raw grants/revokes/lifecycle staff; vẫn trả effective permissions. |
| 25 | SLA trend 7/30 ngày theo ngày Việt Nam, có nhóm unknown cho dữ liệu lịch sử thiếu deadline. |
| 26 | Export audit/moderation CSV có guard, streaming, xử lý disconnect, escaping và audit export. |
| 27 | Dashboard polling mỗi giờ/focus; đồng bộ quyền staff và xóa cache khi quyền thay đổi. |
| 28 | Support code duy nhất; email đóng ticket có code/note, outbox mã hóa với lease/retry/dedup. |

## Kiểm chứng

- Backend: 687 unit test và 222 integration test pass. Integration chạy PostgreSQL cục bộ cô lập, gồm concurrency, phân quyền, audit rollback, migration, token, invitation, SLA và policy acceptance.
- Frontend: toàn bộ suite 566 test pass; thêm 2 regression test OTP Agency pass sau lần chạy toàn bộ đó.
- Kiểm tra TypeScript và production build backend/frontend đều pass; Next.js tạo thành công 74 trang tĩnh.
- Report benchmark: 10.000 rows, 100 target, page 20, 2 warmup và 10 mẫu; p95 khoảng 18,21 ms trên máy local, có EXPLAIN ANALYZE trong `.test-artifacts/kieu-report-performance.json`. Đây không phải cam kết latency production.
- `git diff --check` không có lỗi whitespace.
- CI đã được viết nhưng chưa chạy trên GitHub.

## Triển khai và giới hạn

Migration: `prisma/migrations/202611040001_kieu_admin_workflows/migration.sql`. Chưa áp dụng vào database đang cấu hình trong `.env`; chưa deploy. Khi triển khai cần chạy migration trên database đích trước khi khởi động phiên bản mới. Migration thu hồi refresh token cũ; người dùng cần đăng nhập lại.

Booking lịch sử không có snapshot dùng fallback 24 giờ, vì không thể khôi phục policy lịch sử chính xác. submittedAt được backfill từ thời điểm tạo user có cờ ước lượng. Không tự tạo consent lịch sử.

Outbox có ngữ nghĩa at-least-once: provider đã nhận mail nhưng tiến trình chết trước khi đánh dấu sent có thể dẫn đến gửi lại. Khóa mã hóa được dẫn xuất từ JWT_ACCESS_SECRET; cần giữ secret ổn định đến khi xử lý hết mail đang chờ, hoặc triển khai quy trình chuyển khóa trước khi đổi secret.

Email được mock/capture trong test; chưa kiểm tra nhà cung cấp email production. Chưa kiểm tra trực quan thủ công bằng browser trên nhiều kích thước màn hình, chưa smoke test môi trường staging hay load test toàn hệ thống. Các kết quả trên không bảo đảm tuyệt đối không còn lỗi UI/nghiệp vụ/code.
