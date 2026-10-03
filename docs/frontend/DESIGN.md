# Frontend Design System (DESIGN.md)

Tài liệu hướng dẫn hệ thống thiết kế giao diện (Design System) cho Frontend của dự án **Tripri / Tripin Vietnam Travel Marketplace**, được trích xuất và đồng bộ trực tiếp từ **Stitch Design System** (`projects/639497092690951463`).

---

## 1. Triết lý thiết kế (Brand & Style)

Hệ thống thiết kế hướng tới trải nghiệm **Truyền cảm hứng, Hiện đại, Thân thiện, Chân thực và Đáng tin cậy**. Được tinh chỉnh đặc biệt cho hệ sinh thái du lịch Việt Nam, kết nối khách du lịch với hướng dẫn viên bản địa và các công ty du lịch uy tín.

Phong cách chủ đạo kết hợp giữa **Warm Editorial Modernism** và **Tactile Utilitarianism**:
- **Warm & Welcoming (Ấm áp & Thân thiện):** Tránh cảm giác phần mềm doanh nghiệp thô cứng bằng nền màu canvas ấm (`#F7F8F5`), không gian thở rộng rãi và hình ảnh điểm đến phong phú.
- **Authentic & Grounded (Bản địa & Chân thực):** Tối ưu hóa hiển thị tiếng Việt có dấu, định dạng tiền tệ VNĐ chuẩn xác, thông tin minh bạch.
- **Trustworthy & Dependable (Đáng tin cậy):** Làm nổi bật các huy hiệu đối tác đã xác minh, chính sách cam kết, liên hệ hỗ trợ 24/7 với cấu trúc thẻ và màu sắc tương phản rõ ràng.

---

## 2. Bảng màu (Color Palette & Tokens)

Hệ thống màu sắc kết hợp giữa sự thanh bình của cảnh quan biển đảo Việt Nam với các điểm nhấn hành động chuyển đổi cao.

### 2.1. Bảng màu thương hiệu cốt lõi (Brand Palette)

| Token Name | Mã Màu Hex | Vai trò / Ứng dụng |
|---|---|---|
| **Primary (Ocean Teal)** | `#087E8B` (`#00636E`) | Màu chủ đạo của thương hiệu. Dùng cho nút chính (Primary CTA), trạng thái được chọn (Selected/Active), icon cốt lõi. |
| **Secondary (Deep Teal)** | `#0B5963` (`#226771`) | Màu thứ cấp. Dùng cho header, footer, trạng thái hover của nút chính, các khối tương tác trầm tĩnh. |
| **Tertiary / Accent (Coral Highlight)** | `#B84A2F` (`#9E371E`) | Màu điểm nhấn năng lượng cao. Dùng cho tag giảm giá/flash sale, nút đặt ngay khẩn cấp, icon tim yêu thích, huy hiệu hoàn tiền. |
| **Neutral Core (Ink Dark)** | `#1B2B34` (`#0D1D26`) | Màu chữ chính (Headings, Body text quan trọng) với độ tương phản cao, dễ đọc. |
| **Neutral Muted (Slate Mist)** | `#5A6E78` (`#3E494A`) | Màu chữ phụ cho metadata, phụ đề, thời lượng chuyến đi, placeholder, text gợi ý. |
| **Canvas Base (Warm White)** | `#F7F8F5` (`#F5FAFF`) | Màu nền canvas tổng thể của ứng dụng, tạo cảm giác dịu mắt thay vì nền trắng toát `#FFFFFF`. |
| **Surface Elevation (Crisp Pure White)** | `#FFFFFF` | Nền cho các thẻ (Cards), thanh tìm kiếm nổi (Floating Search Bar), Modal, Sheet Drawers, Dropdowns. |
| **Structural Border (Subtle Line)** | `#E2E8E5` (`#BDC8CA`) | Đường viền mảnh chia tách các thành phần giao diện một cách tự nhiên, nhẹ nhàng. |

### 2.2. Token màu chức năng & Trạng thái (System & Semantic Tokens)

