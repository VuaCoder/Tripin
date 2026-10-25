# Premium dev đã cấu hình — 25/10/2026

Đã áp dụng `20261025090000_premium` bằng Prisma migrate deploy trên database development được cấu hình trong `.env` (`neondb`, endpoint direct `ep-wild-king-b31i00f1.c-4.ap-southeast-1.aws.neon.tech`). Generate Prisma client thành công.

Database có một migration avatar cũ không còn trong checkout (`20261007000000_add_user_avatar_public_id`). Đã giữ nguyên ledger này; không reset database, xóa migration hoặc đánh dấu lịch sử giả. Prisma deploy xác nhận Premium đã được áp dụng thành công.

## Gói mẫu đang mở bán

Tất cả tên hiển thị có tiền tố **[DEV Premium]**.

| Vai trò | Mã gói | Thời hạn | Giá mẫu | Quyền lợi |
|---|---|---|---|---|
| Traveler | DEV_PREMIUM_TRAVELER_30_V1 | 30 ngày | 49.000đ | 2 voucher mỗi kỳ |
| Traveler | DEV_PREMIUM_TRAVELER_90_V1 | 90 ngày | 129.000đ | 6 voucher mỗi kỳ |
| Guide | DEV_PREMIUM_GUIDE_30_V1 | 30 ngày | 99.000đ | Hồ sơ nâng cao, khung/huy hiệu, ưu tiên, analytics |
| Guide | DEV_PREMIUM_GUIDE_90_V1 | 90 ngày | 249.000đ | Hồ sơ nâng cao, khung/huy hiệu, ưu tiên, analytics |

Voucher giảm **10%, tối đa 100.000đ**, đơn từ **500.000đ**, áp dụng tour demo riêng. Nguồn đóng góp của Agency demo đã duyệt, hạn mức 5.000 lượt. Hai setting `premium.enabled.TRAVELER` và `premium.enabled.TOUR_GUIDE` đều là JSON `true`.

Tour: **[DEV Premium] Khám phá Đà Nẵng – Hội An**, ID `70d4992d-4bcf-4698-8b6c-ffcb3849e610`, giá 1.200.000đ, ba lịch khởi hành tương lai, mỗi lịch 20 chỗ.

## Đăng nhập và chạy thử

| Tài khoản | Email | Đường dẫn đăng nhập |
|---|---|---|
| Traveler | premium.demo.traveler@tripri.test | /login?next=/premium |
| Guide | premium.demo.guide@tripri.test | /login?next=/premium |
| Agency | premium.demo.agency@tripri.test | /agency/login |

Mật khẩu ngẫu nhiên nằm trong **`backend/node_modules/.cache/premium-dev-credentials.json`** trên máy hiện tại. File này được Git ignore; không đưa mật khẩu vào source hoặc tài liệu commit. Script không thay mật khẩu tài khoản đã tồn tại.

Khởi động hoặc restart hai app tại root repo:

```powershell
# Terminal backend
pnpm.cmd dev:backend

# Terminal frontend
pnpm.cmd dev:frontend
```

Frontend dùng `http://localhost:3000`, backend `http://localhost:3001/api/v1`. Traveler/Guide mở `/premium`; Agency mở `/agency/premium`; admin hiện có mở `/super-admin/premium`.

Tài khoản Traveler/Guide mẫu bắt đầu ở trạng thái thường. Chọn gói và thanh toán để thử kích hoạt, khung vàng và quyền lợi; không seed payment PAID, voucher đã nhận hoặc subscription đang hiệu lực. Ba khóa PayOS đã có cấu hình. Giá mẫu vẫn được gửi sang luồng PayOS hiện tại; chưa có giao dịch hay chuyển tiền được tạo bởi việc thiết lập này.

## Chạy seed lại

```powershell
pnpm.cmd --filter backend seed:premium:dev --expected-host=ep-wild-king-b31i00f1.c-4.ap-southeast-1.aws.neon.tech --enable-sales
```

Script yêu cầu `NODE_ENV=development` và host khớp rõ ràng. Chỉ tạo các tài khoản/tour/source/code riêng của fixture; giữ ID, password, giá và quyền lợi đã chỉnh trên bản ghi tồn tại. `--enable-sales` publish lại các gói mẫu và bật hai cờ bán một cách chủ động. Nguồn đã bị từ chối/ngừng sẽ không tự được phục hồi. Không sửa các fixture local-only cũ.

Không xóa file credentials nếu vẫn cần đăng nhập lại bằng password đã sinh. Có thể cung cấp `PREMIUM_DEMO_PASSWORD` cho lần tạo ban đầu hoặc khi khôi phục đúng mật khẩu cũ; script từ chối password khác và không reset account.

## Kiểm chứng thực tế

- Seed chạy hai lần: vẫn đúng 4 gói, 1 nguồn voucher, 1 tour demo, 3 tài khoản demo; không nhân đôi.
- Tổng users 17 → 20, tours 24 → 25; giữ nguyên các tài khoản/tour cũ.
- `GET /premium/plans` cho mỗi vai trò: HTTP 200, đủ 2 gói mẫu đúng giá/thời hạn.
- API riêng của ba tài khoản demo: HTTP 200; mật khẩu so khớp bcrypt thành công, không in password hoặc token.
- Public tour demo: HTTP 200, có 3 departure.
- Ledger Premium có `finished_at`; hai cờ mở bán đều true.
- Backend typecheck pass sau khi thêm seed script.

Kiểm tra API dùng Express app thật và database dev; không bật server fixture chỉ đọc để thay dữ liệu thực, không gửi email hoặc gọi checkout PayOS.
