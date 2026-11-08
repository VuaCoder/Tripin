# KHIEM implementation — batch 1

> Cập nhật 07/11/2026: source implementation đã được bổ sung cho toàn bộ 18 task còn lại. Backend/web đã kiểm chứng; đã cài SDK riêng và chạy kiểm tra mobile. Xem kết quả và giới hạn cuối tài liệu; các đoạn batch 1 bên dưới được giữ làm lịch sử.

Ngày: 05/11/2026. Batch này triển khai backend cho KHIEM-04, 08, 09, 10, 02 theo thứ tự dependency trong plan. Các task còn lại chưa triển khai trong batch này. Không commit hoặc deploy; giữ nguyên các thay đổi có trước trong working tree.

## Thay đổi

| Task | Kết quả |
|---|---|
| 04 / PROFILE-005 | Validator HH:mm đúng 00–23/00–59; start < end; reject overlap slot enabled, cho phép adjacent; normalize giờ legacy một chữ số khi đọc preferences. Slot hiện là preference lặp mỗi ngày, chưa phải lịch theo ngày. |
| 08 / BOOK-003 | Issuance khóa booking row và kiểm tra paid + CONFIRMED trong transaction; cancellation chuyển trạng thái booking và hủy vé VALID cùng transaction. |
| 09 / BOOK-012, TOUR-008 | Traveler và guide không complete trước endDate; DB conditional completion cũng có endDate guard; review và upload ảnh không unlock cho legacy booking completed sớm. Guide chỉ complete một departure đã kết thúc, không chạm chuyến tương lai. Có body optional departureId, thiếu lựa chọn khi nhiều departure đã kết thúc trả DEPARTURE_REQUIRED. |
| 10 / PAY-004 | Booking có fulfillmentStatus PENDING/COMPLETED/FAILED, attempts và nextAttemptAt; worker riêng chạy mỗi phút, sweep paid confirmed/completed thiếu vé quá 3 phút; retry lỗi sau 3 phút. Unique bookingId + row lock bảo đảm nhiều worker không tạo hai vé. Repair vé lịch sử cho booking COMPLETED tạo USED; normal issuance vẫn chỉ nhận CONFIRMED. |
| 02 / GUIDE-002 | Kiểm tra overlap theo interval [start,end), khi assign/accept, sửa duration/departure và reserve seats. Nhiều booking cùng departure không xung đột; pending assignment có guide đã nhận tour khác cũng bị chặn khi reserve. Conflict rollback, không mất ghế. |

Mobile thêm thông báo tiếng Việt cho GUIDE_SCHEDULE_CONFLICT, TRIP_NOT_ENDED, DEPARTURE_REQUIRED. Batch chưa bổ sung bộ chọn departure trên UI; client cũ vẫn dùng được khi chỉ có một departure đủ điều kiện. UI chọn nhiều departure nằm trong batch assigned-tour filters tiếp theo.

## Database / rollout

Migration mới: `prisma/migrations/202611050001_khiem_ticket_fulfillment/migration.sql`. Thêm ba cột và index vào Booking; backfill COMPLETED cho booking đã có ETicket. Đã regenerate Prisma client local và chạy migration trên DB test; chưa áp dụng migration lên DB ứng dụng/production. Khi rollout phải áp dụng migration trước khi chạy backend mới. Không dùng `db push` để thay thế migration.

Worker ticket độc lập với Payment.fulfilledAt và in-process event bus, nên payment đã fulfilled nhưng thiếu vé vẫn được sửa. Trạng thái COMPLETED được ghi cùng transaction tạo vé; đọc lịch sử qua e-ticket API không cần notification thành công. Retry delivery notification/email sau khi ticket đã tạo vẫn cần outbox riêng, chưa thuộc implementation batch này.

