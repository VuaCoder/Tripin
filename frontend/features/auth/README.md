# Feature: Auth (Tripri Authentication)

Mô-đun quản lý toàn bộ luồng xác thực người dùng (Đăng nhập, Đăng ký, Quên mật khẩu, Xác thực 2FA OTP, Đăng nhập Google) của nền tảng Tripri.

## 📁 Cấu trúc thư mục (Folder Structure)

```
frontend/features/auth/
├── api/
│   └── authApi.ts              # API service gọi backend endpoints (/api/v1/auth/*)
├── components/
│   ├── AuthBackground.tsx      # Lớp nền phong cảnh khinh khí cầu + hiệu ứng ánh sáng
│   ├── AuthHeader.tsx          # Thanh điều hướng top bar với chuyển đổi ngôn ngữ & hỗ trợ
│   ├── AuthFooter.tsx          # Chân trang bản quyền và liên kết điều khoản pháp lý
│   ├── AuthShowcase.tsx        # Cột giới thiệu thương hiệu và 3 thẻ tính năng (Phòng, Xe, Tour)
│   ├── LoginForm.tsx           # Form nhập liệu credential/mật khẩu, nút login & Google OAuth
│   ├── LoginCard.tsx           # Khung mockup mobile card chứa form đăng nhập
│   ├── LoginPage.tsx           # Container page tổng hợp toàn bộ giao diện
│   └── index.ts                # Barrel export components
├── hooks/
│   ├── useLoginForm.ts         # Quản lý state form đăng nhập, validation & submit
│   └── index.ts                # Barrel export hooks
├── types/
│   ├── auth.types.ts           # Định nghĩa TypeScript interface (UserProfile, FormValues, Payload...)
│   └── index.ts                # Barrel export types
├── utils/
│   └── validation.ts           # Utility kiểm tra tính hợp lệ của email/số điện thoại, mật khẩu
├── README.md                   # Tài liệu hướng dẫn duy trì và phát triển
└── index.ts                    # Entry point chính của feature
```

## 🎨 Design System & Visual Tokens
Giao diện được đồng bộ chính xác từ Stitch MCP thiết kế **Trang Đăng Nhập Tripri (Desktop)**:
- **Brand Colors:**
  - `brand-teal`: `#005A64` (Màu thương hiệu chính)
  - `brand-tealLight`: `#087E8B` (Màu hover / accent)
  - `brand-tealDark`: `#003F46` (Tiêu đề đậm)
  - `brand-orange`: `#F5A623` (Thẻ tính năng Vé xe)
  - `brand-sand`: `#FBF9F5` (Màu nền ấm)
- **Typography:** `Be Vietnam Pro` tối ưu dấu tiếng Việt, kết hợp `Plus Jakarta Sans`.
- **Hiệu ứng:** Glassmorphism (`backdrop-blur-xl`), floating balloons keyframe animations.

## 🚀 Tích hợp với Next.js App Router
Các trang xác thực được định tuyến tại:
- Đăng nhập: `frontend/app/(auth)/login/page.tsx` — `import { LoginPage } from '@/features/auth';`
- Đăng ký Traveler: `frontend/app/(auth)/register/page.tsx` — `<RegisterPage />`
- Đăng ký Hướng dẫn viên: `frontend/app/(auth)/register/guide/page.tsx` — `<RegisterPage role="TOUR_GUIDE" />` (gửi `role=TOUR_GUIDE` lên backend)
- Xác thực OTP: `frontend/app/(auth)/verify-otp/page.tsx` — sau OTP điều hướng theo role qua `homeForRole()` (Tour Guide vào `/guide`)

`RegisterPage` nhận prop `role` (`TRAVELER` mặc định hoặc `TOUR_GUIDE`) và truyền xuống `AuthContainer` → `RegisterForm` → `useRegisterForm`, nơi role được gửi kèm trong `POST /auth/register`. Lỗi backend được xử lý theo `code` (`EMAIL_ALREADY_REGISTERED` hiển thị ở field email, các mã khác hiển thị ở banner chung).
