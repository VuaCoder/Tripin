import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../models/guide_models.dart';

/// Returns the note (possibly empty for an acceptance), or null when the dialog is dismissed.
Future<String?> showAnswerAssignmentDialog(
  BuildContext context, {
  required GuideAssignedTour tour,
  required bool accept,
}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _AnswerAssignmentDialog(tour: tour, accept: accept),
  );
}

class _AnswerAssignmentDialog extends StatefulWidget {
  const _AnswerAssignmentDialog({required this.tour, required this.accept});

  final GuideAssignedTour tour;
  final bool accept;

  @override
  State<_AnswerAssignmentDialog> createState() =>
      _AnswerAssignmentDialogState();
}

class _AnswerAssignmentDialogState extends State<_AnswerAssignmentDialog> {
  final _formKey = GlobalKey<FormState>();
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      Navigator.of(context).pop(_controller.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    final accept = widget.accept;
    return AlertDialog(
      title: Text(
        accept ? 'Nhận tour được phân công' : 'Từ chối tour được phân công',
      ),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              accept
                  ? 'Bạn xác nhận sẽ phụ trách tour này. Đại lý sẽ nhận được thông báo.'
                  : 'Hãy cho đại lý biết lý do để họ sắp xếp hướng dẫn viên khác.',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            Text(
              widget.tour.title,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _controller,
              autofocus: true,
              maxLength: 500,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: accept
                    ? 'Ghi chú (không bắt buộc)'
                    : 'Lý do từ chối',
                hintText: accept
                    ? 'Ví dụ: Tôi sẽ có mặt trước giờ khởi hành 30 phút.'
                    : 'Ví dụ: Tôi đã có lịch dẫn tour khác trong ngày này.',
              ),
              validator: accept
                  ? null
                  : (value) => (value?.trim().isEmpty ?? true)
                        ? 'Vui lòng nhập lý do từ chối.'
                        : null,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Hủy'),
        ),
        ElevatedButton(
          onPressed: _submit,
          child: Text(accept ? 'Xác nhận nhận tour' : 'Xác nhận từ chối'),
        ),
      ],
    );
  }
}
