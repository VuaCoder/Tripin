import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/reports_repository.dart';
import '../models/report_models.dart';

/// Báo cáo sự cố / khiếu nại về một tour đang đi hoặc đã đặt.
/// Gửi xong hiện mã tra cứu để khách đọc lại cho bộ phận chăm sóc khách hàng.
class ReportScreen extends StatefulWidget {
  final String tourId;
  final String tourTitle;
  final String? bookingId;
  final ReportsRepository? repository;

  /// Chọn ảnh từ thư viện; thay được khi test.
  final Future<List<ReportPhoto>> Function(int remaining)? pickPhotos;

  const ReportScreen({
    super.key,
    required this.tourId,
    required this.tourTitle,
    this.bookingId,
    this.repository,
    this.pickPhotos,
  });

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  static const int _minLength = 10;
  static const int _maxPhotos = 5;

  late final ReportsRepository _repo = widget.repository ?? ReportsRepository();
  final TextEditingController _description = TextEditingController();
  ReportCategory _category = ReportCategory.safety;
  final List<ReportPhoto> _photos = [];
  bool _submitting = false;
  String? _error;
  SubmittedReport? _done;

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  bool get _valid => _description.text.trim().length >= _minLength;

  Future<List<ReportPhoto>> _defaultPick(int remaining) async {
    final files = await ImagePicker().pickMultiImage(imageQuality: 80, maxWidth: 1600, limit: remaining < 2 ? 2 : remaining);
    return [for (final f in files.take(remaining)) ReportPhoto(name: f.name, bytes: await f.readAsBytes())];
  }

  Future<void> _addPhotos() async {
    final remaining = _maxPhotos - _photos.length;
    if (remaining <= 0) return;
    try {
      final picked = await (widget.pickPhotos ?? _defaultPick)(remaining);
      if (mounted && picked.isNotEmpty) setState(() => _photos.addAll(picked.take(remaining)));
    } catch (_) {
      if (mounted) setState(() => _error = 'Không mở được thư viện ảnh. Hãy cấp quyền truy cập ảnh rồi thử lại.');
    }
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final report = _photos.isEmpty
          ? await _repo.reportTour(
              tourId: widget.tourId,
              bookingId: widget.bookingId,
              category: _category,
              description: _description.text,
            )
          : await _repo.reportTourWithPhotos(
              tourId: widget.tourId,
              bookingId: widget.bookingId,
              category: _category,
              description: _description.text,
              photos: List.of(_photos),
            );
      if (mounted) setState(() => _done = report);
    } on ReportException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = _done;
    return Scaffold(
      appBar: AppBar(title: const Text('Báo cáo sự cố', style: TextStyle(fontWeight: FontWeight.bold))),
      body: done != null ? _Success(report: done) : _form(),
    );
  }

  Widget _form() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(widget.tourTitle, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        const Text(
          'Nếu đang gặp nguy hiểm, hãy gọi số khẩn cấp 113 / 115 trước. Báo cáo này sẽ được gửi tới bộ phận chăm sóc khách hàng.',
          style: TextStyle(color: AppColors.textSecondary, height: 1.4),
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<ReportCategory>(
          initialValue: _category,
          decoration: const InputDecoration(labelText: 'Lý do báo cáo', border: OutlineInputBorder()),
          items: [for (final c in ReportCategory.values) DropdownMenuItem(value: c, child: Text(c.label))],
          onChanged: _submitting ? null : (c) => setState(() => _category = c ?? _category),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _description,
          enabled: !_submitting,
          minLines: 4,
          maxLines: 8,
          maxLength: 2000,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(
            labelText: 'Mô tả sự cố',
            hintText: 'Chuyện gì đã xảy ra, ở đâu, lúc nào…',
            helperText: 'Tối thiểu 10 ký tự',
            alignLabelWithHint: true,
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        _PhotoStrip(
          photos: _photos,
          max: _maxPhotos,
          enabled: !_submitting,
          onAdd: _addPhotos,
          onRemove: (i) => setState(() => _photos.removeAt(i)),
        ),
        if (_error != null)
          Container(
            key: const Key('report-error'),
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(12)),
            child: Text(_error!),
          ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: (_valid && !_submitting) ? _submit : null,
          child: _submitting
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Gửi báo cáo'),
        ),
      ],
    );
  }
}

class _PhotoStrip extends StatelessWidget {
  final List<ReportPhoto> photos;
  final int max;
  final bool enabled;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;

  const _PhotoStrip({
    required this.photos,
    required this.max,
    required this.enabled,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (var i = 0; i < photos.length; i++)
              Stack(
                key: Key('photo-$i'),
                clipBehavior: Clip.none,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.memory(Uint8List.fromList(photos[i].bytes), width: 72, height: 72, fit: BoxFit.cover),
                  ),
                  Positioned(
                    right: -6,
                    top: -6,
                    child: GestureDetector(
                      onTap: enabled ? () => onRemove(i) : null,
                      child: Semantics(
                        button: true,
                        label: 'Xóa ảnh ${i + 1}',
                        child: const CircleAvatar(radius: 11, backgroundColor: AppColors.error, child: Icon(Icons.close, size: 14, color: Colors.white)),
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ),
        if (photos.isNotEmpty) const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: (enabled && photos.length < max) ? onAdd : null,
          icon: const Icon(Icons.add_photo_alternate_outlined),
          label: Text('Đính kèm hình ảnh (${photos.length}/$max)'),
        ),
      ],
    );
  }
}

class _Success extends StatelessWidget {
  final SubmittedReport report;
  const _Success({required this.report});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle_rounded, size: 64, color: AppColors.success),
            const SizedBox(height: 12),
            const Text('Đã gửi báo cáo', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Bộ phận chăm sóc khách hàng sẽ xem xét và phản hồi. Hãy lưu mã tra cứu bên dưới.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(color: AppColors.secondaryLight, borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SelectableText(
                    report.code,
                    key: const Key('report-code'),
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
                  IconButton(
                    tooltip: 'Sao chép mã tra cứu',
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: report.code));
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã sao chép')));
                    },
                    icon: const Icon(Icons.copy_rounded, size: 20),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Xong')),
          ],
        ),
      ),
    );
  }
}