Guide schedule dùng advisory transaction lock chung số 707002 trên các writer của tour/departure/assignment và seat reservation. Đây là coarse lock để bảo đảm đúng với schema assignment cấp tour hiện tại; có thể giới hạn throughput booking, cần đo trước rollout lưu lượng lớn. Refactor sang lock theo guide phải giữ cùng protocol cho tất cả writer. Ghi trực tiếp DB ngoài repository không được protocol này bảo vệ, nhưng reserve vẫn kiểm tra legacy conflict.

End date tiếp tục dùng Booking.endDate hiện có, được tính khi booking từ departure.date + durationDays × 24h. Batch không tự thay đổi định nghĩa ngày kết thúc hay backfill ngày lịch.

## Kiểm chứng

- Backend typecheck: pass.
- 9 unit suites: 146 tests pass (users preferences/service, bookings service, e-ticket service/check-in/guide completion, reviews service, tours service, earnings service).
- Integration PostgreSQL: 31 tests pass trên 5 suite (lần chạy chung 30 test, sau đó thêm và chạy lại suite guide gồm 5 test). Bao gồm lifecycle issuance/cancel, worker failure/recovery/parallel sweep, completion DB guard, bookings, maintenance, reviews, guide schedule collision. Các suite được chạy bằng database test riêng; không dùng DB ứng dụng.
- Dart analyze `lib/features/guide/utils/guide_error_messages.dart`: pass.
- Không chạy UI/device/camera/payment provider thật.

Các regression mới gồm: cancellation trước issuance; issuance trước cancellation; concurrent issue/cancel; complete tương lai; guide không complete departure tương lai cùng tour; ambiguity giữa nhiều departure; review legacy completed sớm; worker sau lỗi lưu vé; worker không chạy trước 3 phút/không phát vé sau hủy; hai worker không tạo trùng; hai assignment acceptance đồng thời; interval chạm biên; duration edit rollback; pending assignment conflict lúc reserve.

## Các task tiếp theo

01/03/11: payout account encryption + masked DTO/migration, avatar guide, payout ledger. 05/06/07/18/19: assigned-departure UI, roster privacy, ticket list, public profile preview, support. 12–17/20: review rating transaction, versioning, audit regression, restoration reason, outbox moderation, triage, drafts. 21–23: typing UX, AI mobile inbox/read state, persisted incomplete/continuation. Không đánh dấu các task này hoàn tất chỉ vì đã có một phần code nền.

## Cập nhật 07/11/2026 — implementation cho 18 task còn lại

Không deploy hoặc apply migration vào database ứng dụng. Không thay `.env` thực tế hoặc SDK constraint của project. Sau kiểm chứng, các thay đổi được chia thành 12 commit theo schema, dependency mobile và từng nhóm chức năng theo yêu cầu người dùng.

### Phạm vi từng task

