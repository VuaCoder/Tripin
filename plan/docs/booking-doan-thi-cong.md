# Kế hoạch thi công — Booking đoàn qua chat

> Thiết kế và các quyết định: [booking-doan.md](./booking-doan.md). Tài liệu này chỉ chứa **thứ tự code**: mỗi lát cắt `S` là một PR nhỏ, tự chạy được, test xanh rồi mới sang lát cắt sau.
> Trạng thái: **S0–S12 xong (13/11/2026)** — tính năng hoàn chỉnh. Ghi chú phát sinh khi code: quyền `custom-tour:*` chuyển từ S0 sang S2 (audit “no dead permission”), `CUSTOM_TOUR_RESPOND` sang S3 (gán cho cả TRAVELER và AGENCY vì quyết định có hai phía; service kiểm tra role). S5 chốt thêm: body có `unitPrice`/`subtotal` bị **400** (strict schema) thay vì bỏ qua; lưu nháp từ `OFFERED` **xóa `offerSnapshot`** để bản cũ không thể chấp nhận; thêm `emitChatUpdated` ở `chat.gateway.ts`. S6: AGENCY dùng chung inbox, link sidebar `/conversations` và `/agency/custom-tours` (trang sau thuộc S7). S7: yêu cầu đoàn nhập theo đúng nhóm tuổi của tour (`POST /custom-tours` nhận thêm `guestCounts`, tổng phải khớp `participants`) và `startDate` (ngày khởi hành dự kiến, phải ở tương lai; bản clone mở đúng ngày đó), migration `20261112190000_custom_tour_start_date`; hai danh sách hiện cơ cấu + ngày dự kiến; ảnh chụp luồng ở `plan/docs/screenshots/s7/`, script `backend/src/test/custom-tours.browser-smoke.cjs` (dùng lại fixture `chat-browser-server.ts`); sửa kèm 2 lỗi có sẵn của shell: `TravelerAccountShell` tràn ngang trên mobile (`min-w-0` ở `aside`) và lỗi validate trong dialog không tự xóa khi sửa lại; danh sách hành trình chưa có mục nav riêng (vào từ tour, thông báo, hoặc `/traveler/custom-tours`). S8: thẻ ghim + dialog thỏa thuận trong chat (`CustomTourChatSection`, `CustomTourPanel`, `AgencyOfferEditor`, `TravelerOfferReview`); agency nhận yêu cầu, sửa và gửi thỏa thuận ngay trong panel (dùng lại `TourContentFields`/`validateTourEditor`, lưu qua `/draft` kèm revision), khách xem bảng giá và chấp nhận đúng revision; panel là dialog giữa màn hình trên nền mờ (native `<dialog>`: focus trap, Esc đóng, focus trả về thẻ); `chat:updated` invalidate thêm tag `CustomTour`; `toTourContentInput` tách ra `features/tours/utils` để editor và panel dùng chung; panel khách đọc đúng nội dung tour đã chốt trong `offerSnapshot` (tên, điểm đến, số ngày, tóm tắt, mô tả, bao gồm/không bao gồm, chính sách), agency sửa các thông tin này ngay trong panel và server chụp lại toàn bộ khi gửi thỏa thuận; lịch trình chi tiết vẫn đi qua tin nhắn vì tour `PRIVATE` chưa có endpoint cho khách đọc. Ảnh chụp: `plan/docs/screenshots/s8/`, script `backend/src/test/custom-tours.chat-panel.cjs` (10 check, 9 ảnh, 0 page error). S9: `PATCH /custom-tours/:id/checkout-draft` chỉ cho traveler sở hữu request `ACCEPTED`; form phải khớp đúng số người và cơ cấu của `offerSnapshot` (ít nhất 1 người lớn, CCCD 12 số không trùng, SĐT hợp lệ) và có bộ đếm riêng `checkoutRevision` — body dùng `checkoutRevision` thay vì `revision` để không lẫn với revision thương lượng; `GET /:id` trả thêm `checkoutDraft` + `checkoutRevision`; `/traveler/bookings/new?customTourRequestId=…` rẽ nhánh ngay ở route (không sửa page 1.824 dòng) sang `GroupBookingEntry`: tour/ngày/cơ cấu/giá khóa theo offer, không voucher, tự sinh dòng theo cơ cấu, autosave 800ms tuần tự chỉ khi form đủ, trạng thái Đang lưu/Đã lưu/Lưu lỗi + Thử lại, cảnh báo `beforeunload`, reload/đăng nhập lại/thiết bị khác khôi phục bản đã lưu, 409 lấy revision mới rồi thử lại; ảnh chụp `plan/docs/screenshots/s9/` (dùng lại script S8, thêm 3 ảnh cho form). S10: `POST /custom-tours/:id/bookings` (TRAVELER, chỉ request `ACCEPTED`, body `{ clientRequestId? }`) đọc `offerSnapshot` + `checkoutDraft`, kiểm tra lại form bằng đúng schema của S9 rồi gọi `bookings.createBooking` với khối nội bộ `customTour` — giá/`agePricing`/`guestCounts` lấy từ snapshot (đổi giá tour sau đó không ảnh hưởng), không voucher/khuyến mãi, đúng departure đã chốt theo ngày; `Booking.customTourRequestId` + `BookingPassenger` ghi trong cùng lần insert, partial unique index `(customTourRequestId)` chỉ cho một booking `PENDING`/`CONFIRMED` nên tab thứ hai nhận lại booking thắng (200, không tạo mới, không giữ thêm ghế); booking cũ đã hủy/hết hạn không tính nên request vẫn đặt lại được với snapshot cũ. `GET /:id` trả `currentBooking` (kèm `isPaid`) và `nextStep` thành `PAY`/`DONE`; `BookingDto`/`AgencyBookingDto` chi tiết trả `passengers` (list không trả). FE: nút **Đặt chỗ và thanh toán** lưu form lần cuối rồi `router.replace('/settings/history/{id}')`, trang chi tiết cũ lo PayOS; request đã có booking thì form tự mở thẳng booking. Test: `custom-tours.booking.integration.test.ts` (7 case: giá snapshot thắng sau khi sửa tour, đủ hành khách, retry 200 cùng id, 2 tab một booking, hủy rồi đặt lại, chưa `ACCEPTED`/sai chủ, `POST /bookings` trực tiếp với tour private → 404); ảnh chụp `plan/docs/screenshots/s10/`. S11: `GET /custom-tours` trả `currentBooking` cho cả trang danh sách (một query batch) nên danh sách, thẻ ghim và form dùng chung `nextStep`; booking quá 15 phút do sweep cũ hủy (trả ghế, `PAYMENT_EXPIRED`), không hồi sinh — request mất `currentBooking`, lần sau tạo booking mới từ đúng snapshot; trang chi tiết booking hết hạn giải thích và có link **Đặt lại theo thỏa thuận** khi booking mang `customTourRequestId`; server trả `409 DEPARTURE_PASSED`/`TOUR_UNAVAILABLE` cho offer hết hạn hoặc tour riêng bị tạm dừng, form chặn trước theo ngày và hiện lý do + link chat; banner wishlist nhận request `ACCEPTED` chưa có booking; test booking lên 9 case (thêm hết hạn rồi đặt lại, lịch đã qua/tour tạm dừng). S12: `docs:routes` được chạy lại (file cũ vẫn ghi 241 endpoint và thiếu cả mục `/custom-tours`; giờ là 250); hai mã S11 `DEPARTURE_PASSED`/`TOUR_UNAVAILABLE` được khai báo đúng chỗ trong error-contract (test tích hợp booking đã kích hoạt chúng) và test server dùng chung được nâng `max_connections=500` vì chạy song song ~50 file với pool 20 kết nối/file từng làm suite đỏ ngẫu nhiên (`Too many database connections`); sau đó full suite backend 1080/1080.
> Lập ngày 12/11/2026 trên mã nguồn cùng ngày. Trước khi sửa, đọc lại file thật; đừng tin đường dẫn đã cũ.

