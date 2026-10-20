# Workflow kiểm thử tay: viết đánh giá → báo cáo → kiểm duyệt

Hướng dẫn bấm từng bước trên stack **local** đang chạy (frontend `http://localhost:3000`,
backend `http://localhost:3001/api/v1`). Dữ liệu do `dev-reports-fixture.ts` seed, tất cả đều mang
tiền tố `[DEV-REPORTS]`.

- Đăng nhập du khách / moderator: `/login` (ô **Email hoặc số điện thoại** và **Mật khẩu**, nút `Đăng nhập`).
- Đăng nhập đối tác: **`/agency/login`** (ô **Email doanh nghiệp** / **Mật khẩu**, nút `Đăng nhập Agency`).
  Tài khoản AGENCY gọi `/login` thường sẽ bị `403 AGENCY_PORTAL_REQUIRED`.
- Mật khẩu chung của cả 4 tài khoản: **`DevReports!2026`**

| Tài khoản | Vai trò | Dùng để |
| --- | --- | --- |
| `dev.reports.traveler@tripri.test` | TRAVELER | viết đánh giá, gửi báo cáo, xem kết quả |
| `dev.reports.violator@tripri.test` | TRAVELER | tác giả đánh giá bị ẩn / bị khoá |
| `dev.reports.agency@tripri.test` | AGENCY (VERIFIED) | chủ 2 tour, phản ánh đánh giá sai sự thật |
| `dev.reports.moderator@tripri.test` | MODERATOR | xử lý báo cáo, kiểm duyệt đánh giá, khoá tài khoản |

Hai tour đã seed (bấm tìm `[DEV-REPORTS]` ở `/tours` nếu id đã đổi sau lần seed lại):

- `.../tours/177e5fe6-f7ee-4486-b6f0-43cf0f01eeff` — **Vịnh Hạ Long**: tour dùng cho luồng du khách
  (du khách có 2 đặt chỗ `COMPLETED`: `DEVREPORTS02` đã đánh giá, `DEVREPORTS03` **chưa** đánh giá).
- `.../tours/8bbc1cd9-b830-4bb4-8215-663b6ee0ebd5` — **Đà Nẵng – Hội An**: chỗ chứa đánh giá 1★ "lừa đảo".

---

## Phần 1 — Du khách viết đánh giá

> Chỉ người **đã có đặt chỗ `COMPLETED`** của tour mới thấy nút. Hệ thống kiểm tra lại ở server:
> đặt chỗ không phải của mình → `404`, chưa hoàn thành → `409 BOOKING_NOT_COMPLETED`,
> đã đánh giá rồi → `409 REVIEW_EXISTS`. Mỗi đặt chỗ đúng **1** đánh giá.

1. Mở `/login`, đăng nhập `dev.reports.traveler@tripri.test`.
2. Mở trang tour Vịnh Hạ Long ở trên, kéo xuống mục **Đánh giá từ du khách**.
   → thấy nút **Viết đánh giá** và dòng "Bạn có 1 chuyến đi đủ điều kiện đánh giá."
3. Bấm **Viết đánh giá** → hộp thoại `Viết đánh giá`.
4. Chọn số sao (bấm vào ngôi sao), nhập **Cảm nhận của bạn** (10–2000 ký tự), bấm **Gửi đánh giá**.
   → `POST /reviews` → 201, hộp thoại đóng, hiện "Cảm ơn bạn! Đánh giá đã được đăng." và đánh giá của bạn.
5. Tải lại trang: mục đó chuyển thành **Bạn đã đánh giá tour này** (nút viết biến mất).
6. Thử đăng nhập bằng `dev.reports.violator@...` rồi mở cùng tour: tài khoản không có đặt chỗ
   của tour này thấy nút **Viết đánh giá** bị **disable** kèm câu "Bạn chỉ có thể đánh giá sau khi
   một chuyến đi của tour này hoàn thành."

**Sau bước này:** `Review` mới ở trạng thái `VISIBLE`, tour có thêm 1 đánh giá công khai.

## Phần 2 — Du khách gửi báo cáo

