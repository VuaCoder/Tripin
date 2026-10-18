# Kế hoạch hoàn thiện Subscribe to Plan và View Earnings

Ngày khảo sát: 18/10/2026. Phạm vi: đọc source, tài liệu và test trong workspace; chưa xác minh hệ thống đang deploy hoặc dữ liệu production. Đây là kế hoạch triển khai, chưa thay đổi tính năng.

## 1. Kết luận hiện trạng

Backend đã có hai module, route được mount, kiểm tra permission, truy vấn theo tài khoản đăng nhập và event nghiệp vụ. Phần cần làm chính là frontend và nối hoàn chỉnh luồng thanh toán. Chưa đủ cơ sở kết luận tính năng chạy end-to-end chỉ từ sự tồn tại của source/test.

| Hạng mục | Đã có trong source | Còn thiếu/cần xác minh |
|---|---|---|
| Subscribe backend | Plans, tạo checkout, lịch sử cá nhân, gói hiện tại, kích hoạt qua payment event, gia hạn, maintenance | Kiểm thử lại API và payment sandbox; kiểm tra ngữ nghĩa gói gia hạn tương lai |
| Subscribe frontend | Payment API dùng chung hỗ trợ purpose SUBSCRIPTION | Chưa có route, UI, API hooks cho subscription |
| Earnings backend | Danh sách phân trang, khoảng ngày, tổng và thống kê tháng; ghi nhận từ booking hoàn tất | Kiểm thử lại isolation, filter và dữ liệu fixture |
| Earnings frontend | Shared loading/empty/error và mẫu trang Guide | Chưa có route, UI, API hooks cho earnings |
| Quyền truy cập | RoleGuard Guide, permission server, actor lấy từ token; reset cache khi đổi identity | Test tích hợp với các query mới và chuyển tài khoản khi request đang chạy |
| Thanh toán quay về | Trang success gọi GET payment, có polling; trang cancel có thử lại | Đích SUBSCRIPTION đang là /traveler; cancel thử lại bằng checkout booking; nội dung còn gắn với booking |

### Bằng chứng trong repo

- `frontend/app/guide/layout.tsx`: RoleGuard chỉ cho TOUR_GUIDE.
- `frontend/components/layout/GlobalSiteShell.tsx`, `AppShell.tsx`: Guide dùng shell chung, Header/Footer, nội dung responsive có max-width và padding.
- `frontend/components/layout/navigation-config.ts`: Guide có Lịch trình, Tour nhận dẫn, Hồ sơ; chưa có Gói dịch vụ/Thu nhập.
- `frontend/app/guide/page.tsx`: dashboard còn chỉ số cố định và phần tính năng sắp có; không dùng làm nguồn thu nhập thật.
- `frontend/features/guide/`: profile và assigned tours; `api/guideApi.ts` dùng RTK Query injectEndpoints; chưa có subscription/earnings endpoints trong frontend.
- `frontend/features/guide/components/GuideAssignedToursPage.tsx`: mẫu loading/error/empty, refresh, phân trang và mutation unwrap.
- `frontend/store/api/baseApi.ts`: bearer token, refresh session; `identityIsolation.ts` đã được gắn trong `frontend/store/index.ts` để reset API cache khi đổi user.
- `backend/src/modules/subscriptions/`, `backend/src/modules/earnings/`: controller → service → repository → Prisma/PostgreSQL; router được mount trong `backend/src/routes/index.ts`.
- `backend/src/modules/subscriptions/index.ts`: đăng ký handler payment SUBSCRIPTION; `backend/src/modules/earnings/index.ts`: đăng ký handler booking completed.
- `backend/src/jobs/maintenance.ts`: đã có lịch expire/cancel subscription mỗi 5 phút.
- `docs/use-cases/README.md`: có tên hai use case; `docs/flows/README.md` hiện chỉ liệt kê flow tổng quan.