## 0. Chốt trước khi bắt đầu

Không trả lời nghĩa là dùng đúng cột **Mặc định**. Chỉ cần trả lời những dòng muốn đổi.

| # | Điểm | Mặc định chốt |
| --- | --- | --- |
| 1 | Tour Guide | Không xóa role/flow guide trong đợt này; luồng đoàn không dùng guide, không tạo `TourGuideAssignment` |
| 2 | Ai thấy tour riêng | Chỉ khách tổ chức và agency nhận; không xuất hiện công khai |
| 3 | Agency nhận yêu cầu | Chỉ agency `VERIFIED` và đang `ACTIVE` |
| 4 | Giá đoàn | Không cộng voucher/promotion/ưu đãi tự động |
| 5 | Cơ cấu tuổi | Ít nhất 1 người lớn; tổng thành viên 2–50 |
| 6 | Giấy tờ | Mọi thành viên có họ tên, CCCD 12 số và SĐT (đã xác nhận, gồm trẻ em/em bé) |

## 1. Bản đồ file sẽ chạm

| Vùng | File chính |
| --- | --- |
| Schema | `prisma/schema.prisma`, migration mới trong `prisma/migrations/` |
| Hằng số | `packages/constants/src/permissions.ts`, `tours.ts`, `custom-tours.ts` (mới), `index.ts` |
| Backend | `backend/src/modules/custom-tours/*` (mới), `tours/tours.{service,repository,types,view}.ts`, `tours-discovery.service.ts`, `bookings/bookings.{service,repository,types,validation,mapper}.ts`, `routes/index.ts` |
| Test backend | `backend/src/modules/custom-tours/__tests__/*`, `tours/__tests__/*`, `bookings/__tests__/*`, `scripts/__tests__/build-smoke.integration.test.ts`, `routes/__tests__/routes.audit.test.ts`, `scripts/__tests__/prisma-enums-in-sync.test.ts` |
| Frontend | `frontend/features/custom-tours/*` (mới), `chat/ChatProvider.tsx`, `chat/ConversationPage.tsx`, `chat/ConversationWelcome.tsx`, `app/conversations/layout.tsx`, `features/tours/components/detail/TourBookingCard.tsx`, `features/booking/components/BookingEntryPage.tsx`, `features/agency/components/AgencyRightSidebar.tsx` |
| Trang | `frontend/app/traveler/custom-tours/page.tsx`, `frontend/app/agency/custom-tours/page.tsx` (mới) |
| Docs | `docs/backend/DECISIONS.md`, `docs/backend/HANDOVER.md`, `docs/backend/USE_CASE_MAP.md`, `docs/api/ENDPOINTS.md`, `backend/src/modules/custom-tours/README.md`, `backend/src/modules/chat/README.md` |

## 2. Thứ tự lát cắt

### S0 — Mở khóa quyết định và quyền

**Mục tiêu:** hợp pháp hóa việc `custom-tours` có code; thêm quyền nhưng chưa thêm route.

**Việc:**
1. `docs/backend/DECISIONS.md`: thêm **D-85** ghi owner đã duyệt booking đoàn, phạm vi S0–S12, không xóa Tour Guide; sửa ghi chú D-56 thành “custom-tours đã được duyệt, xem D-85”.
2. `backend/src/scripts/__tests__/build-smoke.integration.test.ts`: bỏ `describe('placeholder modules (custom tours)')` và hai assertion `/api/v1/custom-tours` 404. Giữ nguyên phần carts nếu còn; không nới guard nào khác.
3. **Không** thêm quyền ở đây: `routes.audit.test.ts` (“every defined permission protects at least one route”) sẽ đỏ khi quyền tồn tại mà chưa có route. Ba quyền `custom-tour:*` chuyển sang S2, thêm cùng lúc với route đầu tiên.
4. Chưa tạo module/route. Chưa đụng schema.

**Test:** `pnpm --filter backend exec vitest run src/scripts/__tests__/build-smoke.integration.test.ts` và `pnpm --filter backend test:unit`.

**Xong khi:** build-smoke không còn đòi `custom-tours` rỗng; chưa có route mới; `test:unit` xanh.

---

### S1 — Schema, enum và migration