> Báo cáo chỉ cần **đối tượng tồn tại** — không cần đặt chỗ, không cần đã đi tour. Một người
> không mở được 2 báo cáo cùng lúc cho cùng một đối tượng (`409 REPORT_ALREADY_OPEN`).
> Giao diện du khách hiện chỉ có nút báo cáo **tour** (nút nằm cạnh tên tour trên trang chi tiết).

1. Vẫn ở trang tour, bấm nút **Báo cáo** cạnh tên tour.
2. Chọn **Loại vấn đề** (vd. `Chất lượng dịch vụ`), nhập **Mô tả chi tiết**.
3. Thử bấm **Gửi báo cáo** với nội dung ngắn (`Tour tệ`) → bị chặn ngay trên client:
   "Vui lòng mô tả vấn đề (ít nhất 10 ký tự)." — server không được gọi.
4. Nhập nội dung hợp lệ rồi **Gửi báo cáo** → `POST /reports` → 201, toast "Đã gửi báo cáo…".
5. Mở `/settings/reports` (menu tài khoản → **Báo cáo của tôi**): báo cáo mới ở trạng thái **Đang mở**.

## Phần 3 — Moderator xử lý báo cáo đó

> Quyền `dispute:resolve`. Chỉ moderator quyết định; đối tác chỉ được **phản hồi** một lần
> (`complaint:respond`) và không đóng được báo cáo.

1. Đăng xuất, đăng nhập `dev.reports.moderator@tripri.test` ở `/login`.
2. Mở `/moderator/reports`. Báo cáo vừa gửi nằm **đầu danh sách** (mới nhất trước).
   → cột phải là tên người báo cáo / đối tượng / đối tác / tour, **không có UUID**.
3. Bấm vào dòng đó → hộp thoại chi tiết: Đối tượng, Người báo cáo, Đối tác, Tour, loại vấn đề, nội dung.
4. Nhập **Lý do / ghi chú xử lý** rồi chọn:
   - **Chấp nhận báo cáo** → báo cáo `RESOLVED`, người báo cáo được thông báo;
   - hoặc **Bác bỏ báo cáo** → `REJECTED`.
   → `POST /moderation/reports/:id/resolve`.
5. Lọc theo trạng thái để thấy báo cáo vừa xử lý.

## Phần 4 — Moderator kiểm duyệt đánh giá (độc lập với báo cáo)

> Quyền `review:moderate`. Ẩn đánh giá **không** tự đóng báo cáo — đây là hai quyết định khác nhau.

1. Mở `/moderator/reviews` → 2 đánh giá đang `VISIBLE`.
2. Bấm một dòng → hộp thoại: số sao, nội dung, tác giả, đối tác, tour (đều bằng tên).
3. Nhập lý do rồi chọn **Ẩn đánh giá** (bắt buộc lý do) → `POST /moderation/reviews/:id/moderate`.
   Đánh giá biến khỏi danh sách công khai ngay; lý do được lưu vào `hiddenReason`.
4. Mở lại đánh giá đó → nút đổi thành **Khôi phục đánh giá** để trả về `VISIBLE`.
5. Tuỳ chọn: **Khoá tài khoản tác giả** → `POST /moderation/users/:id/ban`
   (tài khoản `BANNED` không đăng nhập được nữa: `403 ACCOUNT_BANNED`).
6. **Tác giả xem đánh giá của mình ở đâu:** mở lại **trang chi tiết tour** (không phải trang tài khoản),
   mục **Đánh giá từ du khách** → thẻ **Đánh giá của bạn**. Đăng nhập `dev.reports.violator@...` rồi mở
   `.../tours/8bbc1cd9-b830-4bb4-8215-663b6ee0ebd5`:
   - chưa bị ẩn → badge **Đang hiển thị**;
   - đã bị ẩn → badge **Đã bị ẩn** kèm dòng "Lý do: …" — tác giả **vẫn thấy** đánh giá của mình
     (`GET /reviews/me` trả cả bản `HIDDEN`), trong khi khách khác không còn thấy nó.
   `/settings/history` → chi tiết đặt chỗ chỉ hiện nhãn "Bạn đã gửi đánh giá cho chuyến đi này", không có nội dung.
   Menu tài khoản **không** có trang "Đánh giá của tôi", nên trang tour là chỗ duy nhất để xem lại.

