import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../models/tour_detail_model.dart';

class TourDetailPoliciesWidget extends StatelessWidget {
  final TourDetailModel tour;

  const TourDetailPoliciesWidget({
    super.key,
    required this.tour,
  });

  @override
  Widget build(BuildContext context) {
    final hasInclusions = tour.inclusions.isNotEmpty;
    final hasExclusions = tour.exclusions.isNotEmpty;
    final hasCancellation = tour.cancellationPolicy != null && tour.cancellationPolicy!.trim().isNotEmpty;
    final hasTravelNotes = tour.travelNotes != null && tour.travelNotes!.trim().isNotEmpty;
    final hasDocuments = tour.requiredDocuments != null && tour.requiredDocuments!.trim().isNotEmpty;
    final hasChildPolicy = tour.childPricingPolicy != null && tour.childPricingPolicy!.trim().isNotEmpty;

    if (!hasInclusions &&
        !hasExclusions &&
        !hasCancellation &&
        !hasTravelNotes &&
        !hasDocuments &&
        !hasChildPolicy) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.shield_outlined, color: AppColors.primary, size: 22),
            SizedBox(width: 8),
            Text(
              'Thông tin & Chính sách',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Inclusions (Bao gồm)
        if (hasInclusions)
          _buildListSection(
            title: 'Dịch vụ bao gồm',
            icon: Icons.check_circle_outline_rounded,
            iconColor: AppColors.success,
            items: tour.inclusions,
          ),

        // Exclusions (Không bao gồm)
        if (hasExclusions)
          _buildListSection(
            title: 'Dịch vụ không bao gồm',
            icon: Icons.cancel_outlined,
            iconColor: AppColors.error,
            items: tour.exclusions,
          ),

        // Cancellation Policy (Chính sách hoàn hủy)
        if (hasCancellation)
          _buildTextSection(
            title: 'Chính sách hoàn hủy',
            icon: Icons.assignment_return_outlined,
            iconColor: AppColors.warning,
            content: tour.cancellationPolicy!,
          ),

        // Child Pricing Policy (Chính sách trẻ em)
        if (hasChildPolicy)
          _buildTextSection(
            title: 'Chính sách giá trẻ em',
            icon: Icons.child_care_rounded,
            iconColor: AppColors.primaryLight,
            content: tour.childPricingPolicy!,
          ),

        // Travel Notes (Lưu ý chuyến đi)
        if (hasTravelNotes)
          _buildTextSection(
            title: 'Lưu ý chuyến đi',
            icon: Icons.lightbulb_outline_rounded,
            iconColor: AppColors.info,
            content: tour.travelNotes!,
          ),

        // Required Documents (Giấy tờ cần thiết)
        if (hasDocuments)
          _buildTextSection(
            title: 'Giấy tờ cần thiết',
            icon: Icons.description_outlined,
            iconColor: AppColors.primary,
            content: tour.requiredDocuments!,
          ),
      ],
    );
  }

  Widget _buildListSection({
    required String title,
    required IconData icon,
    required Color iconColor,
    required List<String> items,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 6),
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        color: iconColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        item,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildTextSection({
    required String title,
    required IconData icon,
    required Color iconColor,
    required String content,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            content,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