**Mục tiêu:** dữ liệu đủ cho request, offer, tour riêng, hành khách; tour cũ mặc định `PUBLIC`.

**Việc:**
1. Thêm vào `prisma/schema.prisma` (đoạn dưới chỉ là phần thêm; `model Tour`/`model Booking` đã tồn tại, không tạo model trùng):

```prisma
enum TourVisibility {
  PUBLIC
  PRIVATE
}

enum CustomTourStatus {
  SUBMITTED
  NEGOTIATING
  OFFERED
  ACCEPTED
  DECLINED
  CANCELLED
}

enum PassengerType {
  ADULT
  CHILD
  INFANT
}

model Tour {
  // ...giữ nguyên các field hiện có
  visibility TourVisibility @default(PUBLIC)
}

model CustomTourRequest {
  id               String           @id @default(uuid()) @db.Uuid
  travelerId       String           @db.Uuid
  agencyId         String           @db.Uuid
  sourceTourId     String           @db.Uuid
  conversationId   String?          @db.Uuid
  privateTourId    String?          @db.Uuid @unique
  status           CustomTourStatus @default(SUBMITTED)
  revision         Int              @default(1)
  participants     Int
  guestCounts      Json?
  notes            String?
  offerSnapshot    Json?
  checkoutDraft    Json?
  checkoutRevision Int              @default(1)
  clientRequestId  String?
  acceptedAt       DateTime?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@unique([travelerId, clientRequestId])
  @@index([travelerId, createdAt(sort: Desc), id(sort: Desc)])
  @@index([agencyId, status, createdAt(sort: Desc), id(sort: Desc)])
  @@index([conversationId])
}

model BookingPassenger {
  id        String        @id @default(uuid()) @db.Uuid
  bookingId String        @db.Uuid
  guestType PassengerType
  fullName  String
  phone     String
  idCard    String
  createdAt DateTime      @default(now())

  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@unique([bookingId, idCard])
  @@index([bookingId])
}

model Booking {
  // ...giữ nguyên các field hiện có
  customTourRequestId String? @db.Uuid
  passengers          BookingPassenger[]

  @@index([customTourRequestId, createdAt])
}
```

2. Trong `Booking`, giữ nguyên các index cũ; chỉ thêm dòng mới.
3. `packages/constants/src/tours.ts`: thêm `TOUR_VISIBILITY = { PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' }`.
4. Tạo `packages/constants/src/custom-tours.ts`:
   - `CUSTOM_TOUR_STATUS` đúng 6 giá trị.
   - `PASSENGER_TYPE = { ADULT, CHILD, INFANT }`.
   - `CUSTOM_TOUR_POLICY = { MIN_PARTICIPANTS: 2, MAX_PARTICIPANTS: 50, MAX_NOTES: 500 }`.
   - Export trong `packages/constants/src/index.ts`.
   - Thứ tự key phải trùng thứ tự giá trị trong enum Prisma: test enum sync so sánh mảng theo thứ tự.
5. Thêm 4 giá trị vào `NOTIFICATION_TYPE` (`custom-tours` dùng ở S2) và Prisma `NotificationType`:
   `CUSTOM_TOUR_REQUESTED`, `CUSTOM_TOUR_DECIDED`, `CUSTOM_TOUR_OFFERED`, `CUSTOM_TOUR_ACCEPTED` (append cuối ở cả hai nơi).
6. `backend/src/scripts/__tests__/prisma-enums-in-sync.test.ts`: thêm 3 enum vào map `code`:
   `TourVisibility`, `CustomTourStatus`, `PassengerType`.
7. Chạy migration:
   `pnpm --filter backend exec prisma migrate dev --name custom_tour_requests`.
8. Nếu migration tạo index thường cho `customTourRequestId`, sửa file SQL: thêm partial unique index (Postgres) để một request chỉ có một booking đang hoạt động:
   ```sql
   CREATE UNIQUE INDEX "Booking_customTourRequestId_active_key"
   ON "Booking"("customTourRequestId")
   WHERE "customTourRequestId" IS NOT NULL AND "status" IN ('PENDING', 'CONFIRMED');
   ```
   Giữ index thường `(customTourRequestId, createdAt)` cho tra cứu lịch sử.
9. Cập nhật mapper/type nếu Prisma generated thêm field `visibility` vào `TourRecord` (thường tự có); thêm `visibility` vào `TourManageDto` và `tours.view.ts` để agency UI biết tour riêng.

**Test:** enum sync; `pnpm --filter backend test:unit`; một integration test cũ bất kỳ (bookings/tours) để chắc migration không phá.

**Xong khi:** migrate chạy sạch trên DB test; tour cũ `PUBLIC`; enum sync xanh; chưa có hành vi mới.

---

### S2 — Request: gửi, danh sách, chi tiết

**Mục tiêu:** khách gửi yêu cầu từ tour công khai; agency thấy trong danh sách; chat được tạo nếu có thể.

**Việc:**
> Quyền (chuyển từ S0, vì audit “no dead permission” chỉ xanh khi đã có route): `packages/constants/src/permissions.ts` thêm `CUSTOM_TOUR_REQUEST: 'custom-tour:request'` (TRAVELER), `CUSTOM_TOUR_VIEW: 'custom-tour:view'` (TRAVELER + AGENCY), gán trong `ROLE_PERMISSIONS`. `CUSTOM_TOUR_RESPOND` để sang S3 cùng route quyết định — cùng lý do.
1. Tạo module `backend/src/modules/custom-tours/` theo đúng cấu trúc module hiện có: `types.ts`, `validation.ts`, `repository.ts`, `mapper.ts`, `service.ts`, `controller.ts`, `routes.ts`, `index.ts`, `README.md`.
2. `types.ts`:
   - `CustomTourOffer`: `{ revision, unitPrice, agePricing, guestCounts, subtotal, departureDate, sentAt }`.
   - `CustomTourCheckoutDraft`: `{ contact: { fullName, phone }, passengers: Array<{ fullName, phone, idCard, guestType }>, notes? }`.
   - `CustomTourNextStep`: `WAITING_AGENCY | NEGOTIATING | REVIEW_OFFER | ENTER_PASSENGERS | PAY | DONE | CLOSED`.
   - DTO request gồm `id, status, revision, participants, guestCounts, notes, sourceTour { id,title,images }, privateTour, offer, checkoutDraft, conversationId, currentBooking, nextStep, createdAt, updatedAt`.