## 2. API và nghiệp vụ cần giữ

Base path `/api/v1`. Response dữ liệu nằm trong `data`; response phân trang có `meta` ở ngoài `data`. Cần map đúng trong RTK Query.

| API | Quyền | Dữ liệu/ý nghĩa |
|---|---|---|
| GET /subscriptions/plans | Public | id, code, name, description, price, durationDays, benefits |
| POST /subscriptions | subscription:subscribe | Body chỉ `{ planId }`; trả `{ subscription, checkout }` |
| GET /subscriptions/me?page&limit | subscription:subscribe | Lịch sử của actor, mới nhất trước |
| GET /subscriptions/me/current | subscription:subscribe | `{ active, subscription }` |
| GET /payments/:id | Đăng nhập + ownership | purpose, referenceId, amount, status, checkoutUrl, expiresAt; pending có reconcile gateway |
| GET /earnings/me?from&to&page&limit | earnings:view | id, bookingId, bookingCode, tour{id,title}, amount, earnedAt |
| GET /earnings/me/summary?from&to | earnings:view | totalAmount, count, byMonth[{month,totalAmount,count}] |

### Subscribe to Plan hiện có

1. Guide chọn plan; server tự lấy giá và thời hạn, snapshot vào subscription.
2. Server tạo/reuse PENDING_PAYMENT cùng plan, rồi tạo/reuse checkout PayOS. Cửa sổ thanh toán subscription là 30 phút.
3. Frontend nhận checkoutUrl rồi chuyển sang cổng thanh toán.
4. Webhook xác minh hoặc reconcile payment cập nhật thanh toán; payment event kích hoạt subscription.
5. Subscription chuyển PENDING_PAYMENT → ACTIVE; gia hạn nối tiếp kỳ đang có. ACTIVE → EXPIRED bằng job; bỏ thanh toán lâu chuyển CANCELLED; tiền đến muộn vẫn có thể kích hoạt.
6. Tạo checkout thành công chỉ có nghĩa đang chờ thanh toán. Payment PAID và subscription đã kích hoạt là hai thông tin cần đọc riêng; không suy ra thành công từ URL quay về.

Lưu ý cần xử lý: `findCurrentActive` hiện lọc status ACTIVE và endsAt > now nhưng không lọc startsAt <= now, chọn endsAt xa nhất. Một kỳ gia hạn tương lai có thể được trả như kỳ hiện tại. Trước khi viết nhãn UI, thêm test và sửa selector nếu cần: current là kỳ đang chạy; kỳ tương lai hiển thị trong lịch sử là đã thanh toán/chờ đến ngày bắt đầu, giữ status backend.

### View Earnings hiện có

Booking COMPLETED → đọc phân công Guide hiện tại trên tour → nếu đã ACCEPTED và có phí, tạo earning một lần theo bookingId → thông báo Guide. API chỉ đọc theo guideId từ token.

- Số tiền là phí VND trên mỗi booking hoàn tất, không nhân số khách và không lấy từ giá tour.
- Summary gom tháng UTC; UI phải ghi rõ quy ước này nếu hiển thị thống kê theo tháng.
- Đây là thu nhập ghi nhận, chưa biểu thị tiền đã chuyển/rút. Không tự thêm trạng thái payout.
- Phí/Guide được đọc lúc hoàn tất, chưa snapshot theo booking. Đây là giới hạn nghiệp vụ hiện có, không tự thay đổi trong scope này.

## 3. UI đề xuất

Giữ shell, kiểu card trắng, nền slate, màu teal, bo góc và component shared đang có. Route mới nằm dưới GuideLayout, không tạo shell riêng.

### /guide/subscriptions — Gói dịch vụ