```yaml
colors:
  # Surface & Background
  background: '#F5FAFF'
  surface: '#F5FAFF'
  surface-dim: '#CBDCE8'
  surface-bright: '#F5FAFF'
  surface-container-lowest: '#FFFFFF'
  surface-container-low: '#E9F5FF'
  surface-container: '#DFF0FD'
  surface-container-high: '#D9EBF7'
  surface-container-highest: '#D4E5F1'
  
  # Content / Text
  on-surface: '#0D1D26'
  on-surface-variant: '#3E494A'
  on-background: '#0D1D26'
  inverse-surface: '#22323C'
  inverse-on-surface: '#E2F3FF'
  
  # Borders & Outlines
  outline: '#6E797B'
  outline-variant: '#BDC8CA'
  surface-tint: '#006874'
  
  # Primary Tones
  primary: '#00636E'
  on-primary: '#FFFFFF'
  primary-container: '#087E8B'
  on-primary-container: '#EAFCFF'
  inverse-primary: '#79D4E2'
  primary-fixed: '#96F0FF'
  primary-fixed-dim: '#79D4E2'
  on-primary-fixed: '#001F24'
  on-primary-fixed-variant: '#004F57'
  
  # Secondary Tones
  secondary: '#226771'
  on-secondary: '#FFFFFF'
  secondary-container: '#AAEAF6'
  on-secondary-container: '#276B76'
  secondary-fixed: '#ADEDF9'
  secondary-fixed-dim: '#91D1DC'
  on-secondary-fixed: '#001F24'
  on-secondary-fixed-variant: '#004F58'
  
  # Tertiary / Accent Tones
  tertiary: '#9E371E'
  on-tertiary: '#FFFFFF'
  tertiary-container: '#BF4F34'
  on-tertiary-container: '#FFF7F6'
  tertiary-fixed: '#FFDAD2'
  tertiary-fixed-dim: '#FFB4A2'
  on-tertiary-fixed: '#3C0700'
  on-tertiary-fixed-variant: '#84250D'
  
  # Semantic / Error
  error: '#BA1A1A'
  on-error: '#FFFFFF'
  error-container: '#FFDAD6'
  on-error-container: '#93000A'
```

---

## 3. Hệ thống Typography (Kiểu chữ)

Font chữ chuẩn hoá toàn dự án: **`Be Vietnam Pro`**. Font này được tối ưu sẵn dấu tiếng Việt, tránh bị cắt/chèn dấu khi hiển thị các từ ngữ như *"Trải nghiệm", "Khởi hành", "Hướng dẫn viên"*.

### 3.1. Bảng quy chuẩn tỷ lệ Typography (Type Scale)

| Phân loại | Font Size | Font Weight | Line Height | Letter Spacing |
|---|---|---|---|---|
| **display-lg** | `48px` | `700` (Bold) | `56px` | `-0.02em` |
| **display-lg-mobile** | `32px` | `700` (Bold) | `40px` | `-0.015em` |
| **headline-xl** | `36px` | `700` (Bold) | `44px` | `-0.015em` |
| **headline-xl-mobile** | `26px` | `700` (Bold) | `34px` | `-0.01em` |
| **headline-lg** | `28px` | `600` (SemiBold) | `36px` | `-0.01em` |
| **headline-md** | `22px` | `600` (SemiBold) | `30px` | `-0.005em` |
| **headline-sm** | `18px` | `600` (SemiBold) | `26px` | `0` |
| **body-lg** | `18px` | `400` (Regular) | `28px` | `0` |
| **body-md** | `15px` | `400` (Regular) | `24px` | `0` |
| **body-sm** | `13px` | `400` (Regular) | `20px` | `0` |
| **label-lg** | `15px` | `600` (SemiBold) | `20px` | `0.01em` |
| **label-md** | `13px` | `600` (SemiBold) | `18px` | `0.01em` |
| **label-sm** | `11px` | `700` (Bold) | `16px` | `0.02em` |
| **price-display** | `22px` | `700` (Bold) | `26px` | `-0.01em` |

### 3.2. Quy tắc dấu tiếng Việt và Tiền tệ (Localization Guidelines)
- **Khoảng cách dòng (Line-height):** Giữ tối thiểu `1.4x` cho nội dung dài (body text) để các dấu hỏi, ngã, nặng có khoảng trống hiển thị rõ ràng, không bị đè lên dòng trên.
- **Định dạng tiền tệ:** Định dạng số tiền bắt buộc theo chuẩn Việt Nam: `1.250.000 ₫` hoặc `1.250.000 VND` kèm thuộc tính `font-variant-numeric: tabular-nums` để số tiền luôn thẳng cột khi hiển thị danh sách.