3. `validation.ts`:
   - `createCustomTourBody = { sourceTourId, participants: int 2..50, notes?: string max 500, clientRequestId?: /^[A-Za-z0-9_-]{8,64}$/ }` strict.
   - `listCustomToursQuery = pagination + { status?, conversationId? }`.
   - `idParams` dùng `idParamsSchema` sẵn có.
4. `service.create(travelerId, input)`:
   - Lấy source tour; bắt buộc `status = APPROVED` và `visibility = PUBLIC`, agency `ACTIVE` + `VERIFIED` (dùng `usersService.assertAgencyVerified` / `assertActiveWithRole`).
   - Nếu `clientRequestId` đã tồn tại: nếu `sourceTourId/participants/notes` giống hệt thì trả request cũ; khác thì `409 IDEMPOTENCY_KEY_REUSED`.
   - Tạo request `SUBMITTED`.
   - Gọi `chatService.startConversation({ userId: travelerId, role: 'TRAVELER' }, { participantId: agencyId, tourId: sourceTourId })`; thành công thì lưu `conversationId`; lỗi thì bỏ qua, request vẫn tồn tại (không chặn yêu cầu).
   - Gửi notification `CUSTOM_TOUR_REQUESTED` cho agency, `data: { requestId, conversationId? }`; không chứa ghi chú/CCCD.
   - Trả DTO (kèm `nextStep = WAITING_AGENCY`).
5. `service.list(actor, query)`: TRAVELER lọc `travelerId`; AGENCY lọc `agencyId`. Phân trang, sắp xếp mới nhất.
6. `service.get(actor, id)`: traveler chủ request hoặc agency sở hữu; người khác `404` (không dùng 403 để không lộ tồn tại).
7. `routes.ts`:
   - `POST /` — `CUSTOM_TOUR_REQUEST`
   - `GET /` — `CUSTOM_TOUR_VIEW`
   - `GET /:id` — `CUSTOM_TOUR_VIEW`
   Tất cả login + permission; không public.
8. Mount một dòng trong `backend/src/routes/index.ts`: `mount('/custom-tours', customToursRouter);`.
9. Dùng 4 giá trị notification đã thêm ở S1; nội dung chỉ có `requestId`/`conversationId`, không có ghi chú hay giấy tờ.
10. Chạy `pnpm --filter backend docs:routes`; thêm endpoint vào `docs/backend/USE_CASE_MAP.md`.

**Test:** `backend/src/modules/custom-tours/__tests__/custom-tours.integration.test.ts`:
- 2 và 50 hợp lệ; 1 và 51 bị 400.
- Source tour `DRAFT`/`PRIVATE`/của agency khác bị 404/400.
- Cùng `clientRequestId` + cùng payload trả cùng id; khác payload 409.
- Người thứ ba `GET /:id` 404; list chỉ thấy request của mình.
- Notification được tạo cho agency; conversation được tạo khi chat thành công.
- Agency chưa verify bị chặn.

**Verify:** `pnpm --filter backend exec vitest run src/modules/custom-tours src/routes/__tests__/routes.audit.test.ts src/scripts/__tests__/docs-in-sync.test.ts`.

**Xong khi:** gửi yêu cầu và xem danh sách chạy thật; docs/route audit xanh; chưa clone tour.

---

### S3 — Nhận/từ chối, clone tour riêng, khóa tour riêng

**Mục tiêu:** agency nhận thì có đúng một tour riêng `PRIVATE/DRAFT`; từ chối/rút không tạo tour.

**Việc:**
1. `PATCH /custom-tours/:id/decision` body `{ decision: 'ACCEPT' | 'DECLINE' | 'CANCEL' }`.
   - `ACCEPT`/`DECLINE`: agency sở hữu, request `SUBMITTED`.
   - `CANCEL`: traveler chủ request, request `SUBMITTED`.
   - Route dùng `CUSTOM_TOUR_VIEW`; service kiểm tra role/ownership.
1b. `custom-tours.types.ts`: khai báo `CUSTOM_TOUR_TRANSITIONS` và dùng `assertTransition` trước mọi CAS:
   `SUBMITTED → NEGOTIATING | DECLINED | CANCELLED`, `NEGOTIATING → OFFERED`, `OFFERED → NEGOTIATING | ACCEPTED`.
2. `repository.acceptInTransaction(requestId)`:
   - CAS `SUBMITTED → NEGOTIATING`.
   - Clone source tour trong cùng transaction:
     - Copy `title` (thêm hậu tố “(riêng)” nếu muốn), `summary`, `description`, `destination`, `durationDays`, `images`, `inclusions`, `exclusions`, `itinerary`, `meetingPoint`, `travelNotes`, `requiredDocuments`, `cancellationPolicy`, `childPricingPolicy`, `agePricing`, categories.
     - `status = DRAFT`, `visibility = PRIVATE`, `basePrice =` giá của departure nguồn sắp tới (hoặc `basePrice` tour nguồn nếu không có departure), `maxGroupSize = participants`.
     - Không copy `ratingAvg/ratingCount`, `submittedAt/reviewedAt`, `guideAssignment`, doanh số, tồn chỗ.
     - Nếu tour nguồn có departure tương lai đang mở: tạo 1 departure `date` đó, `capacity = participants`, `remaining = participants`, `priceOverride = null`.
   - Cập nhật request: `privateTourId`, `status = NEGOTIATING`.
   - Nếu `conversationId` null: gọi chat sau commit (không rollback accept nếu chat lỗi), lưu lại.
