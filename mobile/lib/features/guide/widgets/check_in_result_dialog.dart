import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/constants/app_colors.dart';
import '../models/guide_models.dart';

Future<void> playCheckInFeedback(bool success) async {
  try {
    if (success) {
      await HapticFeedback.mediumImpact();
      await SystemSound.play(SystemSoundType.click);
    } else {
      await HapticFeedback.heavyImpact();
      await SystemSound.play(SystemSoundType.alert);
    }
  } catch (_) {
    // Feedback is best-effort; a device without a vibrator or system sound must not block the result.
  }
}

Future<void> showCheckInResultDialog(BuildContext context, CheckInOutcome outcome) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => CheckInResultDialog(outcome: outcome),
  );
}

class CheckInResultDialog extends StatelessWidget {
  const CheckInResultDialog({super.key, required this.outcome});

  final CheckInOutcome outcome;

  @override
  Widget build(BuildContext context) {
    final success = outcome is CheckInSuccess;
    final result = outcome is CheckInSuccess ? (outcome as CheckInSuccess).result : null;
    final failure = outcome is CheckInFailure ? (outcome as CheckInFailure) : null;
    final color = success ? AppColors.success : AppColors.error;
    final background = success ? AppColors.successLight : AppColors.errorLight;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(color: background, shape: BoxShape.circle),
            child: Icon(success ? Icons.check_circle : Icons.error, color: color, size: 44),
          ),
          const SizedBox(height: 16),
          Text(
            success ? 'Điểm danh thành công' : 'Điểm danh thất bại',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold, color: color),
          ),
          const SizedBox(height: 8),
          Text(
            success ? '${result!.holderName} - ${result.participants} vé' : failure!.message,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, color: AppColors.textPrimary, height: 1.4),
          ),
          if (success) ...[
            const SizedBox(height: 6),
            Text(
              'Tour: ${result!.tourTitle}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Tiếp tục quét'),
        ),
      ],
    );
  }
}
