# ADMIN-01 — kết quả kiểm thử và bàn giao

Ngày kiểm tra: 18/10/2026. **Đã triển khai source; chưa đánh dấu Done toàn bộ kế hoạch.** Chưa triển khai lên môi trường dùng chung/production, chưa chạy browser walkthrough.

## Phạm vi đã triển khai

- Sáu route `/super-admin`, `/super-admin/promotions`, `/super-admin/users`, `/super-admin/settings/commission`, `/super-admin/categories`, `/super-admin/policies` gọi API hiện có.
- Guard backend bắt buộc role Super Admin cùng permission trên mọi admin router; extra admin permission không mở quyền cho role khác. Metadata và generated endpoint docs có cả hai điều kiện.
- Policy cancellationWindowHours được kiểm tra số hữu hạn không âm trước persistence/audit.
- Form promotion dùng chung với Agency; giữ tương thích export và regression tests. Không optimistic update, không báo thành công trước backend, xử lý draft/error/refetch và clear field theo contract.
- Không thêm migration ADMIN-01. Package dependency mới chỉ là liên kết workspace constants đã có, không thêm thư viện bên ngoài.

## Bằng chứng tự động

| Kiểm tra                                         | Kết quả                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline frontend                                | 46 file / 254 test pass; TypeScript pass                                                                                                                          |
| Baseline backend unit                            | 42 file / 502 test pass                                                                                                                                           |
| Frontend riêng ADMIN-01                          | 5 file / 56 test pass: API, component, layout role guard, validation, search/calendar filters                                                                     |
| Backend unit sau thay đổi                        | 42 file / 512 test pass                                                                                                                                           |
| Backend integration liên quan ADMIN-01           | 5 file / 29 test pass assertion trên PostgreSQL disposable thật; runner treo sau summary, xem ghi chú teardown                                                    |
| Frontend toàn bộ sau thay đổi                    | 51 file / 310 test pass; có cảnh báo jsdom navigation từ test booking sẵn có                                                                                      |
| Frontend TypeScript                              | Pass                                                                                                                                                              |
| Frontend production build                        | Pass; sinh đủ sáu route admin, sử dụng `.next-verify` để không đụng dev output                                                                                    |
| Backend production build                         | Pass: Prisma generate + tsup                                                                                                                                      |
| Backend full TypeScript                          | Còn lỗi baseline tại Cloudinary Buffer/Blob, agency-approval `req.user`/`JWT_SECRET`/nullable và bookings.service.test; không có lỗi type mới trong phần ADMIN-01 |
| Full backend integration (lượt triển khai trước) | 33 file: 28 pass, 5 fail; 168 test pass, 7 fail. Chưa chạy lại full suite ở lượt bổ sung filter; chi tiết bên dưới                                                |
| Generated endpoint docs                          | Đã sinh lại bằng `docs:routes`; docs-in-sync và route audit nằm trong backend unit suite pass                                                                     |
| Browser/mobile/keyboard screenshots              | Chưa kiểm tra được: browser inventory rỗng; tạo tab iab báo `Browser is not available: iab`                                                                       |

Các integration test liên quan:

- `dashboards/__tests__/admin-filters.integration.test.ts`: UTC+7 inclusive boundaries, kỳ so sánh không giao nhau, paidAt/confirmedAt, loại cancelled/unpaid, tháng rỗng, user createdAt trước pagination, promotion literal search/type/activation/validity overlap, invalid range và role guard.
- `users/__tests__/platform-admin.integration.test.ts`: mọi method/route admin đều trả guest 401, mọi non-admin role có tất cả extra permissions vẫn 403, không ghi dữ liệu; promotion platform CRUD/filter/scoping/audit; policy invalid không ghi đè dữ liệu đã lưu.
- `users/__tests__/admin.integration.test.ts`: user list/filter/paging, access hiệu lực ngay, self-edit/last-admin/race, category deactivate/re-activate/unique race, commission validation/booking snapshot, policy cancellation thực sự tác động booking.
- `promotions/__tests__/promotions.integration.test.ts`: ownership/platform scope, redemption/release/usage race, checkout errors.
- `dashboards/__tests__/dashboards.integration.test.ts`: đối chiếu số liệu backend với rows thật và role gating.

Integration dùng embedded PostgreSQL riêng theo test file và migrations, không dùng database trong `.env` để ghi dữ liệu nghiệp vụ. Test email/payment provider được giả lập ở các suite liên quan; không có giao dịch tiền thật.