3. `DECLINE`: CAS `SUBMITTED → DECLINED`; không clone; notify traveler.
4. `CANCEL`: CAS `SUBMITTED → CANCELLED`; không clone; notify agency.
5. Chống nhận hai lần: `privateTourId @unique` + CAS; request thua trả `409 INVALID_STATE_TRANSITION` hoặc `CONCURRENT_UPDATE`.
6. Khóa tour riêng khỏi API quản lý thường:
   - Trong `tours.service.ts`, thêm helper `assertNotPrivateManaged(tour)` ném `409 TOUR_PRIVATE_MANAGED_BY_CUSTOM_TOUR`.
   - Gọi helper ở `updateTour`, `deleteTour`, `restoreTour`, `setAvailability`, `setItinerary`, `assignGuide`, `submitForReview`.
   - Không khóa `getDetail` của owner (vẫn xem được), chỉ khóa ghi.
7. `tours.view.ts`/DTO: trả `visibility` để UI agency hiển thị badge; không trả cho public.

**Test:**
- Hai request `ACCEPT` song song: đúng một clone, request còn lại 409.
- `DECLINE`/`CANCEL` không tạo tour.
- Clone đúng nội dung, không có guide assignment, `visibility=PRIVATE`, `status=DRAFT`, capacity = participants.
- Source tour không đổi.
- `PATCH /agency/tours/:id`, availability, itinerary, guide, submit trên tour private đều 409.
- Người ngoài không accept/decline/cancel được.

**Verify:** test module + `tours` unit/integration.

**Xong khi:** nhận/từ chối đúng; tour riêng không thể sửa qua API thường.

---

### S4 — Ẩn tour riêng khỏi public và chặn booking trực tiếp

**Mục tiêu:** `PRIVATE` không lọt search/detail/cards/destinations/cart/booking, kể cả khi đã `APPROVED`.

**Việc:**
1. `tours.repository.searchPublic`: thêm `visibility: PUBLIC` vào `where`.
2. `tours.repository.getPublicDestinations`: chỉ đếm tour `APPROVED` + `PUBLIC`.
3. `tours-discovery.service`:
   - `getPublicCards`: lọc thêm `visibility === PUBLIC`.
   - `getDetail`: nhánh public chỉ trả khi `APPROVED && PUBLIC`.
   - `invalidateCache(id)` gọi khi clone được accept và khi offer được accept (status đổi).
4. `tours.service.getBookableDeparture(tourId, departureId, options?: { allowPrivate?: boolean })`:
   - Mặc định `tour.visibility !== PUBLIC` → `404 Tour not found`.
   - Chỉ `bookings.service` được truyền `allowPrivate: true`, và chỉ khi input nội bộ có `customTourRequestId`.
5. `tours.service.getDepartureFacts`: tour `PRIVATE` trả `bookable: false` (cart không dùng được).
6. `tours.service.getTourFacts` trả thêm `visibility`; `wishlists.service.add` từ chối `visibility !== PUBLIC` bằng 404 (nếu không, biết id vẫn lưu được tour riêng).
7. `carts.service` không cần sửa nếu `getBookableDeparture` mặc định chặn; thêm test direct add.
8. `POST /bookings` với `tourId` private → 404; `POST /cart` với private → 404/400.

**Test:** `tours/__tests__/tours.visibility.integration.test.ts`:
- Search/list/destinations/cards/detail đều không trả private dù `APPROVED`.
- Biết id vẫn 404 với traveler khác; wishlist add bị 404.
- Booking trực tiếp và cart trực tiếp bị chặn.
- Cache: search một lần (cache nóng), accept offer (private approved), search lại vẫn không có; gọi `invalidateCache` khi đổi visibility.

**Verify:** `pnpm --filter backend exec vitest run src/modules/tours src/modules/carts src/modules/bookings`.

**Xong khi:** không còn đường public nào trả tour private.

---

### S5 — Thương lượng: lưu nháp, gửi offer, chấp nhận

**Mục tiêu:** agency sửa tour riêng, khách xem bản đã lưu, chấp nhận đúng revision; không sai giá.

**Việc:**
1. `PATCH /custom-tours/:id/draft` (AGENCY, `CUSTOM_TOUR_RESPOND`):
   - Body: `{ revision, content?: Partial<TourContentInput>, guestCounts?, departure?: { date, capacity? } }` strict.
   - Chỉ request `NEGOTIATING` hoặc `OFFERED`. Nếu `OFFERED`: chuyển `NEGOTIATING` trong cùng transaction, revision++ (offer cũ mất hiệu lực).
   - `content` chỉ các field nội dung; không nhận `visibility`, `status`, `agencyId`.
   - `guestCounts` phải cùng tổng `participants`; ít nhất 1 adult.
   - `departure.date` phải ở tương lai; capacity luôn = `participants`; chỉ 1 departure cho tour riêng.
   - Ghi tour + departure + request trong một transaction; CAS `revision`.
2. `POST /custom-tours/:id/offers` (AGENCY):
   - Chỉ `NEGOTIATING`.
   - Validate tour đủ `title`, `destination`, `durationDays`, `basePrice > 0`, có departure tương lai, guestCounts khớp, ít nhất 1 adult; nếu có trẻ/em bé thì `agePricing` phải tính được.
   - Tính `subtotal` bằng `calculateGuestPrice(basePrice, participants, guestCounts, agePricing)`; **không nhận tiền từ client**.
   - Lưu `offerSnapshot = { revision, unitPrice: basePrice, agePricing, guestCounts, subtotal, departureDate, sentAt }`.
   - CAS `NEGOTIATING → OFFERED`; notify traveler `CUSTOM_TOUR_OFFERED`.
3. `POST /custom-tours/:id/acceptance` (TRAVELER, `CUSTOM_TOUR_REQUEST`):
   - Body `{ revision }`.
   - Chỉ `OFFERED`, revision khớp `offerSnapshot.revision`.
   - Transaction: CAS `OFFERED → ACCEPTED`, `acceptedAt`, tour `DRAFT → APPROVED` (giữ `PRIVATE`) bằng update có điều kiện; `invalidateCache(privateTourId)`.
   - Notify agency `CUSTOM_TOUR_ACCEPTED`.
