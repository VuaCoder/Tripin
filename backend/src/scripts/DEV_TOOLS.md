# Công cụ dữ liệu local

Hai script này chỉ chạy khi được gọi trực tiếp, không thuộc luồng khởi động/build của ứng dụng.
Không dùng chúng với database production. Không có thay đổi mật khẩu tự động trên database đang tồn tại.

## Cấu hình riêng

Trong `.env` tại thư mục gốc (đã được Git bỏ qua), tự đặt:

- `DEV_POSTGRES_PASSWORD`: mật khẩu cho PostgreSQL tạm do `dev-local-pg.ts` tạo mới.
- `DEV_FIXTURE_PASSWORD`: mật khẩu đăng nhập các tài khoản mẫu do `dev-agency-fixture.ts create` tạo.

Không dùng mật khẩu production. Không chia sẻ `.env`, mật khẩu hoặc URL chứa mật khẩu.
Các biến này không bắt buộc khi chạy backend/frontend bình thường.

## Chạy PostgreSQL tạm

Từ thư mục backend:

```sh
pnpm exec tsx src/scripts/dev-local-pg.ts
```

Server mới dùng host `127.0.0.1`, cổng `5433`, database `tripri_dev`, user `postgres`
và mật khẩu `DEV_POSTGRES_PASSWORD`. Dùng các giá trị đó để cấu hình `DATABASE_URL` local,
nhớ mã hóa URL cho ký tự đặc biệt trong mật khẩu. Script không in URL chứa mật khẩu.
Nếu cổng đang được sử dụng, dừng và kiểm tra; không dừng database khác hoặc đổi mật khẩu của nó.
Database tạm chỉ tồn tại trong phiên này. Dừng bằng Ctrl+C để đóng và dọn thư mục tạm.

## Tạo/xóa dữ liệu mẫu

Chỉ trỏ `DATABASE_URL` vào database local dành riêng cho thử nghiệm. Lệnh tạo sẽ xóa dữ liệu
mẫu cũ có cùng email/tiền tố trước khi tạo lại, vì vậy không chạy trên database local đang dùng cho dữ liệu cần giữ.

```sh
pnpm exec tsx src/scripts/dev-agency-fixture.ts create
pnpm exec tsx src/scripts/dev-agency-fixture.ts clean
```

`create` yêu cầu `DEV_FIXTURE_PASSWORD`; `clean` không cần mật khẩu này.
Đăng nhập bằng email được in ra và mật khẩu bạn đã đặt. Mật khẩu không xuất hiện trong log.
Nếu thiếu cấu hình, script dừng; không dùng lại mật khẩu mặc định cũ.

## Cảnh báo GitGuardian

Thay đổi này loại bỏ mật khẩu ghi cứng khỏi hai script ở phiên bản hiện tại, không xóa commit cũ.
Nếu đã dùng credential ở nơi khác, hãy đổi/thu hồi tại nơi phát hành. Không đánh dấu bỏ qua
secret thật chỉ để đạt kiểm tra xanh. Chạy quét lại sau khi được phép push; cần thống nhất trước
nếu phải tạo PR thay thế hoặc làm sạch lịch sử.
