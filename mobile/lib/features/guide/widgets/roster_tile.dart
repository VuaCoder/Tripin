import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../models/guide_models.dart';

class RosterTile extends StatelessWidget {
  const RosterTile({super.key, required this.item});

  final GuideRosterItem item;

  @override
  Widget build(BuildContext context) {
    final departure = item.departureDate;
    final checkedInAt = item.checkedInAt;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: CircleAvatar(
        backgroundColor: item.checkedIn ? AppColors.successLight : AppColors.surfaceVariant,
        child: Icon(
          item.checkedIn ? Icons.check : Icons.person_outline,
          color: item.checkedIn ? AppColors.success : AppColors.textSecondary,
        ),
      ),
      title: Text(
        item.holderName,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        [
          '${item.participants} vé',
          if (departure != null) DateFormat('dd/MM/yyyy').format(departure),
          if (checkedInAt != null) 'Điểm danh ${DateFormat('HH:mm').format(checkedInAt)}',
        ].join(' · '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: item.checkedIn ? AppColors.successLight : AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          item.checkedIn ? 'Đã có mặt' : 'Chưa điểm danh',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: item.checkedIn ? AppColors.success : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
