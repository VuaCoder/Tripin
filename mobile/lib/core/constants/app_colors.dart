import 'package:flutter/material.dart';

/// BẢNG MÀU CHUẨN THƯƠNG HIỆU TRIPRI (ĐỒNG BỘ 100% VỚI WEB TAILWIND)
/// Toàn bộ AI Agent và Thành viên nhóm BẮT BUỘC sử dụng các hằng số màu ở đây.
/// TUYỆT ĐỐI KHÔNG hardcode mã màu hex ở bất kỳ Widget nào!
class AppColors {
  AppColors._();

  // --- 1. MÀU CHỦ ĐẠO (BRAND TEAL) ---
  /// Màu xanh ngọc chủ đạo (Primary brand teal - dùng cho Appbar, Button chính, Selected Tab)
  static const Color primary = Color(0xFF005A64);

  /// Màu xanh ngọc sáng (Focus ring, Active state, Icon nổi bật, Badges)
  static const Color primaryLight = Color(0xFF087E8B);

  /// Màu xanh ngọc đậm (Hover, Pressed, Dark container)
  static const Color primaryDark = Color(0xFF003F46);

  /// Màu nền nhạt xanh ngọc (Background icon, Chip đã chọn, Light card)
  static const Color primarySurface = Color(0xFFE6F3F4);

  // --- 2. MÀU ĐIỂM NHẤN (BRAND ORANGE / ACCENT) ---
  /// Màu cam thương hiệu (Ngôi sao đánh giá, Nút kêu gọi Đặt ngay, Discount badge)
  static const Color secondary = Color(0xFFF5A623);

  /// Màu cam khi bấm hoặc nhấn mạnh
  static const Color secondaryDark = Color(0xFFE09215);

  /// Màu cam rất nhạt làm nền cho voucher hoặc badge giảm giá
  static const Color secondarySurface = Color(0xFFFEF3C7);
  static const Color secondaryLight = secondarySurface;

  // --- 3. MÀU TRẠNG THÁI NGHIỆP VỤ (SEMANTIC COLORS) ---
  /// Thành công (Vé hợp lệ, Thanh toán thành công, Đã điểm danh)
  static const Color success = Color(0xFF10B981);
  static const Color successSurface = Color(0xFFD1FAE5);
  static const Color successLight = successSurface;

  /// Cảnh báo (Sắp hết hạn, Chờ thanh toán, Lưu ý hủy tour)
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningSurface = Color(0xFFFEF3C7);

  /// Thất bại / Lỗi (Hủy đơn, Vé không hợp lệ, Sai OTP, Báo cáo sự cố)
  static const Color error = Color(0xFFEF4444);
  static const Color errorSurface = Color(0xFFFEE2E2);
  static const Color errorLight = errorSurface;

  /// Thông tin (Badge, Hướng dẫn, Điểm đón)
  static const Color info = Color(0xFF0284C7);
  static const Color infoSurface = Color(0xFFE0F2FE);

  // --- 4. BỀ MẶT & NỀN (SURFACES & BACKGROUNDS) ---
  /// Nền chính của toàn app (Slate tint nhẹ nhàng, dịu mắt)
  static const Color background = Color(0xFFF8FAFC);

  /// Nền màu cát ấm (Dùng cho banner tour hoặc section đặc biệt giống web)
  static const Color backgroundSand = Color(0xFFFBF9F5);

  /// Nền thẻ trắng tinh (Card, Dialog, BottomSheet)
  static const Color surface = Colors.white;

  /// Nền xám nhạt (Input field fill, Divider nhẹ, Card secondary)
  static const Color surfaceVariant = Color(0xFFF1F5F9);

  // --- 5. ĐƯỜNG VIỀN (BORDERS) ---
  /// Viền thẻ tour, viền input field mặc định
  static const Color border = Color(0xFFE2E8F0);

  /// Viền nhạt hơn cho divider nội bộ
  static const Color borderLight = Color(0xFFF1F5F9);

  // --- 6. MÀU CHỮ & BIỂU TƯỢNG (TEXT & ICONS) ---
  /// Tiêu đề chính, văn bản quan trọng (Slate 900)
  static const Color textPrimary = Color(0xFF0F172A);

  /// Nội dung mô tả, phụ đề, nhãn input (Slate 600)
  static const Color textSecondary = Color(0xFF64748B);

  /// Placeholder, hint text, icon không kích hoạt (Slate 400)
  static const Color textMuted = Color(0xFF94A3B8);

  /// Chữ trắng trên nền tối
  static const Color textOnPrimary = Colors.white;

  // --- 7. HIỆU ỨNG TẢI (SHIMMER / SKELETON) ---
  static const Color shimmerBase = Color(0xFFE2E8F0);
  static const Color shimmerHighlight = Color(0xFFF8FAFC);
}
