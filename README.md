# Nền Tảng Du Lịch (Travel Platform)

## 1. Tổng Quan Dự Án
Đây là một nền tảng chợ du lịch trực tuyến (online marketplace) kết nối:
* Khách du lịch (Travelers)
* Công ty du lịch (Agencies)
* Hướng dẫn viên du lịch (Tour Guides)

Ngoài ra, hệ thống cũng cung cấp các tính năng quản trị và kiểm duyệt dành cho Ban quản trị.

## 2. Phạm Vi Sản Phẩm (Tính Năng Chính)
* Quản lý tài khoản & Xác thực (Authentication)
* Khám phá và tìm kiếm tour
* Đặt tour (Booking)
* Tour tự chọn (Custom Tour)
* Tour tự chọn được hỗ trợ bởi AI (AI-assisted Custom Tour)
* Giỏ hàng (Cart)
* Danh sách yêu thích (Wishlist)
* Thanh toán (Payment)
* Vé điện tử (E-ticket)
* Các gói đăng ký (Subscription)
* Đánh giá và nhận xét (Review)
* Trò chuyện theo thời gian thực (Realtime chat)
* Báo cáo (Reports)
* Hỗ trợ khách hàng (Support)
* Quản lý thu nhập (Earnings)
* Khuyến mãi (Promotions)
* Quản trị hệ thống (Administration)

## 3. Công Nghệ Sử Dụng (Technology Stack)
**Frontend:**
Next.js + TypeScript + Tailwind CSS + Redux Toolkit + RTK Query + Socket.IO Client

**Backend:**
Express + TypeScript + Kiến trúc Layered MVC + Socket.IO

**Cơ Sở Dữ Liệu:**
MongoDB Atlas + Mongoose

**Xác Thực:**
JWT + Google OAuth + Email OTP + Xác thực 2 bước (2FA)

**Thanh Toán:**
PayOS

**Quản Lý Package:**
pnpm

## 4. Kiến Trúc Hệ Thống
Hệ thống áp dụng kiến trúc **Monorepo** với pnpm workspaces:
→ `apps/web` (Frontend)
→ `apps/api` (Backend)
→ `packages` (Các thư viện dùng chung)

**Kiến trúc Backend (Layered MVC):**
Module → Controller → Service → Repository → Model

## 5. Cấu Trúc Thư Mục (Repository Structure)
```
travel-platform/
├── apps/
│   ├── web/           # Source code Frontend (Next.js)
│   └── api/           # Source code Backend (Express)
├── packages/
│   ├── shared-types/  # Type/Interface dùng chung cho cả FE và BE
│   ├── shared-validation/ # Các schema validation dùng chung
│   └── constants/     # Hằng số, roles, permissions dùng chung
├── docs/              # Tài liệu thiết kế hệ thống
│   ├── architecture/
│   ├── api/
│   ├── database/
│   └── flows/
├── .env.example       # File mẫu chứa các biến môi trường
├── .gitignore
├── package.json
├── pnpm-workspace.yaml# File cấu hình pnpm workspace
├── README.md
└── LICENSE
```

## 6. Các Đối Tượng Truy Cập Hệ Thống (Access Actors)
* **GUEST**: Khách vãng lai chưa đăng nhập. Không lưu vào database.
* **TRAVELER**: Khách du lịch đã đăng nhập.
* **AGENCY**: Công ty du lịch.
* **TOUR_GUIDE**: Hướng dẫn viên du lịch.
* **MODERATOR**: Điều phối viên (Kiểm duyệt, giải quyết khiếu nại).
* **SUPER_ADMIN**: Quản trị viên cấp cao nhất (Toàn quyền hệ thống).

## 7. Yêu Cầu Cài Đặt Ban Đầu (Prerequisites)
Bạn cần cài đặt các công cụ sau trước khi chạy dự án:
* **Node.js** (Phiên bản LTS, khuyên dùng v18 hoặc v20)
* **pnpm** (Cài đặt thông qua lệnh `npm install -g pnpm`)
* Tài khoản MongoDB Atlas (hoặc MongoDB chạy local)
* Git