- Khối gói hiện tại: tên, trạng thái, giá snapshot, số ngày, thời gian hiệu lực; không có gói hiện tại là trạng thái hợp lệ.
- Danh sách plan từ API: giá VND, thời hạn, quyền lợi và nút đăng ký/gia hạn; xác nhận trước khi gửi.
- Disable thao tác lặp lúc mutation chạy. Chỉ redirect khi unwrap thành công và có checkoutUrl hợp lệ; lỗi giữ nguyên trạng thái, thông báo phù hợp và cho thử lại.
- Lịch sử phân trang: tên gói snapshot, giá, trạng thái backend, ngày tạo/bắt đầu/kết thúc. Kỳ đã thanh toán nhưng chưa đến startsAt có nhãn giải thích thời gian.
- Pending có thao tác tiếp tục qua POST cùng planId theo cơ chế reuse. Plan đã ngừng bán có thể bị từ chối theo backend; hiển thị lỗi thực tế, không tạo API mới để bỏ qua quy tắc.
- Loading/error/empty riêng cho plans, current, history; lỗi current không được diễn giải thành chưa đăng ký. Refresh sau checkout thất bại vì server có thể đã tạo pending trước khi gateway lỗi.

### /guide/earnings — Thu nhập

- Tổng thu nhập và số booking lấy từ summary, không cộng các dòng của trang hiện tại.
- Bộ lọc từ/đến ngày dùng chung cho list và summary; validate thứ tự ngày, đổi filter reset page về 1.
- Chốt ngày lọc theo Asia/Ho_Chi_Minh: gửi ISO có offset hoặc UTC tương ứng đầu/cuối ngày; test ranh giới. Summary theo tháng vẫn theo UTC của backend.
- Danh sách responsive: mã booking, tên tour, số tiền VND, ngày ghi nhận; phân trang từ meta. Không tự thêm link tới trang booking Traveler mà Guide không có quyền.
- Thống kê tháng dùng bảng gọn từ byMonth, chưa cần thư viện biểu đồ mới.
- Phân biệt chưa có thu nhập và không có kết quả trong khoảng đã chọn. Chỉ hiển thị 0 khi API trả thành công với tổng 0.
- Lỗi summary/list có retry riêng; không trộn summary filter cũ với list filter mới. Dùng currentData hoặc kiểm soát query args; dữ liệu cũ nếu giữ phải có nhãn rõ và không trình bày như kết quả hiện tại.

## 4. Các bước triển khai và đầu ra

### Bước 1 — Chốt contract và fixture

- Kiểm tra response thực tế, permission, PayOS sandbox/return URLs và seed plan trên môi trường dev/test.
- Chuẩn bị Guide A/B, Traveler, Agency; plan active/inactive; subscription pending/active/future/expired/cancelled; earnings nhiều tháng, empty và booking chưa hoàn tất.
- Bổ sung test current với kỳ tương lai; sửa truy vấn current nếu test xác nhận lỗi và rà soát caller liên quan trước khi đổi semantics.
- Đầu ra: fixture tái lập được và contract DTO thống nhất. Không cần migration nếu không phát hiện thiếu dữ liệu.

### Bước 2 — Lớp API frontend

- Thêm `frontend/features/guide/api/subscriptionsApi.ts`, `earningsApi.ts` và các type DTO tương ứng; export hooks qua index.
- Bổ sung tag Subscription/Earning tại baseApi; invalidation/refetch subscription sau mutation và khi quay về thanh toán.
- Dùng baseApi hiện có để giữ auth/refresh/isolation. Không gửi userId/guideId/giá từ client; không lưu dữ liệu riêng tư vào localStorage.
- Test method, body, query params, response envelope, meta và lỗi mutation không bị chuyển thành success.

### Bước 3 — Subscribe UI và payment return

