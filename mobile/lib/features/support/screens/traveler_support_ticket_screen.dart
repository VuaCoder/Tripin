import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../../core/network/api_client.dart';

typedef SubmitSupportTicket = Future<String> Function(
  String category,
  String subject,
  String message,
);

class TravelerSupportTicketScreen extends StatefulWidget {
  const TravelerSupportTicketScreen({super.key, this.submit});
  final SubmitSupportTicket? submit;
  @override
  State<TravelerSupportTicketScreen> createState() =>
      _TravelerSupportTicketScreenState();
}

class _TravelerSupportTicketScreenState
    extends State<TravelerSupportTicketScreen> {
  final _form = GlobalKey<FormState>();
  final _subject = TextEditingController();
  final _message = TextEditingController();
  String _category = 'BOOKING';
  bool _busy = false;
  String? _error;
  String? _supportCode;
  static const _categories = {
    'BOOKING': 'Đặt tour',
    'PAYMENT': 'Thanh toán',
    'ACCOUNT': 'Tài khoản',
    'OTHER': 'Khác',
  };
  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      String code;
      if (widget.submit != null) {
        code = await widget.submit!(
          _category,
          _subject.text.trim(),
          _message.text.trim(),
        );
      } else {
        final response = await ApiClient().post(
          '/support/tickets',
          data: {
            'category': _category,
            'subject': _subject.text.trim(),
            'message': _message.text.trim(),
          },
        );
        code = response.data['data']['supportCode'] as String;
      }
      if (mounted) setState(() => _supportCode = code);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Không thể gửi yêu cầu. Nội dung đã được giữ lại; vui lòng kiểm tra kết nối và thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Yêu cầu hỗ trợ')),
    body: _supportCode != null
        ? Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.check_circle_outline,
                    size: 48,
                    color: Colors.teal,
                  ),
                  const Text('Đã gửi yêu cầu hỗ trợ'),
                  SelectableText('Mã yêu cầu: $_supportCode'),
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Hoàn tất'),
                  ),
                ],
              ),
            ),
          )
        : Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _category,
                  decoration: const InputDecoration(
                    labelText: 'Danh mục hỗ trợ',
                  ),
                  items: _categories.entries
                      .map(
                        (e) => DropdownMenuItem(
                          value: e.key,
                          child: Text(e.value),
                        ),
                      )
                      .toList(),
                  onChanged: _busy
                      ? null
                      : (value) => setState(() => _category = value!),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _subject,
                  enabled: !_busy,
                  maxLength: 200,
                  decoration: const InputDecoration(labelText: 'Tiêu đề'),
                  validator: (value) => (value?.trim().length ?? 0) < 5
                      ? 'Nhập tiêu đề từ 5 ký tự.'
                      : null,
                ),
                TextFormField(
                  controller: _message,
                  enabled: !_busy,
                  maxLength: 4000,
                  minLines: 5,
                  maxLines: 10,
                  decoration: const InputDecoration(
                    labelText: 'Nội dung cần hỗ trợ',
                  ),
                  validator: (value) => (value?.trim().length ?? 0) < 10
                      ? 'Nhập nội dung từ 10 ký tự.'
                      : null,
                ),
                if (_error != null)
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: Text(_busy ? 'Đang gửi...' : 'Gửi yêu cầu hỗ trợ'),
                ),
              ],
            ),
          ),
  );
}

Future<String> _previewSubmit(
  String category,
  String subject,
  String message,
) async => 'SUP-PREVIEW';
@Preview(name: 'Traveler support request')
Widget travelerSupportPreview() => const MaterialApp(
  home: TravelerSupportTicketScreen(submit: _previewSubmit),
);
