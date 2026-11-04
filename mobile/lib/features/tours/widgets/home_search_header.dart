import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

/// Thanh tìm kiếm nhanh dạng Floating Capsule với hiệu ứng đổ bóng 3D nổi bật
/// Thiết kế tối giản, tập trung vào hành động tìm kiếm "Bắt đầu cuộc hành trình"
class HomeSearchHeader extends StatelessWidget {
  final VoidCallback onSearchTap;

  const HomeSearchHeader({
    super.key,
    required this.onSearchTap,
    // Giữ tham số tùy chọn để đảm bảo tính tương thích
    String? userName,
    DateTime? customTime,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
      child: InkWell(
        onTap: onSearchTap,
        borderRadius: BorderRadius.circular(32),
        child: Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            border: Border.all(
              color: const Color(0xFFE2E8F0),
              width: 1.0,
            ),
            // Hiệu ứng đổ bóng 3D đa tầng (Multi-layer 3D Shadow) tạo độ nổi và chiều sâu chân thực
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.10),
                blurRadius: 18,
                spreadRadius: 0,
                offset: const Offset(0, 8),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 6,
                spreadRadius: 0,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.search_rounded,
                color: AppColors.primary,
                size: 22,
              ),
              SizedBox(width: 10),
              Text(
                'Bắt đầu cuộc hành trình',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
