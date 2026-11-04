import 'package:flutter/material.dart';

import '../cubit/guide_check_in_cubit.dart';
import '../models/guide_models.dart';
import 'check_in_result_dialog.dart';

/// Shows the manual-entry dialog, calls the same check-in endpoint and shows the result.
Future<void> runManualCheckIn(BuildContext context, GuideCheckInCubit cubit) async {
  final code = await showManualCodeDialog(context);
  if (code == null || !context.mounted) return;

  final outcome = await cubit.checkIn(code);
  if (!context.mounted || outcome == null) return;

  await playCheckInFeedback(outcome is CheckInSuccess);
  if (!context.mounted) return;
  await showCheckInResultDialog(context, outcome);
}

Future<String?> showManualCodeDialog(BuildContext context) {
  return showDialog<String>(
    context: context,
    builder: (_) => const _ManualCodeDialog(),
  );
}

class _ManualCodeDialog extends StatefulWidget {
  const _ManualCodeDialog();

  @override
  State<_ManualCodeDialog> createState() => _ManualCodeDialogState();
}

class _ManualCodeDialogState extends State<_ManualCodeDialog> {
  final _formKey = GlobalKey<FormState>();
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      Navigator.of(context).pop(_controller.text.trim().toUpperCase());
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Điểm danh thủ công'),
      content: Form(
        key: _formKey,
        child: TextFormField(
          controller: _controller,
          autofocus: true,
          textCapitalization: TextCapitalization.characters,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _submit(),
          decoration: const InputDecoration(
            labelText: 'Mã vé',
            hintText: 'ETK-...',
            helperText: 'Nhập mã in trên vé điện tử của khách.',
          ),
          validator: (value) {
            final text = value?.trim() ?? '';
            if (text.isEmpty) return 'Vui lòng nhập mã vé.';
            if (text.length > 64) return 'Mã vé tối đa 64 ký tự.';
            return null;
          },
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Hủy')),
        ElevatedButton(onPressed: _submit, child: const Text('Điểm danh')),
      ],
    );
  }
}
