import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:gal/gal.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/constants/app_colors.dart';

/// Hiển thị mã QR và cho phép lưu ảnh QR vào thư viện ảnh (AC2).
class QrCard extends StatefulWidget {
  /// Chuỗi VietQR (hoặc checkoutUrl khi backend không có dữ liệu VietQR).
  final String data;
  final String fileName;

  const QrCard({super.key, required this.data, required this.fileName});

  @override
  State<QrCard> createState() => _QrCardState();
}

class _QrCardState extends State<QrCard> {
  final GlobalKey _boundaryKey = GlobalKey();
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final boundary = _boundaryKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 3);
      final bytes = (await image.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();
      await Gal.putImageBytes(bytes, name: widget.fileName);
      messenger.showSnackBar(const SnackBar(content: Text('Đã lưu ảnh QR vào thư viện ảnh')));
    } on GalException catch (e) {
      final denied = e.type == GalExceptionType.accessDenied;
      messenger.showSnackBar(SnackBar(
        content: Text(denied ? 'Cần cấp quyền truy cập thư viện ảnh để lưu QR' : 'Không lưu được ảnh QR'),
        backgroundColor: AppColors.error,
      ));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(
        content: Text('Thiết bị này không hỗ trợ lưu ảnh QR'),
        backgroundColor: AppColors.error,
      ));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        RepaintBoundary(
          key: _boundaryKey,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: QrImageView(
              data: widget.data,
              size: 240,
              backgroundColor: Colors.white,
              errorCorrectionLevel: QrErrorCorrectLevel.M,
            ),
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _saving ? null : _save,
          icon: _saving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.download_rounded),
          label: const Text('Lưu ảnh QR'),
        ),
      ],
    );
  }
}
