import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_colors.dart';
import '../models/guide_models.dart';
import '../utils/guide_format.dart';

class RosterTile extends StatelessWidget {
  const RosterTile({super.key, required this.item});

  final GuideRosterItem item;

  Future<void> _call(BuildContext context) async {
    final phone = item.contactPhone?.replaceAll(RegExp(r'\s+'), '') ?? '';
    if (phone.isEmpty) return;

    var launched = false;
    try {
      launched = await launchUrl(
        Uri(scheme: 'tel', path: phone),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      launched = false;
    }
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không thể mở trình gọi điện trên thiết bị này.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final departure = item.departureDate;
    final checkedInAt = item.checkedInAt;
    final status = item.checkedIn
        ? 'Đã lên xe${checkedInAt == null ? '' : ' · ${DateFormat('HH:mm').format(checkedInAt)}'}'
        : 'Chưa đến';
    final guestSummary = formatGuestCounts(item.guests, item.participants);
    final subtitle = departure == null
        ? guestSummary
        : '$guestSummary · ${DateFormat('dd/MM/yyyy').format(departure)}';
    final phone = item.contactPhone?.trim();
    final notes = item.notes?.trim();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: item.checkedIn
                    ? AppColors.successLight
                    : AppColors.surfaceVariant,
                child: Icon(
                  item.checkedIn ? Icons.check : Icons.person_outline,
                  color: item.checkedIn
                      ? AppColors.success
                      : AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.holderName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: item.checkedIn
                      ? AppColors.successLight
                      : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: item.checkedIn
                        ? AppColors.success
                        : AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          if (phone != null && phone.isNotEmpty)
            Align(
              alignment: Alignment.centerLeft,
              child: Tooltip(
                message: 'Gọi ${item.holderName}',
                child: TextButton.icon(
                  onPressed: () => _call(context),
                  icon: const Icon(Icons.call, size: 18),
                  label: Text(phone),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    alignment: Alignment.centerLeft,
                    foregroundColor: AppColors.primary,
                  ),
                ),
              ),
            ),
          if (notes != null && notes.isNotEmpty)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.sticky_note_2_outlined,
                  size: 16,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    notes,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
