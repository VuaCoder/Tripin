# Tripin — schema đúng phạm vi đang code

Bản thiết kế **cắt lại cho khớp phạm vi** (use-case diagram): 29 bảng + 1 bảng join + 21 enum, khớp 1-1
với [`prisma/schema.prisma`](../../../prisma/schema.prisma).

Mục đích không chỉ là "đọc cho biết", mà là **soát ngược lại Prisma**: file [`tripin.sql`](tripin.sql)
giữ nguyên phần DDL do Prisma sinh ra, rồi thêm đúng những gì Prisma **không khai được**. Nhờ vậy mọi
khác biệt giữa file này và DB đang chạy đều là cố ý và đã được đếm.

> Bản thiết kế tầm nhìn marketplace (56 bảng, có khách sạn / vận chuyển / hành trình tự ghép / slot)
> vẫn nằm ở [`../design/`](../design/README.md) như tài liệu lịch sử — **không phải** target schema.
> Thư mục `scope/` này mới là bản dùng được.

## 1. File

| File | Nội dung |
| --- | --- |
| [`tripin.sql`](tripin.sql) | Schema đầy đủ, chạy được: **phần 1** = DDL Prisma nguyên văn, **phần 2** = 49 FK + 36 CHECK + 26 index + 7 NOT NULL + 16 trigger. |
| [`tripin.dbml`](tripin.dbml) | Bản DBML (30 bảng, 21 enum, 60 quan hệ), dán được vào <https://dbdiagram.io>. |
| [`database.html`](database.html) | Trang HTML tự chứa: sơ đồ quan hệ, tìm kiếm/lọc, chi tiết từng bảng. Mở offline. |
| [`preflight.sql`](preflight.sql) | Kiểm tra dữ liệu **trước khi** áp ràng buộc (chỉ đọc): tham chiếu mồ côi, dòng vi phạm CHECK, cột `text[]` đang NULL. |
| [`generate.py`](generate.py) | Sinh lại `tripin.dbml` + `database.html` từ metadata thật của PostgreSQL. |

### Chạy

```bash
# dựng schema (database trống)
createdb tripin
psql -v ON_ERROR_STOP=1 -d tripin -f docs/database/scope/tripin.sql

# sinh lại DBML + HTML
python3 docs/database/scope/generate.py -d tripin

# TRƯỚC KHI áp lên DB đang có dữ liệu (chỉ đọc, không sửa)
psql -d <db> -f docs/database/scope/preflight.sql
```

Tham số còn lại được chuyển thẳng cho `psql`, nên dùng được cả DSN. Cần `psql` trong `PATH` và Python 3
(không cần thư viện ngoài).

## 2. Kết quả soát xét

Mốc so sánh là DB dựng **từ chính migration của Prisma** (`prisma/migrations/*/migration.sql`) trên
`postgres:16`. Số liệu lấy từ `pg_catalog`, không viết tay.

| | DB đang chạy (Prisma) | Schema này | Chênh |
| --- | --- | --- | --- |
| Bảng | 30 | 30 | 0 |
| Cột | 331 | 331 | 0 |
| **Khoá ngoại** | **11** | **60** | **+49** |
| **CHECK** | **0** | **36** | **+36** |
| Index | 114 | 140 | +26 |
| Trigger | 0 | 16 | +16 |
| Cột `NOT NULL` | 237 | 244 | +7 |
| Enum | 21 | 21 | 0 |

Phép so sánh đã chạy tự động và cho kết quả **đúng bằng các con số trên**: bảng và cột giống hệt nhau,
cột chỉ khác đúng 7 chỗ `text[]` (nullable → NOT NULL), không có khác biệt nào ngoài dự định.

### 2.1. Nghiêm trọng nhất: DB gần như không có khoá ngoại

Prisma chỉ tạo FK cho 11 quan hệ được khai bằng `@relation`. **49 tham chiếu còn lại là cột `uuid`
trần**, nên DB hiện không hề chặn tham chiếu mồ côi. Đáng chú ý nhất:

