import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../models/tour_detail_model.dart';

/// Component lịch trình chuyến đi chuẩn thiết kế Ảnh 4:
/// - Không còn tiêu đề "Lịch trình chi tiết" thừa thãi bên trong
/// - Mỗi ngày là một card độc lập, tiêu đề bên trái, huy hiệu [Ngày X] ở góc phải trên
/// - Chi tiết hoạt động và mô tả hiển thị thanh lịch bên dưới
class TourDetailTimelineWidget extends StatelessWidget {
  final List<TourItineraryDayModel> itinerary;

  const TourDetailTimelineWidget({
    super.key,
    required this.itinerary,
  });

  @override
  Widget build(BuildContext context) {
    if (itinerary.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: const Row(
          children: [
            Icon(Icons.info_outline_rounded, color: AppColors.textMuted, size: 20),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Lịch trình chi tiết đang được cập nhật.',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: EdgeInsets.zero,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itinerary.length,
      separatorBuilder: (_, _) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final day = itinerary[index];
        final dayLabel = (day.toDay != null && day.toDay! > day.day)
            ? 'Ngày ${day.day} - ${day.toDay}'
            : 'Ngày ${day.day}';

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Tiêu đề bên trái, Huy hiệu [Ngày X] bên phải theo đúng Ảnh 4
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Tiêu đề ngày
                    Expanded(
                      child: Text(
                        day.title,
                        style: const TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Badge [Ngày X] góc phải trên (chuẩn Ảnh 4)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF0F766E), width: 1.2),
                      ),
                      child: Text(
                        dayLabel,
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                    ),
                  ],
                ),

                // Mô tả ngày (nếu có)
                if (day.description != null && day.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    day.description!,
                    style: const TextStyle(
                      fontSize: 13.5,
                      color: Color(0xFF475569),
                      height: 1.45,
                    ),
                  ),
                ],

                // Danh sách hoạt động (các gạch đầu dòng / bullet points)
                if (day.activities.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                  const SizedBox(height: 10),
                  ...day.activities.map(
                    (activity) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            margin: const EdgeInsets.only(top: 6),
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: Color(0xFF0F766E),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              activity,
                              style: const TextStyle(
                                fontSize: 13,
                                color: Color(0xFF334155),
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
