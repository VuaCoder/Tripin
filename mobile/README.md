# Tripri Mobile Application (Flutter)
> Dự án Flutter nền tảng Du lịch Tripri phục vụ môn học **PRM393 – Mobile Application Development (Flutter)**.

## 1. Nền tảng hỗ trợ (Supported Platforms)
Dự án được khởi tạo tối ưu chỉ cho 3 nền tảng theo yêu cầu:
- **Android**: Tương thích 100% Android Studio, Android Emulator & thiết bị thật (Android 5.0 trở lên). Đã cấu hình quyền `INTERNET` trong `AndroidManifest.xml`.
- **Web**: Chạy trên Chrome / Edge (`flutter run -d chrome`).
- **Windows**: Chạy ứng dụng desktop native Windows (`flutter run -d windows`).

## 2. Cách mở và chạy trong Android Studio (Run in Android Studio)
1. Mở **Android Studio**.
2. Chọn **File -> Open...** (hoặc nút **Open** tại màn hình chào mừng).
3. Trỏ tới thư mục `d:\fifa\CHUYÊN NGÀNH 8\WDP302\travel-platform\mobile`.
4. Đợi Android Studio tải cấu hình Gradle và nhận diện Flutter/Dart SDK.
5. Chọn máy ảo Android (AVD Manager) hoặc cắm điện thoại Android bật USB Debugging.
6. Nhấn nút **Run (Shift + F10)**.

## 3. Cấu trúc thư viện dùng chung & Kết nối Backend (Shared Core & Pre-wired APIs)
Toàn bộ mã nguồn cốt lõi dùng chung được tổ chức trong `lib/core/` sẵn sàng để bạn phân chia các module tính năng sau này:

```text
mobile/
├── android/                         <-- Mã nguồn Android Native (mở được ngay trong Android Studio)
├── web/                             <-- Nền tảng Web
├── windows/                         <-- Nền tảng Windows Desktop
├── test/
│   └── widget_test.dart             <-- Smoke test kiểm thử khởi chạy app
└── lib/
    ├── core/
    │   ├── constants/
    │   │   ├── api_endpoints.dart   <-- Định nghĩa toàn bộ endpoint API backend (cổng 3001)
    │   │   └── app_colors.dart      <-- Bảng màu thương hiệu Tripri Teal & Slate
    │   ├── network/
    │   │   └── api_client.dart      <-- Dio Client cấu hình sẵn BaseUrl, Timeout & Token Interceptor
    │   ├── services/
    │   │   └── notification_service.dart <-- Cấu hình thư viện flutter_local_notifications
    │   ├── storage/
    │   │   └── token_storage.dart   <-- Quản lý lưu trữ JWT Access/Refresh Token an toàn
    │   └── theme/
    │       └── app_theme.dart       <-- Cấu hình giao diện Material 3 & Google Fonts Inter
    └── main.dart                    <-- Màn hình Starter kiểm tra kết nối API & Thông báo
```

## 4. Địa chỉ API Backend tự động (Dynamic Host Detection)
Cấu hình trong `lib/core/constants/api_endpoints.dart`:
- **Android Emulator**: Tự động nhận diện host qua IP ảo `http://10.0.2.2:3001/api/v1`.
- **Web & Windows**: Kết nối qua `http://localhost:3001/api/v1`.
- **Thiết bị thật (cùng mạng Wi-Fi)**: Thay thế bằng IP LAN máy tính của bạn khi cần.

## 5. Thư viện dùng chung đã cài đặt sẵn (`pubspec.yaml`)
- **State Management**: `flutter_bloc`, `equatable`
- **Networking**: `dio`
- **Notifications**: `flutter_local_notifications`
- **Storage**: `flutter_secure_storage`, `shared_preferences`
- **UI & Helpers**: `google_fonts`, `intl`, `cached_network_image`
- **Maps**: `flutter_map`, `latlong2`

## 6. Chạy Kiểm thử (Testing)
Chạy lệnh kiểm thử:
```bash
flutter test
```
