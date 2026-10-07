# Tripin — thiết kế schema PostgreSQL (một store duy nhất)

> 🗄️ **ĐÃ THAY THẾ cho mục đích triển khai — bởi [`../scope/`](../scope/README.md).**
> Thư mục này là **tài liệu lịch sử**: bản thiết kế theo tầm nhìn marketplace ở `CONTEXT.md`
> (khách sạn, vận chuyển, hành trình tự ghép, slot guide). Đối chiếu với use-case diagram thì nó
> **vừa thừa 30 bảng vừa thiếu 10 model** so với thứ đang chạy, nên **không phải superset** và
> **không được dùng làm target schema**. Bản dùng được là [`../scope/`](../scope/README.md) —
> 29 bảng khớp 1-1 với `prisma/schema.prisma`. Quyết định: [ADR 0005](../adr/0005-recut-design-to-scope.md).

Thư mục này chứa **bản thiết kế** schema Tripin sau khi bỏ MongoDB: toàn bộ 56 bảng
nằm trong **một** database PostgreSQL, mọi tham chiếu trước đây chỉ là "logic" nay
đã là `FOREIGN KEY` thật.

> ⚠️ **Đây không phải schema mà ứng dụng đang chạy.**
> Schema đang chạy là [`prisma/schema.prisma`](../../../prisma/schema.prisma) (29 model,
> tên khác — xem [mục 6](#6-quan-hệ-với-schema-đang-chạy)). Thư mục này là artifact
> thiết kế để review, không được Prisma hay backend nạp.

## 1. File

| File | Nội dung |
| --- | --- |
| [`database.html`](database.html) | **Trang HTML tự chứa** mô tả schema: sơ đồ quan hệ, tìm kiếm/lọc theo nhóm, chi tiết từng bảng. Mở trực tiếp bằng trình duyệt, không cần mạng. |
| [`generate-html.py`](generate-html.py) | Sinh lại `database.html` từ metadata thật của PostgreSQL. |
| [`tripin.dbml`](tripin.dbml) | Schema hợp nhất dạng DBML, dán được vào <https://dbdiagram.io>. 56 bảng, 24 enum, 73 quan hệ. |
| [`tripin.sql`](tripin.sql) | DDL PostgreSQL chạy được: enum, bảng, PK/UNIQUE/FK/CHECK, index, ràng buộc `EXCLUDE`, trigger `updatedAt`. |
| [`seed.sql`](seed.sql) | Dữ liệu mẫu: port nguyên 15 sample doc của MongoDB cũ + các bản ghi cha mà FK bắt buộc. |

### Sinh lại `database.html`

`database.html` **không viết tay**: nó đọc thẳng `pg_catalog` sau khi `tripin.sql` đã chạy, nên số
bảng, cột, khoá ngoại, index và ràng buộc hiển thị luôn khớp DDL. Sửa `tripin.sql` thì sinh lại:

```bash
psql -v ON_ERROR_STOP=1 -d tripin -f docs/database/design/tripin.sql
python3 docs/database/design/generate-html.py -d tripin
```

Tham số còn lại được chuyển thẳng cho `psql`, nên dùng được cả DSN:
`python3 generate-html.py "postgresql://user:pw@host/db"`. Cần `psql` trong `PATH` và Python 3
(không cần thư viện ngoài).

## 2. Chạy thử

Script **không idempotent** (cố ý fail to trên database đã có schema). Chạy trên database trống:

```bash
createdb tripin
psql -v ON_ERROR_STOP=1 -d tripin -f docs/database/design/tripin.sql
psql -v ON_ERROR_STOP=1 -d tripin -f docs/database/design/seed.sql
```

Đã kiểm chứng thật trên `postgres:16-alpine`:

| Kiểm tra | Kết quả |
| --- | --- |
| `tripin.sql` | chạy sạch, exit 0 |
| `seed.sql` | chạy sạch, exit 0 |
| Bảng | **56** (khớp đúng danh sách bảng trong `tripin.dbml`, diff rỗng) |
| Enum | 24 |
| Foreign key | 73 (khớp đúng 73 dòng `Ref:` trong DBML) |
| UNIQUE / PRIMARY KEY | 20 / 56 |
| CHECK | 45 |
| `EXCLUDE` | 1 (`slot_no_overlap`) |
| Trigger | 6 (`updatedAt`) |
| Cột | 390 (275 `NOT NULL`, 115 nullable) |
| 15 bảng có sample doc gốc | mỗi bảng đúng 1 dòng |

Bốn hành vi được ghi trong `seed.sql` cũng đã được chạy tay và cho **đúng** thông báo lỗi:

```
1) SLOT chồng lấn  -> ERROR: conflicting key value violates exclusion constraint "slot_no_overlap"
2) TRIP trùng NULL -> ERROR: duplicate key value violates unique constraint
                      "TRIP_productId_departScheduled_origin_destination_key"
3) FK không tồn tại -> ERROR: ... violates foreign key constraint "WISHLIST_travellerUserId_fkey"
4) UPDATE CART.updatedAt = '2000-01-01' -> trigger ghi đè thành now()
```

## 3. Gộp hai store thành một

Thiết kế cũ chia làm hai: Postgres cho giao dịch (41 bảng) và MongoDB cho nội dung &
tương tác (15 collection). Bản này gộp lại:

- **15 bảng nội dung vào Postgres**: `ZONE`, `LOCATION`, `PRODUCT_CONTENT`,
  `PROFILE_CONTENT`, `REVIEW`, `REVIEW_SUMMARY`, `NOTIFICATION`, `WISHLIST`, `CART`,
  `CART_ITEM`, `REPORT`, `HELP_ARTICLE`, `TICKET`, `TICKET_MESSAGE`, `RAW_EVENT`.
- **Validator `$jsonSchema` của Mongo → ràng buộc Postgres**:
  `required` → `NOT NULL`; unique index → `UNIQUE`; index thường → `CREATE INDEX`.
- **17 tham chiếu nay thành FK thật**: 4 ref mà DBML cũ đã khai là "logic"
  (`LOCATION.zoneId`, `PRODUCT_CONTENT.productId`, `PROFILE_CONTENT.supplierId`,
  `CART_ITEM.cartId`) cộng 13 cột trỏ sang bảng giao dịch mà Mongo không hề ràng buộc
  (`REVIEW.bookingId`, `REVIEW.travellerUserId`, `NOTIFICATION.userId`, `WISHLIST.*`,
  `CART.travellerUserId`, `CART_ITEM.productId`, `REPORT.reporterUserId`, `TICKET.userId`,
  `TICKET.assigneeId`, `TICKET_MESSAGE.*`) — trong đó có `PRODUCT.zoneId → ZONE.id`,
  trước đây trỏ sang một collection NoSQL nên không cưỡng chế được.
- **Bỏ hoàn toàn MongoDB**: không còn `mongo/docker-compose.yml`, `mongo/init/01-init.js`,
  không còn mongo-express, không còn hai store phải đồng bộ.

Ngoại lệ duy nhất không có FK: các cột **polymorphic** (`REVIEW.targetId`,
`REPORT.targetId`, `NOTIFICATION.refId`, `MODERATION_REQUEST.targetId`,
`INVOICE.refId`, `CHAT_THREAD.refId`) — đúng quy ước đã ghi trong
[`docs/database/README.md`](../README.md).

## 4. Những lỗi của DBML gốc đã sửa

Đây là phần "sửa lại cho đúng Postgres". Mỗi mục đều là lỗi thật, không phải sở thích:

| # | Vấn đề trong thiết kế gốc | Hậu quả nếu giữ nguyên | Cách sửa |
| --- | --- | --- | --- |
| 1 | Ràng buộc `EXCLUDE` của `SLOT` dùng `WITH =` trên cột text nhưng **thiếu `CREATE EXTENSION btree_gist`** | Câu `ALTER TABLE ... EXCLUDE` báo lỗi; luật "một nguồn lực không thể ở hai slot cùng lúc" **không hề tồn tại** | Thêm `CREATE EXTENSION IF NOT EXISTS btree_gist;` ở đầu file |
| 2 | `SUPPLIER.userId` và `TRAVELLER.ownerUserId` khai quan hệ 1-1 (`-`) nhưng **không đánh unique** | Một tài khoản tạo được nhiều nhà cung cấp / nhiều traveller | Thêm `UNIQUE` |
| 3 | `TRIP` có unique index trên `(productId, departScheduled, origin, destination)` nhưng 3 cột sau **nullable** | Hai chuyến cùng `NULL` lọt qua unique index (NULL ≠ NULL trong SQL) | `UNIQUE NULLS NOT DISTINCT` (PostgreSQL 15+) |
| 4 | `Ref: INVOICE.refId > BOOKING.id` trong khi `refType` là polymorphic | FK chặn mọi hoá đơn không trỏ vào `BOOKING` | Bỏ FK, giữ index `(refType, refId)` |
| 5 | `INVOICE.invoiceNo` không unique | Trùng số hoá đơn | Thêm `UNIQUE` |
| 6 | `REFUND.policyVersion` là số rời | Không truy được bản policy đã áp dụng — trái với hệ quả ghi trong [ADR 0003](#7-adr) | Thêm FK `REFUND.policyVersion → CANCELLATION_POLICY.version` |
| 7 | `USER` và cột `order` là **từ khoá SQL** | DDL không chạy nếu không quote | Quote toàn bộ identifier (`"USER"`, `"order"`, `"key"`, `"count"`, …) |
| 8 | PostgreSQL **không tự đánh index cho FK** | Mọi `DELETE`/`UPDATE` trên bảng cha quét toàn bảng con | Thêm index cho mọi FK chưa được index/PK phủ |
| 9 | Kiểu dữ liệu chung chung: `datetime`, `float`, `decimal`, `text` chứa JSON | Mất múi giờ, sai kiểu số, không kiểm tra được JSON | `timestamptz` (UTC), `double precision`, `numeric(14,2)`, `jsonb` |
| 10 | `status`/`type` là `varchar` dù DBML đã liệt kê giá trị | Ghi được giá trị rác | 24 enum PostgreSQL thật |
| 11 | Không có ràng buộc miền giá trị | Tiền âm, `qty` = 0, rating 7/5, slot kết thúc trước khi bắt đầu | 45 `CHECK` |
| 12 | `updatedAt` phó mặc cho tầng ứng dụng | Sửa trực tiếp trong DB là `updatedAt` sai | Trigger `tripin_set_updated_at()` cho 6 bảng có cột này |
| 13 | Thiếu index cho các sweep định kỳ | Job hết hạn hold / xử lý raw event quét toàn bảng | `HOLD(status, expiresAt)`, `RAW_EVENT(processedAt)`, `MODERATION_REQUEST(status, submittedAt)`, `PAYMENT(status, createdAt)`, … |

## 5. Những gì **cố ý giữ nguyên**

Bản hợp nhất **không thêm cột nghiệp vụ nào**. Cụ thể vẫn giữ như thiết kế gốc:

- Tên bảng/cột dạng `SCREAMING_SNAKE` như DBML (nên DDL phải quote mọi identifier).
- `id` là `varchar` opaque do ứng dụng sinh (`'usr_1'`, `'prd_1'`), **không** đổi sang UUID.
- Mọi giờ là UTC; tiền là VND.
- Không thêm bảng, không xoá bảng, không đổi tên cột.

### Điểm cần owner chốt

1. **Nullability.** Quy tắc đã dùng: `NOT NULL` ở nơi **có bằng chứng** — khoá chính,
   cột `UNIQUE`, cột enum, và danh sách `required` của validator Mongo cũ; phần còn lại
   giữ nullable như DBML. Kết quả: **115/390 cột nullable** (danh sách đầy đủ ở
   [phụ lục](#phụ-lục--115-cột-nullable)). Cần chốt lại khi chuyển sang Prisma.
2. **Các cột `varchar` chưa có danh sách giá trị.** DBML ghi `varchar` không kèm giá trị
   nên bản này giữ `varchar`: `USER.status`, `TRIP.status`, `HOLD.itemType`,
   `BOOKING_EVENT.type`, `PAYMENT.method/status`, `PAYMENT_TRANSACTION.type/status`,
   `REFUND.status`, `PAYOUT.status`, `TOUR_REQUEST.status`, `REPORT.status/targetType`,
   `TICKET.status/priority`, `NOTIFICATION.type/refType`, `INVOICE.refType`,
   `MODERATION_LOG.action`, `SUPPLIER_INTEGRATION.status`. Có danh sách giá trị thì
   chuyển thành enum.
3. **`BOOKING` chưa snapshot policy version.** [ADR 0003](#7-adr) nói một Booking *nên*
   ghi lại version policy tại thời điểm đặt, nhưng `BOOKING` không có cột đó — hiện chỉ
   `REFUND.policyVersion` là có. Cần quyết định có thêm `BOOKING.policyVersion` không.
4. **Nhập nhằng `TRAVELLER` vs `travellerUserId`.** Bảng `TRAVELLER` có `ownerUserId → USER`,
   nhưng nhiều cột tên `travellerUserId` (`CART`, `WISHLIST`, `REVIEW`, `BOOKING_GROUP`,
   `ITINERARY`, `PAYMENT`, `TOUR_REQUEST`) lại trỏ thẳng vào `USER`, không trỏ vào `TRAVELLER`.
   Cần thống nhất một quy ước.
5. **Thiết kế này chưa phải Prisma.** Xem [mục 6](#6-quan-hệ-với-schema-đang-chạy).

## 6. Quan hệ với schema đang chạy

| | Thiết kế ở đây | Đang chạy |
| --- | --- | --- |
| File | `docs/database/design/tripin.sql` | [`prisma/schema.prisma`](../../../prisma/schema.prisma) |
| Số bảng | 56 | 29 |
| Tên bảng | `SCREAMING_SNAKE` (`USER`, `PRODUCT`, `TRIP`, `BOOKING`) | PascalCase + `@@map` (`User`, `Tour`, `TourDeparture`, `Booking`) |
| Id | `varchar` opaque | `uuid` |
| Tiền | `numeric(14,2)` | `Int` (VND nguyên) |
| Enum | 24 enum Postgres | enum Prisma, có test `prisma-enums-in-sync` |

Hai bên **không tự đồng bộ**, và quan hệ giữa chúng **không phải "cha–con"**: đối chiếu 56 bảng
ở đây với 29 model đang chạy thì thấy thiết kế **vừa thừa vừa thiếu** so với phạm vi đang code
(chi tiết ở [mục 6.1](#61-đối-chiếu-với-phạm-vi-đang-code)). Vì vậy **không** dùng file này làm
target schema, và không copy SQL vào `prisma/migrations/`.

### 6.1 Đối chiếu với phạm vi đang code

Đối chiếu 56 bảng thiết kế với 29 model của `prisma/schema.prisma`:

| Nhóm | Số bảng | Gồm |
| --- | --- | --- |
| Có bản tương ứng trong code | 24 | `USER`→`User`, `SUPPLIER`→`AgencyProfile`, `PRODUCT`→`Tour`, `AVAILABILITY`/`SEAT_INVENTORY`→`TourDeparture`, `BOOKING_GROUP`/`BOOKING`/`BOOKING_ITEM`→`Booking`, `PAYMENT`/`PAYMENT_TRANSACTION`→`Payment`, `REVIEW`/`REVIEW_SUMMARY`→`Review` + `Tour.ratingAvg`, `TICKET`/`TICKET_MESSAGE`→`SupportTicket`/`SupportTicketMessage`, `CHAT_THREAD`/`CHAT_MESSAGE`→`Conversation`/`Message`, `WISHLIST`→`WishlistItem`, `CART_ITEM`→`CartItem`, `PLATFORM_SETTING`/`CANCELLATION_POLICY`→`SystemSetting`, `AUDIT_LOG`→`AuditLog`, … |
| Chỉ còn một phần | 2 | `TOUR_PACKAGE_ITEM` → `Tour.itinerary` (JSON, không phải bảng ghép); `TRAVELLER` → gộp vào `User` |
| **Không có chỗ nào trong phạm vi** | **30** | xem dưới |

30 bảng không có chỗ trong phạm vi, theo nhóm:

- **Marketplace khách sạn / transport (11)** — `HOTEL_PROFILE`, `TRANSPORT_PROFILE`, `ROOM_TYPE`,
  `AMENITY`, `PROFILE_AMENITY`, `ZONE`, `LOCATION`, `PRODUCT_CONTENT`, `PROFILE_CONTENT`,
  `TRIP`, `TRIP_EVENT`. Use-case diagram không có use case nào cho lưu trú hay vận chuyển.
- **Traveler tự ghép hành trình & slot (7)** — `ITINERARY`, `ITINERARY_VERSION`,
  `ITINERARY_SEGMENT`, `TOUR_REQUEST`, `SLOT`, `GUIDE_AVAILABILITY`, `HOLD`. Diagram không có
  hành trình tự ghép, không có slot của guide, không có yêu cầu tour riêng.
- **Tài chính nâng cao (5)** — `PAYOUT`, `INVOICE`, `REFUND`, `SUPPLIER_PAYOUT_ACCOUNT`,
  `SUPPLIER_INTEGRATION`. Diagram chỉ có "Set platform commission rates"; tiền hoa hồng đang được
  snapshot thẳng trên `Booking` (`commissionBps`, `commissionAmount`, `agencyAmount`), không có
  chu kỳ chi trả.
- **Hạ tầng chưa làm (7)** — `MODERATION_REQUEST`, `MODERATION_LOG` (module moderation là
  orchestrator thuần, không có model — D-52), `RAW_EVENT`, `HELP_ARTICLE`, `BOOKING_EVENT`,
  `BOOKING_TRAVELLER` (thông tin liên hệ snapshot thẳng trên `Booking`), `CART` (không có bảng
  header giỏ, chỉ có `CartItem`).

Chiều ngược lại, **10 model đang chạy mà thiết kế không có** — tức thiết kế bỏ sót cả những use
case *đang nằm trong* diagram: `Otp`, `RefreshToken` (login/2FA), `Category` (Config Tour
Categories), `SubscriptionPlan`, `Subscription` (Subscribe to plan), `Promotion` (Upload/Config
promotions), `ETicket` (Receive E-ticket), `Earning` (View earnings), `AiConversation`,
`AiMessage` (Chat with AI).

Kết luận: đây là **hai mô hình khác nhau**, không phải một bản đầy đủ và một bản rút gọn. Thiết kế
viết cho tầm nhìn marketplace ở `CONTEXT.md`, còn code bám use-case diagram; hai bên chưa bao giờ
được cắt lại cho khớp nhau.

## 7. ADR

Quyết định "một store Postgres" được ghi tại
[`docs/database/adr/0004-single-postgres-store.md`](../adr/0004-single-postgres-store.md),
thay thế ADR `0001-split-data-stores` (hai store) của bộ thiết kế gốc.

---

## Phụ lục — 115 cột nullable

Sinh trực tiếp từ database đã tạo bằng `tripin.sql`, nên khớp 100% với DDL.

```
AMENITY: category, icon
AUDIT_LOG: actorId, entityType, entityId, beforeJson, afterJson, ip, userAgent, requestId
BOOKING: idempotencyKey
BOOKING_EVENT: payload
BOOKING_GROUP: itineraryId
BOOKING_ITEM: roomTypeId, tripId, startDate, endDate
CART_ITEM: startDate, endDate
GUIDE_PROFILE: languages
HELP_ARTICLE: category, body
HOLD: productId, roomTypeId, tripId, date
HOTEL_PROFILE: address, lat, lng, starRating, checkInTime, checkOutTime
INVOICE: taxNo
ITINERARY_SEGMENT: productId, tripId, bookingId, poiName, plannedStart, plannedEnd,
                   actualStart, actualEnd, bufferMin, dependsOnOrder
ITINERARY_VERSION: reason
LOCATION: lat, lng
MODERATION_LOG: note
MODERATION_REQUEST: reviewerId, reason, reviewedAt
NOTIFICATION: body, refType, refId, readAt
PAYMENT: gatewayRef, paidAt
PAYMENT_TRANSACTION: gatewayRef
PAYOUT: paidAt
PLATFORM_SETTING: value, description
PRODUCT: zoneId, lat, lng, ratingAvg
PRODUCT_CONTENT: titleVi, titleEn, descriptionVi, descriptionEn, media, amenities
PROFILE_CONTENT: nameVi, nameEn, descriptionVi, descriptionEn, media, policies
RAW_EVENT: payload, processedAt
REFUND: paymentId, reason
REPORT: reason
REVIEW: title, comment
REVIEW_SUMMARY: distribution
ROOM_TYPE: bedType, sizeSqm
SUPPLIER: legalName, displayName, taxId, licenseNo, licenseExpiry, ratingAvg
SUPPLIER_INTEGRATION: credentials, lastSyncAt
TICKET: priority, assigneeId
TOUR_PACKAGE_ITEM: plannedOffsetMin, durationMin, bufferMin
TOUR_REQUEST: depositAmount
TRAVELLER: dob
TRIP: origin, destination, departScheduled, arriveScheduled, departEstimated, departActual
TRIP_EVENT: newTime, reason, source
USER: phone, passwordHash, locale, currency
ZONE: vibe
```