4. `GET /:id` trả `offer` + `nextStep`; traveler chỉ thấy bản đã lưu.
5. Sau mỗi mutation (draft/offer/acceptance/decision): gọi helper `emitChatUpdated([travelerId, agencyId], conversationId)` (thêm vào `chat.gateway.ts`, dùng `chatIo` sẵn có) để client refetch; REST vẫn là nguồn trạng thái.
6. Sau `ACCEPTED`: không sửa nội dung/giá/lịch; draft/offer/acceptance trả 409. Chỉ `PATCH checkout-draft` (S9) và tạo booking được phép.

**Test:**
- Hai tab agency cùng lưu: một thắng, một 409 revision.
- Khách accept revision cũ: 409; accept đúng: ACCEPTED.
- Sửa sau OFFERED quay về NEGOTIATING; offer cũ không accept được.
- Client gửi `subtotal`/`unitPrice` sai: server bỏ qua, dùng giá tính lại.
- Thiếu người lớn, ngày quá khứ, guestCounts lệch: 400.
- Sau ACCEPTED, draft/offer/acceptance trả 409; tour private vẫn bị khóa ở API quản lý thường.

**Verify:** test module + `calculateGuestPrice` unit.

**Xong khi:** hai tab không thể chấp nhận sai bản; giá luôn do server tính.

---

### S6 — Bật chat agency trên frontend

**Mục tiêu:** AGENCY dùng được inbox/thread hiện có; không đụng backend chat.

**Việc:**
1. `frontend/features/chat/ChatProvider.tsx`: eligible roles thêm `AGENCY`.
2. `frontend/app/conversations/layout.tsx`: `allowedRoles={['TRAVELER','TOUR_GUIDE','AGENCY']}`.
3. `ConversationWelcome`: thay prop `guide: boolean` bằng `audience: 'traveler' | 'agency' | 'guide'`; copy cho agency (“Khi khách gửi yêu cầu booking đoàn…”). Cập nhật 2 chỗ gọi trong `ConversationPage`.
4. `AgencyRightSidebar`: thêm mục **Tin nhắn** → `/conversations` và **Yêu cầu đoàn** → `/agency/custom-tours`.
5. `Header`: hiện nút chat cho AGENCY nếu đang bị ẩn; kiểm tra nhánh `effectiveRole === 'AGENCY'`.
6. Docs: `chat/README.md`, D-13/D-46, `HANDOVER.md` bỏ câu “chỉ traveler ↔ guide”, ghi agency đã dùng.

**Test:** cập nhật test chat hiện có (nếu assert role list); thêm test provider/layout cho AGENCY; test welcome copy.

**Verify:** `pnpm --filter frontend exec vitest run features/chat app/conversations`.

**Xong khi:** agency mở `/conversations` thấy inbox, gửi/nhận được; traveler ↔ agency chat chạy.

---

### S7 — Nút yêu cầu đoàn và danh sách hai phía

**Mục tiêu:** khách gửi yêu cầu từ tour; hai bên thấy danh sách và tiếp tục đúng bước.

**Việc:**
1. Tạo `frontend/features/custom-tours/`: `api.ts` (RTK Query inject `baseApi`, tag `CustomTour`), `types.ts`, `components/`, `index.ts`.
2. Thêm `'CustomTour'` vào `tagTypes` của `frontend/store/api/baseApi.ts`.
3. `TourBookingCard`: thêm nút phụ **Yêu cầu booking đoàn** **ngoài** khối `departure &&`, để tour hết lịch lẻ vẫn gửi được. Khách chưa đăng nhập → `/login?next=/tours/{id}` (không đưa notes vào URL).
4. `GroupBookingRequestDialog`:
   - Số người mặc định `max(2, guestTotal hiện tại)`, 2–50; ghi chú ≤500.
   - Gửi `POST /custom-tours`; thành công điều hướng `/conversations/{conversationId}?request={id}`; nếu `conversationId` null thì `/traveler/custom-tours`.
   - Lỗi giữ nguyên input.
5. Trang `/traveler/custom-tours`: card trạng thái, tour nguồn, số người, nút tiếp tục:
   - `WAITING_AGENCY`/`NEGOTIATING`/`REVIEW_OFFER` → conversation (kèm `?request=`).
   - `ENTER_PASSENGERS` → `/traveler/bookings/new?customTourRequestId=...`.
   - `PAY`/`DONE` → `/settings/history/{bookingId}`.
6. Trang `/agency/custom-tours`: danh sách, lọc trạng thái, nút Nhận/Từ chối (S3), Vào chat.
7. Notification click điều hướng đúng request/conversation.

**Test:** dialog validation + redirect; list render trạng thái; guest redirect; agency accept từ list.

**Verify:** `pnpm --filter frontend exec vitest run features/custom-tours features/tours`.

**Xong khi:** gửi yêu cầu từ tour và thấy ở cả hai danh sách.

---

### S8 — Thẻ ghim và panel trong chat

**Mục tiêu:** trong conversation, thẻ ghim mở panel trái; agency sửa, khách xem/chấp nhận; đóng panel không mất tiến trình.

**Việc:**
1. `ConversationPage`: khi có `id`, gọi `GET /custom-tours?conversationId=...`; hiển thị `CustomTourPinCard` dưới header nếu có request.
2. Nhiều request cùng conversation: select box chọn request; không ghi đè request khác.
3. `CustomTourPanel`:
   - Dialog giữa màn hình, rộng tối đa 896px, cao tối đa 90dvh, nền phía sau tối + mờ nhẹ; Esc/nút đóng trả focus về thẻ ghim.
   - Mobile: cùng dialog, chừa lề 16px mỗi bên.
4. Agency panel:
   - Dùng lại `TourContentFields`, `TourPolicyFields`, `TourAgePricingFields`, `validateTourEditor`; không copy `AgencyTourEditorPage`.
   - Trường ngày khởi hành + cơ cấu + giá; lưu qua `PATCH /draft` với revision.
   - Thanh hành động dính đáy: trạng thái **Đang lưu / Đã lưu / Lưu lỗi** bên trái, nút **Lưu nháp** + **Gửi thỏa thuận** dồn góc phải; 409 thì báo “bản đã đổi” và tải lại, giữ dữ liệu người dùng.
   - Nút **Gửi thỏa thuận** gọi `/offers`; disable khi thiếu điều kiện.
