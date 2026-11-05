# Tripri Premium — triển khai và nghiệm thu

Ngày xác nhận: **25/10/2026**. Đã hoàn thành code và kiểm thử cục bộ; chưa triển khai lên database/môi trường đang cấu hình trong `.env`.

Cập nhật tiếp theo: đã áp dụng migration và mở bốn gói mẫu trên database dev theo yêu cầu. Xem [DEV_SETUP.md](DEV_SETUP.md) để lấy tài khoản, giá mẫu, cách chạy lại seed và kết quả kiểm chứng.

## Kết quả kiểm tra

| Hạng mục | Kết quả cuối |
|---|---|
| Toàn bộ backend unit | **664/664 pass**, 48 file |
| Integration các module bị ảnh hưởng | **56/56 pass**, 8 file, PostgreSQL tạm cô lập |
| Toàn bộ frontend | **560/560 pass**, 81 file, `--maxWorkers=2` |
| Backend typecheck | Pass |
| Backend build | Pass |
| Frontend production build, lint và typecheck | Pass; đủ 70 trang, dùng `.next-verify` |
| `git diff --check` | Pass; chỉ có thông báo chuẩn hóa LF/CRLF của Git |
| Kiểm tra trình duyệt | Traveler desktop/mobile 390×844; menu tài khoản mobile; Guide desktop; admin desktop, bằng API fixture chỉ đọc |

Lượt frontend chạy đồng thời với nhiều bộ kiểm thử từng có hai timeout 5 giây ở màn sửa tour Agency cũ. Lượt xác nhận cuối chạy toàn bộ với hai worker, giữ nguyên timeout và không sửa logic màn đó, đã pass toàn bộ.

Trên Windows, Vitest cần TEMP/TMP có thể đọc được giữa các tiến trình; PostgreSQL tạm cần đường dẫn ASCII và quyền kết nối localhost. Các lần integration dùng hạ tầng test sẵn có để tạo database riêng từ template migration, không dùng database ứng dụng thật.

## Những hành vi đã xác nhận

- Checkout → webhook PayOS có chữ ký → kích hoạt một lần dù webhook chạy lại đồng thời; giá lấy từ server.
- Không vượt hạn mức đóng góp khi nhiều tài khoản mua; giữ điều kiện đã bán sau khi Agency ngừng đóng góp.
- Gia hạn nối tiếp không chồng kỳ; chưa cấp voucher cho kỳ tương lai; cấp lại job không tạo voucher trùng.
- Một voucher không gắn được hai booking; kiểm tra owner/tour/Agency/minimum spend; không cộng mã khác; hủy booking hoàn lượt đúng một lần.
- Chỉ hoàn kỳ chưa bắt đầu; duyệt hoàn giải phóng cam kết, thu hồi kỳ và không bị webhook kích hoạt lại; ghi nhận chuyển tiền hoàn là idempotent.
- Thanh toán đến sau khi hạn mức đã giải phóng tạo nghĩa vụ hoàn tiền, không lấy mất hạn mức đã bán cho người khác.
- Guide Premium được ưu tiên trước phân trang; hết hạn theo thời gian thực; trường hồ sơ cơ bản và gói Guide cũ vẫn hoạt động.
- Hồ sơ nâng cao vẫn lưu khi hết hạn, bị chặn chỉnh sửa/analytics và không trả ra profile công khai; API công khai không trả ngày hết hạn/giá/thanh toán.
- Avatar có khung vàng và huy hiệu ở góc dưới phải, kể cả ảnh lỗi/ảnh thay thế; nhãn `Premium`, dòng `Hoạt động đến dd/MM/yyyy` theo giờ Việt Nam.
- Khung và nhãn hết hiệu lực đúng thời điểm mà không chờ polling; lỗi tải có retry, không bị coi là hết hạn.
- Đổi tài khoản hoặc đổi vai trò trên cùng tài khoản xóa cache quyền cũ; response/refresh trả muộn không khôi phục identity/role trước đó.
- Callback Premium đọc đúng subscription của payment, phân biệt chờ đồng bộ, đã kích hoạt, đã hết hạn và thu hồi/chờ hoàn; không dùng checkout booking để thử lại subscription.
- Lịch sử Premium có phân trang; bản ghi đang chờ thanh toán có thao tác tiếp tục qua plan ID của server.

## Lệnh tái lập

Chạy tại root repo, với TEMP/TMP phù hợp nếu môi trường Windows sandbox yêu cầu:

