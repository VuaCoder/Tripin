import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import 'precise_rating_stars.dart';

class TourReviewSummaryWidget extends StatelessWidget {
  final double ratingAvg;
  final int ratingCount;

  const TourReviewSummaryWidget({
    super.key,
    required this.ratingAvg,
    required this.ratingCount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          // Left: Big Rating Number and Stars
          Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                ratingAvg.toStringAsFixed(1),
                style: const TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 4),
              PreciseRatingStars(
                rating: ratingAvg,
                size: 18,
                spacing: 2,
              ),
              const SizedBox(height: 4),
              Text(
                '$ratingCount đánh giá',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),

          const SizedBox(width: 20),
          Container(width: 1, height: 60, color: AppColors.borderLight),
          const SizedBox(width: 20),

          // Right: Highlight Message
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.verified_rounded,
                      size: 16,
                      color: AppColors.success,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      ratingAvg >= 4.5
                          ? 'Được du khách đánh giá cao'
                          : 'Trải nghiệm du lịch thực tế',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  '100% đánh giá từ du khách đã hoàn thành chuyến đi thực tế trên Tripri.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

