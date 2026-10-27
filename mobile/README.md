# Tripri Mobile Starter Template (Flutter)

Dự án Flutter nền tảng Du lịch Tripri phục vụ môn học **PRM393 – Mobile Application Development (Flutter)**.

> 💡 **QUY CHUẨN THIẾT KẾ:** Thư mục `mobile/` này được cấu hình dưới dạng **Starter Template**. Nghĩa là chỉ chứa các file cấu hình (config), hạ tầng core (network, storage, theme, notifications) và các thư mục rỗng để viết code (`features/`, `shared/`), **hoàn toàn KHÔNG chứa mã nguồn nghiệp vụ viết sẵn**. Các bạn sinh viên / thành viên nhóm sẽ trực tiếp hiện thực hóa giao diện và logic vào từng thư mục tương ứng.

---

## 📁 Cấu trúc Thư mục Chi tiết (Directory Structure)

```text
mobile/
├── android/                         <-- Mã nguồn Android Native (Gradle, AndroidManifest, Permissions)
├── web/                             <-- Nền tảng Web
├── windows/                         <-- Nền tảng Windows Desktop
├── test/
│   └── widget_test.dart             <-- Test khởi chạy cơ bản
├── pubspec.yaml                     <-- Quản lý dependencies (Dio, Bloc, Storage, Notifications)
├── analysis_options.yaml            <-- Cấu hình linter chuẩn cho Dart
└── lib/
    ├── core/                        <-- [HẠ TẦNG DÙNG CHUNG - ĐÃ CẤU HÌNH SẴN]
    │   ├── constants/
    │   │   ├── api_endpoints.dart   <-- Danh sách endpoints backend API (cổng 3001)
    │   │   └── app_colors.dart      <-- Bảng màu Tripri Brand (Teal & Slate)
    │   ├── network/
    │   │   └── api_client.dart      <-- Dio Client với Interceptor tự động gắn Bearer Token
    │   ├── services/
    │   │   └── notification_service.dart <-- Cấu hình thư viện flutter_local_notifications
    │   ├── storage/
    │   │   └── token_storage.dart   <-- Quản lý JWT Access & Refresh Token an toàn
    │   └── theme/
    │       └── app_theme.dart       <-- Cấu hình Material 3 và Google Fonts Inter
    │
    ├── features/                    <-- [CÁC THƯ MỤC ĐỂ BẠN TỰ CODE TÍNH NĂNG - CHỈ TRAVELER & TOUR GUIDE]
    │   ├── auth/                    <-- [BẠN 1] Đăng ký đa vai trò (Traveler & Tour Guide), Login, OTP, Phân tuyến Role
    │   ├── profile/                 <-- [BẠN 1] Hồ sơ cá nhân, Upload Avatar, Hồ sơ KYC Hướng dẫn viên (Upload ảnh thẻ HDV)
    │   ├── tours/                   <-- [BẠN 2 & 3] Trang chủ, Danh mục, Tìm kiếm đa tiêu chí, Chi tiết tour & Timeline lịch trình
    │   ├── wishlist/                <-- [BẠN 2] Traveler: Danh sách tour yêu thích
    │   ├── bookings/                <-- [BẠN 4] Đặt tour, Lịch sử đặt chỗ, Vé điện tử QR code & Hủy tour
    │   ├── vouchers/                <-- [BẠN 4] Ví voucher & Áp dụng mã giảm giá PayOS
    │   ├── guide/                   <-- [BẠN 5] Tour Guide: Lịch dẫn tour, Xác nhận nhận tour, Quét QR Camera điểm danh, Thu nhập
    │   ├── chat/                    <-- [BẠN 5] Chat Realtime Socket.IO (Khách - HDV) & Trợ lý ảo AI Assistant
    │   └── notifications/           <-- [BẠN 5] Trung tâm thông báo push & Báo cáo sự cố tour
    │
    ├── shared/                      <-- [CÁC THÀNH PHẦN DÙNG CHUNG CẦN VIẾT]
    │   ├── models/                  <-- Models, DTOs, JSON Serializers
    │   └── widgets/                 <-- UI Widgets tái sử dụng (Custom Button, Input Field, Card,...)
    │
    └── main.dart                    <-- Entrypoint khởi chạy app & màn hình kiểm tra kết nối API
```

---

## 🛠 Thư viện cài đặt sẵn (`pubspec.yaml`)

- **Quản lý trạng thái (State Management)**: `flutter_bloc`, `equatable`
- **Kết nối mạng (Networking)**: `dio`
- **Thông báo cục bộ (Notifications)**: `flutter_local_notifications`
- **Lưu trữ dữ liệu an toàn (Storage)**: `flutter_secure_storage`, `shared_preferences`
- **Giao diện & Tiện ích (UI & Helpers)**: `google_fonts`, `intl`, `cached_network_image`