- Thêm `frontend/app/guide/subscriptions/page.tsx`, `GuideSubscriptionsPage` và các component plan/current/history theo nhu cầu.
- Sửa `frontend/app/payment/success/page.tsx` và `cancel/page.tsx`: phân nhánh theo purpose lấy từ API; SUBSCRIPTION quay về /guide/subscriptions.
- Retry SUBSCRIPTION quay về màn gói để tiếp tục bằng planId đã tải từ lịch sử của chính user; không truyền subscription referenceId vào checkoutBooking.
- Success chỉ thông báo đã thanh toán khi payment PAID; chỉ thông báo gói đã kích hoạt sau refetch subscription tương ứng trong lịch sử. PAID nhưng chưa kích hoạt hiển thị đang đồng bộ.
- Poll có giới hạn và dừng khi terminal/unmount; hết thời gian vẫn pending cho refresh thủ công. FAILED có thông báo riêng; không coi mọi terminal chưa PAID là hết hạn.
- Cancel page phải đọc trạng thái server: quay về cancel không đồng nghĩa payment đã CANCELLED, đặc biệt trường hợp đã PAID hoặc webhook đến muộn.
- Xử lý thiếu paymentId, 401/403/404, mất mạng và lỗi gateway; bỏ nội dung giữ chỗ 15 phút khỏi nhánh subscription. Giữ regression flow booking.

### Bước 4 — Earnings UI

- Thêm `frontend/app/guide/earnings/page.tsx`, `GuideEarningsPage` và component summary/filter/list.
- Kết nối hai GET API, phân trang, ngày lọc, refresh, loading/empty/error và lỗi từng phần như thiết kế trên.
- Không tự tạo doanh thu từ assigned tours hoặc placeholder dashboard.

### Bước 5 — Điều hướng và kiểm tra quyền

- Thêm Gói dịch vụ/Thu nhập vào navigation-config; kiểm tra cả desktop/mobile và active item.
- Dashboard thêm đường dẫn tới hai màn hình, cập nhật mục thu nhập đang được mô tả là sắp có. Không mở rộng sang sửa toàn bộ dashboard.
- Kiểm tra backend luôn dùng userActor(req).userId và filter repository; tham số userId/guideId giả không đổi được phạm vi dữ liệu.
- Giữ middleware identityIsolation; test logout/login A → B, request A trả muộn, token hết hạn, refresh thất bại và truy cập trực tiếp route.
- GET payment của tài khoản khác phải không tiết lộ amount/checkoutUrl hoặc referenceId; frontend không render cache cũ khi server từ chối.

### Bước 6 — Nghiệm thu

| Acceptance criteria | Kiểm thử bắt buộc |
|---|---|
| Đăng ký theo flow hiện có | Chọn plan → POST → PayOS → webhook/reconcile → subscription được đọc lại; refresh trang vẫn đúng |
| Trạng thái theo backend | Pending, active, future renewal, expired, cancelled; reload và webhook chậm/đến muộn |
| Không báo thành công khi thất bại | POST 4xx/5xx, gateway fail, URL thiếu, payment FAILED, webhook chưa xác nhận; không success toast/active giả |
| Earnings đúng backend | So khớp từng dòng, total/count/month; nhiều trang không làm tổng đổi sai |
| Đúng tài khoản | Guide A/B cho subscriptions/current/list/earnings/summary/payment; giả query identity; chuyển tài khoản khi request đang chạy |
| Empty phù hợp | Không có plan, không có gói hiện tại/lịch sử; chưa có earnings; filter không có kết quả |
| Chặn truy cập trái quyền | Guest 401, role thiếu permission 403 cho API riêng tư; plans vẫn public; UI Guide bị guard |
| Lỗi không sai dữ liệu | List/summary lỗi độc lập, đổi filter/page nhanh, retry, hết phiên; không thay lỗi bằng 0 hoặc dữ liệu tài khoản khác |