---

## 4. Spacing, Grid & Layout

### 4.1. Khoảng cách (Spacing Units)
- `space-xs`: `0.25rem` (4px)
- `space-sm`: `0.5rem` (8px)
- `space-md`: `1rem` (16px)
- `space-lg`: `1.5rem` (24px)
- `space-xl`: `2.5rem` (40px)

### 4.2. Hệ thống Grid & Breakpoints
- **Desktop (≥ 1200px):** 12 columns, max-width `1280px` (căn giữa), gutter `1.5rem` (24px), margin lề ngoài `2rem` (32px).
- **Tablet (768px – 1199px):** 8 columns linh hoạt, gutter `1.25rem` (20px), margin lề ngoài `1.5rem` (24px).
- **Mobile (< 768px):** 4 columns, gutter `1rem` (16px), margin lề ngoài `1rem` (16px). Các danh sách tour chuyển sang cuộn ngang (horizontal snap carousel) hoặc card 1 cột dọc.

---

## 5. Bo góc (Radius) & Đổ bóng (Elevation & Shadows)

### 5.1. Quy chuẩn bo góc (Border Radius)
- **`rounded-sm` (4px / 0.25rem):** Checkbox, radio dot, micro rating tag, chip nhỏ.
- **`rounded` / `rounded-md` (8px / 0.5rem):** Nút bấm chuẩn (Buttons), input form, ô chọn ngày trong lịch, thẻ xác minh.
- **`rounded-lg` (16px / 1rem):** Card tour, container profile hướng dẫn viên, box đánh giá, ảnh preview.
- **`rounded-xl` (24px / 1.5rem):** Floating Hero Search Bar, sticky mobile booking bar, bottom sheets modal.
- **`rounded-full` (9999px):** Badge ưu đãi/flash sale, filter chip phân loại, avatar tròn.

### 5.2. Đổ bóng (Elevation Levels)
Bóng đổ dùng tông màu slate pha xanh biển (`rgba(27, 43, 52, ...)`) để tạo độ trong trẻo tự nhiên, không bị vẩn đục:

- **Level 0 (Flat / Inset):** Không bóng, nền `#F7F8F5`, viền `1px solid #E2E8E5`. (Input fields, ô lịch không chọn).
- **Level 1 (Card Default):** `box-shadow: 0 2px 8px -2px rgba(27, 43, 52, 0.05), 0 1px 4px -1px rgba(27, 43, 52, 0.03)` + viền `1px solid #E2E8E5`. (Thẻ tour, thẻ hướng dẫn viên).
- **Level 2 (Hover & Floating):** `box-shadow: 0 12px 24px -4px rgba(27, 43, 52, 0.08), 0 4px 8px -2px rgba(27, 43, 52, 0.04)` + viền `1px solid #E2E8E5`. (Thanh tìm kiếm nổi, dropdown popover, hover card).
- **Level 3 (Modals & Overlays):** `box-shadow: 0 20px 32px -6px rgba(27, 43, 52, 0.16)`. (Hộp thoại xác nhận đặt chỗ, Mobile Bottom Sheet, Lightbox ảnh).

---

## 6. Thành phần giao diện cốt lõi (Core UI Components)

### 6.1. Floating Hero Search Bar (Thanh tìm kiếm chính)
- **Layout:** Cấu trúc phân tab (`Tour trọn gói`, `Hướng dẫn viên`, `Trải nghiệm trong ngày`).
- **Surface:** Nền trắng tinh khiết (`#FFFFFF`), `rounded-xl` (24px), viền `#E2E8E5`, Elevation Level 2.
- **Phân đoạn Input:**
  1. *Điểm đến* (Destination Selector với autocomplete dropdown)
  2. *Thời gian* (Date Range Picker)
  3. *Ngân sách* (Budget Range Slider theo VNĐ)
  4. *Số khách* (Guest Counter)
- **Nút hành động:** Nút chính màu Ocean Teal (`#087E8B`) nổi bật với icon kính lúp và chữ "Tìm kiếm".

