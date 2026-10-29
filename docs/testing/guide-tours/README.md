# Tour Guide — nhận tour được phân công (end-to-end)

Luồng Playwright đã lưu cho use case **Tiếp nhận & Quản lý Tour phân công**, chạy bằng Chromium thật
trên stack local: HDV đăng nhập → danh sách tour được phân công → mở hộp thoại → **Chấp nhận** →
badge đổi trạng thái → reload vẫn còn. Kèm theo là các kiểm tra API mà màn hình mobile dựa vào
(danh sách tour, chi tiết tour, roster hành khách, phân quyền).

Phần Flutter (2 tab, nút gọi `tel:`, điểm danh) không chạy được bằng Playwright; các trường dữ liệu
mà app đọc được kiểm tra ở tầng API trong cùng lượt chạy này.

## Môi trường

| Thành phần | Cách dựng |
| --- | --- |
| PostgreSQL 18 | `:5433` — `backend/src/scripts/dev-local-pg.ts` (embedded, DB `tripri_dev`) |
| Backend | `:3001` — `DATABASE_URL=... ./node_modules/.bin/tsx src/server.ts` |
| Frontend | `:3100` — `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 ./node_modules/.bin/next dev -p 3100` |
| Fixture | `dev-guide-fixture.ts create` rồi `dev-guide-check-in-fixture.ts create` |
| Driver | `docs/testing/guide-tours/verify-guide-tours.mjs` — Playwright API + Chromium, không mock network |

## Chạy lại

```bash
# 1. Stack local (3 terminal) — xem docs/testing/guide-check-in/README.md

# 2. Fixture, dùng cùng một mật khẩu dev
cd backend
DATABASE_URL='<READY URL>' DEV_GUIDE_PASSWORD='...' ./node_modules/.bin/tsx src/scripts/dev-guide-fixture.ts create
DATABASE_URL='<READY URL>' ./node_modules/.bin/tsx src/scripts/dev-guide-check-in-fixture.ts create

# 3. Walkthrough
cd ..
DEV_GUIDE_PASSWORD='...' node docs/testing/guide-tours/verify-guide-tours.mjs
```

Driver trả lời tour PENDING duy nhất, nên phải chạy lại bước 2 trước mỗi lần chạy. Nếu Playwright
không nằm ở đường dẫn mặc định, đặt `PLAYWRIGHT_MODULE=/path/to/playwright-core`.

## Kết quả

`35/35 checks passed`, 6 ảnh trong thư mục này.

| # | Bước | Kỳ vọng | Quan sát |
| --- | --- | --- | --- |
| 01 | Khách mở `/guide/tours` | bị đẩy về `/login` | ✅ không lộ dữ liệu |
| 02 | HDV đăng nhập, mở `/guide/tours` | `GET /guide/tours` 200; 4 tour: 1 PENDING, 2 ACCEPTED, 1 DECLINED | ✅ đúng badge, thù lao, ngày khởi hành; chỉ tour PENDING có nút |
| 03 | Tour của HDV khác | không xuất hiện | ✅ tour `Sapa` vắng mặt |
| 04 | Bấm "Nhận tour" | hộp thoại có ô ghi chú | ✅ ghi chú 41/500 ký tự |
| 05 | Xác nhận | `POST /guide/tours/:id/verification` 200, badge đổi, mất nút | ✅ 3 tour "Đã nhận tour", 0 tour chờ |
| 06 | Reload | câu trả lời đã ghi vào DB | ✅ vẫn 3 ACCEPTED, không có nút |
| 07 | Traveler mở `/guide/tours` | bị đẩy khỏi khu vực HDV | ✅ về `/home` |
| 08 | `GET /guide/tours` sau khi trả lời | 3 ACCEPTED, 1 DECLINED, 0 PENDING; có `feePerBooking`, `respondedAt`, `nextDepartureDate` | ✅ |
| 09 | `GET /tours/:id` của tour đã nhận | có mô tả, `maxGroupSize`, chuyến khớp ngày khởi hành | ✅ 20 khách, 6 chỗ đã đặt |
| 10 | `GET /guide/e-tickets/:tourId` | 3 vé, 1 đã có mặt | ✅ `total=3, checkedIn=1` |
| 11 | Roster: SĐT + số khách | `0900000000`, `1 người lớn / 1 trẻ em` | ✅ đúng booking `DEVCHK-0001` |
| 12 | Roster: ghi chú | `Dị ứng hải sản, cần phòng riêng.` | ✅ |
| 13 | Booking thiếu `guestPricing` | fallback toàn bộ là người lớn | ✅ `1/0/0` |
| 14 | Vé đã dùng | tính là đã lên xe, có `checkedInAt` | ✅ |
| 15 | Roster không lộ mã vé | không có trường `code` | ✅ |
| 16 | Phân quyền | traveler 403, khách 401, HDV khác 404 | ✅ |
| 17 | Trả lời lại tour đã xử lý | 409 `INVALID_STATE_TRANSITION` | ✅ |

## Ảnh

| Ảnh | Nội dung |
| --- | --- |
| `01-guide-tours-requires-login.png` | khách bị chặn ở cổng đăng nhập |
| `02-guide-tours-list.png` | 4 tour với badge PENDING / ACCEPTED / DECLINED, nút chỉ ở tour chờ |
| `03-accept-dialog.png` | hộp thoại nhận tour + ghi chú |
| `04-accepted.png` | sau khi nhận: badge đổi, thông báo thành công |
| `05-accepted-after-reload.png` | reload vẫn giữ trạng thái |
| `06-role-guard-traveler.png` | traveler bị đẩy về `/home` |

## Giới hạn

- **Không chạy được UI Flutter**: Playwright chỉ điều khiển web. Luồng 2 tab, nút gọi `tel:` và
  trạng thái "Chưa đến / Đã lên xe" trên mobile vẫn cần kiểm tra tay trên emulator/thiết bị.
- Nhánh **Từ chối** dùng chung dialog và endpoint với Chấp nhận (`accept: false`); lượt chạy này
  không bấm nút Từ chối vì fixture chỉ có một tour PENDING. Nhánh này có unit test ở
  `frontend/features/guide/__tests__/GuideAssignedToursPage.test.tsx`.
- Ghi chú khi trả lời không được trả lại trong `GET /guide/tours`, nên chỉ kiểm tra được qua
  thông báo/DB, không kiểm tra qua API ở đây.
