# TRIPRI - NỀN TẢNG DU LỊCH & ĐẶT TOUR TRỰC TUYẾN (TRAVEL PLATFORM)

Chào mừng bạn đến với dự án **TRIPRI** – Nền tảng kết nối du khách (Traveler), đại lý du lịch (Agency) và hướng dẫn viên (Tour Guide). Đây là tài liệu tổng quan toàn diện dành cho các nhà phát triển (Developers), cung cấp kiến trúc hệ thống, cấu trúc thư mục, công nghệ sử dụng và hướng dẫn chi tiết cách khởi chạy toàn bộ nền tảng (Frontend, Backend, Mobile).

---

## 🏗 Cấu trúc dự án (Monorepo Overview)

Dự án được tổ chức theo mô hình **Monorepo** với `pnpm workspaces`, tập trung mọi thành phần trong một kho mã nguồn duy nhất:

```text
travel-platform/
├── frontend/             # Ứng dụng Web Client (Next.js 15, Tailwind CSS, Redux Toolkit)
├── backend/              # Ứng dụng Backend API & Realtime (Node.js, Express, TypeScript, Socket.IO)
├── mobile/               # Ứng dụng Di động (Flutter - Android / Web / Windows)
│                         # (Chỉ chứa các file config, thiết lập core và các folder để code)
├── packages/             # Các thư viện & mã nguồn dùng chung (Monorepo Shared Packages)
│   ├── shared-types/     # TypeScript interfaces/types đồng bộ giữa Frontend và Backend
│   ├── shared-validation/# Schema xác thực dữ liệu (Zod)
│   └── constants/        # Các hằng số dùng chung toàn hệ thống
├── prisma/               # Cấu trúc CSDL PostgreSQL (schema.prisma, migrations, seeds)
├── docs/                 # Tài liệu thiết kế hệ thống (Architecture, Flowcharts, Database, API)
├── .agents/skills/       # Agent skills cấu hình tự động hóa & AI workflow
├── docker-compose.yml    # File cấu hình chạy PostgreSQL cục bộ qua Docker
├── neon.ts               # Cấu hình Neon Serverless Postgres (Branching, Services)
├── .env.example          # Biến môi trường mẫu
├── package.json          # Quản lý script monorepo
└── pnpm-workspace.yaml   # Cấu hình workspaces của pnpm
```

### Chi tiết các thư mục chính:
- **`frontend/`**: Giao diện người dùng web đa phân hệ (Traveler, Agency Portal, Admin Dashboard). Sử dụng App Router của Next.js và Tailwind CSS.
- **`backend/`**: Máy chủ API phục vụ xác thực, đặt tour, thanh toán, quản lý vé và chat realtime qua Socket.IO. Kiến trúc theo chuẩn Layered MVC (Domain-first).
- **`mobile/`**: Ứng dụng di động Flutter phục vụ du khách. **Thư mục này được tổ chức chuẩn dạng starter: chỉ chứa file config, thư viện nền tảng và các folder khung để dev tự viết code tính năng, không chứa mã nguồn nghiệp vụ viết sẵn**.
- **`prisma/`**: Nơi duy nhất định nghĩa mô hình dữ liệu (`schema.prisma`) và quản lý lịch sử migration của PostgreSQL.
- **`packages/`**: Các gói chia sẻ dùng chung trong monorepo giúp Frontend và Backend luôn đồng bộ kiểu dữ liệu.

---

## 🛠 Công nghệ sử dụng (Tech Stack)

### 1. Frontend (Web Application)
- **Framework**: Next.js 15 (React 19, App Router), TypeScript
- **Styling**: Tailwind CSS, Lucide Icons, GSAP Animation
- **State Management**: Redux Toolkit (Global UI state) + RTK Query (Server data caching)
- **Real-time**: Socket.IO Client (kết nối chat & thông báo trực tiếp)

