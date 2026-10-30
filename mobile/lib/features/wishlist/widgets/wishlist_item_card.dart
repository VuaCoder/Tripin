import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../tours/models/tour_model.dart';
import '../models/wishlist_item_model.dart';

/// Thẻ hiển thị tour đã lưu trong màn hình Danh sách yêu thích (AC4)
/// Tích hợp nút xóa nhanh từng mục
class WishlistItemCard extends StatelessWidget {
  final WishlistItemModel item;
  final VoidCallback? onTap;
  final VoidCallback? onRemove;

  const WishlistItemCard({
    super.key,
    required this.item,
    this.onTap,
    this.onRemove,
  });

  bool get _isInTest {
    if (kIsWeb) return false;
    return Platform.environment.containsKey('FLUTTER_TEST');
  }

  @override
  Widget build(BuildContext context) {
    final tour = item.tour ??
        TourModel(
          id: item.tourId,
          title: 'Tour không còn khả dụng',
          destination: 'N/A',
          durationDays: 1,
          basePrice: 0,
        );

    final isAvailable = item.available && item.tour != null;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 0.8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: isAvailable ? onTap : null,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Ảnh Thumbnail bên trái
                SizedBox(
                  width: 125,
                  height: 135,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _buildImage(tour.coverImage),

                      // Badge cảnh báo nếu tour không còn khả dụng
                      if (!isAvailable)
                        Container(
                          color: Colors.black.withValues(alpha: 0.65),
                          alignment: Alignment.center,
                          padding: const EdgeInsets.all(8),
                          child: const Text(
                            'Tạm ngừng',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),

                      // Badge điểm đến ở góc dưới
                      if (isAvailable && tour.destination.isNotEmpty)
                        Positioned(
                          bottom: 6,
                          left: 6,
                          right: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.72),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.location_on_rounded, size: 10, color: Colors.white),
                                const SizedBox(width: 2),
                                Expanded(
                                  child: Text(
                                    tour.destination,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

                // 2. Chi tiết Tour & Nút Xóa nhanh
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Dòng 1: Đánh giá & Nút xóa nhanh
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.star_rounded, size: 15, color: Color(0xFFF5A623)),
                                const SizedBox(width: 3),
                                Text(
                                  tour.formattedRating,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                if (tour.ratingCount > 0) ...[
                                  const SizedBox(width: 2),
                                  Text(
                                    '(${tour.ratingCount})',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ],
                            ),

                            // Nút xóa nhanh từng mục (AC4)
                            InkWell(
                              onTap: onRemove,
                              borderRadius: BorderRadius.circular(20),
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFECEF),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.favorite_rounded,
                                  color: Color(0xFFFF385C),
                                  size: 16,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),

                        // Dòng 2: Tiêu đề Tour
                        Text(
                          tour.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: isAvailable ? AppColors.textPrimary : AppColors.textMuted,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 6),

                        // Dòng 3: Thời lượng
                        Row(
                          children: [
                            const Icon(
                              Icons.schedule_rounded,
                              size: 13,
                              color: AppColors.textSecondary,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              tour.durationText,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),

                        // Dòng 4: Giá tiền
                        Text(
                          tour.formattedPrice,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: isAvailable ? AppColors.primary : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildImage(String? url) {
    if (_isInTest || url == null || url.isEmpty) {
      return Container(
        color: const Color(0xFFF1F5F9),
        child: const Center(
          child: Icon(Icons.landscape_rounded, size: 36, color: Color(0xFFCBD5E1)),
        ),
      );
    }

    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      placeholder: (_, _) => Container(color: const Color(0xFFF1F5F9)),
      errorWidget: (_, _, _) => Container(
        color: const Color(0xFFF1F5F9),
        child: const Center(
          child: Icon(Icons.broken_image_rounded, size: 32, color: Color(0xFFCBD5E1)),
        ),
      ),
    );
  }
}
