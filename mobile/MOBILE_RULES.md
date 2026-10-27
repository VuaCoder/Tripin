# BỘ NGUYÊN TẮC PHÁT TRIỂN MOBILE (MOBILE_RULES.md)
**DỰ ÁN:** TRIPRI TRAVEL PLATFORM – PHÂN HỆ FLUTTER MOBILE
**DÀNH CHO:** TOÀN BỘ CÁC AI AGENT & LẬP TRÌNH VIÊN THAM GIA DỰ ÁN

> [!CAUTION]
> **TÍNH TUÂN THỦ TUYỆT ĐỐI (NON-NEGOTIABLE):** Bất kỳ AI Agent nào vi phạm các nguyên tắc dưới đây đều bị coi là gây lỗi nghiêm trọng (Hallucination/Architecture Violation). Phải đọc kỹ và tuân thủ 100% trước khi viết mã nguồn hoặc đề xuất phương án.

---

## 🛑 BỘ QUY TRÌNH 5 BƯỚC BẮT BUỘC KHI AI NHẬN TASK (MANDATORY WORKFLOW)

Mỗi khi AI được giao bất kỳ công việc nào, **BẮT BUỘC THỰC HIỆN ĐÚNG THỨ TỰ 5 BƯỚC SAU:**

```
[BƯỚC 1: ĐỌC TÀI LIỆU QUY CHUẨN] 
   └── Đọc MOBILE_RULES.md, app_colors.dart, api_endpoints.dart
          │
[BƯỚC 2: KIỂM TRA TASK & TIÊU CHÍ NGHIỆM THU]
   └── Tra cứu mã Flow trong plan_mobile_5_members.md, đọc rõ Luồng bước & AC1 -> AC5
          │
[BƯỚC 3: THỰC HIỆN CÔ LẬP (STRICT ISOLATION)]
   └── Chỉ code trong feature của mình. TUYỆT ĐỐI KHÔNG ĐỤNG VÀO CODE CỦA MODULE KHÁC!
          │
[BƯỚC 4: TỰ CHẠY KIỂM THỬ (SELF-TESTING)]
   └── Chạy `flutter test` và `flutter analyze` xác nhận không có lỗi biên dịch / cảnh báo
          │
[BƯỚC 5: XÁC MINH TRÊN ANDROID STUDIO VIRTUAL DEVICE]
   └── Chạy trên máy ảo (tab Running Devices) kết nối backend 10.0.2.2:3001, nghiệm thu đủ ACs
```

### Chi tiết từng bước:
1. **Bước 1 (Đọc file quy chuẩn trước tiên):**
   - Đọc file `MOBILE_RULES.md` này để nắm rõ các giới hạn kiến trúc.
   - Đọc file `mobile/lib/core/constants/app_colors.dart` để lấy mã màu chuẩn.
   - Đọc file `mobile/lib/core/constants/api_endpoints.dart` để gọi đúng URL backend.
