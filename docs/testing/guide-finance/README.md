# Kiểm thử Subscribe to Plan / View Earnings

Ngày cập nhật: 18/10/2026.

## Kết quả tự động

| Kiểm tra | Kết quả |
|---|---|
| Backend unit subscriptions, earnings, payments | 40 test pass |
| Backend integration subscriptions, reviews/earnings, payments | 24 test pass trên PostgreSQL thật, PayOS HTTP giả lập |
| Fixture local create/recreate/clean và từ chối remote | 2 test pass trên database disposable |
| Frontend guide, payment, cart, booking, agency download/refresh regression | 82 test pass; booking test sẵn có in cảnh báo jsdom không hỗ trợ navigation |
| Frontend TypeScript | Pass |
| Frontend production build | Pass, có hai route Guide mới |
| Backend production build | Pass |
| Backend toàn bộ TypeScript | Chưa pass: lỗi sẵn có ở Cloudinary Buffer/Blob, agency-approval req.user/JWT_SECRET và nullable values, bookings.service.test truy cập có thể undefined; không nằm trong thay đổi chức năng này |
| Kiểm thử UI trên trình duyệt và PayOS sandbox thật | Chưa thực hiện: phiên công cụ không có browser khả dụng (inventory rỗng, iab unavailable); chưa xác minh sandbox/credentials của môi trường triển khai |

Các integration test tạo PostgreSQL riêng từ migrations, không sử dụng database đã cấu hình trong `.env`. `global-setup.ts` khởi tạo UTF-8 để lưu được nội dung tiếng Việt trên Windows. Chỉ ghi test pass khi đã thấy kết quả assertion; không coi việc có file test là bằng chứng.

Đã bổ sung migration `20261018000000_agency_profile_documents`: hai cột nullable đã có trong Prisma schema nhưng thiếu trong migrations làm API đăng nhập trả 500 trên database mới. Migration được thử trên database test; chưa áp dụng vào môi trường dùng chung.

Earnings đã có regression ranh giới UTC+7, nhiều trang và tháng UTC: danh sách và summary phải chọn cùng booking, độc lập timezone của database. Subscription có regression current vs kỳ gia hạn tương lai và gia hạn lần thứ ba.

## Chạy lại

Từ thư mục backend:

```powershell
npm.cmd test -- --project unit src/modules/subscriptions/__tests__/subscriptions.service.test.ts src/modules/earnings/__tests__/earnings.service.test.ts src/modules/payments/__tests__/payments.service.test.ts
npm.cmd test -- --project integration src/modules/subscriptions/__tests__/subscriptions.integration.test.ts src/modules/reviews/__tests__/reviews.integration.test.ts src/modules/payments/__tests__/payments.integration.test.ts src/scripts/__tests__/dev-guide-finance-fixture.integration.test.ts
npm.cmd run build
npm.cmd run typecheck
```

Từ thư mục frontend:

```powershell
npm.cmd test -- features/guide/__tests__ features/payment/__tests__ features/cart/__tests__ features/booking/__tests__ features/agency/__tests__/agency-download.test.ts
pnpm.cmd exec tsc --noEmit
npm.cmd run build
```

## Fixture cho kiểm tra UI thủ công

Script `backend/src/scripts/dev-guide-finance-fixture.ts` chỉ cho database LOOPBACK có tên bắt đầu `tripri_guide_finance`; từ chối production/remote. Tạo database disposable bằng công cụ PostgreSQL local của bạn trước khi chạy. Không dùng dữ liệu khách hàng.

Tại backend, trỏ shell vào database local đã tạo rồi áp dụng migrations:

```powershell
$env:DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/tripri_guide_finance'
pnpm.cmd exec prisma migrate deploy
pnpm.cmd exec tsx src/scripts/dev-guide-finance-fixture.ts create
```

Script in payment IDs dùng cho callback test và tạo bốn tài khoản cùng mật khẩu **GuideFinance!2026**:

| Tài khoản | Dữ liệu |
|---|---|
| guide.finance.a@tripri.test | Current, kỳ tương lai, pending, expired, cancelled; plan ngừng bán; 12 earnings trong hai tháng |
| guide.finance.b@tripri.test | Guide không có subscriptions/earnings, dùng kiểm tra empty và isolation |
| guide.finance.traveler@tripri.test | Sai role |
| guide.finance.agency@tripri.test | Sai role |

Khởi động backend với cùng DATABASE_URL. Frontend phải dùng NEXT_PUBLIC_API_URL trỏ API local. Fixture payment là trạng thái giả để xem UI, không phải giao dịch sandbox thực và không có link thanh toán. Nếu muốn thử checkout thật, dùng PayOS sandbox riêng, cấu hình return/cancel/webhook tương ứng và chọn plan fixture. Không dùng credentials hay chuyển tiền production.

Dọn riêng fixture (không truncate database):

```powershell
pnpm.cmd exec tsx src/scripts/dev-guide-finance-fixture.ts clean
```

## Checklist thủ công còn lại

- Desktop/mobile: navigation, không đồng thời active Lịch trình và màn con, card gói, hộp thoại xác nhận, danh sách dài, phân trang, bảng tháng; không overflow ngang toàn màn hình.
- A → B sau logout: không chớp dữ liệu A; mở lại URL callback của payment A bằng B phải báo không có quyền/không khả dụng và không lộ số tiền.
- Guest/Traveler/Agency mở trực tiếp hai URL Guide: không mount nội dung riêng tư; API riêng tư lần lượt 401/403, plans public vẫn hoạt động.
- Checkout bị lỗi/mất mạng: có lỗi, không success, pending có thể hiện sau refresh; tiếp tục dùng cùng planId. Plan ngừng bán báo lỗi thực tế.
- Sandbox: thành công → PAID → ACTIVE; webhook chậm → đang đồng bộ; cancel URL nhưng payment PAID vẫn hiển thị PAID; PENDING không tự coi là thành công hoặc đã hủy; FAILED và EXPIRED có thông báo riêng. Giữ flow booking và E-ticket.
- Earnings: đối chiếu tổng với summary, đổi filter/page nhanh, thử khoảng ngày không có dữ liệu và khoảng ngày đảo ngược; lỗi list/summary không biến thành tổng 0 hoặc dữ liệu filter cũ.
- Chụp ảnh UI sau khi kiểm tra thực tế và lưu tại thư mục này. Hiện chưa có ảnh và chưa đánh dấu checklist này pass.