## Phần 5 — Báo cáo **về một đánh giá**: xử lý ngay trong dialog

> Đây là chỗ dễ nhầm: báo cáo về đánh giá nằm ở `/moderator/reports` (lọc `Đánh giá`), **không** nằm ở
> `/moderator/reviews` — hai màn hình đọc hai bảng khác nhau.

1. Ở `/moderator/reports`, tìm dòng có nhãn **Đánh giá** với nội dung
   "Đánh giá này sai sự thật: tour không hề bị hủy giữa chừng…" (đã seed sẵn).
2. Bấm vào → dialog hiện khối **ĐÁNH GIÁ BỊ BÁO CÁO**: số sao, tên tác giả, nội dung đánh giá,
   trạng thái `Đang hiển thị`.
3. Bấm **Ẩn đánh giá** ngay tại đây (nhập lý do) → đánh giá `HIDDEN`, không cần sang màn hình khác.
4. Dialog vẫn mở và báo cáo **vẫn `Đang mở`** — ẩn đánh giá ≠ đóng báo cáo.
5. Nhập lý do rồi **Chấp nhận báo cáo** để đóng báo cáo (hoặc **Bác bỏ** nếu thấy đánh giá là đúng).

## Phần 6 — Đối tác phản ánh một đánh giá sai sự thật

> Quyền mới `review:dispute` (chỉ AGENCY). Đối tác **chỉ** phản ánh được đánh giá thuộc tour của mình
> (đánh giá của đơn vị khác → `404`), và **không** tự chọn đối tượng — chỉ gửi loại vấn đề + mô tả.

1. Mở `/agency/login`, đăng nhập `dev.reports.agency@tripri.test`.
2. Vào **Đánh giá** (menu đối tác) hoặc `/agency/reviews` → danh sách đánh giá của các tour thuộc đơn vị,
   tác giả được che tên (`Trần K.`, `Lê P.`).
3. Bấm **Phản ánh đánh giá** ở dòng 1★ "Hướng dẫn viên vô trách nhiệm…".
4. Chọn loại vấn đề, nhập mô tả, **Gửi báo cáo** → `POST /agency/review-disputes/:reviewId` → 201,
   toast "Đã gửi phản ánh…".
5. Phản ánh hiện ở mục **Phản ánh tôi đã gửi** với trạng thái **Đang mở**.
6. Quay lại tài khoản moderator: phản ánh này nằm trong **cùng** hàng đợi `/moderator/reports`
   (nhãn `Đánh giá`) → xử lý như Phần 5.
7. Đối tác tải lại `/agency/reviews`: trạng thái **Đã giải quyết** + dòng **Quyết định của kiểm duyệt viên**.

> Phản ánh của đối tác **không** rơi vào hộp thư khiếu nại của chính họ (`/agency/complaints` vẫn rỗng):
> nó được lưu với `reporterId` = đối tác và **không** có `agencyId`.

## Phần 7 — Du khách thấy kết quả

1. Đăng nhập lại `dev.reports.traveler@tripri.test` → `/settings/reports`.
2. Báo cáo đã xử lý hiện **Đã giải quyết** kèm **Quyết định của kiểm duyệt viên** (ghi chú của moderator).
3. Mở lại trang tour: đánh giá bị ẩn không còn trong danh sách công khai.

---

## Ai được làm gì

| Hành động | Quyền | Ai có |
| --- | --- | --- |
| Viết đánh giá (1 lần / đặt chỗ đã hoàn thành) | `review:create` | TRAVELER |
| Gửi báo cáo (tour / tài khoản) | `report:create` | TRAVELER, AGENCY |
| Phản ánh đánh giá của tour mình | `review:dispute` | AGENCY |
| Phản hồi báo cáo (1 lần) | `complaint:respond` | AGENCY |
| Xem & quyết định báo cáo / tranh chấp | `dispute:resolve` | MODERATOR |
| Ẩn / khôi phục đánh giá | `review:moderate` | MODERATOR |
| Khoá tài khoản | `account:ban` | MODERATOR |
| Xử lý khiếu nại (support ticket) | `complaint:handle` | MODERATOR |

