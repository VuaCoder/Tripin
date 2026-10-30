import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../models/recently_viewed_model.dart';

/// Khối hiển thị ảnh ghép 2x2 cho mục "Recently viewed" (Ảnh 4)
/// Gồm 4 góc ảnh, nếu thiếu thì ô góc dưới phải sẽ hiển thị khối màu xám như trong thiết kế mẫu
class RecentlyViewedCollageWidget extends StatelessWidget {
  final List<RecentlyViewedTourModel> items;

  const RecentlyViewedCollageWidget({
    super.key,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    // Thu thập danh sách ảnh bìa từ các tour xem gần đây
    final imageUrls = <String>[];
    for (final item in items) {
      if (item.tour.coverImage != null && item.tour.coverImage!.isNotEmpty) {
        if (!imageUrls.contains(item.tour.coverImage)) {
          imageUrls.add(item.tour.coverImage!);
        }
      }
      if (imageUrls.length >= 4) break;
    }

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: const Color(0xFF8E8E93),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: AspectRatio(
          aspectRatio: 1.0,
          child: Column(
            children: [
              // Hàng trên (2 ảnh)
              Expanded(
                child: Row(
                  children: [
                    Expanded(child: _buildQuadrant(imageUrls.isNotEmpty ? imageUrls[0] : null)),
                    const SizedBox(width: 2.5),
                    Expanded(child: _buildQuadrant(imageUrls.length > 1 ? imageUrls[1] : null)),
                  ],
                ),
              ),
              const SizedBox(height: 2.5),
              // Hàng dưới (2 ảnh - nếu chỉ có 3 ảnh thì ô thứ 4 là màu xám như ảnh 4)
              Expanded(
                child: Row(
                  children: [
                    Expanded(child: _buildQuadrant(imageUrls.length > 2 ? imageUrls[2] : null)),
                    const SizedBox(width: 2.5),
                    Expanded(child: _buildQuadrant(imageUrls.length > 3 ? imageUrls[3] : null, isPlaceholderGrey: true)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuadrant(String? url, {bool isPlaceholderGrey = false}) {
    if (url != null && url.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        placeholder: (context, url) => Container(color: const Color(0xFFE5E7EB)),
        errorWidget: (context, url, error) => Container(
          color: const Color(0xFFE5E7EB),
          child: const Icon(Icons.image_outlined, size: 20, color: AppColors.textMuted),
        ),
      );
    }

    return Container(
      color: isPlaceholderGrey ? const Color(0xFF8E8E93) : const Color(0xFFD1D5DB),
      child: isPlaceholderGrey
          ? null
          : const Center(
              child: Icon(
                Icons.travel_explore_rounded,
                size: 20,
                color: Colors.white70,
              ),
            ),
    );
  }
}