2. **Bước 2 (Kiểm tra Task & Phạm vi):**
   - Tra cứu đúng mã Task được phân công trong [`plan_mobile_5_members.md`](file:///C:/Users/HOANG%20PHUC/.gemini/antigravity-ide/brain/2bd31de8-1745-4139-959b-7c8c64a597e1/plan_mobile_5_members.md).
   - Đọc kỹ danh sách các bước luồng công việc (Bước 1 -> 4+), bộ tiêu chí nghiệm thu (**AC1 $\rightarrow$ AC5**) và các API Backend liên kết.
3. **Bước 3 (Thực hiện với tính cô lập cao - ZERO REGRESSION):**
   - Chỉ tạo/chỉnh sửa file trong đúng thư mục module được giao (ví dụ: `mobile/lib/features/auth/`, `tours/`, `bookings/`,...).
   - **QUY TẮC CẤM ĐỤNG CODE CŨ:** Tuyệt đối **KHÔNG ĐƯỢC CHỈNH SỬA, XOÁ HOẶC LÀM THAY ĐỔI CÁC FILE CODE CỦA MODULE KHÁC ĐÃ HOÀN THÀNH**. Mỗi module phải hoạt động độc lập qua DI hoặc Interface. Tuyệt đối không để xảy ra tình trạng "xong task này làm hỏng task kia".
   - Bắt buộc dùng màu từ `AppColors`, không hardcode mã màu hex.
4. **Bước 4 (Tự động kiểm thử & Phân tích lỗi):**
   - Chạy lệnh `flutter analyze` trong thư mục `mobile`: Xác nhận **0 error, 0 warning**.
   - Chạy lệnh `flutter test` trong thư mục `mobile`: Đảm bảo 100% test cases đã có và test case mới đều **PASS**.
5. **Bước 5 (Kiểm thử thực tế trên Android Studio Virtual Device):**
   - Mở cửa sổ nhúng *Running Devices* trong Android Studio, kết nối backend đang chạy ở máy host.
   - Trực tiếp kiểm thử kịch bản tương tác xem có thỏa mãn đầy đủ AC1 -> AC5 hay không trước khi thông báo hoàn thành cho người dùng.

> [!WARNING]
> **QUY TẮC QUẢN LÝ GIT (CẤM TỰ ĐỘNG COMMIT & PUSH):**
> - Tuyệt đối **KHÔNG** tự ý chạy lệnh `git commit` hay `git push` sau khi hoàn thành task.
> - Toàn bộ code phải để ở local cho người dùng trực tiếp review, chạy thử và nghiệm thu.
> - **CHỈ** thực hiện commit/push khi người dùng yêu cầu rõ ràng.

---

## 🎨 HỆ THỐNG BẢNG MÀU CHUẨN THƯƠNG HIỆU (COLOR PALETTE)
*Được định nghĩa tại: [`mobile/lib/core/constants/app_colors.dart`](file:///d:/fifa/CHUY%C3%8AN%20NG%C3%80NH%208/WDP302/travel-platform/mobile/lib/core/constants/app_colors.dart)*

> [!IMPORTANT]
> **CẤM HARDCODE MÃ MÀU HEX!** Mọi Widget trên toàn bộ ứng dụng Mobile BẮT BUỘC sử dụng các hằng số màu từ lớp `AppColors`:

| Tên Hằng Số | Mã Màu Hex | Ý Nghĩa & Ngữ Cảnh Sử Dụng |
| :--- | :--- | :--- |
| `AppColors.primary` | `#005A64` | **Màu xanh ngọc chủ đạo (Brand Teal)**: Appbar, nút bấm chính, tab đang chọn. |
| `AppColors.primaryLight` | `#087E8B` | **Xanh ngọc sáng**: Focus border, icon nổi bật, badge thể loại. |
| `AppColors.primaryDark` | `#003F46` | **Xanh ngọc đậm**: Trạng thái hover, pressed, container tối. |
| `AppColors.primarySurface` | `#E6F3F4` | **Nền ngọc nhạt**: Nền icon, chip được chọn, highlight container. |
| `AppColors.secondary` | `#F5A623` | **Màu cam điểm nhấn (Accent Orange)**: Ngôi sao đánh giá, nút Đặt tour, thẻ Sale. |
| `AppColors.secondaryDark` | `#E09215` | **Cam đậm**: Trạng thái nhấn nút cam, border nhấn mạnh. |
| `AppColors.secondarySurface` | `#FEF3C7` | **Cam nhạt**: Nền voucher giảm giá, tag khuyến mãi. |
| `AppColors.success` | `#10B981` | **Thành công (Xanh lá)**: Vé hợp lệ, thanh toán xong, đã điểm danh. |
| `AppColors.warning` | `#F59E0B` | **Cảnh báo (Vàng hổ phách)**: Sắp hết hạn, chờ duyệt, lưu ý hoàn hủy. |
| `AppColors.error` | `#EF4444` | **Lỗi / Thất bại (Đỏ)**: Hủy đơn, sai OTP, vé không hợp lệ, báo sự cố. |
| `AppColors.background` | `#F8FAFC` | **Nền ứng dụng (Slate 50)**: Nền toàn bộ màn hình, chống mỏi mắt. |
| `AppColors.backgroundSand` | `#FBF9F5` | **Nền màu cát ấm**: Dùng cho banner tour hoặc section đặc sắc. |
| `AppColors.surface` | `#FFFFFF` | **Bề mặt trắng**: Thẻ Card tour, Dialog, BottomSheet. |
| `AppColors.surfaceVariant` | `#F1F5F9` | **Bề mặt phụ (Slate 100)**: Nền ô nhập liệu Input, divider nhẹ. |
| `AppColors.border` | `#E2E8F0` | **Đường viền (Slate 200)**: Viền thẻ tour, viền ô nhập mặc định. |
| `AppColors.textPrimary` | `#0F172A` | **Chữ chính (Slate 900)**: Tiêu đề tour, giá tiền, chữ nhấn mạnh. |
| `AppColors.textSecondary` | `#64748B` | **Chữ phụ (Slate 600)**: Mô tả, địa điểm, phụ đề, nhãn ô nhập. |
| `AppColors.textMuted` | `#94A3B8` | **Chữ mờ (Slate 400)**: Placeholder, icon không kích hoạt. |

---

## 1. NGUYÊN TẮC PHẠM VI VAI TRÒ (STRICT ROLE SCOPING)
1. **Chỉ phục vụ 2 đối tượng:**
   - **`TRAVELER` (Khách du lịch):** Khám phá tour, tìm kiếm & lọc, wishlist, xem chi tiết & timeline lịch trình, đặt tour, áp mã voucher, thanh toán VietQR PayOS, xem vé điện tử QR, hủy tour, đánh giá review, chat với HDV.
   - **`TOUR_GUIDE` (Hướng dẫn viên):** Quản lý hồ sơ chuyên môn (số thẻ, ngôn ngữ, kinh nghiệm, ảnh thẻ), xem lịch tour được phân công, chấp nhận/từ chối tour, mở camera quét mã QR vé e-ticket điểm danh khách, xem bảng thu nhập/thù lao, chat với đoàn khách.
2. **Tuyệt đối KHÔNG làm Agency hoặc Admin/Moderator trên Mobile:**
   - Mọi chức năng quản lý của công ty lữ hành (đăng bán tour, quản trị nhân sự, duyệt doanh thu, xuất PDF khách hàng...) và quản trị viên (kiểm duyệt tour, xử lý báo cáo, audit log...) **thuộc 100% về Web Desktop**.
   - Cấm tạo thư mục `mobile/lib/features/agency` hoặc `mobile/lib/features/admin`.

---

## 2. NGUYÊN TẮC CƠ SỞ DỮ LIỆU (ZERO DATABASE EXPANSION)
1. **CẤM mở rộng Database:**
   - Tuyệt đối **KHÔNG** được chỉnh sửa, thêm bảng mới, hoặc thêm cột mới vào `prisma/schema.prisma`.
   - Toàn bộ tính năng Mobile phải map 1-1 với cấu trúc database và các endpoint backend hiện có.
2. **Hồ sơ Hướng dẫn viên (`GuideProfile`):**
   - Đã có sẵn trong database với các trường: `bio`, `languages`, `specialties`, `experienceYears`, `licenseNumber`, `licenseImageUrl`.
   - Cấm tự chế thêm trường hay quy trình KYC phức tạp mới nếu backend chưa có.

---

## 3. NGUYÊN TẮC BẢN ĐỒ & TỌA ĐỘ (NO GPS / COORDINATES FOR TOURS)
1. **Tour không có tọa độ GPS:**
   - Model `Tour` trong Prisma lưu lịch trình dưới dạng mảng JSON `itinerary`: `[{ day, title, description?, activities[] }]`. Không hề có tọa độ Latitude/Longitude.
   - Lịch trình tour phải được thể hiện dạng **Step Timeline trục đứng trực quan** (Ngày 1, Ngày 2... Sáng/Trưa/Chiều/Tối - điểm tham quan, ẩm thực, nghỉ ngơi).
2. **Cấm nhồi nhét bản đồ map:** Không tích hợp Google Maps hay Leaflet để vẽ tọa độ tour gây giật lag và sai lệch thiết kế dữ liệu.

---

## 4. NGUYÊN TẮC ĐĂNG KÝ & ĐIỀU HƯỚNG (BÁM SÁT BẢN WEB)
1. **Hai luồng đăng ký riêng biệt:**
   - Không tạo 1 form gộp có nút bấm/dropdown "chọn vai trò".
   - Phải tách thành 2 entrypoint/màn hình đăng ký riêng biệt bám sát Web:
     - Luồng Khách du lịch (`role: 'TRAVELER'`)
     - Luồng Hướng dẫn viên (`role: 'TOUR_GUIDE'`)
2. **Điều hướng chuẩn vai trò sau đăng nhập:**
   - Khi `POST /auth/login` thành công, đọc trường `role` trong payload trả về:
     - Nếu `TRAVELER` -> Đẩy vào Bottom Navigation Khách du lịch.
     - Nếu `TOUR_GUIDE` -> Đẩy vào Bottom Navigation Hướng dẫn viên.
   - Tuyệt đối không để lẫn lộn giao diện giữa 2 vai trò.

---

## 5. NGUYÊN TẮC UPLOAD & QUẢN LÝ HÌNH ẢNH (CLOUDINARY CONTRACT)
1. **Không gửi file ảnh trực tiếp qua server backend:**
   - Phải tuân thủ cơ chế chữ ký an toàn có sẵn của backend:
     - Bước 1: Gọi `POST /api/v1/users/me/avatar/upload-signature` (hoặc `license-image/upload-signature`) lấy token chữ ký Cloudinary.
     - Bước 2: Tải file ảnh trực tiếp từ Mobile lên máy chủ Cloudinary.
     - Bước 3: Gọi `POST /api/v1/users/me/avatar/complete` (hoặc `license-image/complete`) gửi `publicId` để backend lưu URL vào database.
2. **Hiển thị ảnh:** Luôn dùng `cached_network_image` kèm Shimmer loading placeholder để tránh giật lag UI khi tải danh sách tour.

---

## 6. NGUYÊN TẮC MÔI TRƯỜNG CHẠY & NATIVE (ANDROID STUDIO VIRTUAL DEVICE)
1. **Địa chỉ IP máy ảo:**
   - Khi chạy trên Android Studio Virtual Device, Base URL kết nối backend **BẮT BUỘC LÀ**: `http://10.0.2.2:3001/api/v1`.
   - Cấm dùng `http://localhost:3001` (vì localhost trong máy ảo trỏ vào chính nó).
2. **Cấu hình Native bất khả xâm phạm:**
   - `android.overridePathCheck=true` trong `gradle.properties` (xử lý đường dẫn tiếng Việt `CHUYÊN NGÀNH 8`).
   - `kotlin.incremental=false` trong `gradle.properties` (xử lý lỗi xung đột ổ đĩa C: và D:).
   - `isCoreLibraryDesugaringEnabled = true` với `desugar_jdk_libs:2.1.4` trong `app/build.gradle.kts` (phục vụ thông báo đẩy).
   - `android:usesCleartextTraffic="true"` trong `AndroidManifest.xml` (cho phép gọi HTTP nội bộ không bị Android 9+ chặn).

---

## 7. NGUYÊN TẮC CODE VÀ QUẢN LÝ TRẠNG THÁI (CODE CONVENTIONS)
1. **Kiến trúc thư mục:** Mọi tính năng mới phải nằm trong `mobile/lib/features/<tên_chức_năng>/` gồm: `bloc/` (hoặc `cubit/`), `models/`, `screens/`, `widgets/`.
2. **Quản lý Token:** Access Token và Refresh Token bắt buộc lưu trữ an toàn bằng `flutter_secure_storage`.
3. **Mã vé E-Ticket:** Sử dụng `qr_flutter` để vẽ mã QR của vé điện tử chuẩn từ mã vé (`code` dạng `ET-XXXX-XXXX`), không tự chế format mã vé khác backend.
4. **Quét mã QR:** Sử dụng `mobile_scanner` để quét vé tại luồng của Hướng dẫn viên, có kiểm soát rung và âm thanh khi quét trúng vé hợp lệ.