```powershell
pnpm.cmd --filter backend test:unit
pnpm.cmd --filter backend test:integration src/modules/premium/__tests__/premium.integration.test.ts src/modules/subscriptions/__tests__/subscriptions.integration.test.ts src/modules/users/__tests__/agency-guides.integration.test.ts src/modules/payments/__tests__/payments.integration.test.ts src/modules/bookings/__tests__/bookings.integration.test.ts src/modules/bookings/__tests__/bookings.money.integration.test.ts src/modules/promotions/__tests__/promotions.integration.test.ts src/modules/reviews/__tests__/reviews.integration.test.ts
pnpm.cmd --filter frontend test --maxWorkers=2
pnpm.cmd --filter backend typecheck
pnpm.cmd --filter backend build
$env:TRIPRI_VERIFY_BUILD = '1'
$env:NEXT_TELEMETRY_DISABLED = '1'
pnpm.cmd --filter frontend build
```

API/route docs được đồng bộ bằng `pnpm.cmd --filter backend docs:routes`; unit suite kiểm tra tài liệu khớp các router thực tế.

## Cấu hình và mở bán

1. Xác định đúng môi trường database, sao lưu theo quy trình vận hành và dùng direct connection. Áp dụng migration `20261025090000_premium` bằng `pnpm.cmd --filter backend db:deploy`; generate client/build và triển khai backend/frontend cùng phiên bản.
2. Giữ hai cờ bán tắt trong lúc chuẩn bị. Không seed giá Premium thật hoặc tự chuyển gói Guide cũ thành Premium.
3. Agency vào **`/agency/premium`**, chọn tour của mình, đặt điều kiện/hạn mức, đồng ý chịu chi phí và giữ cam kết đã bán, rồi gửi admin duyệt.
4. Admin vào **`/super-admin/premium`**, duyệt nguồn voucher, tạo phiên bản gói theo vai trò, cấu hình giá/thời hạn/quyền lợi. Traveler cần nguồn voucher đã duyệt; Guide không nhận voucher đặt tour. Mỗi kỳ tối đa 500 voucher.
5. Publish gói rồi bật riêng `premium.enabled.TRAVELER` hoặc `premium.enabled.TOUR_GUIDE`. Thiếu setting hoặc giá trị khác JSON `true` nghĩa là chưa mở bán. Ngừng bán không tắt quyền đã trả tiền.
6. Kiểm tra cấu hình PayOS, return/cancel URLs và webhook trước khi mở bán. Maintenance phải chạy các job payment retry/expiry, cấp quyền lợi và giải phóng giữ chỗ Premium.
7. Kiểm tra Cloudinary trước khi dùng upload portfolio/chứng chỉ. Guide thường vẫn dùng hồ sơ cơ bản; public chỉ thấy phần nâng cao trong kỳ Premium hiệu lực.
8. Theo dõi mục vận hành admin: payment PAID chưa hoàn tất quyền lợi, hạn mức giữ quá hạn và yêu cầu hoàn tiền tồn đọng. Hoàn tiền được chuyển thủ công bên ngoài ứng dụng; chỉ ghi nhận hoàn tất sau khi có tham chiếu chuyển tiền thực tế.

## Preview giao diện không dùng dữ liệu thật

Fixture [`preview-api.mjs`](preview-api.mjs) chỉ lắng nghe localhost, không kết nối database/PayOS/Cloudinary và từ chối các mutation nghiệp vụ. Các giá/tài khoản/ngày trong fixture là dữ liệu minh họa, không phải cấu hình mở bán. Ngày hết hạn mẫu là 25/11/2026; cập nhật fixture khi kiểm tra ở thời điểm khác.

```powershell
# Terminal 1
node docs/testing/premium/preview-api.mjs

# Terminal 2
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:32992/api/v1'
pnpm.cmd --filter frontend exec next dev -p 32991
```

Mở `/premium` trên port 32991. Đổi role fixture bằng GET `/preview/role/TOUR_GUIDE`, `/preview/role/SUPER_ADMIN` hoặc `/preview/role/AGENCY` trên port 32992, rồi reload frontend. Các server preview của lần kiểm tra này đã được dừng.

## Giới hạn nghiệm thu bên ngoài

PayOS HTTP API được mô phỏng trong integration test; chưa thực hiện giao dịch với PayOS thật hoặc upload lên Cloudinary thật trong lần triển khai này. Cần nghiệm thu trên môi trường thanh toán thử nghiệm và cấu hình upload thực tế trước khi mở bán. Không có tự động gia hạn, tự động chuyển tiền hoàn hoặc gói Premium do Agency tự bán.
