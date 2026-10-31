import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../models/tour_detail_model.dart';

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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.timeline_rounded, color: AppColors.primary, size: 22),
            SizedBox(width: 8),
            Text(
              'Lịch trình chi tiết',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: itinerary.length,
          itemBuilder: (context, index) {
            final day = itinerary[index];
            final isLast = index == itinerary.length - 1;

            final dayLabel = (day.toDay != null && day.toDay! > day.day)
                ? 'Ngày ${day.day} - ${day.toDay}'
                : 'Ngày ${day.day}';

            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Step Indicator & Vertical Connecting Line
                  SizedBox(
                    width: 72,
                    child: Column(
                      children: [
                        // Day Pill Badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withValues(alpha: 0.25),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Text(
                            dayLabel,
                            style: const TextStyle(
                              color: AppColors.textOnPrimary,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        // Connecting line down to the next day
                        if (!isLast)
                          Expanded(
                            child: Container(
                              width: 2,
                              margin: const EdgeInsets.symmetric(vertical: 4),
                              color: AppColors.border,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Day Content Card
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(bottom: isLast ? 0 : 20),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.border),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Day Title
                            Text(
                              day.title,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            if (day.description != null && day.description!.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                day.description!,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                            ],
                            if (day.activities.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              const Divider(height: 1, color: AppColors.borderLight),
                              const SizedBox(height: 10),
                              ...day.activities.map((activity) => Padding(
                                    padding: const EdgeInsets.only(bottom: 6),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          margin: const EdgeInsets.only(top: 5),
                                          width: 6,
                                          height: 6,
                                          decoration: const BoxDecoration(
                                            color: AppColors.primaryLight,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            activity,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              color: AppColors.textPrimary,
                                              height: 1.35,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  )),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