### 2. Backend (REST API & Realtime Gateway)
- **Runtime & Language**: Node.js, Express, TypeScript
- **Architecture**: Layered MVC (Route → Middleware → Controller → Service → Repository)
- **Real-time**: Socket.IO (Chat thời gian thực & Push Notifications trên cùng cổng HTTP)
- **Jobs / Cron**: Xử lý quét bảo trì định kỳ (dọn dẹp phiên hết hạn, đồng bộ trạng thái đơn đặt)

### 3. Mobile (Flutter Cross-Platform)
- **Framework & Language**: Flutter SDK, Dart
- **Nền tảng hỗ trợ**: Android (tối ưu chính), Web, Windows Desktop
- **Architecture**: Clean Architecture / Feature-first (Chia theo `core/`, `features/`, `shared/`)
- **Networking**: `dio` (kèm Interceptor tự động gắn Bearer Token)
- **State Management**: `flutter_bloc` & `equatable`
- **Storage**: `flutter_secure_storage` (lưu JWT an toàn), `shared_preferences`
- **Notification**: `flutter_local_notifications`
- **UI & Helpers**: `google_fonts` (Inter), `cached_network_image`, `intl`

### 4. Cơ sở dữ liệu & Đám mây (Database & Cloud)
- **Database Engine**: PostgreSQL
- **Cloud Database Platform**: [Neon](https://neon.tech) (Serverless Postgres, Instant Branching, Scale-to-zero)
- **ORM**: Prisma
- **Lưu trữ tệp tin (Media Storage)**: Cloudinary
- **Cổng thanh toán**: PayOS

---

## 📱 Cấu trúc thư mục Mobile (`mobile/`)

Thư mục `mobile` được chuẩn hóa theo tiêu chí: **Chỉ chứa các file cấu hình và khung thư mục sẵn sàng để code tính năng, không chứa mã nghiệp vụ hoàn chỉnh**:

```text
mobile/
├── android/                         # Cấu hình Android Native (Gradle, AndroidManifest, Permissions)
├── web/                             # Cấu hình Web Flutter
├── windows/                         # Cấu hình Windows Native Desktop
├── pubspec.yaml                     # Khai báo dependencies (Dio, Bloc, Secure Storage, Notifications,...)
├── analysis_options.yaml            # Cấu hình linter chuẩn cho Dart
└── lib/
    ├── core/                        # [CẤU HÌNH & HẠ TẦNG NỀN TẢNG]
    │   ├── constants/
    │   │   ├── api_endpoints.dart   # URL Backend tự động nhận diện thiết bị (localhost / 10.0.2.2)
    │   │   └── app_colors.dart      # Bộ mã màu chuẩn thương hiệu Tripri
    │   ├── network/
    │   │   └── api_client.dart      # Dio Client thiết lập sẵn BaseUrl, Timeout & Token Interceptor
    │   ├── services/
    │   │   └── notification_service.dart # Cấu hình thông báo cục bộ flutter_local_notifications
    │   ├── storage/
    │   │   └── token_storage.dart   # Quản lý lưu/đọc JWT Token an toàn
    │   └── theme/
    │       └── app_theme.dart       # Material 3 Theme & Typography Inter
    │
    ├── features/                    # [CÁC FOLDER ĐỂ LẬP TRÌNH TÍNH NĂNG]
    │   ├── auth/                    # Chứa mã nguồn Đăng nhập, Đăng ký, OTP, Quên mật khẩu
    │   ├── tours/                   # Chứa mã nguồn Tìm kiếm, Danh sách tour, Chi tiết tour, Đánh giá
    │   ├── bookings/                # Chứa mã nguồn Đặt tour, Thanh toán, Lịch sử đặt vé
    │   ├── notifications/           # Chứa mã nguồn Danh sách & Xử lý thông báo
    │   ├── chat/                    # Chứa mã nguồn Hội thoại & Tin nhắn thời gian thực
    │   └── profile/                 # Chứa mã nguồn Quản lý tài khoản cá nhân, Voucher
    │
    ├── shared/                      # [THÀNH PHẦN DÙNG CHUNG CẦN VIẾT]
    │   ├── models/                  # Data classes, DTOs, JSON serializers
    │   └── widgets/                 # Các UI Components tái sử dụng (Button, Input, Card, Dialog,...)
    │
    └── main.dart                    # Điểm khởi chạy app, cấu hình Theme & màn hình chẩn đoán kết nối API
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy Toàn diện

### Yêu cầu tiên quyết (Prerequisites)
1. **Node.js**: Phiên bản 20 trở lên.
2. **pnpm**: Cài đặt bằng `npm install -g pnpm`.
3. **Flutter SDK**: Phiên bản 3.22 trở lên (chạy lệnh `flutter doctor` để kiểm tra môi trường).
4. **Android Studio**: Đã cài Android SDK, Command-line Tools và máy ảo Android Emulator (hoặc điện thoại thật bật USB Debugging).
5. **Cơ sở dữ liệu**: Docker (PostgreSQL) hoặc tài khoản Neon Cloud.

---

### Bước 1: Cài đặt Dependencies Monorepo
Tại thư mục gốc dự án:
```bash
pnpm install
```

---

### Bước 2: Cấu hình Môi trường & Database

#### Lựa chọn A: Dùng Neon Cloud Postgres (Khuyến nghị)
1. Đăng nhập Neon CLI:
   ```bash
   neon login
   ```
2. Liên kết dự án:
   ```bash
   neon link --project-id super-darkness-97500515 --branch production -y
   ```
3. Tạo file `.env` từ `.env.example`:
   ```bash
   cp .env.example .env
   ```

#### Lựa chọn B: Dùng Docker Postgres Cục bộ
1. Chạy container:
   ```bash
   docker compose up -d
   ```
2. Tạo file `.env`:
   ```bash
   cp .env.example .env
   ```

#### Đồng bộ Schema Database:
```bash
pnpm --filter backend db:deploy
```

---

### Bước 3: Khởi động Backend & Frontend

#### Chạy Backend (Cổng 3001):
```bash
pnpm run dev:backend
# hoặc: pnpm --filter backend dev
```
> Server sẽ lắng nghe tại: `http://localhost:3001` (Endpoint kiểm tra: `http://localhost:3001/health`).

#### Chạy Frontend (Cổng 3000):
```bash
pnpm run dev:frontend
```
> Truy cập giao diện web tại: `http://localhost:3000`.

---

### Bước 4: Hướng dẫn Chi tiết Khởi chạy Mobile (`mobile/`)

> ⚠️ **LƯU Ý QUAN TRỌNG:** Mobile không tự động bật Backend. Bạn **bắt buộc phải chạy Backend ở Bước 3** trước khi chạy Mobile để ứng dụng có thể kết nối dữ liệu!

#### Cách 1: Chạy Virtual Device trực tiếp bên trong Android Studio (Tab Running Devices)
1. Mở **Android Studio**.
2. Chọn **Open** và trỏ đường dẫn đến thư mục `travel-platform/mobile`.
3. Kiểm tra cài đặt máy ảo nhúng bên trong:
   - Vào **File -> Settings** -> **Tools** -> **Emulator** -> Tích chọn **"Launch in the Running Devices tool window"**.
4. Mở tab **Device Manager** ở thanh công cụ bên phải Android Studio:
   - Bấm nút **Play (▶)** cạnh máy ảo Android (Pixel 7/8). Máy ảo sẽ khởi động và hiển thị ngay tại tab **Running Devices** bên trong cửa sổ Android Studio (không bị bật ra cửa sổ rời bên ngoài).
5. Kiểm tra dropdown thiết bị trên thanh Toolbar đã chọn đúng máy ảo đó.
6. Nhấn nút **Run 'main.dart'** (tam giác xanh hoặc nhấn `Shift + F10`). App sẽ tự build và hiển thị trực tiếp trong Android Studio.
   *(Lưu ý: Mạng máy ảo bên trong Android Studio vẫn tự động kết nối backend cổng 3001 qua `http://10.0.2.2:3001/api/v1`).*

#### Cách 2: Chạy trực tiếp qua dòng lệnh (Terminal)
Mở terminal và di chuyển vào thư mục `mobile`:
```bash
cd mobile
flutter pub get
```

- **Kiểm tra danh sách thiết bị có sẵn:**
  ```bash
  flutter devices
  ```
- **Chạy trên Android Emulator / Thiết bị Android:**
  ```bash
  flutter run
  ```
- **Chạy trên trình duyệt Web (Chrome):**
  ```bash
  flutter run -d chrome
  ```
- **Chạy trên Windows Desktop:**
  ```bash
  flutter run -d windows
  ```

---

### 🌐 Cơ chế Kết nối Backend từ Mobile (Network & Host Resolution)

Được định nghĩa tại `mobile/lib/core/constants/api_endpoints.dart`:

| Thiết bị chạy Mobile | Host URL tự động | Giải thích cơ chế |
| :--- | :--- | :--- |
| **Android Emulator** | `http://10.0.2.2:3001/api/v1` | `10.0.2.2` là alias đặc biệt của Android Emulator để truy cập vào `localhost` máy tính chủ của bạn. |
| **Web Browser / Windows Desktop** | `http://localhost:3001/api/v1` | Chạy cùng trên máy chủ nên kết nối trực tiếp qua `localhost`. |
| **Thiết bị thật (Physical Android Phone)** | *Cần chuyển tiếp cổng hoặc dùng IP LAN* | Xem hướng dẫn bên dưới. |

#### ⚠️ Khi chạy trên Điện thoại Android thật (Physical Device):
Điện thoại thật coi `localhost` là chính nó chứ không phải máy tính chạy backend. Bạn có 2 cách giải quyết:
1. **Dùng cáp USB (Khuyên dùng):** Bật USB Debugging trên điện thoại, cắm cáp vào máy tính và chạy lệnh:
   ```bash
   adb reverse tcp:3001 tcp:3001
   ```
   *(Lệnh này ánh xạ cổng 3001 trên điện thoại về thẳng cổng 3001 trên máy tính).*
2. **Dùng chung mạng Wi-Fi:** Đổi `baseUrl` trong `mobile/lib/core/constants/api_endpoints.dart` thành IP mạng LAN của máy tính (ví dụ: `http://192.168.1.15:3001/api/v1`).

#### 🔒 Cấu hình cho phép HTTP Cleartext:
File `mobile/android/app/src/main/AndroidManifest.xml` đã được cấu hình cờ:
```xml
android:usesCleartextTraffic="true"
```
giúp tránh lỗi bị Android 9+ chặn kết nối `http://` nội bộ khi kiểm thử.

---

## 👥 Phân quyền & Tài khoản trong Hệ thống

Hệ thống phân tách quyền hạn rõ ràng thông qua JWT Claims:
- **Traveler**: Người dùng thông thường đặt tour, thanh toán, viết review, chat.
- **Agency**: Đăng ký đại lý, tạo & quản lý tour, quản lý booking của khách, gán Tour Guide.
- **Tour Guide**: Hướng dẫn viên nhận tour từ đại lý, theo dõi lịch trình du khách.
- **Moderator**: Kiểm duyệt nội dung tour, giải quyết khiếu nại tranh chấp.
- **Super Admin**: Quản trị tài khoản, phân quyền, cấu hình phí hoa hồng toàn sàn.

---

## 📜 Quy định Đóng góp Mã nguồn (Git Guidelines)

1. **Nhánh làm việc**: Không commit trực tiếp lên `main`. Tạo nhánh mới theo quy tắc:
   - `feature/<tên-tính-năng>` (ví dụ: `feature/mobile-starter-setup`)
   - `fix/<tên-lỗi>`
2. **Commit Message**: Tuân thủ chuẩn Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
3. **Bảo mật**: Tuyệt đối không commit các khóa bí mật (`JWT_SECRET`, `PAYOS_API_KEY`, `.env`) lên kho lưu trữ.