| Task | Implementation hiện có | Kiểm chứng / phần còn chờ |
|---|---|---|
| 01 / GUIDE-001 | Model `GuidePayoutAccount` liên kết user; AES-256-GCM với nonce ngẫu nhiên và AAD ràng buộc guide/key version; mã hóa toàn bộ bank name, holder và number trong envelope; masked owner DTO; clear/update qua PATCH profile; form web/mobile không submit lại số đã mask; script backfill xóa plaintext và chạy lại an toàn | Unit + PostgreSQL + web form tests pass. Mobile earnings/form tests đã chạy; chưa kiểm thử cập nhật ngân hàng trên thiết bị thật. Chưa cấu hình key hoặc chạy backfill trên DB ứng dụng. Validation chỉ xác nhận định dạng, chưa xác minh tài khoản với ngân hàng. |
| 03 / GUIDE-003 | Cho Guide sử dụng signed avatar upload/verify/remove; chặn direct avatar URL PATCH; UI profile chọn ảnh gallery/xóa ảnh và đồng bộ response | Backend unit pass; đã thêm widget tests và preview cô lập. Widget tests pass; cần kiểm tra gallery/upload thật trên thiết bị. |
| 05 / PROFILE-012 | Guide DTO trả từng departure với start/end; app tải đủ các trang tour, mở rộng accepted tours theo departure, filter upcoming/ongoing/completed, badge và quick roster/QR; refetch sau trả lời assignment | Backend types/unit pass, đã thêm test lifecycle theo departure. Mobile assigned-tour UI/cubit/lifecycle tests pass. Client hiện tải toàn bộ trang assigned tours để filter đầy đủ, chưa có endpoint server-paginated riêng cho từng tab. |
| 06 / BOOK-008 | `/e-tickets/scan` cho guide, giữ URL guide check-in cũ; truyền departureId xuyên app/roster/scan/complete; phone masked, bỏ free-form notes, attendance status CHECKED_IN; không mở dialer với số masked; bỏ fallback tour/roster giả khi API rỗng/lỗi | Unit scope/privacy + PostgreSQL scan/duplicate/permission pass. Scanner/haptic/sound đã có và được tái sử dụng; roster privacy tests pass, hardware còn chờ thiết bị thật. |
| 07 / BOOK-013 | Trang `/traveler/tickets`, navigation web/mobile, status filters và pagination, pickup location trong list, QR từ ticket code, cache theo user/page/filter để mở khi lỗi mạng; lỗi quyền không dùng cache | Web tests và PostgreSQL list/scan pass. Mobile list cần test runtime. QR dùng code ổn định để hỗ trợ offline, server kiểm tra trạng thái khi scan; không triển khai token QR xoay vòng. |
| 11 / PAY-018 | `GuidePayoutLedger` một-một với earning; tạo cùng transaction và backfill earning cũ; monitor API/status/date/reference trên web/mobile; Agency sở hữu ghi nhận transfer bằng CAS + audit, replay cùng reference idempotent | PostgreSQL quyền/ownership/idempotency/audit và web tests pass. Đây là ghi nhận một giao dịch đã thực hiện, không gọi ngân hàng chuyển tiền thật. Rule earning vẫn dùng guide/fee accepted hiện tại tại lúc completion như flow cũ; snapshot guide lúc thực sự dẫn chuyến chưa được mở rộng trong batch này. |
| 12 / REVIEW-001 | Khóa tour trước tạo review/visibility mutation; aggregate VISIBLE reviews và update tour trong cùng transaction; xóa vòng refresh rating ngoài transaction ở service | PostgreSQL concurrent writers + lỗi rating gây rollback pass. |
| 13 / REVIEW-002 | `contentVersion` là SHA-256 của comment/rating/images; moderation DTO và report context trả token; API bắt buộc token; service so sánh và DB CAS bind cả nội dung để bắt thay đổi sau service read | Unit, PostgreSQL stale token/mid-read CAS, UI/API transport tests pass. Không có author-edit API mới; hash bảo vệ đường mutation hiện có và các writer tương lai. |
| 14 / REVIEW-003 | Giữ audit trong transaction visibility; thêm fault-injection trigger trên AuditLog để chứng minh rollback rating/visibility/notification | PostgreSQL rollback + audit coverage pass. |
| 15 / REVIEW-008 | Body restore bắt buộc restorationReason; service trim/min/max guard; UI review queue và report screen đều yêu cầu explanation; reason lưu audit | Unit/schema, HTTP 400 thiếu reason và frontend flows pass. |
| 16 / REVIEW-009 | Notification writer ghi in-app cho reviewer và agency cùng mutation; email enqueue vào MailOutbox trong transaction, worker hiện có retry delivery | PostgreSQL 2 recipients/2 email rows, reason payload, rollback và no-op không nhân đôi pass. Email thực tế cần mail provider hoạt động; delivery sử dụng worker outbox hiện có. |
| 17 / REVIEW-007 | Queue riêng `ReviewModerationQueue.tsx`, grouped review/report count/reasons; Keep/Remove kiểm tra content token và snapshot reportIds; report mới không bị đóng nhầm; report resolution, review, rating, audit, notification cùng transaction | 3 PostgreSQL tests và 2 frontend flow tests pass; quyền yêu cầu cả review:moderate và dispute:resolve. |
| 18 / REVIEW-004 | Nút preview trên hồ sơ HDV web mở đúng public guide route đã có; badge 2FA từ private server DTO, không đưa secret/private fields vào public preview | Web preview URL/2FA tests pass. |
| 19 / BOOK-004 | `traveler_support_ticket_screen.dart`: 4 category theo AC, subject/message validation, chống double tap, giữ form khi lỗi, hiển thị supportCode server; nối entry từ profile | Widget success/failure tests pass. Backend support contract đã có và được tái sử dụng. |
| 20 / BOOK-009/010 | Web draft tách theo user/booking; rerender prop array không reset; text/rating localStorage, File attachments IndexedDB; hydrate theo booking; clear sau submit thành công; mobile SharedPreferences serialize draft và xóa sau submit | Frontend regression test remount/rerender/rating/clear pass. Mobile SharedPreferences widget regression đã kiểm tra đóng/mở khôi phục rating/text và tách booking. Browser attachment persistence còn cần kiểm tra runtime. |
| 21 / CHAT-002 | Debounce 500ms, hủy pending event khi send/clear/disconnect/dispose; TypingBubble 3 chấm, TTL peer hiện có, reduced-motion support | Backend transport có sẵn; đã thêm widget animation test. Mobile widget animation và debounce/clear-input tests pass. |
| 22 / AI-001 | Mobile API list/detail/read, inbox theo chủ đề có unread count, paging, chọn server transcript để tiếp tục; mark-read qua last visible assistant message ID; revision guard tránh cache hydrate đè thread đã chọn | Backend history/ownership/read-boundary integration pass. Mobile inbox/read-boundary test và mở inbox từ app bar pass; đã sửa nút inbox đặt nhầm trong dialog xóa lịch sử. |
| 23 / PROFILE-003 | Persist `AiMessage.incomplete`; cả provider max_tokens và app-side slice đều gắn incomplete; history reload giữ flag; web/mobile có nút tiếp tục trong cùng thread; guard chống gửi song song tái sử dụng | AI unit/integration + frontend chat tests pass. Mobile model/cubit/UI tests liên quan pass. |

