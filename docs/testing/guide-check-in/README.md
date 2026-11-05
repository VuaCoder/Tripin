# Tour Guide — quét QR điểm danh (end-to-end)

Bằng chứng Playwright cho luồng **Quét QR Điểm Danh** của HDV: roster, điểm danh vé hợp lệ,
vé trùng / sai tour / đã hủy / đã dùng, phân quyền, và trang vé điện tử của traveler (nguồn QR).
Chạy bằng Chromium thật trên stack local; **không** đụng database Neon trong `.env`.

## Môi trường

| Thành phần | Cách dựng |
| --- | --- |
| PostgreSQL 18 | `backend/src/scripts/dev-local-pg.ts` — embedded PostgreSQL ở `:5433`, database tạm `tripri_dev`, in ra `READY <DATABASE_URL>` |
| Backend | `:3001` — `DATABASE_URL=<READY URL> ./node_modules/.bin/tsx src/server.ts` |
| Frontend | `:3100` — `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 ./node_modules/.bin/next dev -p 3100` |
| Schema | `dev-local-pg.ts` tự áp toàn bộ `prisma/migrations` |
| Fixture | `dev-guide-fixture.ts create` (agency, HDV, traveler, tour ACCEPTED) rồi `dev-guide-check-in-fixture.ts create` (booking + 5 vé) |
| Driver | `.playwright-cli/verify-guide-check-in.mjs` — Playwright API + Chromium, không mock network |

`.playwright-cli/` là vùng nháp đã gitignore (theo convention của repo); fixture và README này
thì được commit.

## Chạy lại

```bash
# 1. PostgreSQL tạm + backend + frontend (3 terminal riêng)
cd backend && ./node_modules/.bin/tsx src/scripts/dev-local-pg.ts
cd backend && DATABASE_URL='<READY URL>' ./node_modules/.bin/tsx src/server.ts
cd frontend && NEXT_PUBLIC_API_URL='http://localhost:3001/api/v1' ./node_modules/.bin/next dev -p 3100

# 2. Fixture (đặt cùng một mật khẩu dev, không commit)
cd backend
DATABASE_URL='<READY URL>' DEV_GUIDE_PASSWORD='...' ./node_modules/.bin/tsx src/scripts/dev-guide-fixture.ts create
DATABASE_URL='<READY URL>' ./node_modules/.bin/tsx src/scripts/dev-guide-check-in-fixture.ts create

# 3. Chạy walkthrough
cd ..
DEV_GUIDE_PASSWORD='...' node .playwright-cli/verify-guide-check-in.mjs
```

`dev-guide-check-in-fixture.ts create` idempotent: nó xóa đúng các booking/vé `DEVCHK-` và tour
`[DEV-CHECKIN]` rồi tạo lại. Khi dọn, chạy `dev-guide-check-in-fixture.ts clean` **trước**
`dev-guide-fixture.ts clean` để không để lại booking/vé mồ côi.

## Kết quả

`37/37 checks passed` — 3 ảnh trong thư mục này.

| # | Bước | Kỳ vọng | Quan sát |
| --- | --- | --- | --- |
| 01 | Traveler mở `/traveler/tickets/<id>` | vé `VALID`, QR + mã `ETK-DEVCHK0000000001` | ✅ badge `VÉ HỢP LỆ · SẴN SÀNG`, QR render đúng mã, mã hiện để nhập tay |
| 02 | HDV `GET /guide/e-tickets/:tourId` | 3 vé (bỏ vé hủy), 1 đã có mặt | ✅ `total=3, checkedIn=1`; vé `USED` tính là có mặt; roster không trả `code` |
| 03 | HDV quét vé hợp lệ (`POST .../check-in`) | 200, đúng tên + số vé + `checkedInAt` | ✅ `Nguyễn Văn An`, 2 khách, mốc thời gian trong 60 s |
| 04 | Roster sau quét | 2/3 đã có mặt, đúng vé được đánh dấu | ✅ `checkedIn=2`, `DEVCHK-0001` có `checkedInAt` |
| 05 | Vé traveler sau khi điểm danh | vẫn `VALID`, booking vẫn `CONFIRMED` | ✅ không bị đổi sớm sang `USED`/hoàn tất; reload trang vẫn `VÉ HỢP LỆ · SẴN SÀNG` |
| 06 | Quét lại cùng vé | 409 `TICKET_ALREADY_USED` | ✅ kể cả khi nhập lại bằng chữ thường + khoảng trắng (trim + uppercase) |
| 07 | Nhập tay vé thứ hai | 200; roster đủ 3/3 | ✅ `Trần Thị Bình`; lần nhập lại bị chặn 409; `checkedIn=3` (điều kiện hiện nút bắt đầu chuyến) |
| 08 | Mã không tồn tại | 404 `TICKET_NOT_FOUND` | ✅ |
| 09 | Vé của tour khác | 409 `TICKET_WRONG_TOUR` | ✅ cùng vé đó, khi trỏ đúng tour thứ hai, điểm danh được 200 |
| 10 | Vé đã hủy / đã dùng | 409 `TICKET_CANCELLED` / `TICKET_ALREADY_USED` | ✅ |
| 11 | HDV không được phân công | 404 `NOT_FOUND` (không phải 403 để không lộ tour) | ✅ cả roster và check-in; tour của HDV khác cũng 404 |
| 12 | Traveler gọi API HDV | 403 | ✅ cả GET lẫn POST |
| 13 | Khách chưa đăng nhập | 401 | ✅ |
| 14 | Trang vé đã hủy | `ĐÃ HỦY · KHÔNG CÒN HIỆU LỰC` | ✅ |

## Ảnh

| Ảnh | Nội dung |
| --- | --- |
| `01-traveler-ticket-before-check-in.png` | vé hợp lệ + QR trước khi HDV quét |
| `02-traveler-ticket-after-check-in.png` | sau khi quét, vé vẫn `VÉ HỢP LỆ · SẴN SÀNG` (chưa hoàn tất chuyến) |
| `03-traveler-ticket-cancelled.png` | vé đã hủy hiển thị đúng trạng thái |

## Playwright không thay được phần nào

Camera, đèn flash, đổi camera trước/sau, rung, âm thanh và debounce nằm trong UI Flutter
(`mobile_scanner`) — Playwright không điều khiển được app mobile. Walkthrough này kiểm tra đúng
hợp đồng mà app gọi (`GET /guide/e-tickets/:tourId`, `POST /guide/e-tickets/:tourId/check-in`) và
nguồn QR trên web. Kiểm tra trên thiết bị/emulator vẫn cần làm tay.