## Lỗi/validate bạn sẽ gặp (đúng như thiết kế)

| Tình huống | Kết quả |
| --- | --- |
| Chưa đăng nhập, mở trang tour | không có nút Báo cáo và nút Viết đánh giá (chỉ "Đăng nhập để đánh giá") |
| Viết đánh giá khi chưa có đặt chỗ hoàn thành | nút bị disable + "Bạn chỉ có thể đánh giá sau khi một chuyến đi của tour này hoàn thành." |
| Đánh giá lại đặt chỗ đã đánh giá | `409 REVIEW_EXISTS` → "Bạn đã đánh giá đặt chỗ này rồi." |
| Mô tả báo cáo < 10 ký tự | chặn ở client, không gọi API |
| Báo cáo trùng khi báo cáo cũ còn mở | `409 REPORT_ALREADY_OPEN` |
| Báo cáo đối tượng không tồn tại | `404 NOT_FOUND` |
| Du khách gọi API moderator | `403 FORBIDDEN` (UI cũng chặn: "Bạn không có quyền truy cập chức năng này.") |
| Moderator gọi `POST /reports` | `403` (moderator không có `report:create`) |
| Đối tác phản ánh đánh giá của đơn vị khác | `404 NOT_FOUND` |

## Giới hạn đã biết (không phải lỗi)

- Giao diện du khách **chưa có** nút báo cáo từng đánh giá; muốn thử báo cáo về đánh giá thì dùng
  bản đã seed (Phần 5) hoặc để đối tác phản ánh (Phần 6). API `POST /reports` với `targetType: REVIEW`
  đã hỗ trợ sẵn.
- `/agency/reviews` chỉ liệt kê đánh giá **VISIBLE**, nên đánh giá đã bị ẩn thì đối tác không phản ánh lại được.
- Phản ánh của đối tác **không bắn thông báo** cho moderator; nó nằm chờ trong hàng đợi như mọi báo cáo.
- Chưa có UI rút lại phản ánh / mở khoá tài khoản.
- Dòng **Đơn đặt chỗ** trong dialog báo cáo chỉ hiện khi báo cáo có đính kèm `bookingId`; giao diện hiện
  không đính kèm, nên bạn sẽ không thấy dòng này.

## Chạy lại từ đầu (dữ liệu sạch)

Mật khẩu Postgres tạm **được sinh ngẫu nhiên mỗi lần chạy** và chỉ in ra màn hình (không nằm trong source),
nên bước 1 in ra URL nào thì dùng đúng URL đó cho các bước sau.

```bash
# 1) Postgres tạm (giữ nguyên terminal này). Dòng cuối in ra: READY postgresql://postgres:<chuỗi>@127.0.0.1:5433/tripri_dev
cd backend && npx tsx src/scripts/dev-local-pg.ts

# 2) Backend, trỏ vào DB tạm vừa in (DATABASE_URL đã set sẽ thắng .env):
DATABASE_URL="<URL ở dòng READY>" npx tsx src/server.ts

# 3) Frontend:
cd frontend && npx next dev -p 3000

# 4) Seed lại dữ liệu (đổi id tour → tìm lại tour theo tiêu đề [DEV-REPORTS]):
cp .playwright-cli/dev-reports-fixture.ts backend/src/scripts/ && \
  (cd backend && DATABASE_URL="<URL ở dòng READY>" \
     npx tsx src/scripts/dev-reports-fixture.ts create) && \
  rm backend/src/scripts/dev-reports-fixture.ts
```

Fixture của module agency (`dev-agency-fixture.ts`) cần thêm `DEV_AGENCY_PASSWORD`: nó **không** ship
mật khẩu, thiếu biến này sẽ báo lỗi ngay.

Bằng chứng chụp màn hình của cùng luồng này: xem [`README.md`](./README.md) và ảnh `01`–`25` trong thư mục này.