### 6.2. Tour & Experience Listing Card (Thẻ danh sách tour)
- **Bề mặt:** Level 1 elevation, `rounded-lg` (16px), viền `1px solid #E2E8E5`. Khi hover chuyển nhẹ sang Level 2.
- **Ảnh đại diện (Media Cover):** Tỉ lệ 16:10 với:
  - Góc trên trái: Pill badge (e.g. `Tour Bán Chạy` - màu Teal, `Giảm 15%` - màu Coral `#B84A2F`).
  - Góc trên phải: Nút tròn trái tim yêu thích (nền mờ trắng, icon tim Ink Dark).
- **Nội dung:**
  - Tên địa danh (`Hạ Long, Quảng Ninh`) - màu Slate Mist (`#5A6E78`).
  - Tiêu đề tour - màu `#1B2B34`, giới hạn 2 dòng (2-line clamp).
  - Metadata: Thời lượng + Phương tiện di chuyển kèm icon nhỏ (`3 ngày 2 đêm` • `Ô tô`).
- **Footer thẻ:** Avatar hướng dẫn viên/công ty du lịch kèm tích xanh, điểm đánh giá (`4.9 ★ (128)`), giá hiển thị (`Chỉ từ 1.850.000 ₫`).

### 6.3. Category & Filter Chips (Thẻ lọc danh mục)
- **Dạng:** Pill-shaped (`rounded-full`), hỗ trợ cuộn ngang trên mobile.
- **Trạng thái thường:** Nền `#FFFFFF`, viền `1px solid #E2E8E5`, chữ `#1B2B34`.
- **Trạng thái chọn (Active):** Nền Ocean Teal `#087E8B`, chữ trắng `#FFFFFF`.

### 6.4. Trust Badges (Huy hiệu bảo chứng)
- **Đối tác xác minh (Verified Partner):** Nền nhẹ Deep Teal (`rgba(11, 89, 99, 0.08)`), chữ `#0B5963`, icon tích xanh.
- **Bảo đảm hoàn tiền (Guaranteed Refund):** Nền nhẹ Coral (`rgba(184, 74, 47, 0.08)`), chữ `#B84A2F`.
- **Hỗ trợ 24/7:** Nền Slate Mist nhẹ với chấm xanh active status.

### 6.5. Buttons (Nút bấm)
- **Primary Button:** Nền Ocean Teal `#087E8B`, hover `#0B5963`, chữ trắng in đậm, `rounded-md` (8px), padding `12px 24px`.
- **Accent / Instant Book Button:** Nền Coral `#B84A2F`, hover `#9C3C24`, chữ trắng. Dùng khi kích hoạt "Đặt ngay".
- **Secondary / Outline Button:** Viền `1.5px solid #087E8B`, nền trong suốt, chữ `#087E8B`, hover nền `rgba(8, 126, 139, 0.04)`.
- **Ghost Button:** Nút dạng link màu Slate cho thao tác phụ (`Hủy`, `Đóng`, `Xem thêm`).

---

## 7. Cấu hình Tailwind CSS đề xuất (`tailwind.config.ts`)

Để đồng bộ hoàn hảo với Design System trên:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#087E8B',
          primaryDark: '#00636E',
          secondary: '#0B5963',
          secondaryDark: '#226771',
          accent: '#B84A2F',
          accentHover: '#9E371E',
          ink: '#1B2B34',
          slate: '#5A6E78',
          canvas: '#F7F8F5',
          border: '#E2E8E5',
        },
        surface: {
          DEFAULT: '#F5FAFF',
          dim: '#CBDCE8',
          bright: '#F5FAFF',
          containerLowest: '#FFFFFF',
          containerLow: '#E9F5FF',
          container: '#DFF0FD',
          containerHigh: '#D9EBF7',
          containerHighest: '#D4E5F1',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'sans-serif'],
        vietnam: ['"Be Vietnam Pro"', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      boxShadow: {
        elevation1: '0 2px 8px -2px rgba(27, 43, 52, 0.05), 0 1px 4px -1px rgba(27, 43, 52, 0.03)',
        elevation2: '0 12px 24px -4px rgba(27, 43, 52, 0.08), 0 4px 8px -2px rgba(27, 43, 52, 0.04)',
        elevation3: '0 20px 32px -6px rgba(27, 43, 52, 0.16)',
      },
    },
  },
  plugins: [],
};

export default config;
```