| Bảng | Cột trỏ ra ngoài mà **không** có FK |
| --- | --- |
| `Booking` | `travelerId`, `agencyId`, `tourId`, `departureId`, `promotionId` — **không một FK nào** |
| `Tour` | `agencyId`, `reviewedById` |
| `Payment` | `userId` |
| `ETicket` | `bookingId`, `travelerId`, `agencyId`, `tourId` |
| `Earning` | `guideId`, `bookingId`, `tourId`, `agencyId` |
| `Review` | `bookingId`, `tourId`, `agencyId`, `travelerId`, `moderatedById` |
| `Report` | `reporterId`, `bookingId`, `agencyId`, `tourId`, `agencyResponseById`, `resolutionById` |
| `CartItem` | `userId`, `tourId`, `departureId` |
| `WishlistItem` | `userId`, `tourId` |
| `Conversation` | `travelerId`, `guideId`, `tourId`, `lastMessageSenderId` |
| `SupportTicket` | `userId`, `bookingId`, `assignedToId` |
| `Promotion` | `ownerId`, `createdById` |
| `Subscription` | `userId` |
| `Notification` | `userId` |
| `Message` | `senderId` |
| `AiConversation` | `userId` |
| `AuditLog` | `actorId` |
| `SystemSetting` | `updatedById` |
| `SupportTicketMessage` | `authorId` |
| `TourGuideAssignment` | `guideId` |

Nghĩa là hiện tại DB **cho phép** một `Booking` trỏ tới tour/departure/người dùng không tồn tại, một
`Review` gắn vào booking đã bị xoá, một `Earning` trả cho guide không có thật — tất cả đều không báo lỗi.
Tính đúng đắn hiện chỉ do tầng ứng dụng giữ.

Hai chỗ **cố ý không có FK** (giữ nguyên): `Payment.referenceId` và `Report.targetId` là polymorphic.

### 2.2. DB có **0** CHECK constraint

Không có gì trong DB chặn: `remaining > capacity`, `rating = 99`, `totalAmount ≠ subtotal − discountAmount`,
tiền âm, `endsAt < startsAt`, `usedCount > usageLimit`, hay `CartItem.participants = 0`.

36 CHECK được thêm đều **chép lại một luật mà code đã chặn sẵn**, ghi kèm nguồn:

| Bảng | Số | Nguồn trong code |
| --- | --- | --- |
| `Tour` | 5 | `tours.validation.ts` (`durationDays` min 1, `basePrice` min 0, `maxGroupSize` min 1), rating 0..5 |
| `TourDeparture` | 3 | `departureShape` (capacity min 1) + `reserveSeats` không bán quá chỗ |
| `Booking` | 6 | `bookings.service.ts:95-119` + `BOOKING_POLICY.MIN_PAYABLE_AMOUNT` (D-74) |
| `Promotion` | 6 | `promotions.validation.ts` + `consume()` nguyên tử |
| `Subscription` | 3 | period/price/duration |
| `SubscriptionPlan` | 2 | price ≥ 0, `durationDays` ≥ 1 |
| `Otp` | 2 | `attempts` ≥ 0, `expiresAt` > `issuedAt` |
| `TourGuideAssignment`, `Payment`, `ETicket`, `Earning`, `Review`, `SupportTicket`, `Conversation`, `AiConversation`, `CartItem` | 1 mỗi bảng | policy tương ứng |

Hai CHECK đáng chú ý vì chúng là **bất biến tiền bạc** đang không được DB bảo vệ:

```sql
-- totalAmount = subtotal - discountAmount
CHECK ("totalAmount" = "subtotal" - "discountAmount")

-- commissionAmount = floor(totalAmount * bps / 10000); agencyAmount = total - commission
CHECK ("commissionAmount" = (("totalAmount"::bigint * "commissionBps") / 10000)
   AND "agencyAmount" = "totalAmount" - "commissionAmount")
```

Ép `::bigint` là **bắt buộc**: `totalAmount` đi tới 1e11, nhân 10000 sẽ tràn `int4` và làm CHECK ném lỗi
thay vì trả `false`.

### 2.3. 26 cột khoá ngoại không có index

