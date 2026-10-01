# TRIPRI - NỀN TẢNG ĐẶT TOUR TRỰC TUYẾN (TOUR PLATFORM)

Chào mừng bạn đến với dự án **TRIPRI** - Nền tảng đặt tour trực tuyến. Đây là tài liệu hướng dẫn tổng quan dành cho tất cả thành viên trong đội ngũ phát triển (Developers), cung cấp các thông tin cần thiết về kiến trúc, công nghệ và cách thiết lập môi trường để bắt đầu làm việc.

---

## 🏗 Cấu trúc dự án (Monorepo)

Dự án được quản lý dưới dạng **Monorepo** sử dụng `pnpm workspaces`. Mọi mã nguồn đều được tập trung trong một kho lưu trữ duy nhất và chia thành các thư mục rõ ràng:

```text
TRIPRI/
├── frontend/        # Ứng dụng Frontend (Next.js, Tailwind CSS)
├── backend/         # Ứng dụng Backend (Express, Node.js)
├── packages/        # Các packages dùng chung cho cả frontend và backend
│   ├── shared-types/      # Định nghĩa các types/interfaces dùng chung
│   ├── shared-validation/ # Các schema xác thực (validation) dùng chung
│   └── constants/         # Các hằng số (constants)
├── prisma/          # Cấu hình CSDL PostgreSQL (Schema, Migrations, Seeding)
├── docs/            # Tài liệu dự án chi tiết (Architecture, Flows, Use-cases, Database)
├── .env.example     # File mẫu chứa các biến môi trường cần thiết
└── pnpm-workspace.yaml # File cấu hình workspace của pnpm
```

### Chi tiết các thành phần chính:
- **`frontend/`**: Giao diện người dùng. Được chia theo tính năng (feature-based) và các thành phần có thể tái sử dụng (components). Sử dụng App Router của Next.js.
- **`backend/`**: Xử lý logic nghiệp vụ. Được cấu trúc theo mô hình **Layered MVC** và **Domain-first** (tổ chức module theo từng nghiệp vụ như auth, tours, bookings,...).
- **`prisma/`**: Là nơi duy nhất định nghĩa cấu trúc dữ liệu (`schema.prisma`) và quản lý các lịch sử thay đổi (migrations) của CSDL PostgreSQL.

---

## 🛠 Tech Stack (Công nghệ sử dụng)

### Frontend:
- **Framework**: Next.js (App Router), TypeScript
- **Styling**: Tailwind CSS (không sử dụng UI Framework nào khác như MUI hay Bootstrap)
- **State Management**: Redux Toolkit (cho Global State) + RTK Query (cho API Data/Server State)
- **Real-time**: Socket.IO Client

### Backend:
- **Framework**: Node.js, Express, TypeScript
- **Architecture**: Layered MVC (Route -> Middleware -> Controller -> Service -> Repository)
- **Real-time**: Socket.IO

### Cơ sở dữ liệu (Database):
- **Database**: PostgreSQL (Không sử dụng MongoDB)
- **ORM**: Prisma

### Hệ thống / Khác:
- **Xác thực (Authentication)**: JWT (Access Token + Refresh Token), Google OAuth, Email OTP, 2FA
- **Thanh toán (Payment)**: PayOS
- **Quản lý gói (Package Manager)**: pnpm

---

## 👥 Các đối tượng người dùng (Actors)

Hệ thống phục vụ các vai trò sau:
- **Guest (Khách chưa đăng nhập)**: Chỉ xem các trang công khai (danh sách tour, chi tiết tour, review,...).
- **Traveler (Khách du lịch)**: Người đặt tour, thanh toán, viết review,...
- **Agency (Đại lý du lịch)**: Tạo, quản lý tour, quản lý đặt chỗ,...
- **Tour Guide (Hướng dẫn viên)**: Nhận tour, xem lịch trình, báo cáo thu nhập,...
- **Moderator (Điều hành viên)**: Kiểm duyệt tour, xử lý khiếu nại (Tài khoản được cấp nội bộ).
- **Super Admin (Quản trị viên cấp cao)**: Quản lý toàn hệ thống, cấu hình phí, phân quyền (Tài khoản được cấp nội bộ).