Ghi chú teardown: các runner integration đã in đầy đủ summary nhưng không tự thoát sau đó. Đã xác minh command line/PID thuộc đúng các lượt Vitest backend của phiên này và kết thúc cây tiến trình để dọn PostgreSQL con. Các số pass/fail trong bảng là kết quả assertion đã nhận; **không tuyên bố integration command exit sạch**. Không sửa global setup đang có thay đổi của task khác. Việc runner không thoát cũng cần xử lý trước CI/Done.

## Các lỗi toàn hệ thống chưa đóng

Full integration phát hiện lỗi ngoài phần source ADMIN-01 sửa:

1. `auth.flows.integration.test.ts`: Google config của môi trường khiến trường hợp kỳ vọng thiếu cấu hình 503 nhận 401.
2. `error-contract.integration.test.ts`: Google tương tự; booking miễn phí hiện được xác nhận với total 0 trong khi test cũ đòi BOOKING_AMOUNT_TOO_LOW; test tổng hợp coverage thiếu code do các scenario trước fail (3 test fail).
3. `bookings.money.integration.test.ts`: cùng khác biệt về booking miễn phí (201 so với 409).
4. `fuzz.integration.test.ts`: agency `dev-accept` destructure `req.body` undefined gây 500; không thuộc router admin.
5. `build-smoke.integration.test.ts`: đăng ký trong bundle production trả 500 thay vì 201. Đã chạy lại sau build mới, vẫn fail; build lệnh thành công không được xem là smoke đã pass.

Không sửa kỳ vọng các test này để làm suite xanh và không sửa lan sang auth/booking. Cần xử lý nguyên nhân trong task tương ứng trước khi tuyên bố toàn hệ thống xanh. Backend typecheck có cùng các lỗi đã thấy trước thay đổi ADMIN-01.

## Chạy lại các kiểm tra

Tại root, PowerShell dùng `.cmd` vì execution policy hiện chặn `pnpm.ps1`:

```powershell
pnpm.cmd --filter frontend test
pnpm.cmd --filter frontend exec tsc --noEmit
pnpm.cmd --filter frontend exec vitest run features/admin features/agency-promotions
$env:TRIPRI_VERIFY_BUILD = '1'
pnpm.cmd --filter frontend build
pnpm.cmd --filter backend typecheck
pnpm.cmd --filter backend test:unit
pnpm.cmd --filter backend exec vitest run --project integration src/modules/dashboards/__tests__/admin-filters.integration.test.ts src/modules/users/__tests__/platform-admin.integration.test.ts src/modules/users/__tests__/admin.integration.test.ts src/modules/promotions/__tests__/promotions.integration.test.ts src/modules/dashboards/__tests__/dashboards.integration.test.ts
pnpm.cmd --filter backend test:integration
pnpm.cmd --filter backend build
pnpm.cmd --filter backend docs:routes
```

Nếu chỉ muốn kiểm tra ADMIN-01, lệnh integration với năm file là nhóm tập trung; không dùng kết quả nhóm này để khẳng định full suite pass.

## Bổ sung tìm kiếm, bộ lọc và dashboard trực quan — 18/10/2026

Điều hướng quản trị dùng header hiện có, đã bỏ sidebar theo phản hồi UI; nội dung mở rộng trong bố cục một cột với breadcrumb và spacing chung; bảng người dùng có avatar, role/status, ngày tạo và hành động; thanh filter cùng chiều cao control; category cards dạng lưới.

Dashboard có chọn ngày và preset 7/30/90/365 ngày, mặc định 30 ngày theo lịch Việt Nam. API nhận ISO bounds, tính doanh thu kỳ hiện tại và kỳ liền trước cùng độ dài. So sánh thể hiện bằng số tăng/giảm; giá trị trước bằng 0 được ghi “Mới phát sinh” hoặc “Không đổi”, không chia cho 0. Biểu đồ đường so sánh tổng tiền/đại lý/hoa hồng, chuyển được sang booking, hỗ trợ tooltip/focus và bảng nguồn. Biểu đồ tỷ trọng thể hiện cơ cấu role/status/tour/booking. Snapshot toàn hệ thống được tách và ghi rõ không lọc theo kỳ doanh thu.

Test ranh giới đã phát hiện và sửa lỗi nhóm tháng theo timezone session của PostgreSQL: dữ liệu timestamp UTC được nhóm trực tiếp, không chuyển một booking cuối tháng UTC sang tháng kế tiếp. Regression kiểm tra các booking tại đầu/cuối khoảng ngày và chỉ cộng đúng tháng.