- Backend: chạy unit subscriptions/earnings/payments; integration subscriptions và reviews (đang chứa earnings), bổ sung summary privacy/filter và payment failure nếu thiếu.
- Frontend: API tests, component tests cho hai màn hình, payment purpose branching, delayed activation, empty/error, identity isolation.
- Regression: booking checkout/success/cancel, Guide profile và assigned tours; build/typecheck hai app theo script/công cụ sẵn có.
- Manual trên mobile/desktop với PayOS sandbox; ghi kết quả và ảnh vào `docs/testing/` cùng hướng dẫn fixture. Tài liệu hóa hai flow trong docs/flows.

## 5. Thứ tự và giới hạn phạm vi

Thứ tự phụ thuộc: Bước 1 → Bước 2 → Bước 3/4 → Bước 5 → Bước 6. Mỗi bước hoàn tất phải có code review được và kết quả kiểm tra tương ứng; không đánh dấu hoàn thành chỉ vì đã có giao diện.

Không thêm auto-renew, hoàn tiền/hủy gói active, quản trị plan, payout/rút tiền hoặc dùng subscription chặn nhận tour: backend hiện chưa định nghĩa các hành vi này và acceptance criteria không yêu cầu. Dùng quyền lợi do API trả, không tự hứa tính năng mới.

Điều kiện hoàn tất: toàn bộ tiêu chí ở ma trận có bằng chứng pass, không còn luồng subscription gọi checkout booking/quay về Traveler, không hiển thị thành công từ callback URL, và dữ liệu riêng tư không tồn tại qua đổi tài khoản.

## 6. Kết quả kiểm tra trong lần khảo sát

- Đã đọc route/controller/service/repository, cấu hình quyền/cache, UI Guide, payment return và test liên quan; chưa chạy UI/browser hoặc gọi API môi trường triển khai.
- Đã thử `npm.cmd test -- --project unit src/modules/subscriptions/__tests__/subscriptions.service.test.ts src/modules/earnings/__tests__/earnings.service.test.ts` tại backend.
- Cả hai suite dừng ở import, chưa chạy test: `Cannot find package 'multer'` từ `src/modules/tours/tours.routes.ts`. Package đã khai báo trong backend/package.json nhưng môi trường dependency hiện tại chưa resolve được. Bước 1 cần khôi phục dependency theo lockfile rồi chạy lại; chưa có bằng chứng test pass, cũng chưa thể kết luận nghiệp vụ thất bại từ lỗi môi trường này.
- Chưa chạy integration vì unit chưa khởi tạo được; không sửa dependency hoặc nghiệp vụ trong nhiệm vụ lập kế hoạch.

## 7. Tiến độ triển khai 18/10/2026

- Đã thêm hai route/UI, API hooks/types, loading/empty/error độc lập, filter ngày và phân trang; thêm navigation desktop/mobile và lối vào dashboard.
- Đã hợp nhất callback success/cancel để đọc trạng thái payment thật, quay subscription về Guide, không retry bằng booking API, xác minh đúng subscription trước khi thông báo kích hoạt; polling có giới hạn.
- Đã sửa truy vấn gói hiện tại, tách kỳ cuối đã thanh toán cho gia hạn nhiều kỳ; sửa Earnings summary để không lệch khoảng ngày/tháng theo timezone database.
- Đã khôi phục dependencies theo lockfile; thêm migration hai trường AgencyProfile còn thiếu và UTF-8 cho database test để chạy được regression thực tế.
- Đã thêm fixture disposable local cùng test khả năng tạo lại/dọn và từ chối remote; thêm test API, component, role guard, cache khi đổi tài khoản và response trả muộn.
- Tự động: 40 backend unit, 26 backend integration, 82 frontend test pass; frontend typecheck và build hai app pass. Backend typecheck tổng thể còn lỗi sẵn có ngoài scope.
- Chưa nghiệm thu browser/mobile hoặc PayOS sandbox thật do công cụ browser không khả dụng. Không đánh dấu toàn bộ ma trận nghiệm thu đã hoàn tất. Xem [báo cáo và checklist](../testing/guide-finance/README.md), [flow đã triển khai](../flows/guide-finance.md).
