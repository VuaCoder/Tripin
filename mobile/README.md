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
    ├── features/                    <-- [CÁC THƯ MỤC ĐỂ BẠN TỰ CODE TÍNH NĂNG]
    │   ├── auth/                    <-- Màn hình Đăng nhập, Đăng ký, OTP, Quên mật khẩu
    │   ├── tours/                   <-- Danh sách tour, Chi tiết tour, Tìm kiếm, Đánh giá
    │   ├── bookings/                <-- Đặt chỗ, Thanh toán, Lịch sử vé
    │   ├── notifications/           <-- Danh sách thông báo, Chi tiết thông báo
    │   ├── chat/                    <-- Danh sách hội thoại, Tin nhắn thời gian thực
    │   └── profile/                 <-- Hồ sơ cá nhân, Đổi mật khẩu, Kho voucher
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
- **Bản đồ (Maps)**: `flutter_map`, `latlong2`

---

## 🚀 Hướng dẫn Chạy Ứng dụng

### 1. Yêu cầu bắt buộc: Bật Backend trước
Ứng dụng mobile cần kết nối với backend để tải dữ liệu. Hãy mở terminal riêng tại thư mục gốc dự án và chạy:
```bash
pnpm run dev:backend
# hoặc: pnpm --filter backend dev
```
> Server sẽ chạy tại: `http://localhost:3001`

### 2. Mở dự án trong Android Studio
1. Mở **Android Studio**.
2. Chọn **Open** và chọn thư mục `travel-platform/mobile`.
3. Chờ Gradle tải xong và nhận diện thiết bị.
4. Mở **Device Manager** và bật máy ảo Android Emulator.
5. Nhấn nút **Run (Shift + F10)**.

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

## 🧪 Kiểm thử (Testing)
Chạy lệnh:
```bash
flutter test
```
