import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

/// Giao diện Empty State khi danh sách yêu thích trống (AC5)
class EmptyWishlistWidget extends StatelessWidget {
  final VoidCallback? onExploreTap;

  const EmptyWishlistWidget({
    super.key,
    this.onExploreTap,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Icon Trái tim trong vòng tròn phong cách Brand Teal
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: AppColors.primarySurface,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.favorite_border_rounded,
                size: 44,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 24),

            // Tiêu đề Empty State
            const Text(
              'Chưa có tour yêu thích nào',
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.3,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),

            // Phụ đề mô tả
            const Text(
              'Hãy khám phá những điểm đến tuyệt vời và chạm vào biểu tượng trái tim trên thẻ tour để lưu lại những chuyến đi bạn ưng ý nhất.',
              style: TextStyle(
                fontSize: 13.5,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),

            // Nút "Khám phá ngay" (AC5)
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                onPressed: onExploreTap,
                icon: const Icon(Icons.travel_explore_rounded, size: 20, color: Colors.white),
                label: const Text(
                  'Khám phá ngay',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 2,
                  shadowColor: AppColors.primary.withValues(alpha: 0.3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
