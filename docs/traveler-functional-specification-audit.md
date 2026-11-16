# TRAVELER FUNCTIONAL SPECIFICATION — Tripri OTA Platform

Phạm vi cuối cùng: **chỉ web**, cùng backend, database và tests phục vụ web. Ứng dụng di động nằm ngoài phạm vi theo yêu cầu của người dùng.

Ngày đối chiếu: 15/11/2026 (Asia/Saigon). Đây là đặc tả **as implemented**, không phải thiết kế chức năng tương lai. Các thiếu sót được giữ nguyên trong mô tả và liệt kê tại Part 5; không sửa mã nguồn để khớp đặc tả.

## PART 1 — PROJECT & SCOPE OVERVIEW

### 1.1. Baseline và tài liệu tham chiếu

- Branch: `feature/agency-accounting`.
- Commit: `2d2749a629c9b04edf9d59954fbf5ff3ee703c2a`.
- Working tree sạch tại đầu audit. Bản audit này là đầu ra tài liệu mới; không commit/push.
- Đã đọc [FUNCTION - WDP](https://docs.google.com/document/d/1f-xDZF-Mn8blbmggVY7lKdAGqg504keXHQ_2wBQVDuc/edit): Traveler `t.0`, Agency `t.m7qxmibyatli`, Super Admin `t.aqa7n98q6k4c`. Traveler hiện chứa placeholder `3.3`, `3.3.1`, `3.3.2`; placeholder Feature thứ hai lặp lại `3.3`. Tài liệu này giữ mốc bắt đầu **3.3**, dùng **3.4 trở đi** cho các Feature tiếp theo. Đây là đề xuất sửa lỗi lặp số của mẫu, chưa thay đổi Google Docs. Agency được tham khảo về tổ chức luồng, Super Admin về thông tin hiển thị và normal/abnormal cases; logic trong hai tab không được coi là bằng chứng thay cho code.
- Tên Feature/Function dùng tiếng Anh; nội dung nghiệp vụ dùng tiếng Việt. Số mục trong Part 3 cũng là ID truy vết trong Part 2/4, không phải Business Rule ID mới.

### 1.2. Kiến trúc và ranh giới xác minh

| Lớp | Tổ chức thực tế | Phạm vi đã đọc |
|---|---|---|
| Web | Next.js App Router, React, Redux Toolkit/RTK Query, Ant Design | `frontend/app`, `components/layout`, `store/api/baseApi.ts`; features auth, tours, booking, payment, e-ticket, cart, wishlist, traveler-account, promotions, review, custom-tours, chat, notifications, complaints, report, premium, public-profiles |
| API | Express; `/api/v1`; route → controller → service → repository, Zod validation, guard tập trung | Registry `backend/src/routes/index.ts`, authenticate/authorize; module tương ứng các chức năng và các consumer liên quan |
| Data | PostgreSQL, Prisma; schema gốc ở **`prisma/schema.prisma`**, không phải `backend/prisma` | Model, enum, unique/index, migration lịch sử booking/passenger, ticket, money, promotion, premium, custom-tour, security, preferences, optional-services |
| Nền | Job trong process và event listener | `backend/src/jobs/maintenance.ts`, `backend/src/server.ts`, booking/payment events và đăng ký consumer, mail outbox, ticket repair |
| Tích hợp | PayOS, Cloudinary, Google Identity, SMTP, Socket.IO, provider AI | Adapter và consumer; không gọi giao dịch/provider thật |
| Test | Vitest backend/frontend; tài liệu manual/E2E | Đọc assertion của luồng rủi ro; chạy subset unit độc lập, kết quả tại 1.5 |

Không tuyên bố đã kiểm tra từng dòng của toàn bộ ứng dụng Agency/Admin/Guide, mã generated, thư viện hay tài nguyên binary. Các phần này chỉ được truy vết khi ảnh hưởng Traveler. Không đọc dữ liệu production, không kiểm tra migration đã được áp dụng trên server, không xác minh secret/cấu hình provider đang triển khai. Không mở giao diện runtime, không tạo screenshot. Những điều kiện phụ thuộc môi trường là **UNVERIFIED runtime**, kể cả khi source được phân loại IMPLEMENTED.

### 1.3. Danh tính, quyền và quy ước dữ liệu dùng chung

Guest được xem tour công khai, category, destination, review, hồ sơ công khai, policy và plan. Web `/traveler/*` và `/settings/*` có `RoleGuard` TRAVELER; middleware Next chỉ `NextResponse.next()`, không phải ranh giới authorization. API xác minh Bearer token, đọc lại User từ database, kiểm tra `tokenVersion`, `staffStatus=ACTIVE`, `status=ACTIVE`; BANNED hoặc chưa active bị từ chối. Quyền thực tế là quyền role cộng/trừ extra/revoked permissions. Tạo/quote booking còn có `requireVerifiedTraveler`: role TRAVELER và email verified. Đọc/sửa tài nguyên riêng kiểm tra owner; thường trả 404 khi ID thuộc người khác, tránh tiết lộ tồn tại.

API dùng envelope `success`, `data`, `meta` cho phân trang, hoặc `error.code/message/details`; cần đọc transformResponse của từng client, không giả định mọi hook trả cùng shape. Tiền lưu **whole VND**, phần lớn BigInt trong SQL rồi chuyển số an toàn ở DTO; không áp dụng cents. Ngày API dùng ISO string; web thường format `vi-VN`, không phải mọi vị trí đều ép múi giờ. Giới hạn phân trang chung xem `backend/src/utils/pagination.ts`; limit tối đa 100, trừ endpoint có schema riêng (complaint tối đa 50).

Quy ước Part 3: **Business Rules chưa có ID** nghĩa là quy tắc được tìm thấy trong code nhưng chưa đối chiếu được mã BR chính thức. `BOOK-*`, `PAY-*`, `D-*` là nhãn issue/decision đã tồn tại, không tự chuyển thành `BR-*`. `BR-42`, `BR-26`, `BR-35` xuất hiện ở tab Super Admin nhưng chưa đủ cơ sở ánh xạ toàn bộ sang Traveler.

### 1.4. Các trạng thái và snapshot quan trọng

| Đối tượng | Trạng thái/quan hệ đã xác minh |
|---|---|
| User | `PENDING_VERIFICATION`, `ACTIVE`, `BANNED`; OTP `REGISTER`, `LOGIN_2FA`, `FORGOT_PASSWORD`; RefreshToken lưu hash/family/revokedAt/tokenVersion |
| Tour | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`, `ARCHIVED`; visibility `PUBLIC`/`PRIVATE`; TourDeparture có date/capacity/remaining/priceOverride/isOpen |
| Booking | `PENDING → CONFIRMED → COMPLETED`; `PENDING/CONFIRMED → CANCELLED`; không có enum EXPIRED cho Booking: hết hạn trở thành CANCELLED với `PAYMENT_EXPIRED` |
| Payment | `PENDING`, `PAID`, `FAILED`, `CANCELLED`, `EXPIRED`; purpose `BOOKING` hoặc `SUBSCRIPTION`; referenceId đa hình, không phải FK trực tiếp tới Booking |
| ETicket | `VALID`, `USED`, `CANCELLED`; unique bookingId: **một vé cho một booking**, không phải mỗi slot một vé |
| Review | `VISIBLE`, `HIDDEN`; unique bookingId, tác giả chỉ tạo, chưa có API sửa/xóa |
| CustomTourRequest | `SUBMITTED`, `NEGOTIATING`, `OFFERED`, `ACCEPTED`, `DECLINED`, `CANCELLED`; revision báo giá và checkoutRevision riêng |
| Subscription/Premium | Subscription `PENDING_PAYMENT`, `ACTIVE`, `EXPIRED`, `CANCELLED`; Premium còn có revokedAt và refund riêng; kỳ tương lai có thể ACTIVE trong storage nhưng chưa có quyền hiện tại |
| Support/Complaint/Report | Ba subsystem riêng, không đồng nhất ticket/report ID hay trạng thái; chi tiết tại 3.14 |

Booking thường lưu người tham gia trong `Booking.passengerSnapshot` (Prisma map xuống cột SQL `passengers` JSON). Booking đoàn lưu `BookingPassenger` relation (fullName, phone, idCard, guestType). Contact chỉ lưu `contactName/contactPhone`, không có contactEmail/contactGender. Tiền/giá/guestPricing/meetingPoint/serviceSnapshot/cancellationPolicySnapshot được chụp tại booking; tour images trong một số query vẫn lấy từ Tour hiện tại. Các scalar ID không có relation Prisma không mặc nhiên là FK SQL.

### 1.5. Kiểm thử đã thực hiện và giới hạn

Đã chạy trực tiếp Vitest cài sẵn bằng `node node_modules/vitest/vitest.mjs` (shell không có `pnpm`). Backend dùng `--project unit`, setup ghi đè DATABASE_URL sang `127.0.0.1:1/tripri_test_unconfigured`; không chạy globalSetup integration, không migrate/seed/reset. **8 file / 175 test backend PASS**: auth, bookings, payments, e-tickets, reviews, promotions, carts, wishlists, mỗi module file `__tests__/<module>.service.test.ts` (auth là `auth.service.test.ts`). **6 file / 44 test frontend PASS**: `passengerValidation`, `BookingEntryAgeValidation`, `searchContext`, `checkout`, `VoucherWallet`, `PremiumPage`.

Các test backend dùng mock repository/provider: chứng minh nhánh service và assertions được kiểm tra, không chứng minh PayOS/SQL production. Đã đọc assertions integration về concurrency inventory/idempotency, ticket lifecycle và repair nhưng **không chạy**. Các test khác trong Part 4 được ghi là “source only”, không gán PASS cho toàn suite. Không chạy browser E2E. Tài liệu `docs/testing/cart-e2e` là lịch sử manual, không chứng minh cart UI còn hoạt động trên HEAD hiện tại.

## PART 2 — COMPLETE TRAVELER FEATURE INVENTORY

IMPLEMENTED = tìm thấy xử lý thực; PARTIALLY IMPLEMENTED = còn thiếu đoạn quan trọng hoặc lệch frontend/backend; UI ONLY = điều khiển chưa nối nghiệp vụ; MOCKED = dữ liệu/kết quả giả; NOT IMPLEMENTED = không tìm thấy trong phạm vi tìm kiếm; UNVERIFIED = thiếu bằng chứng. IMPLEMENTED không đồng nghĩa đã test end-to-end. Nhãn ở bảng áp dụng cho luồng web; giới hạn xác minh được ghi ngay trong ô trạng thái.

| Feature ID | Feature Name | Function Name (ID) | Route/Screen | Implementation Status |
|---|---|---|---|---|
| 3.3 | Authentication & Session | Register Traveler Account (3.3.1) | `/register/traveler`, `/register` | IMPLEMENTED |
| 3.3 | Authentication & Session | Verify Email & Resend OTP (3.3.2) | `/verify-otp` | IMPLEMENTED |
| 3.3 | Authentication & Session | Sign In & Google Sign In (3.3.3) | `/login` | IMPLEMENTED; provider runtime UNVERIFIED |
| 3.3 | Authentication & Session | Recover Password (3.3.4) | `/forgot-password`, `/reset-password` | IMPLEMENTED |
| 3.3 | Authentication & Session | Restore & Revoke Session (3.3.5) | Nền, logout menu | IMPLEMENTED |
| 3.4 | Home & Discovery | Browse Home & Destinations (3.4.1) | `/`, `/home` | IMPLEMENTED; nội dung marketing tĩnh |
| 3.4 | Home & Discovery | Search, Filter & Sort Tours (3.4.2) | `/tours`, legacy `/explore` | IMPLEMENTED; pets UI ONLY |
| 3.4 | Home & Discovery | Browse Similar & Recently Viewed Tours (3.4.3) | Home/detail | IMPLEMENTED local/rule-based; cá nhân hóa server NOT IMPLEMENTED |
| 3.5 | Tour Information | View Tour Details & Departure Prices (3.5.1) | `/tours/:id` | IMPLEMENTED; hiển thị breakdown fixed-age có sai lệch |
| 3.5 | Tour Information | Print Tour Information (3.5.2) | `/tours/:id/print` | IMPLEMENTED client print |
| 3.5 | Tour Information | View Agency & Guide Profiles (3.5.3) | `/agencies/:id`, `/tour-guides/:id` | IMPLEMENTED |
| 3.6 | Saved Tours & Cart | Manage Saved Tours (3.6.1) | `/settings/wishlist`, `/traveler/wishlist` | IMPLEMENTED |
| 3.6 | Saved Tours & Cart | Organize Wishlist Collections (3.6.2) | Wishlist modal/page | IMPLEMENTED local; server sync NOT IMPLEMENTED |
| 3.6 | Saved Tours & Cart | Manage Departure Cart (3.6.3) | API `/cart`; `/traveler/cart` redirect | PARTIALLY IMPLEMENTED: backend/client có, web screen không hoạt động |
| 3.7 | Booking & Checkout | Select Guests & Enter Passenger Details (3.7.1) | `/traveler/bookings/new` | PARTIALLY IMPLEMENTED: FE có, BE validation thiếu |
| 3.7 | Booking & Checkout | Select Optional Services & Request Quote (3.7.2) | Booking step 2/3 | IMPLEMENTED |
| 3.7 | Booking & Checkout | Confirm Booking & Reserve Seats (3.7.3) | Booking step 3 | IMPLEMENTED |
| 3.7 | Booking & Checkout | Expire Unpaid Holds (3.7.4) | Job | IMPLEMENTED |
| 3.7 | Booking & Checkout | Resume Incomplete Booking (3.7.5) | Wishlist banner → history/group form | IMPLEMENTED; giới hạn trang đầu, không lưu nháp form thường |
| 3.8 | Payment | Open & Retry PayOS Checkout (3.8.1) | Booking, `/payment/success`, `/payment/cancel` | IMPLEMENTED; gateway runtime UNVERIFIED |
| 3.8 | Payment | Verify Settlement & Reconcile Payment (3.8.2) | Webhook, poll, job | IMPLEMENTED source; live UNVERIFIED |
| 3.8 | Payment | Issue & Repair E-ticket (3.8.3) | Event/job | IMPLEMENTED |
| 3.9 | Trip Management | View Booking History & Details (3.9.1) | `/settings/history[/id]`, `/traveler/bookings[/id]` | PARTIALLY IMPLEMENTED: core list/detail có; roster thường không map về DTO |
| 3.9 | Trip Management | View E-ticket & Offline Copy (3.9.2) | `/traveler/tickets[/id]`, `/settings/history/:id/ticket` | IMPLEMENTED; tải PDF server NOT IMPLEMENTED |
| 3.9 | Trip Management | Confirm Trip Completion (3.9.3) | History/detail, job | IMPLEMENTED |
| 3.10 | Cancellation & Refund | Cancel Booking (3.10.1) | CancelBookingModal | IMPLEMENTED; compensation không hoàn toàn atomic |
| 3.10 | Cancellation & Refund | Track Booking Refund Requirement (3.10.2) | Booking detail | PARTIALLY IMPLEMENTED: flag/amount có; payout booking tự động NOT IMPLEMENTED |
| 3.11 | Voucher & Promotion | Discover & Collect Vouchers (3.11.1) | Home, agency profile | IMPLEMENTED |
| 3.11 | Voucher & Promotion | View Voucher Wallet (3.11.2) | `/settings/vouchers` | PARTIALLY IMPLEMENTED: trạng thái used chưa đồng bộ |
| 3.11 | Voucher & Promotion | Apply & Release Booking Discounts (3.11.3) | Checkout | IMPLEMENTED backend; wallet status gap |
| 3.12 | Reviews & Ratings | View Public & Own Reviews (3.12.1) | Tour/profile/history | IMPLEMENTED |
| 3.12 | Reviews & Ratings | Write Review & Preserve Draft (3.12.2) | WriteReviewDialog | IMPLEMENTED |
| 3.12 | Reviews & Ratings | Edit/Delete Own Review (3.12.3) | N/A | NOT IMPLEMENTED; report review thuộc 3.14.1 |
| 3.13 | Notifications & Messaging | Read & Manage Notifications (3.13.1) | Header notifications | PARTIALLY IMPLEMENTED: API đầy đủ, UI/count lệch |
| 3.13 | Notifications & Messaging | Converse with Agency or Guide (3.13.2) | `/conversations[/id]` | IMPLEMENTED |
| 3.13 | Notifications & Messaging | Consult AI Assistant (3.13.3) | `/conversations/ai` | IMPLEMENTED configurable; provider runtime UNVERIFIED |
| 3.14 | Reports & Assistance | Submit & Track Reports (3.14.1) | ReportDialog, `/settings/reports` | IMPLEMENTED |
| 3.14 | Reports & Assistance | Open & Discuss Tour Complaint (3.14.2) | Complaint dialog/list/thread | IMPLEMENTED |
| 3.14 | Reports & Assistance | Accept/Escalate Resolution & Submit CSAT (3.14.3) | Complaint thread/CSAT | IMPLEMENTED |
| 3.14 | Reports & Assistance | Create & Follow Support Ticket (3.14.4) | API; chưa tìm thấy màn hình Traveler web | PARTIALLY IMPLEMENTED: backend có; web entry NOT IMPLEMENTED |
| 3.15 | Profile & Preferences | View/Edit Profile & Avatar (3.15.1) | `/settings/profile`, `/traveler/profile` | IMPLEMENTED |
| 3.15 | Profile & Preferences | Change Password & Email OTP 2FA (3.15.2) | `/settings/profile/security`, API | PARTIALLY IMPLEMENTED: 2FA web có; web password change entry chưa tìm thấy |
| 3.15 | Profile & Preferences | Configure Notification Preferences (3.15.3) | API `/users/me/preferences` | PARTIALLY IMPLEMENTED: BE có, web editor chưa tìm thấy |
| 3.15 | Profile & Preferences | Apply to Become Tour Guide (3.15.4) | API; chưa tìm thấy form Traveler web | PARTIALLY IMPLEMENTED: self-approval dev endpoints không có env guard |
| 3.16 | Premium Membership | Browse Premium Plans & Status (3.16.1) | `/premium` | IMPLEMENTED |
| 3.16 | Premium Membership | Purchase/Renew Premium (3.16.2) | Premium → PayOS | IMPLEMENTED source; runtime UNVERIFIED |
| 3.16 | Premium Membership | Receive & Use Premium Vouchers (3.16.3) | Premium/wallet/checkout | IMPLEMENTED |
| 3.16 | Premium Membership | Request Future-period Refund (3.16.4) | API period/history/refund; chưa tìm thấy form Traveler web | PARTIALLY IMPLEMENTED: BE/client có; transfer external |
| 3.17 | Group Booking | Request & Negotiate Group Tour (3.17.1) | Detail → dialog; `/traveler/custom-tours`, chat | IMPLEMENTED |
| 3.17 | Group Booking | Accept Versioned Offer (3.17.2) | CustomTourPanel/chat | IMPLEMENTED |
| 3.17 | Group Booking | Complete Group Roster & Book (3.17.3) | Group booking entry | IMPLEMENTED; mọi tuổi cần CCCD theo code |
| 3.18 | Policy & Navigation | Read & Accept Policy Version (3.18.1) | `/policies` | IMPLEMENTED; không phải gate bắt buộc checkout |

## PART 3 — COMPLETE FUNCTIONAL SPECIFICATION

### 3.3 Authentication & Session

#### 3.3.1 Register Traveler Account

- **Function trigger:** Guest mở `/register/traveler` hoặc chọn Traveler tại `/register`.
- **Function description:** Tạo danh tính Traveler bằng email/password; kết quả là tài khoản chờ xác minh và yêu cầu OTP, chưa phải phiên được phép booking. Form web giữ continuation đã được làm sạch để quay lại sau xác thực.
- **Screen layout:** Form họ tên, email, password/confirmation, tùy form có phone; chọn vai trò qua route; liên kết login, Google; lỗi trường/form và trạng thái đang gửi. Không có màn hình quản trị tài khoản tại đây.
- **Function Details:**
  - **Displayed Information:** Nhãn/placeholder form, hướng dẫn mật khẩu, lỗi API; email được dùng để chuyển sang OTP. Không hiển thị hash hoặc OTP backend.
  - **User Actions / Data Processing:** Gửi `POST /auth/register` với email, password, fullName, phone tùy chọn, role TRAVELER. Backend chuẩn hóa email lowercase/trim, hash bcrypt, tạo/cập nhật nhánh đăng ký chưa verified theo service, gửi OTP; trả email và `otpExpiresInSeconds`.
  - **Input Validation:** BE email hợp lệ ≤254; tên 2–120; password 8–72, có chữ và số; phone đăng ký chỉ trim/max30, không cùng regex phone cập nhật hồ sơ. Confirmation thuộc FE, không phải field API. Role công khai chỉ TRAVELER/TOUR_GUIDE.
  - **Business Rules:** Business Rules chưa có ID: không cho đăng ký role nội bộ; email đã được sử dụng ở nhánh không được đăng ký lại trả `EMAIL_ALREADY_REGISTERED`; pending registration phải đọc nhánh service, không mô tả là luôn insert mới.
  - **Permissions and Status Transitions:** Public endpoint, auth rate limit; User mới `PENDING_VERIFICATION`; không tự ACTIVE chỉ vì form thành công.
  - **Normal Cases:** Dữ liệu hợp lệ tạo user chờ xác minh, gửi thư và điều hướng OTP cho email đó.
  - **Abnormal Cases:** Sai format, email trùng, vượt rate limit hoặc mail/provider lỗi được trả lỗi; không coi việc nhìn thấy trang OTP là bằng chứng email đã đến inbox.

#### 3.3.2 Verify Email & Resend OTP

- **Function trigger:** Sau register, hoặc màn hình `/verify-otp` với email/purpose; “Gửi lại mã” sau cooldown. LOGIN_2FA dùng cùng màn hình nhưng mục đích khác.
- **Function description:** Xác nhận quyền sở hữu email hoặc hoàn tất bước hai của login. Backend chỉ tiêu thụ mã đúng purpose và cấp session sau khi đạt điều kiện tài khoản.
- **Screen layout:** Ô mã 6 số, email đích, countdown, gửi lại, xác nhận; lỗi mã sai/hết hạn/quá lượt; trạng thái disable khi request đang chạy.
- **Function Details:**
  - **Displayed Information:** Countdown từ thời hạn API; nội dung lỗi `OTP_INVALID`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `OTP_RESEND_TOO_SOON` được FE ánh xạ; không hiển thị mã ở UI debug như một tính năng chính thức.
  - **User Actions / Data Processing:** `POST /auth/verify-otp` gửi email/code/purpose/rememberMe; REGISTER kích hoạt và ghi emailVerifiedAt; LOGIN_2FA hoàn tất session. `POST /auth/resend-otp` phát mã mới; resend LOGIN_2FA cần password để chứng minh bước đầu.
  - **Input Validation:** 6 chữ số, email hợp lệ, purpose cho verify chỉ REGISTER/LOGIN_2FA; reset password có endpoint riêng. OTP lưu hash, unique user/purpose.
  - **Business Rules:** Business Rules chưa có ID: TTL 10 phút, cooldown 60 giây; count attempt atomic, vượt 5 lần bị chặn; thành công consume một lần. Mã mới thay mã cũ của cùng purpose.
  - **Permissions and Status Transitions:** Public nhưng rate-limited; BANNED bị từ chối. REGISTER chuyển pending sang ACTIVE; không dùng OTP forgot-password để activate.
  - **Normal Cases:** Mã đúng, còn hạn → session/token và user được trả; người dùng tiếp tục theo role/next path hợp lệ.
  - **Abnormal Cases:** Sai mã không kích hoạt; mã cũ/đã consume không dùng lại; hết hạn phải gửi lại; resend quá sớm trả 429. Lỗi vận chuyển thư không chứng minh mailbox đã nhận.

#### 3.3.3 Sign In & Google Sign In

- **Function trigger:** `/login` hoặc chuyển hướng từ thao tác cần login (booking/wishlist/chat); chọn Google nếu client ID được cấu hình.
- **Function description:** Xác thực Traveler bằng mật khẩu hoặc Google idToken; áp dụng trạng thái tài khoản, tùy chọn nhớ phiên và OTP hai lớp cho đăng nhập bằng mật khẩu.
- **Screen layout:** Email/password, hiện/ẩn mật khẩu, remember me, quên mật khẩu, đăng ký, Google; báo lỗi và busy; 2FA chuyển sang OTP.
- **Function Details:**
  - **Displayed Information:** Email đang nhập, validation, trạng thái cần verify/2FA; không trả lời sai mật khẩu bằng dữ liệu hồ sơ riêng.
  - **User Actions / Data Processing:** `POST /auth/login` với email/password/rememberMe; trả session hoặc yêu cầu OTP. `POST /auth/google` với idToken và role khi tạo mới; server verify Google email, liên kết googleId hoặc tạo tài khoản; User pending bị Google xác minh có nhánh bỏ password cũ để tránh chiếm tài khoản trước xác minh.
  - **Input Validation:** Login chỉ yêu cầu password 1–72, không áp lại password policy mới lên legacy password; Google token 10–4096. `next` được lọc qua `safeNextPath`, không chấp nhận redirect ngoài ứng dụng.
  - **Business Rules:** Business Rules chưa có ID: password login với twoFactorEnabled chưa cấp session trước OTP; Google-only không tự được bật password-2FA. Remember me dùng access 30 ngày và refresh 30 ngày; phiên thường theo env, không hardcode thời hạn từ UI.
  - **Permissions and Status Transitions:** BANNED/inactive/staff inactive bị chặn; Agency không dùng cổng Traveler (`AGENCY_PORTAL_REQUIRED`). Login không đổi booking.
  - **Normal Cases:** User active nhập đúng thông tin nhận session; booking continuation giữ tour/departure/guest query.
  - **Abnormal Cases:** Sai email/password trả `INVALID_CREDENTIALS`; unverified cần OTP; Google chưa cấu hình, token không hợp lệ hoặc provider lỗi không tạo phiên giả. Tích hợp Google live chưa chạy trong audit.

#### 3.3.4 Recover Password

- **Function trigger:** “Quên mật khẩu” tại login → `/forgot-password` → `/reset-password`.
- **Function description:** Gửi OTP khôi phục cho tài khoản đủ điều kiện và thay mật khẩu sau xác minh. Kết quả là mật khẩu mới và thu hồi session, không tự xác minh tài khoản pending.
- **Screen layout:** Bước email; bước email/mã/new password/confirmation; resend/countdown và lỗi; thông báo hoàn tất, quay login.
- **Function Details:**
  - **Displayed Information:** Phản hồi gửi mã dạng chung, tránh khẳng định email có tài khoản; lỗi form/reset được hiển thị theo API.
  - **User Actions / Data Processing:** `POST /auth/forgot-password {email}` chỉ gửi mã khi user ACTIVE; `POST /auth/reset-password {email,code,newPassword}` kiểm tra OTP FORGOT_PASSWORD, hash password, tăng tokenVersion, revoke mọi refresh token.
  - **Input Validation:** Email, OTP và policy mật khẩu như 3.3.1/2; FE kiểm tra confirmation; BE không nhận confirmation.
  - **Business Rules:** Business Rules chưa có ID: reset không phải luồng activation; không cho user banned; mã reset không dùng cho login/register.
  - **Permissions and Status Transitions:** Public/rate-limited; trạng thái User giữ nguyên; các access token mang tokenVersion cũ mất hiệu lực ở request tiếp theo.
  - **Normal Cases:** Mã đúng → password được lưu, phiên cũ bị thu hồi, đăng nhập lại bằng password mới.
  - **Abnormal Cases:** Email không tồn tại vẫn nhận thông điệp forgot chung; mã sai/hết hạn/quá lần chặn reset; không mô tả session cũ vẫn hoạt động sau reset.

#### 3.3.5 Restore & Revoke Session

- **Function trigger:** Tải trang, token sắp hết hạn, API trả 401 có mã token/session, mở socket; logout từ menu.
- **Function description:** Khôi phục phiên, xoay refresh token và kết thúc phiên. Đây là xử lý nền gắn với login/logout, không phải màn hình quản lý danh sách thiết bị.
- **Screen layout:** **N/A – Non-screen function**; RoleGuard có access loader; logout có thao tác menu và redirect login.
- **Function Details:**
  - **Displayed Information:** User/role dùng cho header và navigation; session service unavailable hiện lỗi qua consumer. Không có màn hình revoke riêng từng thiết bị được tìm thấy.
  - **User Actions / Data Processing:** Web AuthBootstrap hydrate `tripri_auth_session` từ localStorage/sessionStorage, refresh khi thiếu/sắp hết token; RTK Query gom request refresh đang chạy, retry request sau refresh. `POST /auth/refresh` nhận cookie, body hoặc x-refresh-token, rotate token/family. `POST /auth/logout` tăng tokenVersion, revoke family, disconnect sockets; FE clear credentials/cache cả khi logout HTTP thất bại.
  - **Input Validation:** Token có chữ ký, expiry, user hiện tại/tokenVersion hợp lệ; response cũ không được ghi đè user mới khi đổi tài khoản.
  - **Business Rules:** Business Rules chưa có ID: reuse refresh đã revoke làm revoke family; lỗi mạng tạm thời refresh không tự xóa persisted session; logout server hợp lệ vô hiệu access token cũ qua version, không chỉ xóa cookie.
  - **Permissions and Status Transitions:** API tiếp tục đọc quyền/status DB, không tin role trong JWT.
  - **Normal Cases:** Reload giữ phiên; 401 token hợp lệ để refresh → request được lặp; logout xóa UI và session server khi request đến nơi.
  - **Abnormal Cases:** Cookie/token hết hạn hoặc reuse → login lại; logout mất mạng chỉ bảo đảm clear cục bộ. Không khẳng định thu hồi server đã thành công khi request logout thất bại.

### 3.4 Home & Discovery

#### 3.4.1 Browse Home & Destinations

- **Function trigger:** Mở `/` (landing thương hiệu), `/home` (khám phá), logo hoặc navigation theo role.
- **Function description:** Guest/Traveler khám phá tour theo rating, mới nhất và điểm đến, xem voucher hot rồi đi vào search/detail. Không yêu cầu login cho dữ liệu công khai.
- **Screen layout:** Landing có ảnh/scene và CTA; Home có hero, thanh điểm đến/ngày/số khách, carousel tour được yêu thích, mới, các thành phố, recently viewed, hot vouchers.
- **Function Details:**
  - **Displayed Information:** Card ảnh/tên/điểm đến/thời lượng/base price/rating/count; destinations từ `/tours/destinations`, metadata được enrich; categories từ `/categories`; hot voucher từ `/promotions/hot`. Hero và copy tĩnh không phải dữ liệu thống kê giao dịch.
  - **User Actions / Data Processing:** Home gọi nhiều query `/tours` với sort rating/newest hoặc destination (Đà Nẵng/Hà Nội/HCM); search dựng query string rồi mở `/tours`.
  - **Input Validation:** Guest selector giới hạn tổng 50; bộ đọc search đảm bảo tối thiểu một adult. Home có thể chọn adult=0 trước bước chuẩn hóa, nên không mô tả tất cả control đều đồng nhất.
  - **Business Rules:** Business Rules chưa có ID: “được yêu thích” ở Home là query rating, không phải số wishlist hay ML recommendation; chỉ APPROVED/PUBLIC từ API. Destination cache 60 giây, search không guest cache 30 giây.
  - **Permissions and Status Transitions:** Guest/Traveler chỉ đọc; Agency có redirect riêng. Không giữ chỗ hoặc tạo Booking.
  - **Normal Cases:** Các carousel tải dữ liệu, chọn tour mở chi tiết; chọn tiêu chí tìm kiếm chuyển danh sách với query tương ứng.
  - **Abnormal Cases:** Section chưa có tour có thể rỗng; loading theo query. Không suy từ ảnh marketing rằng mọi điểm đến đều có inventory. Lỗi provider/network và bố cục runtime chưa test browser.

#### 3.4.2 Search, Filter & Sort Tours

- **Function trigger:** Search Home hoặc trực tiếp `/tours?...`; đổi filter/sort/page/grid-list tự cập nhật query; `/explore` redirect legacy.
- **Function description:** Tìm tour công khai bằng một API search chung, kết hợp các tiêu chí rồi phân trang. State chính đặt trong URL để reload/share/back giữ được bộ lọc.
- **Screen layout:** “Khám phá tour”, grid/list toggle; sidebar category/destination/date/guest/price/duration/rating; ô keyword, sort, kết quả/cards/pagination; loading, empty, lỗi và retry/xóa filter.
- **Function Details:**
  - **Displayed Information:** Card tour và meta tổng/trang. Giá filter/sort dựa **Tour.basePrice**, không phải tổng tiền cả đoàn hay giá override đã chọn. Sort API: newest, price_asc, price_desc, rating.
  - **User Actions / Data Processing:** `GET /tours` nhận q, agencyId, categoryId, destination, min/maxPrice, min/maxDays, departureFrom/To, adults/children/infants, minRating, sort, page, limit. q khớp title/destination/summary không phân biệt hoa thường; keyword debounce 350ms, price slider 400ms; đổi filter reset page. Card sang detail chỉ giữ guest counts và date range qua `tourDetailHref`, không giữ toàn bộ keyword/sort.
  - **Input Validation:** BE q 1–100, destination ≤120; tiền nguyên không âm, rating 0–5; min≤max, from≤to; từng nhóm guest có giới hạn riêng. Search BE không có refine tổng guest≤50/min adult như booking; FE normalize tổng≤50.
  - **Business Rules:** Business Rules chưa có ID: tổng khách = adults+children+infants; khi tổng>0 phải có departure open/future/remaining≥tổng và maxGroupSize đủ hoặc null; yêu cầu child/infant phải có pricing hỗ trợ. Date filter chỉ xét departure còn đặt được. Không có pets trong search API.
  - **Permissions and Status Transitions:** Public read; PRIVATE/unapproved không hiện; không reserve. Query guest bỏ cache để đọc inventory mới, còn detail có cache riêng.
  - **Normal Cases:** Filter có tour phù hợp trả danh sách/meta; sort/page thay kết quả; mở detail tiếp tục với guest/date.
  - **Abnormal Cases:** Khoảng giá/ngày sai trả validation; không match có empty/reset. Lịch vừa hết chỗ vẫn có thể hiện từ dữ liệu cũ, checkout phải kiểm lại. Pets trên Home là UI ONLY, không được viết là hỗ trợ mang thú cưng.

#### 3.4.3 Browse Similar & Recently Viewed Tours

- **Function trigger:** Sau xem detail ghi local history; mở Home/wishlist hoặc SimilarToursSection ở detail.
- **Function description:** Cho phép quay lại tour đã xem và xem gợi ý theo tiêu chí truy vấn. Không có bằng chứng engine cá nhân hóa từ lịch sử mua của User ở server.
- **Screen layout:** Các card/carousel tour tương tự hoặc đã xem; ảnh/tên/giá/rating và link detail.
- **Function Details:**
  - **Displayed Information:** Snapshot card trong local history có viewedAt; web key `tripri_recently_viewed_tours`, tối đa 24; có thể là giá cũ.
  - **User Actions / Data Processing:** Detail ghi/đưa tour lên đầu localStorage; helper đọc lỗi JSON thành mảng rỗng; SimilarToursSection dùng tour API theo tiêu chí của component, không ghi score recommendation vào DB.
  - **Input Validation:** Local helper loại record không có id, hỗ trợ legacy shape; không coi snapshot là giá checkout đáng tin cậy.
  - **Business Rules:** Business Rules chưa có ID: recent được lưu theo thiết bị/trình duyệt, web key không theo user; không có API đồng bộ recently-viewed server được tìm thấy. Gợi ý rule-based khác với recommendations cá nhân hóa.
  - **Permissions and Status Transitions:** Chỉ đọc/ghi storage cục bộ; không ảnh hưởng Booking/Tour. Guest có thể có lịch sử xem.
  - **Normal Cases:** Xem một tour rồi về Home thấy card recent; chọn card đọc lại detail từ API.
  - **Abnormal Cases:** Storage bị chặn/hỏng không chặn trang; snapshot cũ của tour bị ẩn vẫn phải bị detail API từ chối. Không bảo đảm history chuyển tài khoản/thiết bị tự đồng bộ hoặc bị xóa khi logout.

### 3.5 Tour Information

#### 3.5.1 View Tour Details & Departure Prices

- **Function trigger:** Card tour → `/tours/:id` hoặc link trực tiếp mang query/context search.
- **Function description:** Guest/Traveler xem nội dung và chọn lịch/nhóm khách trước booking; dữ liệu giá và remaining là thông tin tham khảo tại lúc đọc, không phải giữ chỗ.
- **Screen layout:** Gallery, tiêu đề/điểm đến/thời lượng/rating, agency/guide link, tabs lịch trình/dịch vụ/chính sách/lưu ý/giấy tờ/reviews; list dịch vụ có thể đặt thêm; sidebar ngày, giá/người, guest selector, subtotal, CTA đặt tour và booking đoàn; save/report/print theo component.
- **Function Details:**
  - **Displayed Information:** API `/tours/:id` cung cấp summary/description, images/highlights, itinerary (ngày/range/title/description/activities), inclusions/exclusions, agePricing, cancellationPolicy, travelNotes, requiredDocuments, meetingPoint, optionalServices, departures, agency/guide, ratingAvg/count. Không tự tạo nội dung chính sách khi field trống.
  - **User Actions / Data Processing:** Đổi departure/guest tính preview; default chọn ngày trong khoảng tìm kiếm nếu có, nếu không dùng ngày đầu đủ điều kiện. CTA dựng tourId/departureId/participants/adults/children/infants và sang booking; guest đi login với next.
  - **Input Validation:** Chỉ show ngày open, future, remaining>0; số khách≤min(50,remaining), ít nhất adult theo helper; age group không được bán khi price null. BE kiểm lại ở create.
  - **Business Rules:** Business Rules chưa có ID: giá adult = departure.priceOverride nếu có, ngược basePrice; child/infant ưu tiên giá tuyệt đối nếu được định nghĩa, nếu không tính tỷ lệ round. Tổng cộng cả infant vào chỗ. Breakdown dòng con/em bé tại TourBookingCard lại dùng percent trực tiếp: **GAP khi fixed price khác percent**, dù tổng dùng helper chuẩn.
  - **Permissions and Status Transitions:** APPROVED/PUBLIC; tour private/không public trả 404 cho Traveler. Không đổi DB khi chỉ xem; cache detail 30 giây có thể làm remaining cũ.
  - **Normal Cases:** Chọn lịch hợp lệ và đủ khách → thấy tổng và đi đúng checkout context.
  - **Abnormal Cases:** Không có departure hợp lệ thì CTA không đặt được; hết chỗ/chỉnh nhóm thông báo; 404 hoặc API error có trạng thái riêng. Chính sách text của tour chưa đồng nghĩa window/refund milestone được code áp dụng.

#### 3.5.2 Print Tour Information

- **Function trigger:** “In”/print link ở detail mở `/tours/:id/print` với departureId/date và guest counts.
- **Function description:** Tạo bản trình bày tour thích hợp in/lưu qua trình duyệt; không phải e-ticket, không tạo booking hay tài liệu đã thanh toán.
- **Screen layout:** TourPrintView có tiêu đề, hình/nội dung tour, lịch trình, giá/ngày/khách lựa chọn và chính sách; control in trình duyệt.
- **Function Details:**
  - **Displayed Information:** Dữ liệu tour công khai và selection từ URL; nội dung trống không được mô tả là do hệ thống bổ sung tự động.
  - **User Actions / Data Processing:** Tải tour theo id rồi dựng print view; component tự gọi `window.print()` một lần khi mount và có nút in lại; in/lưu phụ thuộc browser. Không có model PrintTicket hay file PDF server mới.
  - **Input Validation:** Query guest qua helper, departure phải được đối chiếu với tour; dữ liệu in không thay thế giá server ở create.
  - **Business Rules:** Business Rules chưa có ID: đây là thông tin tour, không xác nhận giữ chỗ, thanh toán, hoặc quyền check-in.
  - **Permissions and Status Transitions:** Public detail access; không thay trạng thái bất kỳ model nào.
  - **Normal Cases:** Tour còn public tải được, browser hiển thị trang in với selection hiện tại.
  - **Abnormal Cases:** Tour 404/lỗi không tạo vé thay thế; browser cancel print không ảnh hưởng đơn. Chất lượng trang in trên thiết bị thật UNVERIFIED.

#### 3.5.3 View Agency & Guide Profiles

- **Function trigger:** Chọn agency hoặc guide từ detail/review/chat; URL `/agencies/:id`, `/tour-guides/:id`.
- **Function description:** Cung cấp hồ sơ công khai của đơn vị tổ chức/người dẫn, tour/reviews liên quan, promotion agency và portfolio Premium guide nếu có quyền công khai.
- **Screen layout:** PublicProfilePage có avatar/tên/thông tin giới thiệu, khối tour/reviews; agency có voucher; CTA chat/report; Premium guide có phần portfolio/chứng chỉ công khai.
- **Function Details:**
  - **Displayed Information:** Các DTO public từ `/agencies/:id`, `/tour-guides/:id`; guide bio/languages/specialties/experience; thông tin doanh nghiệp public, rating/reviews và cards. Ảnh giấy phép guide private không được xuất như ảnh portfolio.
  - **User Actions / Data Processing:** GET profile, reviews theo agencyId hoặc guideId, tours theo agency; promotion từ `/agencies/:id/promotions`; Premium guide từ `/premium/guides/:id`; mở chat chuyển flow 3.13.2.
  - **Input Validation:** UUID; sai đối tượng/không có hồ sơ phù hợp trả 404 theo service. Không cho chỉnh profile người khác tại màn này.
  - **Business Rules:** Business Rules chưa có ID: public DTO khác `/users/me`; Premium guide portfolio chỉ hiện khi membership đủ hiệu lực. Không suy rating của guide là đánh giá người dẫn độc lập với booking/tour.
  - **Permissions and Status Transitions:** Guest xem public; chat/report cần Traveler permission. Không thay User/Tour khi xem.
  - **Normal Cases:** Hồ sơ hợp lệ tải các section và mở tour/chat theo link.
  - **Abnormal Cases:** Profile không tồn tại/không public báo lỗi; không có tour/review/voucher hiển thị empty tương ứng, không dựng testimonial giả.

### 3.6 Saved Tours & Cart

#### 3.6.1 Manage Saved Tours

- **Function trigger:** Biểu tượng tim trên card/detail hoặc menu “Danh sách yêu thích” → `/settings/wishlist`; `/traveler/wishlist` là route tương ứng của Traveler.
- **Function description:** Traveler lưu/bỏ lưu tour vào danh sách ở server, sau đó mở lại tour hoặc loại bỏ mục không còn quan tâm. Guest được nhắc đăng nhập; không tạo wishlist server cho guest.
- **Screen layout:** WishlistPage có collection collage, danh sách card, recently viewed và banner booking chưa hoàn tất; modal chọn collection, xác nhận bỏ lưu; skeleton, empty, API error/retry và trạng thái từng item đang xử lý.
- **Function Details:**
  - **Displayed Information:** Tour id, addedAt, available và public card từ `GET /wishlist`; tour không còn public vẫn có item với `available:false`. Không xóa âm thầm item chỉ vì tour ngừng bán.
  - **User Actions / Data Processing:** `POST /wishlist/:tourId` lưu; `DELETE /wishlist/:tourId` bỏ lưu. Server dùng unique userId/tourId, POST trùng là no-op; UI cập nhật/cache invalidation theo mutation.
  - **Input Validation:** UUID tour; POST kiểm tra tour APPROVED/PUBLIC; cap theo `WISHLIST_LIMITS.MAX_ITEMS`; list phân trang theo schema chung. Trang hiện lấy page đầu với PAGE_SIZE, không đồng nghĩa đã tải toàn bộ wishlist lớn.
  - **Business Rules:** Business Rules chưa có ID: wishlist không giữ giá/chỗ; DELETE idempotent; tour private không lưu được dù biết ID. Collection cục bộ không phải relation trong WishlistItem.
  - **Permissions and Status Transitions:** `WISHLIST_MANAGE`; user đang active, phạm vi userId từ actor. Không thay Tour/Booking.
  - **Normal Cases:** Lưu tour công khai → server có một item, tim trạng thái đã lưu; bỏ lưu → item biến mất sau cập nhật.
  - **Abnormal Cases:** Hết cap/không public/API lỗi hiện lỗi; không coi local snapshot là bằng chứng POST thành công. Wishlist nhiều hơn trang đầu có giới hạn hiển thị cần review.

#### 3.6.2 Organize Wishlist Collections

- **Function trigger:** SaveToWishlistModal chọn/tạo nhóm; WishlistPage mở menu đổi tên/xóa collection, hoặc chọn nhóm để xem tour.
- **Function description:** Tổ chức tour đã lưu thành các bộ sưu tập trên trình duyệt. Có logic lưu thật ở localStorage, nhưng không có backend collection API/model được tìm thấy.
- **Screen layout:** Collage các nhóm; modal tạo/chọn nhóm, modal đổi tên/xác nhận xóa; card tour trong nhóm và thông báo lưu.
- **Function Details:**
  - **Displayed Information:** id/name/tourIds, snapshot tours, createdAt/updatedAt; mặc định “Danh sách yêu thích”. Helper hỗ trợ suffix userId nhưng WishlistPage gọi `getWishlistCollections()` không truyền userId.
  - **User Actions / Data Processing:** Helper create/rename/delete/add/remove ghi `tripri_wishlist_collections_<suffix>`, dispatch `wishlist-collections-updated`; lưu lựa chọn gần nhất ở key riêng. Bỏ lưu server và xóa một collection là các thao tác khác nhau, không suy một thao tác tự xóa mọi bản sao.
  - **Input Validation:** Modal kiểm tra tên theo component; dữ liệu JSON không hợp lệ được xử lý fallback. Không có validation SQL cho collection hoặc giới hạn đồng bộ server.
  - **Business Rules:** Business Rules chưa có ID: local collection có thể tồn tại khác danh sách server; default group được bổ sung từ kết quả server ở một số điều kiện. Caller không truyền userId có nguy cơ dùng chung suffix `default` giữa tài khoản trên một trình duyệt.
  - **Permissions and Status Transitions:** Trang nằm sau Traveler guard; localStorage vẫn không được server authorize. Không có trạng thái collection chính thức trong DB.
  - **Normal Cases:** Tạo/đổi tên nhóm rồi reload trình duyệt thấy dữ liệu cục bộ còn lưu; chọn nhóm mở danh sách.
  - **Abnormal Cases:** Storage bị chặn/quota lỗi được helper bỏ qua, có thể không persist; không đồng bộ thiết bị; ảnh/giá snapshot có thể cũ. Phải ghi rõ đây là chức năng cục bộ, không tuyên bố account isolation đã hoàn chỉnh.

#### 3.6.3 Manage Departure Cart

- **Function trigger:** Hiện có API/client/hook cho cart; **`/traveler/cart` redirect `/tours`**, không tìm thấy component web gọi các mutation cart trong phạm vi kiểm tra.
- **Function description:** Backend hỗ trợ shortlist departure/số khách, xem giá/availability hiện tại, đổi số khách và xóa. Luồng web đầu cuối chưa hiện hữu; phân loại PARTIALLY IMPLEMENTED.
- **Screen layout:** **N/A – Non-screen function ở web hiện tại**. Route cart chuyển danh sách tour; không mô tả screenshot giỏ hàng lịch sử như màn hình còn hoạt động.
- **Function Details:**
  - **Displayed Information:** DTO API gồm items, availability, lý do không khả dụng và totals; giá tính lại từ tour/departure khi GET, không chụp cố định lúc add.
  - **User Actions / Data Processing:** `GET /cart`; `POST /cart/items {tourId,departureId,participants,guestCounts?}`; `PATCH /cart/items/:id {participants,guestCounts?}`; `DELETE /cart/items/:id`. Unique user/departure: add lại thay headcount thay vì cộng dòng. Consumer web để thao tác trực tiếp chưa tìm thấy.
  - **Input Validation:** Participants nguyên 1–50; guestCounts phải khớp pricing; thêm/đổi kiểm remaining và bookable; cap theo CART_LIMITS.MAX_ITEMS. Sửa item người khác 404, xóa item đã mất thành công im lặng.
  - **Business Rules:** Business Rules chưa có ID: cart **không reserve seats**; giữ lại dòng unavailable để caller hiển thị; checkout phải reprice bằng booking service. Không có multi-tour booking/payment nguyên khối.
  - **Permissions and Status Transitions:** `CART_MANAGE`; ownership userId. Chỉ CartItem thay đổi, remaining không giảm.
  - **Normal Cases:** Gọi API hợp lệ có dòng shortlist, GET trả giá live; unit test service kiểm tra nhánh này.
  - **Abnormal Cases:** Full cart, closed/sold-out, group pricing sai trả 409/validation; trên web người dùng vào cart chỉ được redirect. Tài liệu không được khẳng định có màn giỏ hoạt động.

### 3.7 Booking & Checkout

#### 3.7.1 Select Guests & Enter Passenger Details

- **Function trigger:** “Đặt tour” tại detail → `/traveler/bookings/new?tourId=...&departureId=...&participants=...&adults=...&children=...&infants=...`; chọn/đổi lịch và đi từ bước 1 sang bước 2.
- **Function description:** Traveler đã xác thực email chọn số khách và điền người liên hệ cùng danh sách người tham gia. Đây là bước chuẩn bị; chưa giữ chỗ trước khi tạo Booking.
- **Screen layout:** BookingEntryPage có stepper ba bước: kiểm tra lựa chọn → thông tin → xác nhận/thanh toán; sidebar summary. Bước thông tin có contact name/phone/email/gender, từng passenger name/birthYear/age label/special notes, ghi chú, thông tin VAT tùy chọn, dịch vụ thêm.
- **Function Details:**
  - **Displayed Information:** Ngày/giá/remaining, nhóm người lớn/trẻ em/em bé; tạo số card passenger bằng participants. Tuổi suy từ **năm khởi hành − năm sinh**, không phải tính theo ngày sinh đầy đủ; năm sinh không bắt buộc ở FE.
  - **User Actions / Data Processing:** Đổi số khách đồng bộ số card; kiểm lỗi rồi sang bước3. Payload gửi passengerId/fullName/birthYear?/ageGroup/phone/specialNotes? vào `passengers`; contact chỉ gửi fullName/phone. Contact email/gender không có cột lưu tương ứng; VAT ghép company/taxId/email vào notes và cắt tối đa500 ký tự; vatAddress được hỏi nhưng không ghép vào payload.
  - **Input Validation:** FE buộc tên từng người ≥2 ở chuyển bước; email/phone contact đúng format, birthYear có thì4 số,1900..năm khởi hành, đúng nhóm tuổi. Khi chọn VAT, FE buộc company/taxId/email hợp lệ/address; xác nhận buộc agreedToTerms nhưng không gửi policy acceptance version từ checkbox này. BE tên2–120; birthYear optional1900..năm hiện tại; ageGroup enum; phone regex; passenger array optional1–50. BE chỉ chặn **dư** passenger, không buộc **đủ** khi không có services; không kiểm tuổi theo birthYear ở booking thường.
  - **Business Rules:** Business Rules chưa có ID: participants = adults+children+infants, tất cả đều chiếm chỗ; ít nhất một adult, tổng≤50. Không có agePricing thì không nhận trẻ em/em bé; giá tuyệt đối null khóa nhóm, giá 0 được hỗ trợ nếu tour subtotal/payable đạt điều kiện.
  - **Permissions and Status Transitions:** FE RoleGuard TRAVELER; create/quote API cần booking:create + verified Traveler. Form không đổi trạng thái Booking khi chưa submit create.
  - **Normal Cases:** Chọn 4 khách → FE tạo 4 card, thiếu tên bất kỳ bị chặn sang bước 3; danh sách hợp lệ gửi cùng booking.
  - **Abnormal Cases:** **GAP bắt buộc ghi:** API nhận participants=4 với passengers bị bỏ hoặc chỉ có 1 người nếu không chọn dịch vụ. Không được coi quy tắc đủ người đã triển khai xuyên suốt. BE giới hạn năm hiện tại có thể từ chối em bé sinh vào năm khởi hành tương lai dù FE cho phép.

#### 3.7.2 Select Optional Services & Request Quote

- **Function trigger:** Bước 2 chọn dịch vụ bổ sung; trước create, bước 3 gọi báo giá `POST /bookings/quote`.
- **Function description:** Cho phép chọn đưa đón/ăn uống/thiết bị/dịch vụ khác theo tour và nhận tính toán từ server mà không giữ chỗ hay tiêu thụ voucher.
- **Screen layout:** BookingExtras liệt kê dịch vụ active, giá/đơn vị/mô tả, checkbox hành khách hoặc quantity; PICKUP có điểm đón/địa chỉ theo cấu hình. Summary tách tiền tour, dịch vụ, giảm giá; lỗi điều kiện dịch vụ hiện tại form.
- **Function Details:**
  - **Displayed Information:** Tour.optionalServices: kind, pricing PER_PERSON/PER_BOOKING/PER_UNIT, unit, price, cutoffHours, maxQuantity, ages; khu vực/điểm đón/hướng dẫn. Quote trả tourSubtotal/servicesSubtotal/services/beforeDiscount; không có discount preview đầy đủ trong response quote.
  - **User Actions / Data Processing:** Gửi serviceId/terms/passengerIds/quantity/pickups và booking shape. `quoteExtras` so terms hiện tại, tính quantity theo kiểu giá, trả snapshot người dùng dịch vụ và total. FE so quote với preview; create có expectedTourSubtotal để phát hiện đổi giá tour.
  - **Input Validation:** Chọn services thì phải đủ passengerId cho toàn roster; không trùng id/dịch vụ/người; nhóm tuổi được phép; quantity nguyên 1..maxQuantity; trước cutoff. Địa chỉ đón 5–300; POINT phải nằm trong points, mỗi người chỉ một pickup service; cấm pickupPoint tự do ngoài service.
  - **Business Rules:** Business Rules chưa có ID: dịch vụ thu phí riêng, **không nằm trong subtotal giảm voucher tour**. PER_BOOKING quantity=1; PER_PERSON bằng số người chọn; PER_UNIT lấy quantity. Free service có thể total=0; dịch vụ inactive/terms đổi bị chặn.
  - **Permissions and Status Transitions:** Quyền và verified như create; quote không decrement remaining, không tạo Booking/PromotionRedemption. Create đọc/khóa terms service lại trong transaction.
  - **Normal Cases:** 5 người, chỉ 3 chọn pickup → tiền pickup tính 3 người; booking/ticket lưu đúng snapshot và điểm đón.
  - **Abnormal Cases:** Hết chỗ/giá đổi/ngừng dịch vụ/hết cutoff trả conflict; FE yêu cầu xem lại. Không mô tả quote là bảo đảm giữ được giá/chỗ đến lần submit sau.

#### 3.7.3 Confirm Booking & Reserve Seats

- **Function trigger:** Traveler xác nhận ở bước 3; FE chặn submission đang chạy và dùng clientRequestId để retry cùng yêu cầu.
- **Function description:** Tạo Booking từ giá server, reserve số chỗ và snapshot dữ liệu để bắt đầu thời gian thanh toán. Thành công tạo đơn PENDING, không đồng nghĩa đã thanh toán.
- **Screen layout:** Review thông tin tour/lịch/khách/contact/services/voucher/notes và tổng tiền; nút xác nhận, busy, lỗi; khi có đơn pending trùng có link mở đơn đó. Tạo thành công mở PayOS; nếu mở thanh toán lỗi chuyển chi tiết đơn.
- **Function Details:**
  - **Displayed Information:** Subtotal tuổi, giảm agency/platform hoặc Premium, servicesSubtotal, total; mã đơn do server tạo dạng `TRP-` + 8 ký tự đọc rõ; deadline 15 phút.
  - **User Actions / Data Processing:** `POST /bookings` gửi IDs/headcount/contact/passengers/services/promo keys/expectedTourSubtotal/clientRequestId. Service đọc bookable departure, reprice, kiểm pending trùng, reserve remaining atomically, rồi transaction tạo Booking/redemptions/claim voucher, snapshot cancellation và commission. Thành công gửi notification, trả Booking DTO; email/gender contact không persist.
  - **Input Validation:** Participants 1–50/guest sum/age pricing, remaining; tour APPROVED/PUBLIC và departure open/future. Không tin client total/price; unknown fields bị strict schema từ chối. clientRequestId 8–64 chữ/số/_/-; key cũ khác fingerprint trả `BOOKING_REQUEST_CHANGED`.
  - **Business Rules:** Business Rules chưa có ID: tourSubtotal = A×adultPrice+C×childPrice+I×infantPrice; `totalAmount=max(0,tourSubtotal-discountAmount)+servicesSubtotal`, tối thiểu 1 VND. Một Traveler không có hai PENDING cùng tour/departure; idempotency key cùng payload trả lại đơn. Reserve trước transaction, thất bại có compensation release, không phải một transaction SQL bao phủ mọi thao tác.
  - **Permissions and Status Transitions:** verified Traveler; owner lấy từ actor. Booking PENDING, isPaid=false, paymentExpiresAt=now+15 phút; snapshot/endDate=departure+durationDays×24h.
  - **Normal Cases:** Tạo đúng một đơn, giảm đủ tổng chỗ; replay key không tạo thêm/khấu trừ thêm; lỗi notification sau commit không làm mất đơn.
  - **Abnormal Cases:** NOT_ENOUGH_SEATS, PENDING_BOOKING_EXISTS, quote đổi, voucher hết lượt hoặc transaction lỗi trả lỗi; compensation thất bại được log, chưa thấy durable repair riêng cho orphan seat hold. Crash giữa reserve và persist còn rủi ro chưa được loại bỏ bằng unit test.

#### 3.7.4 Expire Unpaid Holds

- **Function trigger:** Job `bookings.expirePending` mỗi phút; không cần người dùng mở trang.
- **Function description:** Giải phóng đơn PENDING vượt paymentExpiresAt, chỗ và ưu đãi gắn với đơn; không tạo enum Booking EXPIRED mới.
- **Screen layout:** **N/A – Non-screen function**; kết quả thấy ở history/detail và thông báo hết hạn.
- **Function Details:**
  - **Displayed Information:** Booking CANCELLED, cancelReason PAYMENT_EXPIRED, cancelledAt; frontend có lời nhắc đặt lại và không thanh toán đơn hết hạn.
  - **User Actions / Data Processing:** Sweep batch 100; conditional transition chỉ PENDING; release promotion trong transaction cancel, sau đó release Premium/remaining và emit cancelled; gửi notification. Ticket VALID bị cancel theo repository/event lifecycle.
  - **Input Validation:** Deadline≤now và status còn PENDING khi cập nhật; snapshot đã stale không được cancel một đơn vừa CONFIRMED.
  - **Business Rules:** Business Rules chưa có ID: giữ chỗ 15 phút tính từ Booking.create, không tính từ lần xem trang; job một phút có thể làm giải phóng muộn hơn deadline. Payable guard vẫn từ chối ngay khi quá hạn trước khi job quét.
  - **Permissions and Status Transitions:** Tác vụ hệ thống; PENDING→CANCELLED, paymentExpiresAt=null. Không hồi sinh khi tiền đến muộn.
  - **Normal Cases:** Đơn không thanh toán hết 15 phút được quét, inventory/voucher giải phóng một lần khi CAS thắng.
  - **Abnormal Cases:** Một item lỗi được log rồi tiếp tục; không bảo đảm seat compensation nguyên tử với status khi lỗi sau commit. Tiền đến muộn chuyển sang xử lý refundRequired, không confirm lại booking.

#### 3.7.5 Resume Incomplete Booking

- **Function trigger:** WishlistPage render IncompleteBookingBanner; Traveler chọn banner “Hoàn tất quy trình đặt tour”.
- **Function description:** Dẫn về đơn chưa thanh toán hoặc form đoàn đã chấp nhận chưa có booking. Đây là resume từ dữ liệu server đã tồn tại, không phải auto-save toàn bộ form booking thường chưa submit.
- **Screen layout:** Banner ảnh/tên tour, ngày đi/kết thúc, số khách và mũi tên; không hiển thị khi query còn loading hoặc chưa có target phù hợp.
- **Function Details:**
  - **Displayed Information:** Chọn từ5 Booking đầu và5 CustomTourRequest ACCEPTED đầu; ưu tiên booking PENDING hoặc chưa paid chưa CANCELLED, nếu không có thì chọn request chưa currentBooking. Tên/ảnh thiếu dùng fallback hiển thị.
  - **User Actions / Data Processing:** GET `/bookings/me?limit=5`, `/custom-tours?status=ACCEPTED&limit=5`; click mở `/settings/history/:bookingId` hoặc `/traveler/bookings/new?customTourRequestId=:id`. Không tạo/cập nhật Booking khi render banner.
  - **Input Validation:** Owner filter server; không có input form riêng. Target booking có thể vừa thay trạng thái nên detail/checkout vẫn kiểm lại.
  - **Business Rules:** Business Rules chưa có ID: không query status=PENDING riêng cho list booking, nên pending cũ hơn5 đơn mới có thể bị bỏ qua; group cũng giới hạn trang đầu. Không tìm thấy local draft passenger/contact thường trong BookingEntryPage để khôi phục sau reload.
  - **Permissions and Status Transitions:** Trang Traveler; GET own, không thay trạng thái hoặc kéo dài payment deadline.
  - **Normal Cases:** Đơn pending trong tập đã tải có banner dẫn đúng detail; offer accepted chưa có booking dẫn đúng roster đoàn đã lưu server.
  - **Abnormal Cases:** Query lỗi/target ngoài page đầu có thể không có banner; đơn expired phải xử lý trạng thái hiện tại ở detail. Form thường chưa submit có thể mất khi reload, không được mô tả như draft server.

### 3.8 Payment

#### 3.8.1 Open & Retry PayOS Checkout

- **Function trigger:** Sau create, nút thanh toán ở history/detail hoặc thử lại từ `/payment/success`/`/payment/cancel`.
- **Function description:** Tạo/tái sử dụng payment link PayOS cho chính Booking PENDING còn hạn của Traveler; trang return chỉ đọc kết quả server, không quyết định theo chữ “success” trên URL.
- **Screen layout:** Redirect sang PayOS; PaymentReturnPage hiển thị loading, PAID/PENDING/CANCELLED/EXPIRED/FAILED, retry, link booking; thiếu paymentId có empty state. Không có bằng chứng các gateway khác được triển khai cho web booking.
- **Function Details:**
  - **Displayed Information:** Payment id/status/amount/currency/reference, hướng về `/settings/history/:id`; paymentId được truyền trong callback URL. Poll 2,5 giây khi pending, dừng đợt tự động sau 20 giây; người dùng có thể refresh.
  - **User Actions / Data Processing:** `POST /payments/bookings/:bookingId/checkout` không nhận amount từ FE; service lấy getPayable rồi tạo/reuse Payment, gọi provider createPaymentLink, lưu checkoutUrl/order/link IDs. GET `/payments/:id` đọc owner và có thể reconcile. `openCheckout` kiểm https hoặc loopback dev; BookingEntry redirect trực tiếp response URL ở nhánh tạo mới.
  - **Input Validation:** UUID/owner, status PENDING và deadline còn hiệu lực; min payable từ booking. Pending unique index cho purpose/reference chống nhiều checkout cùng lúc.
  - **Business Rules:** Business Rules chưa có ID: trả link live hiện tại nếu đã có; timeout/5xx không chắc provider tạo link chưa thì giữ PENDING để retry an toàn; provider từ chối rõ đánh FAILED. Checkout retry không kéo dài hold của Booking.
  - **Permissions and Status Transitions:** `PAYMENT_CREATE`; đọc Payment cần auth/owner. Payment PENDING riêng với Booking PENDING; chuyển URL return/cancel không tự cancel Booking.
  - **Normal Cases:** Payment link hợp lệ mở PayOS; return lấy trạng thái server rồi về đơn; double click tái sử dụng transaction target.
  - **Abnormal Cases:** Đơn người khác 404; đã paid/cancelled/hết hạn trả BOOKING_NOT_PAYABLE/BOOKING_PAYMENT_EXPIRED. Thiếu paymentId không hiện thành công giả; provider chưa cấu hình hoặc mất mạng trả lỗi. Live gateway UNVERIFIED.

#### 3.8.2 Verify Settlement & Reconcile Payment

- **Function trigger:** `POST /payments/webhooks/payos`, owner GET payment, job poll pending mỗi 2 phút, expire/retry mỗi phút.
- **Function description:** Xác minh tiền nhận, cập nhật Payment và thực hiện nghiệp vụ đích; khôi phục missed webhook/fulfillment thất bại mà không tin kết quả từ client.
- **Screen layout:** **N/A – Non-screen function**; PaymentReturnPage/detail phản ánh trạng thái server và thời gian chờ.
- **Function Details:**
  - **Displayed Information:** Payment PAID/terminal state và fulfilledAt; Booking isPaid/status có thể chưa đồng bộ ngay nếu fulfillment lỗi. `PAID` không tự chứng minh vé đã cấp.
  - **User Actions / Data Processing:** Provider verifyWebhook kiểm chữ ký, resolve orderCode lưu trong DB, so amount chính xác; mismatch ghi failureReason AMOUNT_MISMATCH, không settle. Settle PAID bằng CAS rồi gọi booking.confirmPayment hoặc handler SUBSCRIPTION; thành công lưu fulfilledAt. Owner poll có throttle theo service; sweep pending đủ cũ (5 phút) hỏi provider.
  - **Input Validation:** Payload provider/signature, order tồn tại, số tiền đúng; poll chỉ chấp nhận remote paid khi amountPaid≥amount yêu cầu; không chấp nhận thanh toán thiếu.
  - **Business Rules:** Business Rules chưa có ID: webhook replay idempotent; money đã đến muộn vẫn ghi PAID, nhưng Booking CANCELLED hoặc quá hold không phục hồi, thay vào isPaid=true/refundRequired=true. Chưa thấy tự tính đầy đủ refundAmount cho mọi nhánh late payment.
  - **Permissions and Status Transitions:** Webhook public nhưng signature-auth/rate limit 120/phút; owner poll cần login. Booking pending còn hạn→CONFIRMED, confirmedAt và xóa deadline; terminal booking giữ terminal khi late settlement.
  - **Normal Cases:** Webhook hợp lệ confirm một đơn, gửi thông báo và emit confirmed; missed webhook được poll/job bù.
  - **Abnormal Cases:** Chữ ký sai trả lỗi; unknown order/non-success bỏ qua; provider unreachable giữ trạng thái đã biết. Fulfillment fail giữ PAID chưa fulfilled để retry; test concurrency mock không chứng minh mọi side effect exactly-once trong production.

#### 3.8.3 Issue & Repair E-ticket

- **Function trigger:** Booking confirmed event; `eTickets.retryFulfillment` mỗi phút quét paid CONFIRMED/COMPLETED thiếu ticket sau ít nhất 3 phút.
- **Function description:** Cấp một vé điện tử cho Booking và sửa lỗi cấp vé bằng dữ liệu bền vững; không phụ thuộc người dùng phải ở lại trang payment.
- **Screen layout:** **N/A – Non-screen function**; vé xuất hiện ở danh sách/detail, notification và email khi gửi được.
- **Function Details:**
  - **Displayed Information:** Ticket code, bookingCode, tour/date, participants, holderName, status; meetingPoint/services gắn từ booking context khi DTO được dựng.
  - **User Actions / Data Processing:** Repository khóa row booking, kiểm paid/status, insert ETicket unique bookingId/code và đánh fulfillment. Notify ETICKET_ISSUED/email. Retry đọc booking thiếu vé, cấp lại; failed attempt tăng fulfillmentAttempts, FAILED và nextAttemptAt=now+3 phút.
  - **Input Validation:** Issue thường yêu cầu paid+CONFIRMED; repair cho COMPLETED có đường nội bộ tạo USED. Không tin stale event cho booking đã cancel.
  - **Business Rules:** Các nhãn đã tồn tại: BOOK-003/BOOK-012/PAY-004 trong test/docs; Business Rules chưa có BR ID: một ticket/booking, không một ticket/passenger. Cancel và issue đồng thời dùng guard/lock; hoàn tất chuyển VALID→USED, cancel chuyển VALID→CANCELLED. Check-in có usedAt nhưng vé còn VALID cho tới completion.
  - **Permissions and Status Transitions:** System consumer/job; Traveler không gọi API issue tùy ý. Chỉ đọc vé own ở 3.9.2.
  - **Normal Cases:** Thanh toán đúng → vé VALID; repair thiếu vé tạo đúng một bản dù nhiều worker; completed lịch sử repair thành USED.
  - **Abnormal Cases:** Storage/provider mail lỗi không được biến thành “vé chắc chắn đã giao qua email”; retry vé dựa missing ticket, không tự gửi lại email nếu vé đã tồn tại nhưng lần notify thất bại. Booking cancelled không repair thành vé hợp lệ.

### 3.9 Trip Management

#### 3.9.1 View Booking History & Details

- **Function trigger:** Menu “Chuyến đi” → `/settings/history`, chọn card → `/settings/history/:id`; route `/traveler/bookings[/id]` dùng chức năng tương ứng.
- **Function description:** Traveler theo dõi đơn của mình, trạng thái thanh toán, hành khách, dịch vụ và hành động sau đặt. List/detail đọc dữ liệu server, không phải các card mẫu.
- **Screen layout:** List tabs Tất cả/Chờ thanh toán/Đã xác nhận/Đã hoàn thành/Đã hủy, refresh, card và pagination 10; detail chia tour/departure/contact/passengers/price/services/status/timestamps, các CTA payment/cancel/complete/review/ticket theo trạng thái, modal xác nhận và feedback.
- **Function Details:**
  - **Displayed Information:** Booking code/status, tour title/images, departure/endDate/participants, contact, guestPricing/services/meetingPoint, notes, subtotal/discount/services/total, deadline, cancelledAt/reason/refundRequired. Danh sách người hiển thị từ `booking.passengers` relation BookingPassenger (flow đoàn); **passengerSnapshot booking thường chưa được toBookingDto ánh xạ vào đây**. refundAmount/cancelNote/cancellationPolicySnapshot có trong storage nhưng không được own DTO xuất. Giá snapshot không đổi theo basePrice mới; images có thể lấy Tour hiện tại.
  - **User Actions / Data Processing:** `GET /bookings/me {status?,page,limit}`; `GET /bookings/:id`. Đổi tab reset trang; refresh gọi lại query. Hành động liên quan dùng functions tương ứng; reviewedBookingIds ở list lấy tối đa 100 review đầu.
  - **Input Validation:** Status phải thuộc BookingStatus; ID UUID; owner từ token; filter booking cá nhân BE chỉ status/pagination, không tự nhận keyword/date như agency list.
  - **Business Rules:** Business Rules chưa có ID: tên tour/ngày/headcount/tiền là dữ liệu snapshot; hết hạn là CANCELLED+PAYMENT_EXPIRED. Không có API Traveler sửa số người/lịch/contact/passenger sau tạo được tìm thấy.
  - **Permissions and Status Transitions:** `BOOKING_VIEW_OWN`; không truy cập booking người khác (404). GET không đổi trạng thái trừ các consumer nền độc lập.
  - **Normal Cases:** List trả đúng owner, detail đúng đơn; hành động thành công làm refresh/cache update và feedback.
  - **Abnormal Cases:** Loading có skeleton; không có đơn có empty; request lỗi hiện ErrorState/retry. Nút review có thể dựa tập 100 review chưa đầy đủ, backend vẫn chặn duplicate; ID không tồn tại/người khác không lộ dữ liệu.

#### 3.9.2 View E-ticket & Offline Copy

- **Function trigger:** Menu vé `/traveler/tickets`, mở `/traveler/tickets/:id` hoặc `/settings/history/:id/ticket`; button vé từ booking.
- **Function description:** Xem vé own và QR để xuất trình; list có cache khi lỗi mạng cho dữ liệu đã đọc. Không tìm thấy API tải file PDF vé riêng ở server.
- **Screen layout:** List có filter trạng thái, card/QR và phân trang; ETicketView/ETicketCard hiển thị booking/tour/date/holder/headcount/status/code/QR, services/meetingPoint; trạng thái chưa đủ điều kiện hoặc không tìm thấy. Control in/lưu ở card nếu có là client, không phải server PDF endpoint.
- **Function Details:**
  - **Displayed Information:** ETicket.code là giá trị QR ổn định; status VALID/USED/CANCELLED, issuedAt/usedAt; QR list chỉ render khi VALID. Hiển thị số khách cho cả booking, không liệt kê mỗi người một QR.
  - **User Actions / Data Processing:** `GET /e-tickets {status?,page,limit}`, `/e-tickets/:id`, `/e-tickets/booking/:bookingId`; list cache localStorage có key theo user/page/filter; detail ticketByBooking có query booking bổ sung để giải thích chưa eligible.
  - **Input Validation:** UUID/status/filter; owner kiểm server. Cache chỉ dùng với loại lỗi mạng được phép, không dùng để vượt 401/403/404.
  - **Business Rules:** Business Rules chưa có ID: bản offline có thể cũ, check-in server kiểm tra hiệu lực/đã dùng; QR không xoay vòng. Ticket USED/CANCELLED vẫn là lịch sử own, không đồng nghĩa có quyền đi tour.
  - **Permissions and Status Transitions:** `ETICKET_VIEW_OWN`; Traveler không được scan/check-in (`GUIDE_CHECK_IN`). Xem/in không chuyển VALID→USED.
  - **Normal Cases:** Đơn đã cấp vé → xem code/QR; lỗi kết nối list có cache phù hợp → hiển thị cảnh báo bản đã lưu.
  - **Abnormal Cases:** Paid nhưng vé chưa cấp có thông báo không tìm thấy/chưa phát hành, không dựng QR booking giả. Detail thiếu ticket của COMPLETED còn nhánh eligibility tổng quát cần review; server vẫn là nguồn trạng thái cuối.

#### 3.9.3 Confirm Trip Completion

- **Function trigger:** CTA hoàn thành ở history/detail và CompleteBookingModal; tự động bởi `bookings.completeFinished` mỗi 5 phút.
- **Function description:** Xác nhận chuyến đã kết thúc để hoàn tất booking và mở quyền review; không phải nút cho phép hoàn thành trước ngày kết thúc.
- **Screen layout:** Modal xác nhận; success feedback và mở WriteReviewDialog từ history sau complete; job không có màn hình riêng.
- **Function Details:**
  - **Displayed Information:** Booking/tour và endDate; COMPLETED badge/completedAt; sau complete lời mời đánh giá.
  - **User Actions / Data Processing:** `POST /bookings/:id/complete`; service owner-check, kiểm transition/endDate, CAS update, notify Traveler và emit completed. Consumer cập nhật ticket, các nghiệp vụ Guide/earnings liên quan chạy theo event nhưng không thành chức năng Traveler riêng.
  - **Input Validation:** Booking CONFIRMED, endDate≤now; repository cũng có guard completion theo thời gian. Booking COMPLETED lặp lại không tạo transition thứ hai.
  - **Business Rules:** Nhãn BOOK-012/TOUR-008 đã có trong docs/tests; chưa có BR ID chính thức: only ended confirmed trip; endDate dựa durationDays×24h snapshot, không dựa “ngày cuối” suy từ lịch trình text.
  - **Permissions and Status Transitions:** BOOKING_VIEW_OWN; CONFIRMED→COMPLETED, completedAt; ticket VALID→USED. API người khác 404.
  - **Normal Cases:** Chuyến đã kết thúc → completed, sau đó review đủ điều kiện; job xử lý nếu Traveler không bấm.
  - **Abnormal Cases:** TRIP_NOT_ENDED, invalid transition, CONCURRENT_UPDATE; lỗi event consumer được log, không coi completion đã rollback. Review service kiểm ngày lần nữa cho dữ liệu legacy sai.

### 3.10 Cancellation & Refund

#### 3.10.1 Cancel Booking

- **Function trigger:** Hủy tại history/detail → CancelBookingModal → xác nhận; hệ thống hết hạn dùng 3.7.4.
- **Function description:** Owner hủy Booking PENDING hoặc CONFIRMED trong điều kiện cho phép, giải phóng chỗ/ưu đãi và ghi dữ liệu hủy. Đây là thao tác hủy trực tiếp, không có trạng thái “yêu cầu hủy chờ agency duyệt” riêng.
- **Screen layout:** Modal thông tin mã/tour, cảnh báo loại đơn đã/chưa thanh toán, reason optional, Đóng/Xác nhận, busy; thành công/catch lỗi trên màn cha. Không có bảng tiền hoàn dự kiến server trước xác nhận ở modal hiện tại.
- **Function Details:**
  - **Displayed Information:** Sau hủy, DTO own hiển thị CANCELLED/cancelledAt/cancelReason/refundRequired. Storage còn có cancelNote và refundAmount nếu paid; **hai field này không được toBookingDto xuất cho Traveler** ở baseline.
  - **User Actions / Data Processing:** `POST /bookings/:id/cancel {reason?}`; assert transition; confirmed đọc cancellationWindowHours từ snapshot (legacy fallback24); load refund milestones từ policy hiện tại; CAS CANCELLED, release promo cùng transaction, sau đó release Premium/remaining và emit cancelled, notify agency.
  - **Input Validation:** Reason trim≤500; confirmed có `(departureDate-now)/hour >= cancellationWindowHours`; đúng bằng ngưỡng được phép vì code chặn khi `<`. Completed/cancelled không cancel được.
  - **Business Rules:** Business Rules chưa có ID: booking cancellation window snapshot khác tour.cancellationPolicy text; **milestones refund lại đọc policy hiện tại**, không snapshot cùng thời điểm mua. Release remaining dùng LEAST(capacity,remaining+participants); không cho cộng vượt capacity. Hủy không phải gọi ngân hàng trả tiền.
  - **Permissions and Status Transitions:** BOOKING_VIEW_OWN, owner; PENDING/CONFIRMED→CANCELLED; ticket VALID→CANCELLED có bảo vệ ở repository. paymentExpiresAt=null.
  - **Normal Cases:** Pending hủy giải phóng chỗ; confirmed đủ sớm hủy và đánh refundRequired/amount; thao tác đồng thời chỉ CAS winner thực hiện release chính.
  - **Abnormal Cases:** CANCELLATION_WINDOW_PASSED, invalid transition, owner404, CONCURRENT_UPDATE; lý do quá dài do BE chặn (textarea chưa có maxLength tương đương). Release chỗ/Premium sau transaction bị lỗi có nguy cơ lệch trạng thái, chưa có job bù chuyên biệt được tìm thấy.

#### 3.10.2 Track Booking Refund Requirement

- **Function trigger:** Xem booking paid đã hủy hoặc late payment tại detail; complaint resolution có thể ghi yêu cầu hoàn liên quan.
- **Function description:** Cho Traveler biết có yêu cầu hoàn tiền/số tiền ghi nhận. Backend có flag/amount và RefundLedger cho một số nguồn; chưa có luồng booking refund tự động chuyển tiền và theo dõi payout đầy đủ ở web.
- **Screen layout:** BookingDetail badge/banner “đang xử lý hoàn tiền” và trạng thái đơn; không tìm thấy bảng tiến độ refund booking với transfer reference/processedAt cho Traveler.
- **Function Details:**
  - **Displayed Information:** refundRequired và cancelReason trong own DTO; `refundAmount` lưu ở DB nhưng toBookingDto chưa xuất, nên Traveler web chưa thấy số tiền này từ API own. Câu “hệ thống đang xử lý” trên UI không chứng minh đã gửi lệnh chuyển tiền.
  - **User Actions / Data Processing:** Cancel paid tính `floor(totalAmount×percent/100)` không âm; mặc định milestones ≥7 ngày100%, ≥3 ngày50%, còn lại0%. DaysLeft là số thực từ milliseconds, không làm tròn ngày trước so. Cancellation window vẫn có thể chặn trước công thức. Complaint có thể tạo RefundLedger PENDING và cập nhật Booking flag/amount.
  - **Input Validation:** Milestones được load từ policy JSON có daysBefore/percent numeric hoặc fallback; không suy tour text chứa tỷ lệ là công thức được chạy. Late settlement có thể chỉ flag mà chưa có refundAmount.
  - **Business Rules:** D-15 ghi refund money movement ngoài phạm vi; đây là giới hạn thực tế. Nếu 0% vẫn có thể refundRequired=true với amount0 theo cancellation code. Công thức dùng totalAmount đã giảm và gồm services, không có service refund split riêng.
  - **Permissions and Status Transitions:** Owner xem booking; không có POST tự xác nhận “đã hoàn” cho Traveler. Payment PAID có thể đi cùng Booking CANCELLED/refundRequired.
  - **Normal Cases:** Paid hủy đủ điều kiện thấy flag và dữ liệu ghi nhận; hỗ trợ vận hành xử lý ngoài hệ thống tùy nguồn.
  - **Abnormal Cases:** Thiếu amount/ledger hoặc chưa processed không được trình bày là refund completed; không có cơ sở cam kết SLA hoặc tự trả về tài khoản PayOS. Premium refund là flow khác tại 3.16.4.

### 3.11 Voucher & Promotion

#### 3.11.1 Discover & Collect Vouchers

- **Function trigger:** Home HotVouchersSection, voucher agency tại public profile hoặc voucher selector khi checkout; chọn lưu voucher.
- **Function description:** Xem ưu đãi công khai và lưu liên kết voucher vào ví tài khoản. Lưu không đồng nghĩa voucher đủ điều kiện cho một đơn cụ thể và không tiêu thụ lượt dùng.
- **Screen layout:** Card mã/title/giá trị giảm/đơn tối thiểu/hạn dùng, nút lưu và feedback; checkout có ShopeePromotionModal chia ưu đãi agency/platform và voucher trong ví.
- **Function Details:**
  - **Displayed Information:** Promotion.scope, code/title/description, discountType/value/maxDiscountAmount, minOrderAmount, startsAt/endsAt, quota và điều kiện được DTO cung cấp; hot/agency list lọc ưu đãi public đang chạy còn lượt.
  - **User Actions / Data Processing:** Guest `GET /promotions/hot`, `/agencies/:id/promotions`; Traveler `POST /promotions/collect {promotionId}`. Service tìm promotion active, upsert UserVoucher unique userId/promotionId, gửi VOUCHER_COLLECTED; không reserve inventory.
  - **Input Validation:** promotionId UUID; collect chỉ kiểm tồn tại/isActive trong service, không áp toàn bộ thời hạn/min order/role eligibility của checkout. Có thể lưu promotion active nhưng chưa tới ngày dùng.
  - **Business Rules:** Business Rules chưa có ID: collect idempotent ở row, nhưng notify có thể được gửi lại khi gọi collect lặp; phải kiểm eligibility lại lúc preview/redeem. Không bảo đảm có lượt giảm giá chỉ vì đã lưu vào ví.
  - **Permissions and Status Transitions:** Xem public không login; collect cần BOOKING_CREATE permission; UserVoucher mới isUsed mặc định false, không đổi usedCount của Promotion.
  - **Normal Cases:** Voucher active được lưu một lần trong ví, UI phản ánh đã lưu và có thông báo.
  - **Abnormal Cases:** Không tồn tại/inactive trả404; lỗi request hiện lỗi ở consumer. Hết hạn/chưa bắt đầu có thể vẫn collect theo service, không được viết như backend đã chặn tất cả tại collect.

#### 3.11.2 View Voucher Wallet

- **Function trigger:** `/settings/vouchers` từ account nav; chọn tab Khả dụng/Đã sử dụng/Hết hạn hoặc refresh.
- **Function description:** Hiển thị voucher thường đã collect và section Premium riêng. Phân loại tab thông qua UserVoucher và Promotion; hiện còn thiếu đồng bộ “đã sử dụng” với redemption booking.
- **Screen layout:** Tiêu đề/refresh, ba tab kèm count, VoucherCard, skeleton và empty CTA khám phá; PremiumWalletSection dưới danh sách.
- **Function Details:**
  - **Displayed Information:** UserVoucher.id/collectedAt/isUsed/usedAt/bookingId + promotion; tab used ưu tiên isUsed; expired nếu endsAt≤now hoặc inactive; còn lại active. Active không kiểm startsAt/min spend/quota, do đó nhãn “khả dụng” không xác nhận áp được.
  - **User Actions / Data Processing:** `GET /promotions/my-vouchers` trả toàn bộ voucher own; filter ở browser; refresh query. Premium đọc `/premium/me/vouchers` bằng query riêng.
  - **Input Validation:** Không nhập dữ liệu ở thao tác xem; bỏ bản ghi không có promotion; dữ liệu ngày dùng Date. Không có pagination wallet thường ở endpoint này.
  - **Business Rules:** Business Rules chưa có ID: `UserVoucher.isUsed` khác `PromotionCodeInstance.isUsed`. Tìm trong promotions/bookings cho thấy redeem cập nhật code-instance/quota/redemptions, **không thấy cập nhật UserVoucher.isUsed/usedAt/bookingId**; used tab có thể không theo đúng đơn đã dùng. Không được khẳng định single-use wallet hoàn chỉnh.
  - **Permissions and Status Transitions:** BOOKING_CREATE; owner theo actor. GET wallet thường không consume; GET Premium có thể grantDue idempotent.
  - **Normal Cases:** Voucher đã collect xuất hiện đúng dữ liệu trả; chuyển tab lọc bộ dữ liệu; Premium có trạng thái/loading/error riêng.
  - **Abnormal Cases:** Wallet thường không xử lý isError thành ErrorState riêng, response lỗi có thể trông như ví rỗng. Voucher thực tế hết quota vẫn có thể ở active tab; redemption BE phải chặn.

#### 3.11.3 Apply & Release Booking Discounts

- **Function trigger:** Nhập/chọn mã ở checkout; preview khi xác nhận; create booking redeem; cancel/expiry release.
- **Function description:** Tính giảm giá hợp lệ, áp một mã agency và một mã platform hoặc một Premium voucher, lưu từng redemption cho kiểm toán và trả quota khi hủy đúng owner booking.
- **Screen layout:** Hai ô mã agency/platform, chọn từ modal/wallet, kết quả áp/xóa, discount trong price summary; Premium chọn riêng và chặn phối hợp mã thường.
- **Function Details:**
  - **Displayed Information:** `/promotions/preview` trả discountAmount/finalAmount và promotion snapshot; `/available` trả danh sách và auto candidates. Hiển thị số tiền giảm tour riêng, không giảm servicesSubtotal.
  - **User Actions / Data Processing:** Preview GET gửi code/tourId/subtotal cùng context theo schema; create gửi agencyPromotionCode/platformPromotionCode hoặc legacy promotionCode. BE revalidate bằng giá server, khóa parent promotion, tiêu thụ batch code/quota và tạo PromotionRedemption cùng transaction booking. Cancel release theo redemptions/codeInstance gắn booking.
  - **Input Validation:** Mã uppercase trim `[A-Z0-9_-]{3,30}`; scope agency phải đúng tour agency; thời gian, active, targetTourIds, minOrderAmount, minParticipants, daysInAdvance, firstBookingOnly, tổng quota/per-user quota; unique code chưa dùng. Premium không cộng với bất kỳ mã thường.
  - **Business Rules:** Nhãn PAY-001/PAY-014 đã tồn tại trong test; chưa có BR ID được xác minh. Agency discount tính trước; platform tính trên phần tour còn lại. PERCENT có trần, FIXED không vượt subtotal; backend tính lại dù FE preview đã đúng. Auto-candidate do helper trả, không suy create tự chọn ưu đãi tốt nhất khi client không gửi mã.
  - **Permissions and Status Transitions:** Preview/available/collect có BOOKING_CREATE; redeem qua verified create. Unique batch instance isUsed=true gắn usedById/bookingId; cancel CAS thắng mới release, tránh trả voucher của đơn khác.
  - **Normal Cases:** Hai scope hợp lệ lưu hai redemption, cộng discount; cancel trả lượt/instance đúng booking; preview không consume.
  - **Abnormal Cases:** PROMOTION_EXPIRED/EXHAUSTED/USER_LIMIT_REACHED/CODE_USED hoặc điều kiện khác trả lỗi, transaction rollback và seat compensation. Shared voucher đã collect không bắt buộc có trong ví mới nhập được; trạng thái UserVoucher thiếu update là gap riêng 3.11.2.

### 3.12 Reviews & Ratings

#### 3.12.1 View Public & Own Reviews

- **Function trigger:** Reviews section tại detail/public agency/guide, đổi sort/page; history/detail đọc review own hoặc eligibility trước mở form.
- **Function description:** Guest xem review công khai; Traveler xem review của mình gồm cả hidden. Điểm tour phản ánh các review VISIBLE, không tính hidden.
- **Screen layout:** Rating summary/count, sao, card tác giả/ngày/comment/ảnh, sort/pagination, review own ở booking; empty/loading/error. Ảnh có viewer theo ReviewPhotos.
- **Function Details:**
  - **Displayed Information:** Rating1–5, comment/images, author public được mask qua mapper; hiddenReason/status ở own DTO phù hợp. Guide reviews truy qua Earning.bookingId/guideId để gắn chuyến đã dẫn, không đơn thuần guideAssignment hiện tại.
  - **User Actions / Data Processing:** `GET /reviews` nhận đúng một tourId/agencyId/guideId và sort newest/rating_desc/rating_asc; `GET /reviews/me` phân trang own. Backend aggregate VISIBLE, round average 2 decimals, update Tour.ratingAvg/count trong transaction tạo/moderate review.
  - **Input Validation:** UUID/filter exactly-one; sort enum; pagination chuẩn. Không cho query nhiều scope cùng lúc.
  - **Business Rules:** Business Rules chưa có ID: hidden không public nhưng vẫn là review đã tồn tại, không cho tác giả tạo thêm cho booking đó; tour stats lưu trong DB có thể được public detail cache giữ cũ đến TTL.
  - **Permissions and Status Transitions:** Public đọc reviews VISIBLE; own cần REVIEW_CREATE; không có quyền tự hide/restore. GET không đổi review.
  - **Normal Cases:** Scope đúng trả reviews/meta, đổi sort đổi thứ tự; own thấy review đã gửi dù moderator ẩn.
  - **Abnormal Cases:** Không có review có empty; lỗi/API stale có retry ở consumer. Eligibility web chỉ lấy tối đa 100 completed bookings/reviews đầu, chưa bảo đảm UI chính xác cho tài khoản vượt mức này.

#### 3.12.2 Write Review & Preserve Draft

- **Function trigger:** “Viết đánh giá” ở tour hoặc booking COMPLETED đủ điều kiện; history có thể mở dialog sau complete.
- **Function description:** Traveler đánh giá đúng booking đã đi, một lần/booking, kèm tối đa sáu ảnh; nội dung nháp được giữ qua đóng/mở trước gửi thành công.
- **Screen layout:** WriteReviewDialog chọn booking nếu có nhiều, RatingInput, textarea/count, photo picker/preview/remove, submit/cancel, lỗi; thông báo chưa đủ điều kiện/đã đánh giá.
- **Function Details:**
  - **Displayed Information:** Tour/booking context, sao1–5, comment10–2000, tối đa6 ảnh; draft phục hồi theo user/booking. Text/rating ở localStorage, file attachment dùng IndexedDB helper.
  - **User Actions / Data Processing:** POST `/reviews/images/upload-signature {bookingId}`; upload Cloudinary; `POST /reviews {bookingId,rating,comment,imagePublicIds?}`. Server kiểm owner/completed/endDate, xác minh asset thuộc user/booking, insert review và cập nhật stats trong transaction; thành công clear draft/notify agency.
  - **Input Validation:** Rating nguyên1–5; comment trim10–2000, profanity check FE/BE; image IDs≤6, unique, đúng namespace/UUID và provider verify. Không nhận URL ảnh tự do làm trusted asset.
  - **Business Rules:** Business Rules chưa có ID: completed nhưng endDate tương lai (legacy) vẫn không review; unique bookingId chặn race. Không bắt buộc phải check-in trước review theo code đã đọc. Draft không phải dữ liệu review server và có thể không persist nếu browser storage unavailable.
  - **Permissions and Status Transitions:** REVIEW_CREATE, booking own COMPLETED/endDate≤now. Tạo Review mặc định VISIBLE; không đổi Booking. Moderation là chức năng role khác.
  - **Normal Cases:** Đúng booking/sao/comment/ảnh → review lưu, stats cập nhật, form đóng và draft xóa.
  - **Abnormal Cases:** BOOKING_NOT_COMPLETED/TRIP_NOT_ENDED/REVIEW_EXISTS, sai asset/profanity/provider error chặn; error giữ dữ liệu nháp. Test draft/browser attachment runtime không được gán PASS chỉ từ đọc helper.

#### 3.12.3 Edit/Delete Own Review

- **Function trigger:** Không tìm thấy action web hoặc endpoint sửa/xóa review của Traveler trên route hiện tại.
- **Function description:** **NOT IMPLEMENTED**. Tác giả có thể xem review; report nội dung dùng 3.14.1; moderator có hide/restore nhưng không phải quyền tác giả sửa/xóa.
- **Screen layout:** N/A – Không có màn hình/chức năng được triển khai; không đặt screenshot placeholder như chức năng hoàn thiện.
- **Function Details:**
  - **Displayed Information:** N/A; review own vẫn có thể hiển thị tại history/detail.
  - **User Actions / Data Processing:** N/A; không có PATCH/DELETE own Review trong reviewsRouter.
  - **Input Validation:** N/A; không có payload sửa/xóa đã xác minh.
  - **Business Rules:** Không tự tạo quy tắc thời hạn edit/delete hoặc quyền gỡ review. Review HIDDEN vẫn chiếm unique bookingId.
  - **Permissions and Status Transitions:** Không có transition do Traveler cho thao tác này.
  - **Normal Cases:** N/A, chưa triển khai.
  - **Abnormal Cases:** Người dùng muốn sửa/xóa cần quyết định sản phẩm và triển khai; không hướng dẫn gọi moderation endpoint để thay thế.

### 3.13 Notifications & Messaging

#### 3.13.1 Read & Manage Notifications

- **Function trigger:** Đăng nhập mở chuông ở Header; click notification/đọc tất cả; socket event invalidates/reload; job gửi thông báo sự kiện nền.
- **Function description:** Traveler nhận tin booking created/confirmed/cancelled/completed, payment succeeded, ticket issued, chat, voucher collected/expiry, review moderation, report/support/complaint và group/Premium theo event thực tế của module.
- **Screen layout:** Header popover, badge count, title/body/time/icon/deep link, đọc tất cả; không tìm thấy inbox Traveler web đầy đủ với pagination/delete control dù API hỗ trợ.
- **Function Details:**
  - **Displayed Information:** GET notifications trả20 mục trang1; Header tính unread từ **20 mục đang tải**, không dùng full server unread-count cho badge này; có thể thiếu số chưa đọc cũ hơn. Lỗi query làm list=[] nên trông như không có notification.
  - **User Actions / Data Processing:** `GET /notifications {page,limit,unreadOnly?}`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, API-only `DELETE /notifications/:id`. Header update optimistic read rồi catch im lặng nếu API lỗi. notify lưu row và publish; email chỉ khi consumer/options yêu cầu, outbox cho một số transaction notification.
  - **Input Validation:** UUID/owner; unreadOnly enum string true/false; mark-read idempotent, tài nguyên người khác404.
  - **Business Rules:** Business Rules chưa có ID: in-app khác email; job purge retention180 ngày mỗi6h; voucher expiry job mỗi15 phút, phạm vi48h và urgent≤3h, chống nhắc lại trong12h. Không gán “mọi notification đều có email”.
  - **Permissions and Status Transitions:** requireAuth, owner từ actor; unread→read; delete xóa own. Không tự đổi booking khi click thông báo.
  - **Normal Cases:** Nhận sự kiện đúng owner, chọn deep link và lưu đã đọc; đọc tất cả giảm unread server.
  - **Abnormal Cases:** Request mark-read lỗi UI có thể vẫn trông đã đọc; cần refresh để reconcile; count quá20, error-as-empty và thiếu UI delete/pagination là PARTIALLY IMPLEMENTED. Websocket/mail delivery live UNVERIFIED.

#### 3.13.2 Converse with Agency or Guide

- **Function trigger:** CTA nhắn tin trên profile/tour, hoặc `/conversations` và `/conversations/:id`; group request có thể tạo thread liên quan.
- **Function description:** Traveler trao đổi với agency/guide qua REST và Socket.IO; không tìm thấy điều kiện phải có booking mới được mở hội thoại. Server bảo vệ participation, agency scope và cập nhật unread.
- **Screen layout:** Inbox trái tên/avatar/last message/time/unread, thread phải header/messages/history loader, textarea2000, send, emoji picker, ảnh preview, typing và lỗi/retry sync. Có AI entry riêng.
- **Function Details:**
  - **Displayed Information:** Conversation/participant names, messages theo thời gian, sender/time, read/unread và typing; image được biểu diễn trong message text dạng Markdown URL, không có bảng attachment độc lập.
  - **User Actions / Data Processing:** `POST /chat/conversations {participantId XOR agencyId,tourId?}`, GET list/detail/messages (cursor before,limit), POST messages `{text}`, POST read; gateway có send/read/typing/reconnect. AppendMessageAndBumpUnread cùng thao tác repository; publish cả thiết bị người gửi, thông báo khi counterpart trước đó chưa có unread.
  - **Input Validation:** Text trim1–2000, profanity; REST gửi giới hạn60/phút; image controller JPEG/PNG/WebP≤5MB. FE nhánh image dùng fetch tương đối `/api/v1/chat/upload-image` không gắn Bearer token như RTK client; khả năng upload hoạt động còn phụ thuộc proxy/auth, **chưa xác minh runtime**. URL Markdown làm tăng độ dài sau precheck2000 có thể bị BE chặn.
  - **Business Rules:** Business Rules chưa có ID: không chat chính mình; role pairing Traveler↔Guide/Agency; không có edit/delete message endpoint. Gửi lại sau kết quả bất định không có client message idempotency key được thấy, nên UI sync lịch sử trước retry để giảm duplicate.
  - **Permissions and Status Transitions:** CHAT_USE và participation; đọc/gửi thread người khác404; counterpart phải đủ điều kiện active theo service khi start. Chat không đặt tour/thay giá ngoài group workflow.
  - **Normal Cases:** Start tái sử dụng thread cùng đối tượng theo unique logic, gửi lưu message và cập nhật thread/unread các bên; read cập nhật watermark.
  - **Abnormal Cases:** Mất mạng/403/404/history error chặn hoặc báo lỗi, reconnect resync; ảnh chưa chứng minh hoạt động không được mô tả IMPLEMENTED end-to-end. Không có block-contact backend được xác minh chỉ từ state `blocked` phía client.

#### 3.13.3 Consult AI Assistant

- **Function trigger:** `/conversations/ai`, chọn cuộc AI cũ hoặc gửi câu hỏi đầu tiên từ AiThread.
- **Function description:** Traveler nhận tư vấn du lịch qua provider cấu hình và lưu lịch sử own. AI không có tool đọc inventory/giá live hoặc tạo/sửa/hủy/pay booking.
- **Screen layout:** AI entry trong inbox, thread, nhập câu hỏi, trạng thái đang tạo, câu trả lời định dạng, lỗi/retry; unread/incomplete indicator theo DTO.
- **Function Details:**
  - **Displayed Information:** AiConversation title/count/updatedAt/lastMessage/unread; AiMessage role/content/time/incomplete. Kết quả là nội dung provider, không phải báo giá được bảo đảm.
  - **User Actions / Data Processing:** `POST /ai/chat {conversationId?,message}`; GET `/ai/conversations`, `/:id`, `/ai/overview`; POST `/ai/conversations/:id/read {throughMessageId}`. Service gửi20 message context gần nhất; chỉ lưu exchange sau provider trả thành công, tránh dangling user message khi provider fail.
  - **Input Validation:** Message trim1–2000 và profanity; conversation max100 messages, reply stored≤16000, provider output token cap4096; POST chat15/phút/IP; IDs phải thuộc caller, read watermark phải là message hợp lệ của thread.
  - **Business Rules:** Business Rules chưa có ID: khi provider disabled trả503 AI_NOT_CONFIGURED; full conversation yêu cầu tạo mới; không có API xóa thread được tìm thấy. Không coi AI là search engine tour cá nhân hóa.
  - **Permissions and Status Transitions:** AI_CHAT_USE và owner; lưu AiConversation/AiMessage, read-state; không đổi Booking/Payment/Tour.
  - **Normal Cases:** Hỏi trong thread own → trả reply, lưu cặp message và cập nhật inbox/unread; chọn lại tải lịch sử.
  - **Abnormal Cases:** Provider outage/disabled/full/profanity/foreign thread trả lỗi; phản hồi incomplete được đánh dấu theo provider. Chất lượng nội dung và cấu hình provider production UNVERIFIED.

### 3.14 Reports & Assistance

#### 3.14.1 Submit & Track Reports

- **Function trigger:** ReportButton trên tour/review/public profile → ReportDialog; menu “Báo cáo của tôi” → `/settings/reports`, tab REPORTS.
- **Function description:** Traveler báo cáo tour/account/review và xem xử lý thuộc mình; đây là Report subsystem, khác ComplaintTicket đối thoại dịch vụ và SupportTicket hỗ trợ nền tảng.
- **Screen layout:** Dialog target/category/description; trang MyReportsPage có status filter/list/detail thông tin xử lý và phản hồi; tab khiếu nại dịch vụ nằm cạnh.
- **Function Details:**
  - **Displayed Information:** Target/type/category/description, createdAt/status, agency response/resolution khi có; statuses theo ReportStatus `OPEN`, `AGENCY_RESPONDED`, `RESOLVED`, `REJECTED`.
  - **User Actions / Data Processing:** `POST /reports {targetType,targetId,category,description,bookingId?}`; service resolve target, owner-check booking nếu gửi; tạo report và các liên kết phục vụ queue/notification; `GET /reports/me`, `/reports/:id` own.
  - **Input Validation:** Target/category enum, UUID, description trim10–2000; rate limit20/h; chống một report open trùng target của cùng reporter (service + unique handling).
  - **Business Rules:** Business Rules chưa có ID: không buộc đã booking cho mọi report target; optional booking ownership chưa đồng nghĩa code đã xác minh booking liên quan mọi loại target. Review report không tự xóa/hide review; moderator quyết định sau.
  - **Permissions and Status Transitions:** REPORT_CREATE; reporter owner; Traveler tạo OPEN, agency/moderator xử lý các trạng thái sau. Không tự resolve từ màn Traveler.
  - **Normal Cases:** Target tồn tại/nội dung hợp lệ → report lưu và xuất hiện trong danh sách; sau xử lý thấy phản hồi.
  - **Abnormal Cases:** REPORT_ALREADY_OPEN, target/booking404, format/rate-limit/network error báo lỗi và không tạo report giả. Không suy complaint ledger đã được tạo cho mọi report.

#### 3.14.2 Open & Discuss Tour Complaint

- **Function trigger:** ComplaintButton/dialog trên tour/booking; `/settings/reports` tab COMPLAINTS → chọn ticket mở ComplaintConversationView.
- **Function description:** Gửi khiếu nại chất lượng dịch vụ tới agency và trao đổi bằng text/ảnh có lịch sử; optional booking phải thuộc Traveler và đúng tour khi được cung cấp.
- **Screen layout:** Form category/subcategory/subject/description/evidence≤5 ảnh; danh sách status filter/refresh/pagination10; thread có summary/status/SLA/messages, gửi text/ảnh và action theo trạng thái.
- **Function Details:**
  - **Displayed Information:** Complaint code/tour/category/priority/status/createdAt, message senderRole/name/time/attachments, giải pháp đề xuất; dữ liệu own từ API, không gộp SupportTicket ID.
  - **User Actions / Data Processing:** POST `/complaints/images/upload-signature`, upload Cloudinary; POST `/complaints {tourId,bookingId?,category,subCategory,subject,description,imagePublicIds?}`; GET `/complaints/me`, `/:id`; POST `/:id/messages {text,imagePublicIds?}`. Service kiểm ảnh namespace/user, provider asset và duplicate open complaint theo logic.
  - **Input Validation:** subject5–200, subCategory2–100, description10–4000, text1–4000, images≤5; list limit≤50; create30/h, message30/phút. Chưa có yêu cầu bắt buộc COMPLETED booking cho mọi complaint vì bookingId optional.
  - **Business Rules:** Business Rules chưa có ID: CLOSED không nhận thêm message; giới hạn thread theo complaints policy; lời nhắn vào RESOLVED có thể ảnh hưởng trạng thái/thời điểm chờ theo service. Ảnh đúng namespace không tự chứng minh nội dung khiếu nại đúng sự thật.
  - **Permissions and Status Transitions:** REPORT_CREATE cho Traveler; chỉ ticket own. Agency/moderator được participation riêng; không cho Traveler mở ticket người khác qua ID.
  - **Normal Cases:** Complaint lưu/tạo hội thoại; gửi message/evidence cập nhật thread và notify đúng bên.
  - **Abnormal Cases:** Tour/booking sai404, duplicate open conflict, ảnh không sở hữu403, CLOSED/TICKET_FULL chặn; upload/API lỗi giữ thông tin theo component thay vì báo đã gửi. Không có refund tự động chỉ từ tạo complaint.

#### 3.14.3 Accept/Escalate Resolution & Submit CSAT

- **Function trigger:** Agency đánh RESOLVED → Traveler chọn chấp nhận hoặc chuyển cấp; sau CLOSED mở ComplaintCsatDialog; job auto-close mỗi15 phút.
- **Function description:** Kết thúc/leo thang tranh chấp và đánh giá chất lượng xử lý, tách biệt review tour. Agency/moderator có thể ghi nhận refund ledger nhưng chưa có chuyển tiền tự động.
- **Screen layout:** Thread hiển thị solutionSummary, action chấp nhận/chuyển cấp với reason dialog, trạng thái; CSAT rating/speed/attitude/satisfaction/comment sau đóng.
- **Function Details:**
  - **Displayed Information:** Complaint statuses OPEN/IN_PROGRESS/RESOLVED/ESCALATED/CLOSED, solution/time/refund ghi nhận, CSAT đã gửi; không nhầm rating CSAT với Tour.ratingAvg.
  - **User Actions / Data Processing:** POST `/complaints/:id/accept-resolution`, `/escalate {reason}`, `/feedback {rating,speedScore?,attitudeScore?,satisfactionScore?,comment?}`. Accept closes; escalate tạo ESCALATED và moderator notification. Agency resolve hoặc moderator adjudicate có thể tạo RefundLedger PENDING/cập nhật booking refund flag. Auto-close RESOLVED quá72h không phản hồi theo query, tạo system message/mời CSAT.
  - **Input Validation:** Escalation reason10–2000; scores nguyên1–5, comment≤1000; feedback chỉ CLOSED, một lần/ticket. Accept chỉ cập nhật khi RESOLVED; escalation chỉ OPEN/IN_PROGRESS/RESOLVED. Message thread tối đa200; Traveler reply RESOLVED chuyển IN_PROGRESS, agency reply đầu từ OPEN chuyển IN_PROGRESS/ghi firstResponseAt. CAS ngăn cập nhật trên trạng thái đã đổi.
  - **Business Rules:** Business Rules chưa có ID: auto-close là đóng khiếu nại, không complete booking; CSAT không mở quyền review tour. RefundAmount từ resolution không có BE split/services policy đã xác minh; không cam kết tiền đã trả.
  - **Permissions and Status Transitions:** Traveler owner accept/feedback; escalation cho owner/agency được phép; moderator adjudication không phải Traveler action. Xem transition map complaints cho trạng thái đầu vào, không cho chuyển tùy ý từ CLOSED.
  - **Normal Cases:** Accept RESOLVED→CLOSED rồi gửi CSAT một lần; không đồng ý có reason hợp lệ→ESCALATED để moderator xử lý.
  - **Abnormal Cases:** Status đã đổi conflict, ticket người khác404; feedback trước CLOSED TICKET_NOT_CLOSED hoặc đã gửi FEEDBACK_EXISTS. Quá72h có thể chờ tối đa chu kỳ job trước auto-close; job không cam kết SLA giao tiền.

#### 3.14.4 Create & Follow Support Ticket

- **Function trigger:** Có API Traveler tạo/theo dõi hỗ trợ; **chưa tìm thấy form/route web Traveler nối subsystem này**. `/moderator/support-tickets` là màn staff, không phải màn Traveler.
- **Function description:** Backend hỗ trợ yêu cầu hỗ trợ nền tảng và trả lời/đóng ticket own. Phân loại PARTIALLY IMPLEMENTED ở web; không dùng Complaint UI làm bằng chứng Support UI.
- **Screen layout:** **N/A – Non-screen function ở web hiện tại**; không có screenshot form Traveler được xác minh.
- **Function Details:**
  - **Displayed Information:** API DTO có support code/subject/category/status, messages và resolution; OPEN/IN_PROGRESS/RESOLVED/CLOSED.
  - **User Actions / Data Processing:** POST `/support/tickets {subject,category,message,bookingId?}`; GET `/me`, `/:id`; POST `/:id/messages {text}` và `/:id/close`. Lưu SupportTicket/SupportTicketMessage; owner reply RESOLVED có thể reopen IN_PROGRESS theo transition.
  - **Input Validation:** Subject5–200, message10–4000, reply2–4000; profanity; category BOOKING/PAYMENT/ACCOUNT/TOUR/OTHER; optional booking own; create10/h, reply30/phút; max200 messages.
  - **Business Rules:** Business Rules chưa có ID: CLOSED final; không sửa/xóa message. SupportTicket không trực tiếp thay Booking/Payment.
  - **Permissions and Status Transitions:** SUPPORT_TICKET_CREATE; owner read/reply/close; staff reply có quyền riêng. Foreign ticket404.
  - **Normal Cases:** Gọi API đúng tạo ticket, owner gửi bổ sung hoặc đóng; staff có thể nhận và phản hồi ở portal riêng.
  - **Abnormal Cases:** Closed/full/ownership/validation bị chặn; người dùng web chưa có entry chính thức để thực hiện flow trọn vẹn. Không ghi là chức năng web hoàn chỉnh chỉ vì BE có endpoint.

### 3.15 Profile & Preferences

#### 3.15.1 View/Edit Profile & Avatar

- **Function trigger:** Menu tài khoản → `/settings/profile` hoặc `/traveler/profile`; mở edit, chọn/xóa ảnh, lưu/hủy.
- **Function description:** Traveler xem hồ sơ own, cập nhật họ tên/phone và ảnh avatar qua signed upload; email, role và trạng thái không được sửa bằng profile form.
- **Screen layout:** TravelerAccountShell/nav; ProfileSummary (avatar/tên/email/thông tin tài khoản), ProfileEditForm với tên/phone/image picker, preview/error và nút lưu disabled khi không đổi; loading skeleton và API error/retry.
- **Function Details:**
  - **Displayed Information:** User.fullName/email/phone/avatarUrl/role/status cùng dữ liệu account DTO; không có birth date/gender/address cá nhân được xác minh trong Traveler profile schema. Avatar còn được dùng ở header/chat/Premium; cập nhật Redux user để đồng bộ UI.
  - **User Actions / Data Processing:** GET `/users/me`; PATCH `/users/me {fullName?,phone?}` chỉ fields thay đổi. Ảnh: POST `/users/me/avatar/upload-signature {}`, upload trực tiếp Cloudinary, POST `/users/me/avatar/complete {publicId}` để verify/lưu secureUrl; DELETE `/users/me/avatar` xóa reference/asset thuộc hệ thống.
  - **Input Validation:** Tên trim2–120; phone null hoặc regex `+?` và6–20 ký tự số/space/().-; payload nonempty/strict. FE nhận JPEG/PNG/WebP tối đa5MB; BE xác minh asset policy/ownership. Traveler gửi avatarUrl tùy ý qua PATCH bị403 dù schema chung có field đó.
  - **Business Rules:** Business Rules chưa có ID: blank phone chuyển null; update không thay role/email; không cho Traveler gửi agencyProfile/guideProfile/bankAccount để mở quyền role khác. Signed upload không lưu URL vào User cho đến complete thành công.
  - **Permissions and Status Transitions:** PROFILE_VIEW_OWN/UPDATE_OWN, active user; không thay User.status, không tự xác minh email/agency.
  - **Normal Cases:** Lưu tên/phone thành công trả private DTO; upload/complete đúng asset cập nhật avatar; xóa ảnh trở lại fallback initials.
  - **Abnormal Cases:** Validation/asset không sở hữu/provider lỗi trả lỗi; update giữ form để sửa. Delete Cloudinary có thể thất bại trước DB clear theo service, không khẳng định xóa ảnh luôn best-effort thành công.

#### 3.15.2 Change Password & Email OTP 2FA

- **Function trigger:** `/settings/profile/security` (legacy `/traveler/settings/security`) tải cài đặt và toggle 2FA; đổi mật khẩu có endpoint nhưng chưa tìm thấy form Traveler web gọi `/auth/change-password`.
- **Function description:** Xem cách xác thực và bật/tắt OTP email cho password login; backend cũng hỗ trợ đổi/đặt password rồi revoke session. 2FA web IMPLEMENTED, change-password web PARTIALLY IMPLEMENTED do thiếu entry.
- **Screen layout:** TwoFactorCard hiện passwordConfigured/googleLinked/twoFactorEnabled/method, toggle và ConfirmPasswordModal; success/error banner; không mô tả form đổi mật khẩu không tồn tại.
- **Function Details:**
  - **Displayed Information:** `GET /auth/security` trả method EMAIL_OTP cùng các cờ; không có TOTP app/SMS/passkey được xác minh.
  - **User Actions / Data Processing:** PATCH `/auth/two-factor {enabled,password?}` so password nếu user có hash rồi ghi twoFactorEnabled; không cấu hình secret TOTP. POST API-only `/auth/change-password {currentPassword,newPassword}` hash, tăng tokenVersion, revoke refresh, disconnect sockets.
  - **Input Validation:** Tài khoản password phải xác nhận đúng password khi toggle; Google-only bật2FA bị TWO_FACTOR_REQUIRES_PASSWORD. Password mới8–72 có chữ/số; currentPassword nonempty ở schema, nhưng service Google-only không compare hash vì chưa có hash.
  - **Business Rules:** Business Rules chưa có ID: 2FA áp dụng password login, không tuyên bố Google flow bắt OTP Tripri; đổi password không tự đổi User.status. Không có UI đăng xuất riêng từng thiết bị.
  - **Permissions and Status Transitions:** requireAuth; 2FA flag true/false, password change làm tokenVersion cũ hết hiệu lực; current user phải login lại sau revocation.
  - **Normal Cases:** Confirm password đúng → toggle lưu và feedback; password API hợp lệ → password mới/session bị revoke.
  - **Abnormal Cases:** INVALID_CREDENTIALS, TWO_FACTOR_REQUIRES_PASSWORD và lỗi chung hiện trong modal; close bị khóa khi đang mutate. Không khẳng định đổi mật khẩu web hoàn chỉnh chỉ vì API có.

#### 3.15.3 Configure Notification Preferences

- **Function trigger:** Có hooks/API preferences trong voucherWalletApi; chưa tìm thấy component web dùng để chỉnh freeTimeSlots/emailAlerts/voucherExpiryAlerts.
- **Function description:** Backend lưu khung giờ rảnh và lựa chọn nhắc voucher; tác vụ nền sử dụng để chọn lúc gửi. Không phải sở thích loại tour hoặc personalization engine.
- **Screen layout:** **N/A – Non-screen function ở web hiện tại**; thiếu form edit nối hooks.
- **Function Details:**
  - **Displayed Information:** API GET `/users/me/preferences` trả freeTimeSlots, voucherExpiryAlerts, emailAlerts sau merge defaults; mỗi slot có id/name/start/end/enabled.
  - **User Actions / Data Processing:** PATCH cùng endpoint với field cần đổi; merge trong User.preferences JSON giữ key khác. Job voucher sweep đọc preferences; theo múi giờ Việt Nam để so khung giờ.
  - **Input Validation:** Slot≤10; id≤50/name≤100, HH:mm hợp lệ, start<end, enabled slots không overlap; hai alert flags boolean. Không có hỗ trợ slot qua nửa đêm theo validation start<end.
  - **Business Rules:** Business Rules chưa có ID: voucher trong48h nhắc trong giờ rảnh, urgent≤3h bỏ điều kiện giờ rảnh, vẫn tôn trọng voucherExpiryAlerts=false; chống nhắc trùng12h, email theo emailAlerts. DEFAULT_USER_PREFERENCES: hai slot enabled11:45–13:00 và19:30–21:30, voucherExpiryAlerts=true, emailAlerts=false; schema vẫn cho tối đa10 slot, không giới hạn đúng2.
  - **Permissions and Status Transitions:** PROFILE_VIEW_OWN/UPDATE_OWN; sửa own preferences, không đổi booking hay trạng thái voucher.
  - **Normal Cases:** PATCH hợp lệ lưu JSON; sweep tiếp theo dùng cờ/slots đã cập nhật để chọn notification.
  - **Abnormal Cases:** Sai giờ/overlap/too many bị400; user web chưa có editor, không thể ghi rằng đã có màn cài đặt này. Việc job gửi đúng giờ production UNVERIFIED.

#### 3.15.4 Apply to Become Tour Guide

- **Function trigger:** Backend có `/users/me/guide-application`; chưa tìm thấy form Traveler web gửi application. Chức năng được ghi để không bỏ sót API dành cho người đang là Traveler.
- **Function description:** Gửi hồ sơ xin chuyển vai trò sang Guide, lưu application trong User.preferences. Quy trình phê duyệt còn có endpoint self-accept/reject mang tên dev và chưa có environment/admin guard ở route/service đã đọc.
- **Screen layout:** **N/A – Non-screen function ở web hiện tại**; không dựng màn onboarding Guide cho Traveler trong đặc tả này.
- **Function Details:**
  - **Displayed Information:** GET application trả NOT_SUBMITTED, application PENDING/REJECTED, hoặc APPROVED khi user đã là Guide; không phải UserStatus enum mới.
  - **User Actions / Data Processing:** POST `/users/me/guide-application` với licenseNumber/experienceYears?/languages?/specialties?/bio?/licenseImageUrl?; lưu preferences.guideApplication, submittedAt, notify admin. POST `/dev-accept` cập nhật role TOUR_GUIDE/GuideProfile/approved preferences; POST `/dev-reject` lưu rejection.
  - **Input Validation:** License3–100, experience0–80, languages≤20/specialties≤30, bio≤5000, image URL; AGENCY bị chặn, đã TOUR_GUIDE không apply lại; role guard chính xác theo service không được suy chỉ endpoint permission là đủ.
  - **Business Rules:** Business Rules chưa có ID: chưa có quy trình xét duyệt admin được chứng minh cho toàn flow này. Self-accept có fallback license/default data ngay cả khi application chưa đủ, cần GAP/security review; không mô tả như xác minh nghề nghiệp đáng tin cậy.
  - **Permissions and Status Transitions:** PROFILE_UPDATE_OWN/view-own; route dev không có requireSuperAdmin/env condition được tìm thấy; role đổi làm `/settings/*` Traveler guard không còn phù hợp và booking create verified Traveler không còn được phép.
  - **Normal Cases:** POST application lưu PENDING và admin có notification; GET đọc lại được hồ sơ.
  - **Abnormal Cases:** Hồ sơ sai/role không phù hợp bị chặn; **self-approval không bị chặn đúng như mong đợi** là lỗ hổng triển khai, không phải normal business case. Audit không gọi các endpoint này.

### 3.16 Premium Membership

#### 3.16.1 Browse Premium Plans & Status

- **Function trigger:** Menu “Bảng giá”/Premium → `/premium`; member mở avatar/status trong Header/Profile theo component.
- **Function description:** Guest xem gói theo audience, Traveler xem membership hiện tại và bộ voucher. Giá/thời hạn lấy từ plan trong DB, không áp bảng giá cố định từ marketing.
- **Screen layout:** PremiumPage tiêu đề/identity, selector audience cho guest, plan cards/radio/default first, price/duration/benefits/voucher quantities, CTA mua/login; status active/expired/inactive/loading/error và VoucherList.
- **Function Details:**
  - **Displayed Information:** GET `/premium/plans?audience=TRAVELER` trả id/code/name/description/version/price/durationDays/benefits/vouchers. GET `/premium/me` trả active/endsAt/current/periods/expired; hook type thu hẹp một phần response nhưng server có dữ liệu kỳ.
  - **User Actions / Data Processing:** Chọn audience/plan, xem status; public plan list chỉ khi SystemSetting `premium.enabled.TRAVELER` true; chỉ published/isActive và nguồn contribution đủ quota/APPROVED/acceptingNew.
  - **Input Validation:** Audience enum TRAVELER/TOUR_GUIDE; plan UUID khi mua. Chỉ `ACTIVE` row chưa đủ để gọi membership active nếu startsAt trong tương lai hoặc revoked.
  - **Business Rules:** Business Rules chưa có ID: continuousPremiumEnd nối các kỳ liền nhau đã thanh toán, current bắt đầu≤now; không có tier/point system Traveler được tìm thấy. Benefit text không tự chứng minh mọi dòng đã có enforcement code; quyền lợi xử lý thật được xác minh là voucher theo gói và hiển thị membership.
  - **Permissions and Status Transitions:** Plans public; status requireAuth+PROFILE_VIEW_OWN; GET status không kích hoạt kỳ mới. Non-Traveler/Guide không eligible mua.
  - **Normal Cases:** Gói đang mở còn quota hiện đúng giá; member thấy mốc liên tục đến ngày nào, voucher đã được cấp.
  - **Abnormal Cases:** Flag off/hết nguồn có list rỗng; API error có retry riêng. Không biết giá/gói production nếu không đọc data runtime; không điền số tiền giả vào đặc tả.

#### 3.16.2 Purchase/Renew Premium

- **Function trigger:** Traveler chọn gói trên `/premium` và bấm mua/gia hạn; guest có link `/login?next=/premium`.
- **Function description:** Mua thêm kỳ Premium qua PayOS dùng Payment purpose SUBSCRIPTION; kỳ sau nối sau kỳ đang có, không trừ tự động từ thẻ hay gia hạn định kỳ.
- **Screen layout:** Plan selection/CTA busy và lỗi; redirect PayOS; PaymentReturnPage phân biệt Premium subscription và dẫn về `/premium`.
- **Function Details:**
  - **Displayed Information:** Giá/duration/benefit snapshot của gói; payment status và thời hạn current. Không có setting auto-renew được xác minh.
  - **User Actions / Data Processing:** POST `/premium/subscribe {planId}`; khóa User, kiểm role/status/plan/flag, tạo hoặc reuse Subscription PENDING_PAYMENT, reserve quota contribution atomically, snapshot benefits/version/terms; createCheckout 30 phút từ subscription.createdAt. Verified payment gọi premiumService.activate, commit reservations, đặt startsAt sau kỳ active cuối hoặc now; endsAt=startsAt+durationDays×24h.
  - **Input Validation:** UUID; audience đúng role active/published; quota đủ; pending cùng plan còn hạn reuse, quá hạn yêu cầu chờ reconcile thay vì tạo trùng ngay. Không tin giá FE.
  - **Business Rules:** Business Rules chưa có ID: không dùng `/subscriptions` legacy Guide để mua Premium Traveler. Gia hạn là mua kỳ mới, không có recurring debit. Subscription đã ACTIVE trong storage nhưng chưa startsAt không cấp quyền/voucher sớm.
  - **Permissions and Status Transitions:** PREMIUM_SUBSCRIBE + profile permission/auth; PENDING_PAYMENT→ACTIVE khi paid; quá hạn/late released reservation có thể CANCELLED/revoked và PremiumRefund APPROVED, không chiếm lại quota đã bán cho người khác.
  - **Normal Cases:** Thanh toán đúng → kỳ hoạt động/được xếp tiếp, status tự phản ánh tại thời điểm bắt đầu; voucher grant khi tới kỳ.
  - **Abnormal Cases:** Hết quota/flag off/role đổi/provider lỗi trả lỗi; tiền đến sau release có refund record chứ không hứa kích hoạt. Production transaction/PayOS chưa chạy.

#### 3.16.3 Receive & Use Premium Vouchers

- **Function trigger:** Job premium.grantDue mỗi phút hoặc GET `/premium/me/vouchers`; chọn voucher Premium khi checkout tour phù hợp.
- **Function description:** Cấp bộ voucher đã snapshot cho kỳ bắt đầu, cho phép dùng một voucher vào một booking hợp lệ; lease/CAS bảo vệ dùng song song và release khi đơn hủy.
- **Screen layout:** VoucherList ở PremiumPage/PremiumWalletSection; hiển thị title/discount/tour scope/thời hạn/held-used; selector checkout và tổng giảm, không cộng mã thường.
- **Function Details:**
  - **Displayed Information:** PremiumVoucher.id/terms/startsAt/endsAt/heldAt/bookingId; terms agencyId/tourIds/discountType/value/max/minOrder. Đây là model riêng với UserVoucher và PromotionCodeInstance.
  - **User Actions / Data Processing:** grantDue tạo theo reservations khi kỳ tới; create booking gửi premiumVoucherId, service reserveVoucher owner/agency/tour/subtotal, lấy leaseToken; BookingRepository claim trong transaction; fail release lease; cancel release booking voucher; job releaseExpiredHolds dọn các hold theo trạng thái và điều kiện repository.
  - **Input Validation:** Kỳ ACTIVE chưa revoke, now trong voucher validity, đúng agency/tour/minimum; chưa held/chưa bookingId, CAS chỉ một winner. Discount percent dùng floor và cap, fixed không vượt tour subtotal.
  - **Business Rules:** Business Rules chưa có ID: Premium không cộng agency/platform code; không giảm tiền dịch vụ; voucher chỉ khả dụng trong kỳ own, không phải tất cả tour/toàn sàn. Nguồn agency ngừng bán mới không tự làm mất terms đã snapshot của kỳ đã mua.
  - **Permissions and Status Transitions:** Owner authenticated, verified create booking như3.7; heldAt/leaseToken→bookingId; hủy trả lại nếu còn điều kiện hạn dùng, không gia hạn voucher do hủy.
  - **Normal Cases:** Voucher tới kỳ được cấp một lần; đặt đúng tour giảm đúng tiền và không cho hai booking claim cùng voucher.
  - **Abnormal Cases:** Voucher expired/held/used/sai tour/minimum bị lỗi; lease lost làm rollback; cancellation release sau commit lỗi có thể chờ job phục hồi theo query, không khẳng định tuyệt đối đồng bộ ngay.

#### 3.16.4 Request Future-period Refund

- **Function trigger:** Backend `/premium/subscriptions/:id/refunds`; có history/period/client generic mutation nhưng chưa tìm thấy form refund/history Traveler được render trong PremiumPage hiện tại.
- **Function description:** Yêu cầu hoàn một kỳ đã trả tiền nhưng chưa bắt đầu; admin approve/reject/record complete. PARTIALLY IMPLEMENTED ở web; chuyển tiền thực tế là bên ngoài, không có API bank payout được gọi trong repository.
- **Screen layout:** **N/A – Non-screen function cho yêu cầu hoàn ở web hiện tại**; API history/period có thể đọc để xây UI, chưa phải màn đã nối.
- **Function Details:**
  - **Displayed Information:** GET `/premium/me/history` phân trang và GET `/premium/subscriptions/:id` có premiumRefund; trạng thái refund REQUESTED/APPROVED/REJECTED/COMPLETED và số tiền, note/reference theo stored record.
  - **User Actions / Data Processing:** POST `{reason}` upsert một PremiumRefund/subscription, amount bằng toàn price snapshot. Admin APPROVE re-check tương lai, revoke/cancel kỳ và release contribution reservations; COMPLETE ghi transferReference. Không thay Period start/end của các kỳ khác bằng suy luận chưa xác minh.
  - **Input Validation:** Reason5–1000; subscription own isPremium/statusACTIVE; startsAt tồn tại và **>now**, chưa revoked. COMPLETE phải có transferReference theo schema admin.
  - **Business Rules:** Business Rules chưa có ID: kỳ đang dùng/đã hết không được refund qua flow này; pending purchase không phải “paid future period”; replay yêu cầu dùng unique subscriptionId. Ghi COMPLETED là bằng chứng vận hành nhập reference, không phải lệnh chuyển tiền của app.
  - **Permissions and Status Transitions:** requireAuth+PROFILE_VIEW_OWN; owner request, admin decision. Refund REQUESTED→APPROVED/REJECTED; APPROVED→COMPLETED; approve kỳ→CANCELLED/revoked.
  - **Normal Cases:** Paid kỳ tương lai đủ điều kiện tạo REQUESTED; admin phê duyệt/cập nhật chuyển tiền bên ngoài có lịch sử dữ liệu.
  - **Abnormal Cases:** Đã bắt đầu/đã revoke/foreign404 hoặc conflict; trạng thái xử lý đồng thời bị chặn. Người dùng web chưa có entry, không mô tả refund self-service đã hoàn chỉnh.

### 3.17 Group Booking

#### 3.17.1 Request & Negotiate Group Tour

- **Function trigger:** “Yêu cầu booking đoàn” ở TourBookingCard → GroupBookingRequestDialog; xem `/traveler/custom-tours` hoặc panel trong chat agency.
- **Function description:** Traveler yêu cầu tour riêng dựa tour công khai; agency nhận/từ chối, tạo private clone và thương lượng trong thread. Đây là luồng có code thực ngoài checklist ban đầu.
- **Screen layout:** Dialog số khách theo nhóm/ngày dự kiến/notes; MyCustomToursPage status/card/guest summary/startDate/offer subtotal/CTA theo nextStep, pagination10; thread có CustomTourPinCard/panel.
- **Function Details:**
  - **Displayed Information:** Source tour, participants/guestCounts/startDate/notes, status/revision/offer, currentBooking và nextStep; private tour chỉ hiện trong phạm vi request đủ quyền.
  - **User Actions / Data Processing:** POST `/custom-tours {sourceTourId,participants,guestCounts?,startDate?,notes?,clientRequestId?}`; GET list/detail; Traveler PATCH `/:id/decision {decision:CANCEL}` nếu transition cho phép. Agency ACCEPT/DECLINE là tác nhân khác; ACCEPT tạo một PRIVATE tour DRAFT và gắn conversation.
  - **Input Validation:** 2–50 khách, guest sum khớp, ít nhất adult theo pricing/service; startDate nếu có phải tương lai, notes≤500; source tour public/approved và agency đủ điều kiện theo create; retry key sai payload IDEMPOTENCY_KEY_REUSED.
  - **Business Rules:** Decision D-85 là nguồn quyết định đã tồn tại, không phải BR mới: clone private không hiện search/detail public/cart/wishlist/booking thường; không tạo TourGuideAssignment tự động. Trao đổi chat text không thay offer đã snapshot trừ flow revision.
  - **Permissions and Status Transitions:** CUSTOM_TOUR_REQUEST/VIEW; owner request, agency context theo tenant. SUBMITTED→NEGOTIATING khi agency nhận hoặc DECLINED; Traveler chỉ CANCEL khi SUBMITTED (→CANCELLED), không cancel request NEGOTIATING/OFFERED/ACCEPTED theo map hiện tại. Không hủy Booking đã paid bằng cancel request.
  - **Normal Cases:** Yêu cầu hợp lệ lưu một row, agency nhận được thông báo và mở thread; Traveler theo dõi bước tiếp theo.
  - **Abnormal Cases:** Source không public404, dữ liệu sai400, request ID khác payload409, foreign request404. Không đủ bằng chứng một tin nhắn “đồng ý” thay thao tác Accept Offer.

#### 3.17.2 Accept Versioned Offer

- **Function trigger:** Agency gửi offer; Traveler mở CustomTourPanel/pin card xem báo giá và chọn chấp nhận.
- **Function description:** Đóng băng thỏa thuận tour riêng theo revision trước nhập roster/booking; chưa giữ chỗ chỉ vì nhận offer hoặc accept.
- **Screen layout:** CustomTourPanel hiển thị TravelerOfferReview: tiêu đề/điểm đến/số ngày, summary/description, bao gồm/không bao gồm, chính sách/lưu ý, ngày/nhóm khách và bảng giá/subtotal; nút chấp nhận mở xác nhận, lỗi stale offer có reload. Snapshot content không chứa lịch trình ngày có cấu trúc, nên không mô tả panel này như timeline đầy đủ của tour.
- **Function Details:**
  - **Displayed Information:** offerSnapshot/revision, unitPrice/agePricing/guestCounts/departureDate/subtotal/content theo DTO; không dùng source tour giá mới để thay offer đã chấp nhận.
  - **User Actions / Data Processing:** POST `/custom-tours/:id/acceptance {revision}`; service đối chiếu request.revision và snapshot.revision, CAS accept, đánh private tour APPROVED nhưng vẫn PRIVATE, notify agency/invalidate public caches; mở bước nhập người tham gia.
  - **Input Validation:** Revision nguyên≥1 và khớp server; trạng thái cho accept phải theo transition (OFFERED); actor roleTRAVELER/owner; phải có snapshot/private tour.
  - **Business Rules:** D-85: agency đổi draft có thể làm revision cũ stale; không overwrite silently. Giá/bookable được kiểm lại theo accepted offer khi tạo đơn; sự chấp nhận không là thanh toán và không đổi Booking state vì chưa có Booking.
  - **Permissions and Status Transitions:** CUSTOM_TOUR_REQUEST; OFFERED→ACCEPTED. Agency không được giả Traveler accept; public detail vẫn404 cho private tour.
  - **Normal Cases:** Revision hiện hành → ACCEPTED, nextStep ENTER_PASSENGERS; giá snapshot giữ cho checkout tiếp theo.
  - **Abnormal Cases:** CONCURRENT_UPDATE khi báo giá đổi, invalid transition/foreign404; yêu cầu reload đọc lại, không auto-accept revision mới. Departure đã trôi qua sẽ bị chặn khi create booking, không suy accept bảo đảm luôn book được.

#### 3.17.3 Complete Group Roster & Book

- **Function trigger:** “Nhập hành khách” trong request đã ACCEPTED; GroupBookingEntry được chọn từ BookingEntryPage qua customTourRequestId/query của luồng đoàn.
- **Function description:** Lưu draft roster server có revision, kiểm đúng toàn bộ thành viên rồi tạo Booking thường trên private departure từ accepted offer. Mọi payment/hold/ticket dùng hệ thống booking hiện hữu.
- **Screen layout:** Contact name/phone, card từng passenger fullName/phone/CCCD12/guestType, notes; lưu/tiếp tục, summary offer và checkout, lỗi revision/validation, link current booking khi đã có.
- **Function Details:**
  - **Displayed Information:** Số người/nhóm tuổi cố định từ offer, checkoutRevision, dữ liệu draft, giá accepted; không cho form đổi số người/giá ngoài negotiation.
  - **User Actions / Data Processing:** PATCH `/custom-tours/:id/checkout-draft {checkoutRevision,contact,passengers,notes?}`; POST `/:id/bookings {clientRequestId?}` đọc/revalidate draft JSON và private tour/date, gọi BookingsService với internal customTour. Lưu BookingPassenger relation, customTourRequestId và giá offer; currentBooking existing được trả thay tạo thêm.
  - **Input Validation:** **Bắt buộc đủ exactly participants**, group counts đúng offer và≥1adult, tên2–120/phone regex, CCCD đúng12 số và không trùng trong roster; schema áp dụng mọi độ tuổi kể cả infant. CheckoutRevision stale trả CONCURRENT_UPDATE. Chưa thấy verify CCCD ngoài format.
  - **Business Rules:** D-85: unique live booking per request (partial index), không cộng voucher thường/Premium, không thêm optional service ngoài accepted offer. PENDING hold15 phút; hết hạn cancel và có thể book lại từ offer chưa đổi nếu departure còn tương lai; BookingPassenger không dùng notes để nhét CCCD.
  - **Permissions and Status Transitions:** Owner TRAVELER/CUSTOM_TOUR_REQUEST, requestACCEPTED; verified booking boundary thông thường phải xem guard qua handler nội bộ, không tự coi request permission là email verification guard. Booking tạo PENDING→PayOS như3.7/3.8.
  - **Normal Cases:** Draft đủ mọi người, revision đúng → lưu; create đúng một live booking, full roster persist, mở checkout đúng đơn.
  - **Abnormal Cases:** Thiếu người/CCCD trùng/sai counts bị400; TOUR_UNAVAILABLE/DEPARTURE_PASSED/UNAVAILABLE chặn tạo; tab đồng thời nhận winner. **Khác booking thường:** đầy đủ roster được enforce BE ở flow đoàn; không dùng đó để khẳng định flow thường cũng enforce.

### 3.18 Policy & Navigation

#### 3.18.1 Read & Accept Policy Version

- **Function trigger:** Truy cập `/policies` qua link công khai; user đăng nhập bấm đồng ý terms/privacy có active version.
- **Function description:** Đọc policy texts và lưu sự chấp nhận đúng version; không phải guard bắt buộc đã accept mới được tạo booking theo code hiện tại.
- **Screen layout:** Heading “Điều khoản và chính sách”; section title/content, chưa có nội dung, nút đồng ý version khi đủ điều kiện; loading/error/retry ở mức component và feedback chấp nhận cục bộ.
- **Function Details:**
  - **Displayed Information:** GET `/policies` trả policies, UI bỏ moderation; content/title/version/activeVersion/policyVersionId. Tên hook `getAdminPolicies` nhưng query thực tế là endpoint public `/policies`, không gọi admin endpoint khi xem.
  - **User Actions / Data Processing:** POST `/policies/accept {policyVersionId}`; server tìm version terms/privacy có content và effectiveFrom≤now, upsert PolicyAcceptance unique userId/versionId. UI giữ mảng accepted trong component để disable nút sau thành công.
  - **Input Validation:** UUID và version tồn tại/đúng key/đã hiệu lực/content nonempty; không nhận bất kỳ version do client tự đặt.
  - **Business Rules:** Business Rules chưa có ID: acceptance gắn version, không phải đồng ý vĩnh viễn mọi version sau; UI chưa query lại lịch sử acceptance own khi reload, trạng thái nút không phải ledger đầy đủ. Không tìm thấy booking create kiểm PolicyAcceptance; checkbox UI checkout không được coi là backend version acceptance.
  - **Permissions and Status Transitions:** Public read; accept requireAuth; chỉ tạo own PolicyAcceptance, không cập nhật User status/Booking.
  - **Normal Cases:** Đọc policy hiện tại, user đồng ý → row acceptance lưu và UI hiện đã đồng ý phiên bản này.
  - **Abnormal Cases:** Version tương lai/sai key/trống content bị400; request lỗi giữ nút và báo không lưu được. Không khẳng định đã consent trước mọi booking nếu chưa có enforcement.

## PART 4 — CODE TRACEABILITY

### 4.1. Cách đọc đường dẫn và test evidence

Để bảng không lặp đường dẫn dài, `F/` = `frontend/features/`, `B/` = `backend/src/modules/`, `C/` = `packages/constants/src/`. Đây chỉ là viết tắt đường dẫn, không phải module/API giả. Mọi HTTP endpoint ở bảng đều có tiền tố **`/api/v1`**. Route web là `frontend/app/<route>/page.tsx`; phần `:id` tương ứng thư mục `[id]`. Auth routes nằm trong `(auth)` nên URL không chứa segment `(auth)`. Route aliases/redirect phải đọc page source, không suy từ tên thư mục.

Trong bảng dưới, cột module dùng key catalog 4.2; key đó xác định **cụ thể** router/controller/service/repository/validation và FE API client. Cột Function tiếp tục chỉ chính xác symbol cần đọc. Các quy tắc chưa có BR ID được truy tới symbol/policy, không tạo mã BR mới.

Test status: **PASS** chỉ subset 219 test case đã thực thi tại1.5; **SOURCE** = đọc source/locate test, chưa chạy, không chứng minh runtime/coverage đầy đủ; **GAP** = chưa có test xác minh hành vi thiếu được nêu. Một test suite PASS cũng không làm mọi case của function trở thành VERIFIED.

### 4.2. Catalog module và API client

| Key | Backend files (đường dẫn đầy đủ sau B/) | Frontend client / logic dùng chung |
|---|---|---|
| AUTH | `auth/auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.validation.ts`, `auth.policy.ts`, `otp.service.ts`, `otp.repository.ts`, `refresh-token.repository.ts`, `auth.tokens.ts` (các tên sau cùng thuộc thư mục `B/auth/`) | `F/auth/api/authApi.ts`, `hooks/useLoginForm.ts`, `useRegisterForm.ts`, `useGoogleLogin.ts`, `useLogout.ts`; `frontend/store/api/baseApi.ts`, `F/auth/components/AuthBootstrap.tsx`, `store/authSlice.ts`, `utils/safeNextPath.ts` |
| TOUR | `B/tours/tours.routes.ts`, `tours.controller.ts`, `tours-discovery.service.ts`, `tours.service.ts`, `tours.repository.ts`, `tours.validation.ts`, `tours.view.ts` | `F/tours/api/toursApi.ts`, `utils/searchContext.ts`, `utils/recentTours.ts`, `C/age-pricing.ts` |
| USER | `B/users/users.routes.ts`, `users.controller.ts`, `users.service.ts`, `users.repository.ts`, `users.validation.ts`, `users.mapper.ts`, `users.types.ts` | `F/traveler-account/api/profileApi.ts`, `avatarUpload.ts`, `F/public-profiles/api.ts`; `B/agencies/agency-profile.repository.ts` cho public agency |
| WISH | `B/wishlists/wishlists.routes.ts`, `wishlists.controller.ts`, `wishlists.service.ts`, `wishlists.repository.ts`, `wishlists.validation.ts`, `wishlists.types.ts` | `F/wishlist/api/wishlistApi.ts`, `hooks/useTourWishlist.ts`, `utils/wishlistCollections.ts` |
| CART | `B/carts/carts.routes.ts`, `carts.controller.ts`, `carts.service.ts`, `carts.repository.ts`, `carts.validation.ts`, `carts.mapper.ts`, `carts.types.ts` | `F/cart/api/cartApi.ts`, `hooks/useCart.ts`; không tìm thấy consumer mutation web đang render |
| BOOK | `B/bookings/bookings.routes.ts`, `bookings.controller.ts`, `bookings.service.ts`, `bookings.repository.ts`, `bookings.validation.ts`, `bookings.policy.ts`, `bookings.mapper.ts`, `bookings.events.ts` | `F/booking/api/bookingApi.ts`, `utils/passengerValidation.ts`, `C/age-pricing.ts`, `C/tour-services.ts`; `backend/src/utils/age-pricing.ts` |
| PAY | `B/payments/payments.routes.ts`, `payments.controller.ts`, `payments.service.ts`, `payments.repository.ts`, `payments.validation.ts`, `providers/payos.provider.ts`, `providers/payment.provider.ts`, `payments.events.ts` | `F/payment/api/paymentApi.ts`, `utils/checkout.ts` |
| TICKET | `B/e-tickets/e-tickets.routes.ts`, `e-tickets.controller.ts`, `e-tickets.service.ts`, `e-tickets.repository.ts`, `e-tickets.fulfillment.ts`, `e-tickets.validation.ts`, `index.ts` | `F/e-ticket/api/eTicketApi.ts`; QR renderer `F/e-ticket/components/QRCodeDisplay.tsx` |
| PROMO | `B/promotions/promotions.routes.ts`, `promotions.controller.ts`, `promotions.service.ts`, `promotions.repository.ts`, `promotions.validation.ts`, `promotions.policy.ts` | `F/traveler-account/api/voucherWalletApi.ts`, promotion calls tại `F/booking/api/bookingApi.ts` và BookingEntryPage |
| REVIEW | `B/reviews/reviews.routes.ts`, `reviews.controller.ts`, `reviews.service.ts`, `reviews.repository.ts`, `reviews.validation.ts`, `reviews.mapper.ts` | `F/review/api/reviewApi.ts`, `hooks/useTourReviewEligibility.ts`, `utils/validation.ts`, `utils/draftStorage.ts` |
| NOTIF | `B/notifications/notifications.routes.ts`, `notifications.controller.ts`, `notifications.service.ts`, `notifications.repository.ts`, `notifications.validation.ts`, `notifications.writer.ts`, `mail-outbox.ts`, `notifications.mail.ts` | `F/notifications/api/notificationsApi.ts`, `frontend/components/layout/Header.tsx`, notification routing helpers tại frontend |
| CHAT | `B/chat/chat.routes.ts`, `chat.controller.ts`, `chat.service.ts`, `chat.repository.ts`, `chat.validation.ts`, `chat.policy.ts`, `chat.gateway.ts` | `F/chat/api.ts`, `ChatProvider.tsx`, `presentation.ts`, `components/FormattedMessage.tsx` |
| AI | `B/ai/ai.routes.ts`, `ai.controller.ts`, `ai.service.ts`, `ai.repository.ts`, `ai.validation.ts`, `ai.types.ts`, `providers/index.ts` | `F/chat/api/aiChatApi.ts`, `F/chat/components/AiThread.tsx` |
| REPORT | `B/reports/reports.routes.ts`, `reports.controller.ts`, `reports.service.ts`, `reports.repository.ts`, `reports.validation.ts`, `reports.types.ts` | `F/report/api/reportApi.ts` |
| COMPLAINT | `B/complaints/complaints.routes.ts`, `complaints.controller.ts`, `complaints.service.ts`, `complaints.repository.ts`, `complaints.validation.ts`, `complaints.types.ts`; `B/payments/refund-ledger.repository.ts` | `F/complaints/api/complaintsApi.ts`, `C/complaints.ts` |
| SUPPORT | `B/support/support.routes.ts`, `support.controller.ts`, `support.service.ts`, `support.repository.ts`, `support.validation.ts`, `support.types.ts` | Không tìm thấy Traveler web API consumer/form riêng; staff UI không phải Traveler |
| SECURITY | AUTH routes/service và `backend/src/middlewares/authenticate.ts`, `authorize.ts`, `rate-limit.ts` | `F/traveler-account/api/securityApi.ts`, `F/auth/components/RoleGuard.tsx` |
| PREMIUM | `B/premium/premium.routes.ts`, `premium.service.ts`, `premium.repository.ts`, `premium.policy.ts`, `premium.validation.ts`; fulfillment phối hợp `B/subscriptions/subscriptions.service.ts` | `F/premium/api.ts`, `PremiumIdentity.tsx`; server không có PremiumController riêng, route handler gọi service/repository trực tiếp |
| GROUP | `B/custom-tours/custom-tours.routes.ts`, `custom-tours.controller.ts`, `custom-tours.service.ts`, `custom-tours.repository.ts`, `custom-tours.validation.ts`, `custom-tours.types.ts`, `C/custom-tours.ts` | `F/custom-tours/api.ts`, `types.ts`, `links.ts`; reuse BOOK/PAY |
| POLICY | `B/system-settings/system-settings.routes.ts`, `system-settings.controller.ts`, `system-settings.service.ts`, `system-settings.repository.ts`, `policy-history.routes.ts` | `F/admin/api/adminApi.ts` query `/policies`, `operationsApi.ts` accept; `frontend/app/policies/page.tsx` |

Ghi chú catalog: khi một ô bắt đầu `B/<module>/...`, các filename không lặp prefix tiếp theo trong cùng ô nằm trong **cùng thư mục module đó**; riêng đường dẫn `providers/...` nằm dưới module tương ứng. `frontend/app/layout.tsx`, `frontend/store/Providers.tsx`, `frontend/components/layout/GlobalSiteShell.tsx`, `Header.tsx`, `navigation-config.ts`, `F/traveler-account/components/TravelerAccountNav.tsx` quyết định shell/navigation, không thay authorization API.

### 4.3. Truy vết từng Function

Tên test rút gọn `B/<module>/__tests__/file` hoặc `F/<feature>/__tests__/file` tuân theo prefix trên. Mỗi hàng chỉ rõ test đã chạy hoặc chưa chạy; các gap không được test vô tình “xác nhận” bằng tên suite.

| Function ID | Frontend / route web | HTTP API và dữ liệu chính | Backend / Business Rules location | Database model/field | Test evidence |
|---|---|---|---|---|---|
| 3.3.1 | `F/auth/components/RegisterPage.tsx`, RegisterForm; `/register/traveler` | POST `/auth/register`: identity/password → email/OTP TTL | AUTH `AuthService.register` dòng79; registerBody/passwordSchema | User.email/passwordHash/status; Otp | PASS `B/auth/__tests__/auth.service.test.ts`; SOURCE `auth.flows.integration.test.ts`, FE RegisterPage.continuation |
| 3.3.2 | `F/auth/components/VerifyOtpPage.tsx`; `/verify-otp` | POST verify-otp/resend-otp: email/code/purpose | AUTH verifyOtp206/resendOtp258; OtpService.issue/verify, AUTH_POLICY | Otp.hash/attempts/expiresAt; User.emailVerifiedAt/status; RefreshToken | PASS auth.service; SOURCE auth.flows integration. OTP delivery thật chưa kiểm |
| 3.3.3 | `F/auth/components/LoginPage.tsx`, LoginForm, GoogleLoginButton; `/login` | POST `/auth/login`, `/auth/google`: credential/idToken → session hoặc2FA | AUTH login172/loginUser187/loginWithGoogle310; Google adapter | User.googleId/twoFactorEnabled/lastLoginAt; RefreshToken | PASS auth.service; SOURCE FE LoginPage/useGoogleLogin/authApi.google |
| 3.3.4 | ForgotPasswordPage/ResetPasswordPage trong `F/auth/components`; các route tương ứng | POST forgot-password/reset-password: email/code/newPassword | AUTH forgotPassword380/resetPassword389, otp.verify | User.passwordHash/tokenVersion; Otp; RefreshToken.revokedAt | PASS auth.service; SOURCE auth.flows integration; chưa browser recovery |
| 3.3.5 | AuthBootstrap/authSlice/useLogout/baseApi; header logout, root providers | POST `/auth/refresh`, `/auth/logout`; token→session/revoke | AUTH refresh406/logout442/createSession561; authenticate.resolveUserActor; jobs purgeExpired | RefreshToken.family/tokenHash/revokedAt; User.tokenVersion | PASS auth.service; SOURCE FE AuthBootstrap/authSlice.hydration/RoleGuard; chưa browser multi-tab |
| 3.4.1 | `frontend/app/page.tsx`, `app/home/page.tsx`, HotVouchersSection | GET tours/destinations/categories/promotions/hot → cards | TOUR ToursDiscoveryService.search/getDestinations; `B/categories/categories.service.ts`; PROMO listHot407 | Tour/TourDeparture/Category/Promotion | PASS FE searchContext chỉ helper; SOURCE TourCard/HotVouchersSection; Home orchestration chưa test trực tiếp |
| 3.4.2 | `F/tours/components/TourListPage.tsx`, utils/searchContext; `/tours`, `/explore` redirect | GET `/tours`: q/filters/groups/sort/page → items/meta | TOUR tours.validation.searchToursQuery; ToursRepository.searchPublic183, discovery cache | Tour.basePrice/status/visibility/agePricing; TourDeparture.remaining/date/isOpen; Category relation | PASS FE searchContext; SOURCE TourListPage/TourBookingCard và backend discovery tests; chưa runtime query DB |
| 3.4.3 | `F/tours/utils/recentTours.ts`, detail/SimilarToursSection/Home; wishlist recent | GET `/tours` theo destination/category, limit8→exclude current/slice4; local write recent | TOUR search; local functions getRecentlyViewedRecords/add... | LocalStorage recent24; đọc Tour, không User history model | SOURCE FE tour/detail tests; chưa test đầy đủ cross-account local history |
| 3.5.1 | `F/tours/components/detail/TourDetailView.tsx`, TourBookingCard/TourGuestSelector; `/tours/:id` | GET `/tours/:id` → detail/departures/agency/guide | TOUR discovery.getDetail, tours.view; C/age-pricing.calculateGuestPrice/ageUnitPrice | Tour.*, TourDeparture.priceOverride/remaining, agency/guide assignment | SOURCE TourDetailView/TourPolicyAndPricing/TourBookingCard/TourGuestSelector; PASS FE age helper liên quan; fixed breakdown GAP |
| 3.5.2 | `F/tours/components/detail/TourPrintView.tsx`; `/tours/:id/print` | GET `/tours/:id` + selection URL, browser window.print | TOUR detail; print local calculation/fallback | Read Tour/Departure; không lưu PDF | SOURCE FE TourPrintView.test.tsx; chưa print runtime |
| 3.5.3 | `F/public-profiles/PublicProfilePage.tsx`, API; `/agencies/:id`, `/tour-guides/:id` | GET agencies/guides/detail/reviews/promotions/premium guide | USER public-profile service/mapper; agency-profile.repository; REVIEW; PREMIUM public route | AgencyProfile, GuideProfile, User public fields, Review/Earning, PremiumGuideProfile | SOURCE PublicProfilePage/AgencySections; chưa live public data |
| 3.6.1 | `F/wishlist/components/WishlistButton.tsx`, WishlistPage; `/settings/wishlist` | GET `/wishlist`; POST/DELETE `/:tourId` | WISH add/remove/list; repository.addWithCap; WISHLIST_LIMITS | WishlistItem unique(userId,tourId); Tour public card | PASS B/wishlists/wishlists.service.test; SOURCE wishlist.integration, FE WishlistButton/wishlistApi |
| 3.6.2 | `F/wishlist/utils/wishlistCollections.ts`, SaveToWishlistModal, WishlistPage | Không collection API; phối hợp wishlist API khi save/un-save | Local create/rename/delete helpers, caller suffix default | LocalStorage collections/lastSelected; không collection table | SOURCE FE wishlistCollections/Rename/ConfirmDeleteCollection; isolation GAP |
| 3.6.3 | `F/cart/api/cartApi.ts`, hooks/useCart; `app/traveler/cart/page.tsx` redirect | GET cart; POST items; PATCH/DELETE items/:id | CART add/updateParticipants/list/remove; CART_LIMITS20, BOOK pricing | CartItem unique(userId,departureId), guestCounts; read departure | PASS carts.service; SOURCE carts.integration/cartApi; web screen GAP |
| 3.7.1 | `F/booking/components/BookingEntryPage.tsx`, utils/passengerValidation; `/traveler/bookings/new` | POST quote/create với contact/passengers/groups | BOOK createBookingBody/passengerSchema; createBookingOnce134 chỉ count upper bound; C/age-pricing | Booking.passengerSnapshot(JSON SQL passengers), guestPricing/contactName/Phone | PASS FE passengerValidation/BookingEntryAgeValidation; B/bookings.service PASS nhưng roster completeness GAP |
| 3.7.2 | `F/booking/components/BookingExtras.tsx`, BookingEntryPage | POST `/bookings/quote`: selections/terms/passenger ids → subtotals | BOOK quoteBooking96/createOnce; `B/tours/tour-services.validation.ts`, C/tour-services.quoteExtras | Read Tour.optionalServices; create→Booking.serviceSnapshot/servicesSubtotal/meetingPointSnapshot | SOURCE bookings.integration assertions quote5/pickup3/no inventory mutation; optional service full browser GAP |
| 3.7.3 | BookingEntryPage steps/submit, BOOK/PAY clients | POST `/bookings`: IDs/roster/services/codes/requestKey → Booking | BOOK createBooking115/createOnce134/assertNoPending343; TOUR.reserveSeats; PROMO/PREMIUM | Booking/requestFingerprint/unique traveler,key; TourDeparture.remaining; Redemptions | PASS bookings.service (trong subset175 backend); SOURCE bookings.integration concurrency/idempotency; crash compensation GAP |
| 3.7.4 | History/IncompleteBookingBanner; nền | Không API Traveler; job expiry | BOOK expirePendingBookings550/cancelInternal686; jobs/maintenance | Booking.status/cancelReason/deadline; inventory/vouchers/ticket | PASS bookings.service maintenance/CAS; SOURCE jobs maintenance integration |
| 3.7.5 | `F/booking/components/IncompleteBookingBanner.tsx` trong WishlistPage | GETbookings/me limit5; GETcustom-tours statusACCEPTED limit5 | BOOK listMine; GROUP list/describe.nextStep; banner chọn target | Read Booking/CustomTourRequest/checkoutDraft; không thường draft mới | SOURCE `F/booking/__tests__/IncompleteBookingBanner.test.tsx`; paging/resume form thường GAP |
| 3.8.1 | BookingEntryPage, BookingDetailPage, `F/payment/components/PaymentReturnPage.tsx` | POST checkout booking; GET payments/:id → link/status | PAY createBookingCheckout61/createCheckout77/attach99; BOOK getPayable462; PayOS provider | Payment.purpose/reference/status/orderCode/url/expiresAt; Booking deadline | PASS payments.service, FE checkout; SOURCE provider/API integration; live UNVERIFIED |
| 3.8.2 | PaymentReturn polling, PAY API | POST webhook signature payload; GET Payment own; jobs | PAY handleWebhook186/sync268/settle287/fulfil304/retry231; BOOK confirmPayment484 | Payment.paidAt/fulfilledAt/failureReason; Booking.confirmedAt/isPaid/refundRequired | PASS payments.service: bad signature/mismatch/late/retry; SOURCE payments.integration; mock parallel assertions giới hạn |
| 3.8.3 | UI ticket/banner consumer; nền cấp vé | Không Traveler issue API; GET ở3.9.2 | TICKET issueForBooking40, repository.create, index event wiring, retryTicketFulfillment | ETicket uniquebookingId/code; Booking.fulfillmentStatus/Attempts/NextAttemptAt | PASS e-tickets.service; SOURCE e-tickets.lifecycle.integration assertions race/repair/completedUSED |
| 3.9.1 | `F/booking/components/BookingHistoryPage.tsx`, BookingDetailPage; `/settings/history[/id]` | GET bookings/me(status/page), bookings/:id → own DTO | BOOK listMine338/getMine353/mapper; repository.listByTraveler/findById | Booking snapshots, BookingPassenger, Review lookup; Tour images live | PASS bookings.service owner; SOURCE FE BookingHistory/BookingDetail/BookingInventoryCache |
| 3.9.2 | `F/e-ticket/components/ETicketList.tsx`, ETicketView/ETicketCard; `/traveler/tickets[/id]` | GET e-tickets/list/:id/booking/:id | TICKET listMine85/getMine90/getMineByBooking95/mapper owner | ETicket.*, Booking services/meeting snapshot; local cache user/page/status | PASS e-tickets.service; SOURCE FE ETicketList/View/Card/API; offline browser chưa chạy |
| 3.9.3 | BookingHistoryPage/CompleteBookingModal; nền job | POST bookings/:id/complete | BOOK completeMine420/completeFinished573; repository.transition endDate guard | Booking.completedAt/status; ticketUSED; review eligibility | PASS bookings.service end-date/owner; SOURCE ticket lifecycle guard; FE BookingHistory |
| 3.10.1 | `F/booking/components/CancelBookingModal.tsx`, history/detail | POST bookings/:id/cancel {reason?} | BOOK cancelMine380/cancelInternal686/cancellationSnapshot333; policy/transition | Booking.cancellationPolicySnapshot/cancelledAt/refund fields; departure; redemptions/ticket | PASS bookings.service cancel/duplicate/window; SOURCE booking integration; release failure GAP |
| 3.10.2 | BookingDetailPage refund banner | GET bookings/:id; không booking refund transfer API | BOOK calculateRefundAmount/loadRefundMilestones720; COMPLAINT resolve/adjudicate; D-15 | Booking.refundAmount/refundRequired; RefundLedger khi source tạo ledger | PASS bookings.service refund flag; SOURCE complaints tests; payout timeline/transfer GAP |
| 3.11.1 | `F/tours/components/HotVouchersSection.tsx`, public-profile sections, voucher client | GET hot/agency promos; POST promotions/collect {promotionId} | PROMO listHot407/collect141/repository.collectUserVoucher | Promotion; UserVoucher unique user,promotion; Notification | PASS promotions.service; SOURCE HotVouchersSection, promotions.integration; collection expiry restrictions GAP |
| 3.11.2 | `F/traveler-account/components/VoucherWalletPage.tsx`, VoucherCard/PremiumWalletSection; `/settings/vouchers` | GET promotions/my-vouchers, premium/me/vouchers | PROMO listUserVouchers261/repository; PREMIUM vouchers/grantDue | UserVoucher.isUsed/usedAt/bookingId; Promotion; PremiumVoucher | PASS FE VoucherWallet; PASS promotions.service; UserVoucher redemption update GAP |
| 3.11.3 | BookingEntryPage/ShopeePromotionModal; BOOK client | GET promotions/preview/available; codes in POSTbooking | PROMO assertApplicable/computeDiscount, redeem314/release381; BOOK agency→platform order | Promotion.usedCount, PromotionCodeInstance, PromotionRedemption, Booking discount | PASS promotions/bookings.service; SOURCE unique-vouchers integration assertions owner/release/multi-code; wallet state GAP |
| 3.12.1 | `F/review/components/TourReviewsSection.tsx`, ReviewCard/MyReviewCard; detail/history/profile | GET reviews(scope/sort/page), reviews/me | REVIEW listPublic/listMine; repository.refreshRating (visible avg round2) | Review.status/rating; Tour.ratingAvg/count; Earning for guide scope | PASS reviews.service; SOURCE TourReviewsSection/reviews.atomic.integration; eligibility>100 GAP |
| 3.12.2 | `F/review/components/WriteReviewDialog.tsx`, ReviewPhotoPicker, draftStorage | POST reviews/images/upload-signature; POST reviews | REVIEW reviewableBooking/createReview/createImageSignature; uniquebooking | Review.bookingId/comment/images/status; Tourstats; local draft/IndexedDB | PASS reviews.service; SOURCE WriteReviewDialog/validation/eligibility/reviews.integration; browser attachment persistence UNVERIFIED |
| 3.12.3 | Không edit/delete component được tìm thấy | Không own PATCH/DELETE route | REVIEW reviews.routes.ts chỉ GET/POST; moderation hide/restore là quyền khác | Không own write cho review đã tạo | GAP: chức năng/test edit/delete không tồn tại trong phạm vi |
| 3.13.1 | `frontend/components/layout/Header.tsx`, NOTIF client | GET notifications/unread-count; PATCHread; POSTread-all; DELETE API-only | NOTIF list/unreadCount/markRead/markAllRead/remove; notify/outbox; jobs purge | Notification.userId/isRead/data; MailOutbox; User.preferences khi voucher alerts | SOURCE notifications.service/mail/locale/policy tests; Header.test; badge20/optimistic error GAP |
| 3.13.2 | `F/chat/ConversationPage.tsx`, ChatProvider/StartConversationButton; `/conversations[/id]` | chat conversations CRUD-read subset/messages/read/upload + socket | CHAT canConverse/assignSides/requireParticipation/sendMessage/markRead; gateway | Conversation.travelerId/guideId/agencyId/unread/watermarks; Message.text | SOURCE chat.service/integration/realtime, FE ConversationPage/ChatProvider; image auth/runtime GAP |
| 3.13.3 | `F/chat/components/AiThread.tsx`; `/conversations/ai` | POST ai/chat; GET conv/overview; POSTread through id | AI chat/requireOwned/markRead; AI_LIMITS/provider | AiConversation.userId/messageCount; AiMessage.readAt/incomplete according schema | SOURCE ai.service/integration/provider tests, FE AiChat; live provider UNVERIFIED |
| 3.14.1 | `F/report/components/ReportDialog.tsx`, ReportButton/MyReportsPage; `/settings/reports` | POST reports; GET reports/me/:id | REPORT createReport/resolveTarget/getMine; dedupe/unique handling | Report.reporterId/target/status/response/resolution, linked complaints when logic creates | SOURCE reports.service/integration, FE report.test/reportApi; runtime/moderator E2E UNVERIFIED |
| 3.14.2 | `F/complaints/components/ComplaintTicketDialog.tsx`, MyComplaintsPage/ComplaintConversationView | POST complaints/signature/messages; GETme/detail | COMPLAINT createTicket68/sendMessage239/resolveUploadedImages; validation/taxonomy | ComplaintTicket.travelerId/tourId/bookingId/status/priority; messages/attachments | SOURCE complaints.service assertions duplicate/owner/asset; FE complaints.test; chưa run |
| 3.14.3 | ComplaintConversationView/ComplaintCsatDialog | POSTaccept-resolution/escalate/feedback | COMPLAINT acceptResolution370/escalate412/submitFeedback510/autoClose598; transition map | ComplaintTicket.status/resolvedAt/closedAt; ComplaintFeedback unique ticket; RefundLedger | SOURCE complaints.service assertions CLOSED/ESCALATED/CSAT; no live payout |
| 3.14.4 | N/A Traveler web screen; staff route khác scope | POST support/tickets; GETme/detail; POSTmessages/close | SUPPORT createTicket/replyAsOwner/closeMine, SUPPORT_LIMITS/transitions | SupportTicket.userId/status/supportCode; SupportTicketMessage | SOURCE support.service/integration; Traveler web UI GAP |
| 3.15.1 | `F/traveler-account/components/ProfileSummary.tsx`, ProfileEditForm; `/settings/profile` | GET/PATCH users/me; avatar signature/complete/delete | USER getMe68/updateMe91/createAvatar145/complete152/remove161; Cloudinary verify | User.fullName/phone/avatarUrl; no birth/gender/email patch | SOURCE users.service, FE ProfileSummary; Cloudinary runtime chưa chạy |
| 3.15.2 | `frontend/app/settings/profile/security/page.tsx`, TwoFactorCard/ConfirmPasswordModal | GETauth/security; PATCHtwo-factor; POSTchange-password(API-only) | AUTH setTwoFactor466/changePassword485; passwordSchema | User.twoFactorEnabled/passwordHash/tokenVersion; revoked RefreshToken | PASS auth.service; FE 2FA integration chưa chạy; password web form GAP |
| 3.15.3 | `F/traveler-account/api/voucherWalletApi.ts` hooks chưa có editor | GET/PATCH users/me/preferences | USER updatePreferences76/preferencesOf; updatePreferencesBody; PROMO.sweep168 | User.preferences JSON; Notification voucher alert records | SOURCE users.preferences assertions HH:mm/overlap/default normalize; editor GAP |
| 3.15.4 | Chưa có form Traveler web | POST/GET users/me/guide-application; POSTdev-accept/dev-reject | USER applyGuide207/getGuideApplication258/devAcceptGuide/devRejectGuide; routes guards | User.preferences.guideApplication/role; GuideProfile | SOURCE users.service scope; self-approval authorization GAP, chưa test negative guard |
| 3.16.1 | `F/premium/PremiumPage.tsx`, PremiumIdentity; `/premium` | GET premium/plans(audience)/me | PREMIUM routes, repo.plans68/status22; continuousPremiumEnd | SubscriptionPlan/Subscription/SystemSetting; PremiumContribution/PlanVoucher | PASS FE PremiumPage; SOURCE premium.policy/integration; live plan values UNVERIFIED |
| 3.16.2 | PremiumPage buy/openCheckout, PaymentReturnPage | POSTpremium/subscribe{planId}; Payment handlers | PREMIUM service.subscribe/activate; repo.pending158/activate246; PAY/SUBSCRIPTIONS dispatch | Subscription.PENDING_PAYMENT/price/version/snapshot; PremiumReservation; Payment | PASS FE PremiumPage only UI; SOURCE premium.integration; full payment flow UNVERIFIED |
| 3.16.3 | `F/premium/PremiumWalletSection.tsx`, PremiumPage.VoucherList, BookingEntryPage | GETpremium/me/vouchers; premiumVoucherId in createbooking | PREMIUM repo.grantDue302/reserveVoucher424/release464/470, policy.premiumDiscount; BOOK claim | PremiumVoucher.terms/heldAt/leaseToken/bookingId; PremiumReservation | PASS FE PremiumPage/BOOK service scope; SOURCE premium.integration/policy; browser claim UNVERIFIED |
| 3.16.4 | `F/premium/api.ts` history/period hooks; chưa có refund form | GETpremium/me/history/subscriptions/:id; POST/:id/refunds | PREMIUM repo.requestRefund476/decideRefund502; assertRefundable | PremiumRefund.amount/status/reference; Subscription.revokedAt; reservations | SOURCE premium.policy/integration; web request form GAP |
| 3.17.1 | `F/custom-tours/components/GroupBookingRequestDialog.tsx`, MyCustomToursPage/panel; `/traveler/custom-tours` | POST/GETcustom-tours; PATCHdecision CANCEL | GROUP create65/decide138/replay442/ensureConversation; D-85 | CustomTourRequest/source/private tour IDs/revision; Tour.visibility; Conversation | SOURCE custom-tours.integration/agency-scope, FE custom-tours/custom-tour-chat; chưa run |
| 3.17.2 | `F/custom-tours/components/CustomTourPanel.tsx`, CustomTourPinCard/chat | POSTcustom-tours/:id/acceptance{revision} | GROUP acceptOffer236, repository.acceptOffer/CAS; D-85 | CustomTourRequest.offerSnapshot/revision/acceptedAt/status; privateTour status | SOURCE custom-tours.negotiation.integration; version stale assertions cần runtime nếu xác nhận E2E |
| 3.17.3 | `F/custom-tours/components/GroupBookingEntry.tsx`, BookingEntryPage branch | PATCHcheckout-draft, POSTrequests/:id/bookings | GROUP saveCheckoutDraft268/createBooking291/assertCheckoutCounts342; BOOK internal allowPrivate | BookingPassenger unique(booking,idCard), CustomTourRequest.checkoutRevision/draft; Booking.customTourRequestId | SOURCE custom-tours.checkout/booking integration assertions exact roster/ownership/revision, FE group-booking-entry; email guard gap |
| 3.18.1 | `frontend/app/policies/page.tsx`, POLICY clients | GETpolicies; POSTpolicies/accept{policyVersionId} | POLICY policyAcceptanceRouter native handler, system policy service | SystemSetting, PolicyVersion, PolicyAcceptance unique user/version | SOURCE `B/users/__tests__/platform-admin.integration.test.ts` và policy-related tests có liên quan; checkout enforcement GAP, không claim PASS |

### 4.4. Schema, migration và lifecycle đối chiếu

| Vùng dữ liệu | Nguồn định nghĩa / migration | Điều đã đối chiếu và giới hạn |
|---|---|---|
| Identity | `prisma/schema.prisma`: User18, Otp128, RefreshToken141; migration `20261104140000_toan215_security_refund_chat` | tokenVersion, password/2FA, refresh family; trạng thái kiểm lại mỗi request. Không kiểm dữ liệu/migration applied server |
| Tour/inventory | Schema Tour174/TourDeparture222; init và các migration tour-policy/meeting-point/highlights | capacity/remaining, giá BigInt, visibility; reserve updateMany có remaining≥seats, tour public/approved, date/isOpen guards; release capped capacity |
| Booking thường | Schema Booking285; `20261112000500_booking_passenger_roster` và `20261114000100_tour_optional_services` | PassengerSnapshot JSON map cột passengers; optionalServices/serviceSnapshot JSON array check, servicesSubtotal≥0; không có SQL CHECK đủ roster theo participants |
| Booking đoàn | Schema CustomTourRequest253/BookingPassenger361; `20261112000000_custom_tour_requests`, `20261112190000_custom_tour_start_date` | relation roster/CCCD unique, revision, partial unique live booking; số người/nhóm tuổi do service kiểm |
| Payment/money | Schema Payment376/RefundLedger406; `20261103000000_expand_whole_vnd_storage`, init/security refund migration | Payment reference đa hình, unique provider order và pending target SQL index; RefundLedger không đồng nghĩa tự chuyển tiền |
| Ticket | Schema ETicket426; `202611050001_khiem_ticket_fulfillment` | unique booking/ticket code, fulfillment retry fields, repository locks/status guard; job chỉ hoạt động khi JOBS_ENABLED |
| Promotion | Schema Promotion539/CodeInstance577/UserVoucher593/Redemption608; `20261021200000_promotion_system_enhancements`, `20261104000000_promotion_redemptions` | quota/unique instance/redemption; UserVoucher used state khác instance state, không thấy cập nhật đồng bộ từ booking |
| Review | Schema Review482; `20261018020000_review_images` | unique bookingId, images, visible/hidden; aggregate stats transaction trong ReviewsRepository |
| Notification/preferences | Schema Notification890/MailOutbox1297/User.preferences; `20261022110000_user_preferences_and_voucher_notifications`, `202611040001_kieu_admin_workflows` | in-app/read state, outbox cho các writer; preferences merge/default; delivery chưa xác minh production |
| Chat/AI | Schema Conversation909/Message938/AiConversation951/AiMessage964; `20261024000000_ai_message_read_state`, `202611070003_ai_incomplete`, `20261114000300_agency_chat_tenant` | participation/unread/read watermark, agency tenant, incomplete; không có chat edit/delete API |
| Report/support/complaint | Schema Report507/SupportTicket778/ComplaintTicket817/Feedback871; `20261022193000_tour_complaint_ticket_system` | ba model flow riêng, CSAT unique và ledger ghi nhận; không đồng nhất mọi ticket status |
| Premium | Schema SubscriptionPlan625/Subscription648/PremiumContribution681/Reservation712/Voucher726/Refund743; `20261025090000_premium`, `20261110000000_subscription_expiring_soon` | snapshot/quota/kỳ liên tục/refund tương lai; PENDING_PAYMENT khác Booking.PENDING |
| Policy | Schema PolicyVersion1275/PolicyAcceptance1289; `202611040001_kieu_admin_workflows` | unique user/version acceptance; chưa có create-booking enforcement |

Các số dòng schema là điểm bắt đầu model tại baseline, không phải giả định mọi quan hệ đều có FK. Migration SQL có constraint/index ngoài schema Prisma cần đọc cùng repository. Không chạy migration để kiểm nghiệm các ràng buộc này.

### 4.5. Tác vụ nền ảnh hưởng Traveler

Nguồn: `backend/src/jobs/maintenance.ts:28` (`defaultTasks`), khởi chạy bởi `backend/src/server.ts` **chỉ khi `env.JOBS_ENABLED` true**. Đây là interval thiết kế của code, không phải bằng chứng scheduler production đang bật.

| Task | Chu kỳ | Tác động Traveler |
|---|---|---|
| mail.deliverOutbox | 1 phút | Gửi lại email từ outbox; không đảm bảo mọi notify trực tiếp đều vào outbox |
| eTickets.retryFulfillment | 1 phút | Repair paid booking thiếu vé sau ngưỡng3 phút; failed attempt delay3 phút |
| premium.grantDue / releaseExpiredHolds | 1 phút | Cấp voucher khi kỳ bắt đầu, dọn reservation/voucher lease đủ điều kiện |
| bookings.expirePending | 1 phút | CANCELLED unpaid booking quá15 phút, release quota/chỗ theo flow |
| bookings.completeFinished | 5 phút | CONFIRMED ended→COMPLETED, mở review, ticketUSED |
| payments.expireStale / retryUnfulfilled | 1 phút | Đối soát trước expiry; retry PAID chưa fulfilled |
| payments.pollPending | 2 phút | Hỏi provider cho pending đủ cũ5 phút, bù missed webhook |
| subscriptions.expireEnded / cancelAbandoned | 5 phút | Kỳ kết thúc/hủy purchase abandoned theo điều kiện service; Premium có reservation logic riêng |
| subscriptions.notifyExpiring | 30 phút | Gửi nhắc subscription sắp hết theo policy service; không phải recurring payment |
| auth.purgeExpired | 1 giờ | Xóa OTP/refresh hết hạn; không xóa account |
| notifications.purgeOld | 6 giờ | Retention180 ngày |
| promotions.sweepExpiring | 15 phút | Nhắc voucher48h/urgent3h, preferences và dedupe12h |
| complaints.autoCloseResolved | 15 phút | Đóng resolved quá72h không phản hồi, mời CSAT |

Jobs không overlap với chính nó trong một process; lỗi được log và retry tick sau (có retry ngắn cho một số lỗi DB). Không suy mọi tác vụ exactly-once trên nhiều server; tính an toàn phụ thuộc CAS/unique/lock tại repository cụ thể.

## PART 5 — GAP ANALYSIS & REVIEW

### 5.1. Gap/issue có bằng chứng

“Expected Behavior” dưới đây là yêu cầu người dùng đã nêu hoặc tiêu chí cần làm rõ để UI/BE nhất quán; không có nghĩa mọi mong muốn đã được PO duyệt. Các row là số thứ tự audit, **không phải Business Rule ID**. “Chưa tìm thấy” là kết quả tìm trong scope baseline, không phải khẳng định ngoài repository không có tích hợp khác.

| # / Feature/Function | Expected Behavior | Actual Implementation | Gap/Issue | Evidence | Documentation Recommendation |
|---|---|---|---|---|---|
| 1 — 3.7.1 Passenger roster | Mỗi slot có đủ thông tin người tương ứng; 4 slot thiếu3 người phải bị chặn ở API | FE kiểm tên mọi card khi sang bước3; array passengers BE optional, chỉ chặn length>participants; đủ roster chỉ khi services có chọn | **Validation thiếu — ảnh hưởng trực tiếp booking** | `B/bookings/bookings.validation.ts` createBookingBody; `bookings.service.ts:134`/extraPassengers guard; FE BookingEntryPage khoảng601 | Ghi PARTIALLY IMPLEMENTED, không viết rule “đủ người” đã enforce BE; cần test API 4/1 và4/0 có/không services |
| 2 — 3.7.1 Age validation | Tuổi/năm sinh thống nhất FE/BE và tương ứng guest type | FE kiểm tuổi theo năm khởi hành; BE năm≤năm hiện tại và không so tuổi/group khi booking thường | **Frontend/backend không đồng bộ** | `F/booking/utils/passengerValidation.ts`, `B/bookings/bookings.validation.ts`, createBookingOnce | Mô tả năm sinh optional và hai giới hạn khác nhau; không gọi đây là xác minh tuổi/giấy tờ |
| 3 — 3.7.1 Contact/VAT | Thông tin được nhập có cách lưu/hiển thị lại rõ ràng | FE hỏi email/gender nhưng POSTcontact chỉ fullName/phone; VAT nối vào notes rồi slice500 | **Dữ liệu UI không được lưu có cấu trúc** | BookingEntryPage submitBooking payload/VAT; schema Booking.contactName/Phone/notes | Không liệt kê contactEmail/gender/VAT invoice model giả; ghi email chỉ dùng form, VAT là ghi chú, chưa có xuất hóa đơn điện tử |
| 4 — 3.7.3/3.10.1 Inventory compensation | Booking/cancel thất bại không bỏ sót ghế hoặc hoàn sai quota | Reserve trước DB transaction; release khi lỗi có catch/log; cancel status transaction rồi release Premium/chỗ phía sau | **Logic chưa hoàn toàn atomic; crash/failure window** | `B/bookings/bookings.service.ts:134`, `:686`, `:736`; `B/tours/tours.repository.ts` reserve/release | Ghi atomic conditional decrement và compensation tách biệt; không hứa crash-safe toàn luồng. Cần fault-injection/reconciliation audit riêng |
| 5 — 3.7.5 Resume | Dễ tìm mọi đơn pending và không mất form đã nhập nếu sản phẩm yêu cầu draft | Banner chỉ đọc5 booking mới nhất,5 accepted request; booking thường form state trong memory | **Phân trang hạn chế; draft thường chưa có** | IncompleteBookingBanner query/target selection; BookingEntryPage state | Phân biệt resume đơn đã tạo, draft đoàn ở server, draft review cục bộ và form thường chưa lưu |
| 6 — 3.5.1 Fixed age prices | Breakdown và tổng đúng cùng price rule | calculateGuestPrice ưu tiên childPrice/infantPrice; các dòng breakdown TourBookingCard69–70 dùng percent | **Sai lệch số tiền hiển thị** | `C/age-pricing.ts:calculateGuestPrice`; `F/tours/components/detail/TourBookingCard.tsx` | Ghi tổng helper là preview chuẩn; dòng nhóm có bug khi fixed≠percent; cần case fixed-price trong component test |
| 7 — 3.4.2 Pets/search context | Chỉ hứa tiêu chí đi xuyên API và giữ đúng selection | Home có pets control nhưng API không có pets; detailHref chỉ giữ guest/date; `/explore` legacy chỉ giữ q | **UI ONLY / giới hạn giữ query** | `frontend/app/home/page.tsx`; searchToursQuery; `F/tours/utils/searchContext.ts`; `/explore/page.tsx` | Không đặc tả pets là bộ lọc nghiệp vụ; liệt kê chính xác field được giữ ở từng chuyển trang |
| 8 — 3.4.2 Search group limits | Validation tìm kiếm nhất quán với booking≤50/≥1adult | BE mỗi count có min/max, không refine tổng/ít nhất adult như helper booking | **Validation không đồng nhất** | tours.validation.searchToursQuery vs C/age-pricing.calculateGuestPrice | Ghi search có thể nhận tổ hợp không book được, checkout authority; không gán search match là booking guarantee |
| 9 — 3.5.1 Data freshness | Availability/giá là live khi người dùng đặt | Detail cache30s; search nhóm bỏ cache; checkout re-read/reserve | **Dữ liệu hiển thị có thể cũ — đã có bước recheck** | tours-discovery.service caches/search; bookable departure/createBooking | Phân biệt giá/chỗ tham khảo và đảm bảo chỉ sau create; runtime invalidation chưa test browser |
| 10 — 3.6.3 Cart web | Có trang web để thao tác giỏ hoặc ghi rõ không có | API/hook đầy đủ, `/traveler/cart` chỉ redirect `/tours`, không thấy mutation consumer web | **Thiếu frontend flow** | `frontend/app/traveler/cart/page.tsx`; `F/cart/api/cartApi.ts`; `B/carts/*` | PARTIALLY IMPLEMENTED; tài liệu manual cart cũ không là bằng chứng HEAD; không tự dựng UI trong audit |
| 11 — 3.6.2 Collections | Nhóm yêu thích thuộc đúng tài khoản/đồng bộ nếu sản phẩm yêu cầu | Helpers có user suffix nhưng WishlistPage gọi mặc định, local snapshots; không collection table/API | **Account isolation/local persistence chưa đầy đủ** | WishlistPage.loadData/getWishlistCollections(); `utils/wishlistCollections.ts` | Ghi local/browser-only; nguy cơ dùng chung default collection giữa tài khoản; chưa có cross-device sync |
| 12 — 3.6.1/3.12.1 Pagination | Truy cập đủ saved tours và review eligibility | Wishlist fetch page1 limit100 trong cap200; review helper lấy100 completed/own reviews | **Bỏ sót ngoài trang đầu** | WishlistPage/WISHLIST_UI_LIMITS; useTourReviewEligibility; BookingHistoryPage | Ghi rõ ceiling/tập data UI; backend vẫn chặn duplicate. Không gọi inventory/account history là đầy đủ chỉ từ UI |
| 13 — 3.10.1/2 Cancellation policy | Chính sách hiển thị và áp dụng có một nguồn/version rõ | Tour text riêng; window snapshot khi book; refund milestones lấy policy hiện tại khi cancel | **Business policy/version mismatch cần PO chốt** | BookingService.cancellationSnapshot/cancelMine/loadRefundMilestones; Tour.cancellationPolicy | Tách3 loại nguồn; ghi đúng công thức/code, không sao chép text tour thành refund rule; cần quyết định freeze milestones hay theo hiện tại |
| 14 — 3.10.2 Booking refund | Theo dõi khoản hoàn và kết quả chuyển tiền | Cancel paid flag/amount; late payment chủ yếu flag; complaint có ledgerPENDING; chưa có Traveler payout progress/automatic transfer. Booking.refundAmount/RefundLedger.amount còn Int trong khi totalAmount BigInt | **Logic chưa đầy đủ; thiếu UI/process settlement; rủi ro numeric range** | BookingService.cancelInternal/confirmPayment; schema Booking/RefundLedger; D-15; BookingDetail banner | Không viết “hoàn tiền tự động/đã hoàn”; phân biệt Premium refund. Suy luận từ schema: refund vượt Int32 có thể không persist dù booking amount hợp lệ; chưa tái hiện trên DB, cần test riêng |
| 15 — 3.8.3 Ticket/email recovery | Trả tiền thành công mà cấp vé/email lỗi vẫn phục hồi đúng | Có ticket repair bền vững; notify email có thể fail sau insert ticket, repair chỉ tìm thiếu ticket | **Phục hồi vé có, delivery email chưa đủ bằng chứng** | ETicketsService.issueForBooking; retryTicketFulfillment NOT EXISTS ticket; NotificationsService.notify catch | Ghi vé có thể có trong tài khoản dù mail chưa giao; không coi job repair bảo đảm resend mọi email |
| 16 — 3.9.2 QR/print | Nêu chính xác điều kiện hiện QR và in | List QR chỉVALID; ETicketCard chi tiết render QR theo code kể cả status khác, nút In vé/LưuPDF chỉVALID/USED qua window.print | **UI status khác giữa list/detail; không server PDF** | ETicketList.tsx; ETicketCard.tsx isPrintable/QRCodeDisplay | Ghi QR là code, server scan authority; canceled QR còn nhìn thấy không có hiệu lực. Không invent PDF endpoint/download storage |
| 17 — 3.11.2 Wallet used | Voucher đã dùng được phân loại used đúng | UserVoucher.isUsed không thấy được cập nhật bởi redemption; code-instance có isUsed riêng | **State không đồng bộ** | promotions.repository collect/list vs consumeCodeInstance; promotions.service.redeem/release; BookingRepository redemptions | PARTIALLY IMPLEMENTED wallet status; cần test booking success→wallet used→cancel theo loại mã, không chỉ test render fixture |
| 18 — 3.11.1/2 Eligibility/empty | “Khả dụng” phản ánh điều kiện sử dụng và lỗi không bị hiểu ví rỗng | Collect chỉ active; wallet active không so startsAt/quota/minimum; query error không có error state riêng | **Validation/UX error thiếu** | collectVoucher141; VoucherWalletPage.categorized/query destructuring | Mô tả đã lưu/chưa dùng khác đủ điều kiện; preview/redeem là authority; ghi lỗi có thể trông empty |
| 19 — 3.13.1 Notification count/read | Badge đủ unread toàn inbox, read lỗi được reconcile | Header count từ20 mục; optimistic update catch im lặng; error→[]; DELETE API không UI | **Frontend/backend capability mismatch** | Header notifications effect/count/handlers; sharedNotificationsApi; notifications.routes | Ghi badge giới hạn, chưa full inbox/delete; không báo hoàn chỉnh chỉ vì BE support |
| 20 — 3.13.2 Chat images | Ảnh dùng đúng API origin/auth và server length validation | FE fetch relative không Bearer, sau upload ghép Markdown dài thêm; controller cần CHAT_USE | **Chưa xác minh runtime / rủi ro auth và length** | ConversationPage.send khoảng779; chat.routes/controller; baseApi; next config nếu proxy | Chat text IMPLEMENTED; attachment end-to-end UNVERIFIED, cần browser/proxy integration. Không assert chắc chắn hỏng nếu môi trường có proxy khác |
| 21 — 3.12.3 Edit/delete review | Có quyền edit/delete nếu scope sản phẩm yêu cầu | Không có action/endpoint own; moderation hide/restore không thay thế | **NOT IMPLEMENTED** | reviews.routes.ts; review components | Ghi N/A chưa có, không tự thêm thời hạn sửa/xóa; báo cáo review đi qua Report |
| 22 — 3.14.4 Support / 3.15.2 password / 3.15.3 preferences / 3.16.4 refund | Có entry web cho chức năng API-only nếu định đưa vào UX | API/hook có nhưng chưa tìm thấy form web Traveler tương ứng | **PARTIALLY IMPLEMENTED** | SUPPORT routes; auth.change-password; voucherWalletApi prefs; PremiumPage vs premiumApi history/refund | Mỗi function ghi Non-screen/API-only; không đưa mock screen như đã triển khai |
| 23 — 3.15.4 Guide application | Quyết định đổi role do bên có thẩm quyền, dev action bị giới hạn môi trường | Self dev-accept/reject chỉ guard profile permission; service có thể đổi role với default application values | **Authorization gap nghiêm trọng trong API người dùng** | users.routes.ts guide-application/dev-accept; UsersService.devAcceptGuide, không env/admin guard | Đánh dấu thiếu quy trình duyệt đáng tin cậy; audit không gọi endpoint; cần negative authorization tests và PO quyết định |
| 24 — 3.17.3 Verified boundary | Quy tắc email verified cho booking thống nhất cả flow đoàn | `/bookings` route dùng requireVerifiedTraveler; custom request bookings route chỉ permission, controller→internal BookingsService không có email guard tương tự | **Business Rule chưa áp dụng tại đường vào đoàn** | custom-tours.routes/controller/createBooking291 vs bookings.routes/authorize.requireVerifiedTraveler | Ghi khác biệt endpoint; cần test User ACTIVE nhưng emailVerifiedAt null; không suy active luôn verified trong mọi dữ liệu legacy |
| 25 — 3.17.3 Passenger ID policy | Giấy tờ theo tuổi phù hợp yêu cầu PO | BE CCCD12 bắt buộc cho mọi passenger, kể cả infant, mỗi số unique trong booking | **Ý định nghiệp vụ cần PO xác nhận** | custom-tours.validation checkoutDraftShape; schema BookingPassenger comment/unique | Ghi đúng rule hiện tại; không tự đổi sang passport/birth certificate hoặc miễn trẻ nhỏ |
| 26 — 3.18.1 Consent | Nếu bắt buộc consent checkout thì có enforcement/version | Có accept endpoint/row; booking create không đọc PolicyAcceptance; page accepted state trong memory | **Business Rule chưa gắn flow; UI chưa hydrate lịch sử** | policyAcceptanceRouter; policies/page.tsx; BookingService.createOnce | Không khẳng định consent compulsory; cần PO xác định và trace version lưu với booking nếu yêu cầu |
| 27 — Background/integrations | Có bằng chứng jobs/provider chạy trong môi trường đích | Code có env.JOBS_ENABLED, provider env và retry; audit không chạy app/provider/DB | **UNVERIFIED môi trường, không phải khẳng định bug** | server.ts, config/env.ts, jobs/maintenance, PayOS/Cloudinary/Google/AI adapters | Giữ phân loại source và runtime riêng; không dùng unit PASS để tuyên bố live integration verified |
| 28 — Tests | Có regression tests cho những gap cần chặn | Subset219 test case PASS; nhiều unit mock, integration chưa chạy; thiếu assertions negative cho roster/API-only/self-approval/exact compensation fault | **Thiếu coverage xác minh mục tiêu** | Test log1.5 và bảng4.3; service tests có fixture không đủ roster vẫn success | Ghi test scope thật; ưu tiên cases rủi ro, không ghi “full test suite PASS” hoặc “đã audit production” |
| 29 — 3.9.1/3.10.2 Own booking DTO | Traveler xem lại đủ roster thường và dữ liệu hoàn đã lưu nếu thuộc scope | toBookingDto dùng relation passengers, không fallback passengerSnapshot; không xuất refundAmount/cancelNote/cancellationPolicySnapshot; UI roster dùng guestType/CCCD đoàn | **Data projection thiếu — storage khác API/UI** | `B/bookings/bookings.mapper.ts:toBookingDto`; repository.create/findById; BookingDetailPage passengers section | Phân biệt “đã lưu” với “đã hiển thị”; không khẳng định DB thiếu roster chỉ vì own UI không thấy |

### 5.2. Tổng hợp trạng thái chức năng

Inventory gồm **16 Feature / 52 Function**: 40 Function gắn nhãn IMPLEMENTED theo phạm vi source đã mô tả (có thể kèm giới hạn), 11 PARTIALLY IMPLEMENTED và1 NOT IMPLEMENTED. Có29 mục gap/review; các capability UI ONLY/MOCKED/UNVERIFIED được ghi ở phạm vi thành phần, không ép cả feature vào cùng một nhãn. Tổng test đã chạy là175 backend +44 frontend =219 test case, không phải số assertions hay toàn bộ suite.

**Các luồng đã có xử lý thực trong web/BE:** đăng ký/OTP/login/Google/password recovery/session; Home/search/detail/print/public profile; lưu tour và collections cục bộ; chọn dịch vụ/quote/create/idempotency/hold expiry/resume đơn đã tồn tại; PayOS checkout/reconcile, ticket issuance/repair, history/ticket/completion/cancel; collect/preview/redeem/release voucher; public/own review/create/draft; chat text/AI; report/complaint/escalation/CSAT; profile/avatar/2FA; Premium plans/purchase/renew/grant/use voucher; request đoàn/offer revision/roster booking; đọc/accept policy. “Có xử lý thực” có thể đi kèm gap đã liệt kê, không khẳng định không còn lỗi.

**Các luồng mới hoàn thiện một phần trên web:** roster thường chưa enforce đủ BE; cart thiếu UI; wallet used state; notification inbox/count/error handling; booking refund settlement; support ticket entry, password-change form, preferences editor, guide application/approval, future Premium refund self-service. Các route/client API-only được giữ trong inventory vì có capability cho Traveler, nhưng không mô tả như có màn hình thao tác.

**Các capability chưa tìm thấy triển khai trong scope:** sửa/xóa review own; bank refund booking tự động và lịch sử payout Traveler đầy đủ; multi-gateway thanh toán booking ngoài PayOS; recurring auto-debit Premium; backend sync collections/recent history; personalized recommendation engine; pets search/filter; sửa lịch/số khách/roster đơn đã tạo; VAT invoice điện tử có cấu trúc. Đây là danh sách kiểm tra/giới hạn, không tự mở rộng thành yêu cầu phát triển đã được duyệt. Pets có control UI nhưng không có nghiệp vụ đi kèm.

**Ảnh hưởng trực tiếp cần ưu tiên review:** (1) booking4slot/1passenger lọt API; (2) self-approval Guide; (3) inventory compensation sau lỗi/crash; (4) giá breakdown fixed-age khác tổng; (5) tiền đã trả nhưng booking expired/refund còn thủ công; (6) wallet used và notification unread/error lệch; (7) collection local không tách user tại một số caller; (8) email verification ở flow đoàn. Các vấn đề chưa được sửa trong audit.

### 5.3. Business Rules cần bổ sung vào tài liệu chính thức

Danh sách sau là nội dung đã thấy trong code, **chưa gán BR ID**. PO có thể bổ sung ID theo registry chính thức, không dùng số thứ tự ở đây làm ID giả.

1. Tổng khách/chỗ gồm cả infant,≥1 adult, tối đa50; tuổi tính theo năm khởi hành; ưu tiên giá tuyệt đối/null/percent; quy tắc round/floor phụ thuộc từng loại tính tiền.
2. `subtotal tour` khác `servicesSubtotal`; voucher chỉ giảm tour; tổng payable tối thiểu1 VND; commission là khoản phân bổ nội bộ, không tự thêm một khoản phí checkout mới.
3. Booking thường PENDING giữ chỗ15 phút; same key/same fingerprint replay một đơn; một pending cùng Traveler/tour/departure; seat reservation/compensation boundary và lỗi cần reconcile.
4. Chỉ verified payment server confirm Booking; Payment.PAID khác Booking.CONFIRMED và ticket fulfillment; late payment không revive đơn hết hạn/hủy mà cần refund.
5. Cancellation window snapshot theo đơn, fallback legacy24h; refund milestones hiện tại khi hủy; mặc định7ngày100%,3ngày50%,còn lại0%, floor; hủy paid không tự chuyển tiền.
6. Một ticket/booking; issuance/ cancellation/completion lock/guard; QR code ổn định, offline có thể stale, server scan kiểm final validity; print là browser.
7. Agency discount trước platform, riêng redemption; Premium không stack; unique batch code thuộc đúng booking/user; release đúng transaction/owner; ví UserVoucher khác code instance.
8. Review chỉ own completed/endDate đã kết thúc, một review/booking, hidden vẫn chiếm lượt; điểm tour chỉ VISIBLE; draft local không phải review server.
9. Notification/email là kênh riêng; unread/retention; khung giờ nhắc voucher theo Việt Nam,48h/3h/12h; chưa có UI preferences editor.
10. Chat participation/role pairing; limit/profanity; thread messages không sửa/xóa; AI advisory không có tool/giá/inventory live.
11. Report, ComplaintTicket và SupportTicket là3 flow riêng; complaint CLOSED/CSAT một lần, auto-close72h; refund ledger ghi nhận khác chuyển tiền.
12. Premium audience/flag/quota/version snapshot; kỳ nối tiếp không auto-debit; grant voucher khi kỳ bắt đầu; refund chỉ kỳ paid tương lai và admin ghi reference.
13. Group request2–50, clonePRIVATE, versioned offer/checkout revision, đủ roster/CCCD12 mọi tuổi, một live Booking/request; reuse payment/expiry; không tạo GuideAssignment tự động.
14. PolicyAcceptance theo effective version, không tự coi checkbox là create-booking guard; xác định chỗ lưu version/consent nếu trở thành rule bắt buộc.

### 5.4. Câu hỏi cần Product Owner quyết định

1. “Đủ thông tin mỗi slot” tối thiểu là fullName hay phải có birthYear/phone/giấy tờ? Có áp cho booking thường cả khi không chọn dịch vụ? Năm sinh có thể theo năm khởi hành tương lai?
2. Infant có luôn chiếm một chỗ như code web/BE hiện tại? Tour không có agePricing có nên từ chối trẻ em/em bé hay tính adult? Nguồn giá tuyệt đối so percent cái nào là chính thức?
3. Hủy dùng policy snapshot toàn bộ hay chỉ window? Refund services/voucher phân bổ thế nào; refund0 có cần flag? Ai xử lý payout, SLA nào và dữ liệu transfer nào Traveler được xem?
4. Giỏ tour còn nằm trong product scope hay route redirect là chủ ý loại bỏ? Nếu có, chỉ shortlist/đặt từng dòng hay checkout nhiều tour?
5. Collections/recent có cần tách theo tài khoản và đồng bộ thiết bị? Saved tour vượt100 và review lịch sử vượt100 có yêu cầu truy cập đầy đủ trên UI?
6. Voucher shared có được tái dùng đến usageLimitPerUser, hay mỗi wallet item chỉ dùng một lần? Tab “khả dụng” có cần đủ mọi điều kiện theo booking context? Collect có cần chặn chưa bắt đầu/hết hạn?
7. Các API-only support/preferences/password-change/Premium refund có cần web UI trong bản phát hành hiện tại? Không mặc nhiên đồng ý phát triển chỉ từ audit.
8. Ai có thẩm quyền duyệt chuyển Traveler→Guide? Các endpoint dev phải tồn tại ở môi trường nào? Dữ liệu Traveler/booking/Premium giữ thế nào khi role đổi?
9. Booking đoàn có phải bắt buộc email verified như booking thường? CCCD12 cho em bé/trẻ em có đúng yêu cầu hay cần loại giấy tờ khác? Chính sách sửa danh sách sau khi tạo đơn là gì?
10. Tác giả có được sửa/xóa review hay chỉ báo cáo? Có yêu cầu đã check-in thay vì chỉ COMPLETED/endDate? Ẩn review có phải một trạng thái vẫn chặn viết lại?
11. Premium có quyền lợi nào ngoài bộ voucher và membership hiển thị cần enforce? Có yêu cầu auto-renew hoặc chỉ mua kỳ mới? Refund future period có cần dồn lại thời gian các kỳ kế tiếp hay để gap?
12. Consent terms/privacy có phải prerequisite đăng ký/booking hay chỉ tùy chọn? Cần lưu policy version theo booking/payment nào?
13. Có production deployment/proxy/config nào hỗ trợ upload chat khác cấu hình repo? Ai xác minh JOBS_ENABLED/SMTP/PayOS/Cloudinary/Google/AI và end-to-end trước khi ghi “verified vận hành”?

### 5.5. Hướng dùng bản đặc tả

Part3 là nội dung chức năng để review/đưa vào tab Traveler; giữ nguyên các câu nêu PARTIAL/GAP cho tới khi code thay đổi hoặc PO chốt scope. Part2 dùng làm checklist chức năng; Part4 là phụ lục kiểm chứng; Part5 là danh sách vấn đề và câu hỏi, không phải lệnh sửa ứng dụng. Screenshot có thể bổ sung sau tại Screen layout của từng function; audit không tạo hình ảnh và không chỉnh Google Docs.

Kết quả kiểm tra code/test trong tài liệu áp dụng baseline đã nêu, không thay cho nghiệm thu môi trường chạy. Chỉ thêm/cập nhật **tài liệu audit** trong working tree; không thay mã ứng dụng, database, cấu hình, migration hoặc thực hiện commit/push/deployment/giao dịch thật.