PostgreSQL **không** tự đánh index cho FK, nên mỗi lần xoá/sửa dòng cha là một lần quét toàn bảng con.
26 cột dưới đây sẽ trở thành cột FK mà không có index nào lấy chúng làm cột đầu — trong đó có 2 FK **đã
có sẵn**:

```
Subscription.planId            User.bannedById                 (FK đã tồn tại, vẫn thiếu index)
Booking.departureId            Booking.promotionId             CartItem.departureId
CartItem.tourId                Conversation.tourId             Conversation.lastMessageSenderId
ETicket.agencyId               ETicket.tourId                  Earning.agencyId
Earning.tourId                 Message.senderId                Promotion.ownerId
Promotion.createdById          Report.agencyResponseById       Report.bookingId
Report.resolutionById          Report.tourId                   Review.moderatedById
SupportTicket.assignedToId     SupportTicket.bookingId         SupportTicketMessage.authorId
SystemSetting.updatedById      Tour.reviewedById               WishlistItem.tourId
```

7 trong số đó chỉ phục vụ cột "ai làm việc này" (User không bao giờ bị xoá cứng) — đã đánh dấu
`[ghi công]` trong `tripin.sql`, bỏ được nếu sau này cần giảm chi phí ghi.

### 2.4. 7 cột `text[]` đang NULLable

Prisma khai `String[] @default([])` nhưng cột `text[]` vẫn cho phép `NULL` — tức DB cho phép `NULL` ở
đúng những chỗ code luôn coi là mảng:

`User.extraPermissions`, `Tour.images`, `Tour.inclusions`, `Tour.exclusions`, `GuideProfile.languages`,
`GuideProfile.specialties`, `SubscriptionPlan.benefits`.

### 2.5. `@updatedAt` chỉ chạy khi ghi qua Prisma

16 bảng có `updatedAt` nhưng không có trigger nào, nên sửa trực tiếp bằng SQL (script vận hành, `psql`,
migration) sẽ để lại `updatedAt` sai. Schema này thêm trigger `set_updated_at()` cho cả 16 bảng.

## 3. Cần kiểm tra trước khi áp

Các ràng buộc dưới đây **có thể vướng dữ liệu cũ** — chạy [`preflight.sql`](preflight.sql) trước:

1. **49 FK** — bất kỳ tham chiếu mồ côi nào cũng chặn `ALTER TABLE ... ADD CONSTRAINT`. Preflight in ra
   từng bảng.cột có bao nhiêu dòng mồ côi.
2. **`Booking_amount_min_check`** (`subtotal >= 1 AND totalAmount >= 1`) — luật này chỉ có từ D-74, nên
   booking tạo trước đó có thể vi phạm.
3. **7 `SET NOT NULL`** — cần chắc không còn dòng `NULL` (Prisma luôn ghi mảng nên nhiều khả năng là 0).

`ON DELETE` đã chọn theo quy ước: `CASCADE` cho dòng con thuộc sở hữu dòng cha (profile, tin nhắn, giỏ,
wishlist), `RESTRICT` cho dòng tiền/audit/danh tính, `SET NULL` cho cột nullable chỉ để ghi công. An
toàn vì code **không hard-delete** `User` / `Tour` / `Booking` (user bị ban, tour bị `ARCHIVED`, booking
bị `CANCELLED` — D-14, D-61).

## 4. Quan hệ với các artifact khác

| | Thư mục này | `../design/` (tầm nhìn) | `prisma/schema.prisma` |
| --- | --- | --- | --- |
| Bảng | 30 | 56 | 29 model |
| Khớp phạm vi diagram | ✅ | ❌ (30 bảng ngoài phạm vi, thiếu 10) | ✅ |
| Dùng làm target schema | ✅ | ❌ | ✅ (nguồn sự thật) |

`tripin.sql` **không** thay thế `prisma/schema.prisma`: nó là bản DB-view của cùng mô hình, thêm những
ràng buộc mà Prisma không diễn đạt được. Muốn đưa các ràng buộc này vào ứng dụng thì viết một Prisma
migration chứa đúng phần 2 của `tripin.sql`, **không** copy cả file.