5. Traveler panel:
   - Đọc nội dung tour đã chốt trong `offerSnapshot` (tên, điểm đến, số ngày, tóm tắt, mô tả, bao gồm/không bao gồm, chính sách) + bảng giá từng nhóm/tổng; đây là bản chụp lúc gửi nên sửa nháp chưa gửi không hiện ở phía khách. Lịch trình chi tiết chưa chụp (đi qua tin nhắn) cho tới khi có endpoint cho khách đọc tour `PRIVATE`.
   - Nút **Chấp nhận**, và nút trong hộp xác nhận ngày/cơ cấu/giá/tổng, dồn góc phải; gọi `/acceptance` với `revision`.
   - Sau ACCEPTED: panel chỉ đọc + nút sang nhập hành khách.
6. Không render/hiển thị Tour Guide trong panel; không gọi API guide.
7. Sau mỗi mutation: invalidate tag `CustomTour`; nếu socket đang mở, phát tín hiệu `chat:updated` hiện có để thread/card refetch. REST/database là nguồn trạng thái, socket chỉ báo thay đổi.
8. Loading/empty/error/retry; keyboard/focus; reduced motion.

**Test:** `CustomTourPanel` render theo trạng thái; save 409; accept đúng revision; đóng/mở giữ request; keyboard Esc; offer chụp kèm nội dung tour (integration) và panel khách render đúng nội dung đó (unit). Browser: `backend/src/test/custom-tours.chat-panel.cjs` sửa mô tả/bao gồm/không bao gồm ở panel agency rồi kiểm tra khách thấy đúng bản đã gửi.

**Verify:** `pnpm --filter frontend exec vitest run features/custom-tours features/chat`.

**Xong khi:** hai phiên khách–agency thương lượng và chốt được ngay trong chat.

---

### S9 — Nhập hành khách, lưu nháp, tiếp tục sau khi rời trang

**Mục tiêu:** khách nhập đủ thành viên; reload/đổi máy khôi phục bản đã lưu; không mất dữ liệu.

**Việc:**
1. Backend `PATCH /custom-tours/:id/checkout-draft` (TRAVELER, `CUSTOM_TOUR_REQUEST`):
   - Body `{ revision, contact, passengers, notes? }` strict.
   - Chỉ `ACCEPTED`; `passengers.length === participants`; `guestType` đếm khớp `guestCounts`; ít nhất 1 adult.
   - `idCard` `/^\d{12}$/`, unique trong request; `phone` dùng validator chung; `fullName` 2–120; `notes` ≤500.
   - Lưu `checkoutDraft`, `checkoutRevision++`; CAS revision; không lưu PII vào notification/log.
2. `GET /:id` trả `checkoutDraft` + `checkoutRevision` + `nextStep`.
3. Frontend:
   - `BookingEntryPage` đọc `customTourRequestId`; nếu có, render nhánh `GroupBookingEntry` (component mới) thay vì luồng lẻ; không sửa sâu page 1.600 dòng.
   - `GroupBookingEntry` lấy request, khóa tour/ngày/cơ cấu/giá theo offer; ẩn voucher/promotion.
   - Sinh đúng số dòng hành khách theo `guestCounts` (adult → child → infant); mỗi dòng họ tên, SĐT, CCCD 12 số.
   - Autosave debounce ~800ms, tuần tự hóa request, revision; hiển thị **Đang lưu/Đã lưu/Lưu lỗi** + thử lại.
   - `beforeunload` khi còn thay đổi chưa lưu; không hứa khôi phục phần chưa từng lưu.
   - Reload/đăng nhập lại/thiết bị khác: lấy draft server.
4. Tách `PassengerRosterFields` dùng chung với roster hiện có nếu không làm phình luồng lẻ; nếu tách quá lớn, giữ roster lẻ nguyên và tạo component riêng cho đoàn.

**Test:**
- Backend: thiếu dòng, sai CCCD, CCCD trùng, SĐT sai, sai guestType count, revision cũ, request chưa ACCEPTED.
- Frontend: sinh đúng số dòng; autosave; reload khôi phục; cảnh báo rời trang; 409 hiển thị.

**Verify:** backend module tests + `pnpm --filter frontend exec vitest run features/custom-tours features/booking`.

**Xong khi:** rời trang giữa chừng, quay lại vẫn còn đúng dữ liệu đã lưu.

---

### S10 — Tạo booking từ snapshot và thanh toán

**Mục tiêu:** một request → một booking hoạt động; giá/ngày/hành khách đúng snapshot; dùng PayOS hiện có.

**Việc:**
1. `POST /custom-tours/:id/bookings` (TRAVELER):
   - Body `{ clientRequestId? }`.
   - Chỉ `ACCEPTED`; đọc `offerSnapshot` + `checkoutDraft`; validate lại toàn bộ.
   - Nếu có booking `PENDING`/`CONFIRMED`/đã trả cho request: trả booking đó (200), không tạo mới.
   - Nếu không: gọi `bookingsService.createBooking(travelerId, { tourId, departureId, participants, contact, notes, customTour: { requestId, unitPrice, agePricing, guestCounts, passengers } })`.
2. `bookings.service`:
   - `CreateBookingInput` thêm field nội bộ `customTour?: { requestId, unitPrice, agePricing, guestCounts, passengers }`; **không** thêm vào `createBookingBody` công khai.
   - Khi có `customTour`: bỏ qua promotion/voucher; dùng `unitPrice/agePricing/guestCounts` từ snapshot; `getBookableDeparture(..., { allowPrivate: true })`; bắt buộc tour/departure khớp request và ngày khớp `offerSnapshot.departureDate`.
   - Ghi `Booking.customTourRequestId`; ghi `BookingPassenger` trong cùng transaction; `guestPricing` = snapshot.
   - Unique partial index xử lý đua; unique violation thì đọc booking thắng và trả lại.