### Kiểm chứng cuối đợt

- Toàn bộ backend unit: **54 suites, 706 tests pass**.
- Backend integration được chọn theo luồng: **9 suites, 48 tests pass**. Lần chạy kết hợp có 47 test; sau khi bổ sung scan alias/status-list, suite lifecycle chạy lại 9 test, nâng tổng case duy nhất lên 48.
- Frontend guide/moderation/review/e-ticket/AI chat: **23 suites, 165 tests pass** (22 suites/163 tests trong một lần chạy rộng, cộng suite queue mới 2 tests).
- Backend TypeScript, frontend TypeScript và `git diff --check`: pass.
- Formatter Dart đã chạy cho phần mobile thay đổi; kết quả analyzer/test bổ sung bên dưới.

### Mobile: SDK riêng và kết quả kiểm chứng bổ sung

Máy chỉ có SDK global `C:/Users/ASUS/flutter` với Dart **3.12.2**. Đã cài SDK chính thức **Flutter 3.47.9 / Dart 3.13.7** riêng tại `.tmp-sdk/flutter-3.47.9/flutter`, kiểm tra SHA-256 archive theo metadata chính thức. Không đổi SDK global, PATH hoặc constraint `^3.13.3` của project. `.tmp-sdk/` được gitignore. `flutter pub get` thành công; lockfile và Windows generated plugin registration được cập nhật theo pubspec hiện có.