Users tìm/lọc ngày tạo trên backend trước count/pagination. Promotion tìm code/title literal, lọc discount type, active và thời gian áp dụng giao với khoảng chọn. Category tìm không dấu/trạng thái/sắp xếp trên toàn danh sách đã tải; policy có tìm text và lọc loại. Commission chỉ có một cấu hình nên không thêm ô search hoặc date filter không có ý nghĩa.

Checklist trực tiếp bổ sung (chưa đánh dấu pass vì browser inventory vẫn rỗng):

- [ ] Đổi preset, chọn khoảng tùy ý, áp dụng, đặt lại; Network phải có from/to đúng UTC+7. Kỳ so sánh có cùng độ dài và không giao kỳ hiện tại.
- [ ] Biểu đồ khớp bảng nguồn, đổi sang booking, hover/Tab xem giá trị; không phát sinh phần trăm vô hạn khi kỳ trước bằng 0.
- [ ] User search + role/status/date trên nhiều trang; promotion text/type/active/overlap trên nhiều trang; thay filter đặt page về 1.
- [ ] Tìm category/chức năng không dấu, lọc inactive, đổi sort; policy search/type và trạng thái không có kết quả.
- [ ] Sidebar, toolbar, KPI và biểu đồ tại 375/768/1280px; không overflow toàn trang, bảng/biểu đồ cuộn trong container; chụp ảnh sau khi kiểm tra thật.

## Chuẩn bị walkthrough local còn lại

Tạo một database PostgreSQL LOOPBACK riêng, ví dụ `tripri_admin_01`, không dùng database của môi trường dùng chung. Thiết lập `DATABASE_URL` trỏ vào database đó; cấu hình JWT test và frontend/backend URL tương ứng, rồi:

```powershell
$env:SEED_ADMIN_EMAIL = 'admin01@tripri.test'
$env:SEED_ADMIN_PASSWORD = 'Admin01!LocalQA2026'
pnpm.cmd --filter backend db:deploy
pnpm.cmd --filter backend seed
pnpm.cmd --filter backend dev
```

Các giá trị trên chỉ là fixture local. Frontend ở terminal khác phải trỏ `NEXT_PUBLIC_API_URL` vào API local rồi chạy `pnpm.cmd --filter frontend dev`. Seed không thay mật khẩu tài khoản đã tồn tại; dùng database disposable mới cho lượt QA có thể tái lập. Không đưa credentials production vào tài liệu/test.

## Checklist browser trước Done

- [ ] Đăng nhập Super Admin: dashboard có dữ liệu backend, không có health/security giả; generatedAt/cache và tháng UTC hiển thị đúng.
- [ ] Promotion: tạo percent/fixed, sửa, tắt/bật; mã trùng, discount đã dùng, usageLimit dưới usedCount đều lỗi phù hợp; reload xác nhận persistence; agency code không xuất hiện trong platform list.
- [ ] Users: tìm/lọc/phân trang, xem role defaults/extra/effective; không tự chỉnh mình; thay quyền tài khoản test, xác nhận và GET lại; không ghi target lên session admin.
- [ ] Commission: trống/âm/>100/3 decimals bị chặn; lưu 12.5%, reload; booking mới dùng mức mới, booking cũ giữ snapshot (API invariant đã có integration test).
- [ ] Category: tạo/đổi tên/order/vô hiệu hóa/kích hoạt lại; public list và selector tour cập nhật; không mất reference tour.
- [ ] Bốn policies: sửa text và typed params; reload, giữ params khi chỉ sửa text; số giờ âm/chuỗi bị chặn; nội dung HTML hiển thị text an toàn.
- [ ] Network/server failure: giữ draft, không success/đóng form sớm; save đã success nhưng refetch lỗi có thông báo riêng; đọc lại sau timeout trước retry.
- [ ] Guest và mọi role non-admin mở trực tiếp URL: không mount nội dung private; session admin bị đổi role/ban thì API 403 và UI dừng thao tác.
- [ ] 375px / 768px / 1280px: không overflow trang, bảng cuộn trong container, navigation đủ sáu mục; modal cuộn và thao tác keyboard/Escape/đóng hoạt động.
- [ ] Lưu screenshots và ghi đúng environment/kết quả thực tế ở thư mục này; hiện chưa có screenshots và không được đánh dấu các mục trên pass dựa riêng vào DOM test.

Giới hạn hiện tại: cấu hình last-write-wins khi hai admin sửa đồng thời; audit best-effort; dashboard cache 30 giây; không policy version/approval hoặc commission riêng agency/category.
