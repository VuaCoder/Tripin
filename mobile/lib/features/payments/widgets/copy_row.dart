import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/constants/app_colors.dart';

/// Một dòng thông tin chuyển khoản kèm nút sao chép (AC3).
class CopyRow extends StatelessWidget {
  final String label;
  final String value;
  final bool emphasize;

  const CopyRow({super.key, required this.label, required this.value, this.emphasize = false});

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Đã sao chép'), duration: Duration(seconds: 1)));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: emphasize ? 18 : 15,
                    fontWeight: FontWeight.w600,
                    color: emphasize ? AppColors.primary : AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Sao chép $label',
            onPressed: () => _copy(context),
            icon: const Icon(Icons.copy_rounded, size: 20, color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}