Lượt test liên quan đầu tiên: **141 pass, 1 fail** do nút inbox AI bị đặt nhầm trong actions của dialog xóa lịch sử. Đã chuyển nút lên app bar và thêm regression mở inbox khi chưa có tin nhắn. Suite AI + review draft sau sửa: **5 tests pass**, bao gồm xóa lịch sử, mở inbox, khôi phục text/rating khi đóng review ngay trước debounce và tách biệt theo booking. Roster widget che số điện thoại và bỏ private notes kể cả khi backend cũ gửi dữ liệu chưa mask.

Đã sửa 13 lint thiếu ngoặc trong source vừa thay đổi và 1 lint trong test chat. Analyzer hoàn tất báo cáo với **0 lỗi biên dịch**, còn **7 warnings/infos ở các file không thay đổi**: notifications repository, tour checkout, voucher storage, conversation/voucher tests. Strict analyze toàn project vẫn chưa sạch vì các lint này. Một lần analyzer có thông báo Dart out-of-memory sau khi xuất báo cáo; không coi riêng exit code là bằng chứng kiểm tra hoàn toàn sạch.

Lượt analyzer riêng trên **26 file Dart đã sửa và được Git theo dõi**: **No issues found**, exit code 0. Source/test mới được kiểm tra biên dịch qua bộ test tập trung; không gộp kết quả analyzer này thành tuyên bố strict analyze toàn project pass.

Lượt chạy toàn bộ mobile gặp Dart out-of-memory dù giảm concurrency xuống 1; test runner báo hai case của `tour_search_flow_test.dart` chưa hoàn tất. Không đánh dấu toàn bộ mobile suite pass dựa trên lượt này. Bộ test tập trung sau sửa: **118 tests pass**, gồm profile, guide, earnings, chat, AI, support, bookings và review bloc/model/draft.

Lệnh SDK riêng, chạy từ `mobile/`:

```powershell
& '../.tmp-sdk/flutter-3.47.9/flutter/bin/flutter.bat' pub get
& '../.tmp-sdk/flutter-3.47.9/flutter/bin/flutter.bat' analyze --no-pub
& '../.tmp-sdk/flutter-3.47.9/flutter/bin/flutter.bat' test --no-pub --concurrency=1 test/features/profile test/features/guide test/features/earnings test/features/chat test/features/ai test/features/support test/features/bookings test/features/tours/tour_review_bloc_test.dart test/features/tours/tour_review_model_test.dart test/features/tours/tour_review_draft_test.dart
```

Cần kiểm tra camera/gallery/Cloudinary/rung/âm thanh trên thiết bị thật, màn danh sách vé mới trong điều kiện online/offline và lưu File review qua IndexedDB trên browser. Các bước này chưa được thay thế bằng widget tests. Migration/config/backfill dưới đây chưa chạy trên DB ứng dụng.

### Rollout database/config

Thứ tự migration mới sau batch 1:
1. `202611070001_guide_payout_account` — bảng account encrypted.
2. `202611070002_guide_payout_ledger` — ledger + backfill earnings cũ.
3. `202611070003_ai_incomplete` — flag incomplete trên message.

Áp dụng migration lên môi trường được chọn trước khi chạy backend mới. Payout cần secret keyring JSON `PAYOUT_ENCRYPTION_KEYS` và current id `PAYOUT_ENCRYPTION_KEY_ID`; dùng secret manager/biến môi trường server, không dùng JWT secret hoặc commit key thật. Giữ key versions cũ khi rotation. Sau khi cấu hình key, chạy `pnpm --filter backend exec tsx src/scripts/backfill-guide-payout-accounts.ts`, kiểm tra số bản ghi/legacy plaintext và chạy lại để xác nhận idempotency. Chưa thực hiện các thao tác này trên DB ứng dụng.

API moderation/web phải rollout đồng thời vì quyết định nay yêu cầu contentVersion và restorationReason khi restore. Update API docs/route index/use-case map đã được kiểm tra tự động. Commit được nhóm theo dependency và chức năng, kèm migration/test tương ứng và mã task trong commit body; chưa push lên remote.