3. `bookings.repository`: thêm `findActiveByCustomTourRequest(requestId)`; dùng cho endpoint và `GET /custom-tours/:id` (`currentBooking`).
4. `BookingDto` chi tiết (owner/agency) trả `passengers`; list không trả để tránh nặng. Trang chi tiết booking hiển thị danh sách hành khách cho chủ đơn và agency; không đưa CCCD vào danh sách công khai/export mặc định.
5. Frontend: sau tạo booking, `router.replace('/settings/history/{id}')`; trang chi tiết hiện có nút thanh toán PayOS, không thêm payment purpose.
6. Nếu booking hết hạn: request vẫn `ACCEPTED`; lần gọi sau tạo booking mới với `clientRequestId` mới; không đổi snapshot.

**Test:**
- Giá booking = snapshot dù tour bị đổi ngoài luồng (test trực tiếp DB) — server vẫn dùng snapshot.
- Đủ passengers rows; đúng số; CCCD unique.
- Double-click/2 tab: một booking; unique violation trả winner.
- Booking trực tiếp qua `POST /bookings` với tour private: 404.
- Booking hết hạn → lần mới tạo booking mới, không hồi sinh booking cũ.
- Payment checkout hai lần → cùng payment link (test hiện có).

**Verify:** `pnpm --filter backend exec vitest run src/modules/custom-tours src/modules/bookings src/modules/payments`.

**Xong khi:** tạo đơn và thanh toán được; không có đường tạo đơn thứ hai cho cùng request.

---

### S11 — Hết hạn, thanh toán chưa rõ, và ma trận quay lại

**Mục tiêu:** mọi điểm rời flow đều có đường về đúng bước; không thu trùng.

**Việc:**
1. `nextStep` server-side đã có; bổ sung `currentBooking` (id/status/isPaid) vào list/detail.
2. Liên kết tiếp tục từ: thẻ ghim, `/traveler/custom-tours`, `/agency/custom-tours`, notification, `/settings/history`, `IncompleteBookingBanner`.
3. Booking hết 15 phút:
   - UI giải thích, nút tạo lần mới từ snapshot.
   - Không hồi sinh booking cũ; không đổi giá.
4. Thanh toán chưa xác định: dùng `payments` reconcile hiện có; không mở lần thu thứ hai khi timeout; webhook muộn/trùng theo logic hiện có.
5. Quá ngày khởi hành / tour bị chặn: hiện lý do + về chat, không tạo booking lỗi.
6. Kiểm thử tay hai phiên (traveler + agency) và tài khoản thứ ba.

**Test:** integration cho expiry + retry; unit cho `nextStep`; manual checklist.

**Xong khi:** không còn màn hình “trang trắng” khi quay lại; không thu trùng.

---

### S12 — Hợp đồng, tài liệu, hồi quy

**Mục tiêu:** repo tự bảo vệ được tính năng; docs khớp code.

**Việc:**
1. `pnpm --filter backend docs:routes`; cập nhật `docs/backend/USE_CASE_MAP.md`.
2. Route audit: thêm route mới nếu cần vào `LOGIN_ONLY_ROUTES`/`BODYLESS_MUTATIONS` (mặc định không, vì đều có body và permission).
3. `backend/src/modules/custom-tours/README.md`: thay placeholder bằng mô tả thật (use case, state machine, API, quyền, test).
4. `docs/backend/DECISIONS.md`: D-85 đầy đủ; D-13/D-46 ghi agency chat; `HANDOVER.md` cập nhật.
5. `docs/api/ENDPOINTS.md`, `docs/backend/USE_CASE_MAP.md`, enum sync, docs-in-sync xanh.
6. `build-smoke` không còn guard placeholder; vẫn phải build production.
7. Chạy toàn bộ lệnh ở mục 4; kiểm tra browser 320/768/1024/1440, keyboard, focus, reduced motion.

**Xong khi:** toàn bộ test/typecheck/build xanh; không còn tài liệu nói custom-tours là placeholder.

## 3. Lệnh kiểm chứng

Chạy theo thứ tự; không chạy migration production.

```bash
pnpm --filter backend exec prisma generate
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter frontend test
pnpm --filter backend typecheck
pnpm --filter frontend exec tsc --noEmit
pnpm --filter backend build
pnpm --filter frontend build
```

Kiểm thử mục tiêu nhanh hơn:

```bash
pnpm --filter backend exec vitest run src/modules/custom-tours
pnpm --filter frontend exec vitest run features/custom-tours
```

## 4. Definition of Done chung

- [ ] Mỗi S là một commit/PR độc lập, revert được; main luôn xanh.
- [ ] Không thêm dependency mới.
- [ ] Không dùng `TOUR_GUIDE`, không tạo `TourGuideAssignment`, không gọi API guide trong luồng đoàn.
- [ ] Mọi ghi trạng thái là compare-and-set; request revision không bị ghi đè.
- [ ] Không có CCCD/SĐT trong URL, log, notification, socket payload, localStorage.
- [ ] Tour `PRIVATE` không lọt bất kỳ API public nào, kể cả khi `APPROVED`.
- [ ] Booking/payment/e-ticket dùng lại luồng hiện có, không có payment purpose mới.
- [ ] `docs:routes`, route audit, enum sync, docs-in-sync, build-smoke đều xanh.
- [ ] Slice có UI (S7 trở đi): chạy Playwright trên luồng thật và lưu ảnh chụp từng bước vào `plan/docs/screenshots/<slice>/`; slice backend thuần thì bỏ qua bước này.

## 5. Rủi ro phải theo dõi

1. **CCCD trẻ em/em bé** là yêu cầu đã chốt nhưng nhiều phụ huynh không có; nếu đổi ý phải sửa validator + UI + test trước khi làm S9.
2. **Khóa tour private** phải chặn đủ mọi đường ghi; sót một endpoint là thỏa thuận bị sửa sau chốt.
3. **Cache discovery** 30–60 giây: phải lọc ở query, không chỉ DTO; nếu không tour private có thể lọt sau khi `APPROVED`.
4. **Booking trực tiếp**: nếu `getBookableDeparture` không mặc định chặn private, bất kỳ ai biết id đều đặt được.
5. **Partial unique index** cho booking đang hoạt động phải viết trong migration SQL; Prisma schema không diễn đạt được.
6. **Tour Guide** vẫn còn trong code; đừng “dọn luôn” trong các PR này — phạm vi sẽ nổ.