## 8. Hướng Dẫn Clone Code
```bash
git clone https://github.com/VuaCoder/Tripin.git travel-platform
cd travel-platform
```

## 9. Cài Đặt Thư Viện (Dependencies)
Tại thư mục gốc của dự án, chạy lệnh:
```bash
pnpm install
```

## 10. Cấu Hình Biến Môi Trường (Environment Configuration)
Tạo file `.env` dựa trên file mẫu `.env.example`:
```bash
cp .env.example .env
```
*(Trên Windows, bạn có thể copy file `.env.example` và đổi tên file bản sao thành `.env`).*
Sau đó, hãy điền đầy đủ các thông tin cần thiết vào file `.env` (ví dụ: thông tin kết nối DB, API Keys, JWT Secrets).

## 11. Hướng Dẫn Chạy Dự Án
Dự án được cấu hình dạng Monorepo, bạn có thể chạy trực tiếp từng dự án Frontend hoặc Backend bằng các lệnh sau ở thư mục gốc:

**Chạy Frontend (Next.js):**
```bash
pnpm --filter web dev
```
*Lưu ý: Mở http://localhost:3000 trên trình duyệt.*

**Chạy Backend (Express):**
```bash
pnpm --filter api dev
```
*Lưu ý: API server sẽ chạy ở cổng mặc định được cấu hình.*

## 12. Cơ Sở Dữ Liệu MongoDB Atlas
Dự án sử dụng MongoDB. Bạn không nhất thiết phải cài MongoDB ở máy local. Chỉ cần có chuỗi kết nối (Connection String) từ MongoDB Atlas và điền vào biến `MONGODB_URI` trong file `.env`.

## 13. Định Hướng Tính Năng "Custom Tour"
Custom Tour (Tour Tự Chọn) được thiết kế như một *first-class domain* (lĩnh vực ưu tiên hàng đầu) và cố ý cô lập để sau này có thể trở thành tính năng kinh doanh cốt lõi của hệ thống mà không cần phải thay đổi cấu trúc repository.

## 14. Các Giai Đoạn Phát Triển Dự Kiến (Phases)
* **Phase 1**: Khởi tạo cấu trúc repository (Đã hoàn thành)
* **Phase 2**: Xác thực người dùng (Auth) + RBAC (Phân quyền)
* **Phase 3**: Tìm kiếm và đặt Tour
* **Phase 4**: Giỏ hàng (Cart) + Danh sách yêu thích (Wishlist)
* **Phase 5**: Custom Tour + Trợ lý AI
* **Phase 6**: Chat Realtime
* **Phase 7**: Thanh toán qua PayOS + Vé điện tử
* **Phase 8**: Các gói đăng ký tài khoản (Subscriptions)
* **Phase 9**: Đánh giá + Báo cáo + Hỗ trợ
* **Phase 10**: Công ty/HDV + Quản lý thu nhập
* **Phase 11**: Tính năng cho Moderator + Super Admin
* **Phase 12**: Testing + Security + Tối ưu hóa hiệu năng

## 15. Quy Tắc Kiến Trúc Sống Còn (Architecture Rules)
* Chỉ dùng duy nhất một GitHub repository (Monorepo).
* Sử dụng TypeScript làm ngôn ngữ chính.
* Chỉ sử dụng Tailwind CSS cho việc styling ở Frontend.
* Sử dụng Redux Toolkit cho State Management.
* Tuân thủ kiến trúc Layered MVC ở Backend, và tổ chức theo hướng Domain/Module.
* Chia sẻ code và kiểu dữ liệu chung thông qua thư mục `packages`.
* Không dùng quá nhiều hệ thống Authentication độc lập.
* Không viết logic xử lý nghiệp vụ ở tầng Controller.
* Không thao tác với Database ở bên trong tầng Controller (phải thông qua Service/Repository).
* Không tích hợp mã nguồn của bên cung cấp thanh toán trực tiếp vào logic nghiệp vụ của Service.
* Tránh kết nối trực tiếp đến AI Provider bên trong logic Custom Tour.
* Tuyệt đối không tự ý thay đổi cấu trúc module nếu chưa thống nhất trong quá trình review kiến trúc.