---

## 🚀 Hướng dẫn Chạy Ứng dụng

### 1. Yêu cầu bắt buộc: Bật Backend trước
Ứng dụng mobile cần kết nối với backend để tải dữ liệu. Hãy mở terminal riêng tại thư mục gốc dự án và chạy:
```bash
pnpm run dev:backend
# hoặc: pnpm --filter backend dev
```
> Server sẽ chạy tại: `http://localhost:3001`

### 2. Chạy Virtual Device trực tiếp bên trong Android Studio (Tab Running Devices)
1. Mở **Android Studio**.
2. Chọn **Open** và trỏ đến thư mục `travel-platform/mobile`.
3. Kiểm tra cài đặt để máy ảo nhúng bên trong:
   - Vào **File -> Settings** (Windows) -> **Tools** -> **Emulator** -> Tích chọn **"Launch in the Running Devices tool window"**.
4. Mở tab **Device Manager** ở thanh công cụ bên phải Android Studio:
   - Bấm nút **Play (▶)** cạnh tên máy ảo Android của bạn.
   - Máy ảo sẽ khởi động và hiển thị ngay tại tab **Running Devices** bên trong Android Studio (không bị nhảy ra cửa sổ rời bên ngoài).
5. Nhìn lên thanh công cụ trên cùng (Toolbar), đảm bảo dropdown thiết bị đã chọn máy ảo đó.
6. Nhấn nút **Run 'main.dart'** (tam giác xanh hoặc nhấn `Shift + F10`). Ứng dụng sẽ build và hiển thị trực tiếp trong Android Studio.

### 3. Hoặc chạy qua Terminal
Tại thư mục `mobile`:
```bash
flutter pub get
flutter run
```

---

## 🌐 Địa chỉ Kết nối Backend API

File cấu hình tại `lib/core/constants/api_endpoints.dart`:
- **Android Emulator**: Tự động nhận diện host qua `http://10.0.2.2:3001/api/v1`.
- **Web & Windows Desktop**: Kết nối qua `http://localhost:3001/api/v1`.
- **Điện thoại thật (Physical Device cắm cáp)**: Chạy lệnh sau trên máy tính để chuyển tiếp cổng:
  ```bash
  adb reverse tcp:3001 tcp:3001
  ```
- **Cho phép HTTP**: Đã cấu hình `android:usesCleartextTraffic="true"` trong `AndroidManifest.xml` để không bị Android 9+ chặn kết nối nội bộ.

---

## ⚡ Lộ trình Thần tốc 1 Tuần (7-Day Sprint)

| Ngày | Trọng tâm công việc cho cả 5 bạn | Kết quả nghiệm thu cuối ngày (EOD) |
| :--- | :--- | :--- |
| **Thứ 2 (Day 1)** | Dựng Base UI (Login, Home, Booking form, Guide tours, Chat list) & Models | Mọi màn hình chính có UI tĩnh hoàn chỉnh |
| **Thứ 3 (Day 2)** | Hoàn thiện UI chi tiết (OTP, Tour Itinerary, Voucher, QR Scanner, Chat bubble) | 100% UI màn hình phụ và điều hướng mượt mà |
| **Thứ 4 (Day 3)** | Tích hợp API Đợt 1 (Auth, Lấy danh sách Tour thật, Đặt chỗ cơ bản, Socket.IO) | Dữ liệu thật từ backend (3001) hiển thị trên app |
| **Thứ 5 (Day 4)** | Tích hợp API Đợt 2 (Phân quyền Role, Thanh toán PayOS, Quét QR Check-in, Notif) | Các nút bấm và tương tác nghiệp vụ hoàn tất |
| **Thứ 6 (Day 5)** | Gộp code chung (Merge Git) & Kiểm thử liên thông chéo giữa 5 bạn | Chạy trọn vẹn kịch bản từ Đặt tour -> Quét QR check-in |
| **Thứ 7 (Day 6)** | Tối ưu UI/UX, thêm Shimmer loading, xử lý lỗi mất mạng (Offline/Error state) | Giao diện chỉn chu, mượt mà chuẩn demo |
| **Chủ Nhật (Day 7)** | Chạy test, build file `.apk` cài đặt và đóng gói tài liệu | Xuất bản file APK nộp bài và demo hoàn chỉnh |

---

## 🧪 Kiểm thử (Testing)
Chạy lệnh:
```bash
flutter test
```
