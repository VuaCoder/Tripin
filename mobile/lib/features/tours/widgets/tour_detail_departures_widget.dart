import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../models/tour_detail_model.dart';

class TourDetailDeparturesWidget extends StatelessWidget {
  final List<TourDepartureModel> departures;
  final String? selectedDepartureId;
  final ValueChanged<String> onDepartureSelected;

  const TourDetailDeparturesWidget({
    super.key,
    required this.departures,
    required this.selectedDepartureId,
    required this.onDepartureSelected,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );
    final dateFormatter = DateFormat('dd/MM/yyyy');

    if (departures.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: const Row(
          children: [
            Icon(Icons.event_busy_rounded, color: AppColors.textMuted, size: 22),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Hiện chưa có ngày khởi hành mở bán cho tour này.',
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
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Row(
              children: [
                Icon(Icons.calendar_month_rounded, color: AppColors.primary, size: 22),
                SizedBox(width: 8),
                Text(
                  'Ngày khởi hành',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
            Text(
              '${departures.length} lịch có sẵn',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 102,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: departures.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final departure = departures[index];
              final isSelected = departure.id == selectedDepartureId;
              final isBookable = departure.isBookable;

              final formattedDate = dateFormatter.format(departure.date);
              final formattedPrice = currencyFormatter.format(departure.price);

              return GestureDetector(
                onTap: isBookable
                    ? () => onDepartureSelected(departure.id)
                    : null,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 148,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: !isBookable
                        ? AppColors.surfaceVariant.withValues(alpha: 0.6)
                        : isSelected
                            ? AppColors.primarySurface
                            : AppColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: !isBookable
                          ? AppColors.border
                          : isSelected
                              ? AppColors.primary
                              : AppColors.border,
                      width: isSelected ? 2 : 1,
                    ),
                    boxShadow: [
                      if (isSelected)
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Date & Selection / Status Badge
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            formattedDate,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: !isBookable
                                  ? AppColors.textMuted
                                  : isSelected
                                      ? AppColors.primary
                                      : AppColors.textPrimary,
                            ),
                          ),
                          if (isSelected)
                            const Icon(
                              Icons.check_circle_rounded,
                              size: 16,
                              color: AppColors.primary,
                            )
                          else if (!isBookable)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: AppColors.errorSurface,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'Hết chỗ',
                                style: TextStyle(
                                  fontSize: 9,
                                  color: AppColors.error,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                        ],
                      ),

                      // Price
                      Text(
                        formattedPrice,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: !isBookable
                              ? AppColors.textMuted
                              : AppColors.textPrimary,
                        ),
                      ),

                      // Remaining capacity
                      Row(
                        children: [
                          Icon(
                            Icons.people_outline_rounded,
                            size: 13,
                            color: !isBookable
                                ? AppColors.textMuted
                                : departure.remaining <= 5
                                    ? AppColors.warning
                                    : AppColors.textSecondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            !isBookable
                                ? 'Đã đóng'
                                : 'Còn ${departure.remaining} chỗ',
                            style: TextStyle(
                              fontSize: 11,
                              color: !isBookable
                                  ? AppColors.textMuted
                                  : departure.remaining <= 5
                                      ? AppColors.warning
                                      : AppColors.textSecondary,
                              fontWeight: departure.remaining <= 5
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