---

## 🚀 Hướng dẫn Cài đặt & Chạy dự án (Getting Started)

### 1. Yêu cầu hệ thống
- **Git**
- **Node.js** (Phiên bản LTS - khuyến nghị v18 trở lên)
- **pnpm** (Cài đặt qua npm: `npm install -g pnpm`)
- **PostgreSQL** (Đã cài đặt và đang chạy trên máy của bạn)

### 2. Tải mã nguồn về máy
```bash
git clone https://github.com/VuaCoder/Tripin.git
cd travel-platform
```

### 3. Cài đặt thư viện (Dependencies)
```bash
# Ở thư mục gốc (root) của dự án, chạy lệnh:
pnpm install
```

### 4. Thiết lập biến môi trường
Sao chép file mẫu và điền thông tin thực tế của bạn (đặc biệt là URL kết nối tới PostgreSQL):
```bash
cp .env.example .env
```
*Lưu ý: Bạn cần tạo một cơ sở dữ liệu PostgreSQL trống trước, sau đó điền chuỗi kết nối vào biến `DATABASE_URL` trong file `.env`.*

### 5. Chạy dự án
Mở 2 terminal tại thư mục gốc để chạy song song Frontend và Backend.

**Chạy Frontend:**
```bash
pnpm run dev:frontend
```
👉 Truy cập: [http://localhost:3000](http://localhost:3000)

**Chạy Backend:**
```bash
pnpm run dev:backend
```
👉 Backend sẽ chạy ở cổng được cấu hình (mặc định thường là 3001). Route kiểm tra tình trạng: `GET /health`.

---

## ⚠️ Các Lưu ý Quan trọng dành cho Team (AI Rules & Guidelines)

Khi tham gia phát triển, xin hãy tuân thủ nghiêm ngặt các nguyên tắc sau đây để giữ cho source code sạch và dễ bảo trì:

1. **Tuân thủ Kiến trúc có sẵn**: Luôn giữ backend theo cấu trúc *Domain-first* (Mọi Controller, Service, Route liên quan đến nhau phải nằm chung trong `src/modules/{domain}/`). KHÔNG tạo các thư mục global như `controllers/` hay `services/` dùng chung cho toàn dự án.
2. **Nguyên tắc "Minimal Change"**: Chỉ chỉnh sửa/thêm những phần liên quan trực tiếp đến Task bạn đang làm. Không tự ý refactor những module không liên quan.
3. **Database & Prisma**: PostgreSQL và Prisma là nguồn duy nhất quản lý CSDL. TUYỆT ĐỐI không sử dụng hay cài đặt MongoDB/Mongoose.
4. **Không tùy tiện thêm thư viện (Dependencies)**: Kiểm tra kĩ xem thư viện đang cần đã có sẵn chưa. Chỉ cài đặt thư viện mới khi thực sự cần thiết và phải được thống nhất chung.
5. **Không lộ Secret Keys**: **KHÔNG BAO GIỜ** đẩy (commit) các thông tin nhạy cảm như JWT Secret, PayOS keys, Database URL lên GitHub. Luôn để trong `.env`.
6. **Bảo mật Xác thực**: Phân quyền (Authorization) bắt buộc phải được xử lý ở Backend. Frontend chỉ ẩn/hiện UI để tối ưu trải nghiệm, không đóng vai trò bảo mật chính.
7. **Luôn tham khảo Thư mục `docs/`**: Các tài liệu thiết kế Use-case, Flow, Architecture đã được định nghĩa chuẩn xác trong thư mục `docs/`. Hãy đọc chúng trước khi bắt đầu code tính năng mới.
