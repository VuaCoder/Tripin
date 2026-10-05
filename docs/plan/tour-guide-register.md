# Plan — Đăng ký Tour Guide

Trạng thái: chờ thực thi. Chưa sửa code.
Phạm vi: chỉ frontend. Không đổi backend.

## 1. Mục tiêu

- Tour Guide đăng ký được ở route riêng.
- Dùng đúng field của backend.
- Validate dữ liệu.
- Kết nối API đăng ký có sẵn.
- Xử lý email đã tồn tại.
- Xử lý lỗi backend theo `code`.
- Đăng ký thành công chuyển sang OTP.
- OTP xong chuyển đúng flow.
- Responsive.

## 2. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Route đăng ký | `/register/guide`, dùng chung component |
| Header | Giữ tab Đăng nhập/Đăng ký, chỉ sửa chữ |
| Login | Dùng chung `/login`, không tạo trang riêng |
| Sau OTP | Theo role, Tour Guide vào `/guide` |
| Trường phone | Bắt buộc, như form hiện tại |
| Nút Google | Giữ, truyền `role=TOUR_GUIDE` |
| Field hồ sơ guide | Không có ở bước đăng ký |

## 3. Hợp đồng backend (nguồn sự thật)

`POST /api/v1/auth/register`

Body:
```json
{
  "fullName": "string (2-120)",
  "email": "string (max 254)",
  "phone": "string (max 30)",
  "password": "string (8-72, 1 chữ + 1 số)",
  "role": "TOUR_GUIDE"
}
```

Thành công: `201 { success: true, data: { email, otpExpiresInSeconds, message } }`

Lỗi:
- `400 VALIDATION_ERROR`
- `409 EMAIL_ALREADY_REGISTERED`
- `429 OTP_RESEND_TOO_SOON`

Sau đó: `POST /api/v1/auth/verify-otp` với `{ email, code, purpose: "REGISTER" }`.

Ghi chú: backend trả `EMAIL_ALREADY_REGISTERED` cho tài khoản đang ACTIVE. Email còn `PENDING_VERIFICATION` được đăng ký lại và nhận OTP mới.

## 4. File mới

### `frontend/app/(auth)/register/guide/page.tsx`
- Server component.
- `metadata` riêng cho Hướng dẫn viên.
- Render `<RegisterPage role="TOUR_GUIDE" />`.

### `frontend/app/guide/page.tsx`
- Trang đích sau OTP.
- Nằm dưới `app/guide/layout.tsx` (đã có `RoleGuard` cho `TOUR_GUIDE`).
- Nội dung tối giản: lời chào "Bảng điều khiển Hướng dẫn viên", ghi chú tính năng sắp có.
- Dùng token và class sẵn có.

## 5. File sửa

### `frontend/features/auth/components/RegisterPage.tsx`
- Thêm prop `role?: 'TRAVELER' | 'TOUR_GUIDE'`, mặc định `TRAVELER`.
- Truyền `registerRole={role}` và `registerPath` xuống `AuthContainer`.
- `handleRegisterSuccess` giữ nguyên.

### `frontend/features/auth/components/AuthContainer.tsx`
- Thêm prop `registerRole` và `registerPath`.
- `handleSwitchMode`: tab Đăng nhập trỏ `/login`; tab Đăng ký trỏ `registerPath`.
- Đổi tiêu đề khi role là `TOUR_GUIDE`: "TRỞ THÀNH HƯỚNG DẪN VIÊN !".
- Truyền `role` xuống `RegisterForm`.

### `frontend/features/auth/components/RegisterForm.tsx`
- Thêm prop `role`, truyền cho `useRegisterForm`.
- Giữ nguyên field, thứ tự, nút Google.
- Banner lỗi chung thêm `role="alert"`.
- Input lỗi thêm `aria-invalid` và `aria-describedby`.

### `frontend/features/auth/hooks/useRegisterForm.ts`
- Thêm `role` vào props, mặc định `TRAVELER`.
- Khởi tạo `formData.role` theo `role`.
- Gửi `role` trong `register(...)`. Sửa lỗi đang hardcode `TRAVELER`.
- Bắt lỗi theo `code`:
  - `EMAIL_ALREADY_REGISTERED` → lỗi ở field email.
  - `OTP_RESEND_TOO_SOON` → banner chung.
  - `ACCOUNT_BANNED` → banner chung.
  - `VALIDATION_ERROR` → banner chung.
  - Lỗi khác → banner chung như hiện tại.

### `frontend/features/auth/utils/apiError.ts`
- Giữ `getApiErrorMessage`.
- Thêm `getApiErrorCode(error)` đọc `err.data.error.code`.

### `frontend/features/auth/utils/validation.ts`
- Giữ phone bắt buộc.
- Thêm max: họ tên 120, email 254, mật khẩu 72.
- Giữ message tiếng Việt.

### `frontend/features/auth/types/auth.types.ts`
- Thêm `message?: string` vào `RegisterResultData`.
- `role` đã cho phép `TOUR_GUIDE`, không đổi.

### `frontend/features/auth/README.md` (tùy chọn)
- Thêm một dòng về route `/register/guide`.

## 6. File không đổi

- `frontend/app/(auth)/login/page.tsx`
- `frontend/features/auth/components/LoginPage.tsx`
- `frontend/features/auth/components/LoginForm.tsx`
- `frontend/features/auth/hooks/useLoginForm.ts`
- Toàn bộ backend.

Login dùng chung. `LoginPage` đã chuyển `TOUR_GUIDE` về `/guide`.

## 7. Thiết kế

- Dùng lại shell, card 2 cột, hero, token màu và class hiện có.
- Chỉ đổi chữ: tiêu đề "TRỞ THÀNH HƯỚNG DẪN VIÊN !". Mô tả giữ nguyên.
- Dùng `animate-fadeInScale`, không dùng `animate-fadeIn` (không tồn tại).
- Responsive giữ như hiện tại: mobile 1 cột, ẩn hero; desktop hiện hero.

## 8. Acceptance Criteria

| Tiêu chí | Cách đáp ứng |
|---|---|
| Tour Guide đăng ký thành công | Route `/register/guide` gửi `role=TOUR_GUIDE` |
| Validation hoạt động | Giữ rule hiện có, thêm max khớp backend |
| Email đã tồn tại được xử lý | `EMAIL_ALREADY_REGISTERED` → lỗi field email |
| Backend error được xử lý | Map lỗi theo `code` |
| Đăng ký thành công chuyển đúng flow | Chuyển `/verify-otp?purpose=REGISTER` |
| OTP flow hoạt động | `VerifyOtpPage` đã theo role, guide vào `/guide` |
| Responsive | Dùng lại layout sẵn có |

## 9. Kiểm tra

- `pnpm --filter frontend lint`
- `pnpm --filter frontend build`
- `pnpm --filter backend typecheck`
- Thử tay:
  - `/register/guide` → OTP → `/guide`.
  - Email trùng báo ở field email.
  - Mật khẩu sai báo inline.
  - Login guide từ `/login` vào `/guide`.
  - Layout responsive.

## 10. Ngoài phạm vi

- Không tạo trang login riêng cho guide.
- Không thêm field hồ sơ guide ở bước đăng ký.
- Không làm luồng Google OAuth thật (chưa có client ID).

## 11. Cảnh báo

Repo đang có thay đổi chưa commit từ luồng khác (RTK Query, `RoleGuard`, `app/guide/layout.tsx`).
Nên commit hoặc phối hợp trước khi thực thi để tránh chồng chéo.
