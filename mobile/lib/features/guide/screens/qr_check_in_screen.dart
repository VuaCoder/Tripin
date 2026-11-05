import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/constants/app_colors.dart';
import '../cubit/guide_check_in_cubit.dart';
import '../models/guide_models.dart';
import '../widgets/check_in_result_dialog.dart';
import '../widgets/manual_code_dialog.dart';

class QrCheckInScreen extends StatefulWidget {
  const QrCheckInScreen({super.key, required this.tour});

  final GuideAssignedTour tour;

  @override
  State<QrCheckInScreen> createState() => _QrCheckInScreenState();
}

class _QrCheckInScreenState extends State<QrCheckInScreen> {
  MobileScannerController? _controller;
  bool _processing = false;
  DateTime? _lastHandledAt;
  String? _lastCode;

  bool get _scannerSupported {
    if (kIsWeb) return true;
    return defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS;
  }

  @override
  void initState() {
    super.initState();
    if (_scannerSupported) {
      _controller = MobileScannerController(
        detectionSpeed: DetectionSpeed.noDuplicates,
        formats: const [BarcodeFormat.qrCode],
      );
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing || capture.barcodes.isEmpty) return;
    final raw = capture.barcodes.first.rawValue;
    if (raw == null || raw.trim().isEmpty) return;

    final normalized = raw.trim().toUpperCase();
    final now = DateTime.now();
    if (_lastHandledAt != null) {
      final elapsed = now.difference(_lastHandledAt!);
      // Cooldown after any result, plus a longer guard for the same code.
      if (elapsed < const Duration(milliseconds: 1500)) return;
      if (_lastCode == normalized && elapsed < const Duration(seconds: 2)) return;
    }
    await _submit(normalized);
  }

  Future<void> _submit(String code) async {
    if (_processing) return;
    final cubit = context.read<GuideCheckInCubit>();
    setState(() => _processing = true);

    final outcome = await cubit.checkIn(code);
    if (!mounted) return;
    if (outcome == null) {
      setState(() => _processing = false);
      return;
    }

    await playCheckInFeedback(outcome is CheckInSuccess);
    if (!mounted) return;
    await showCheckInResultDialog(context, outcome);
    if (!mounted) return;

    // Stay blocked until the dialog closes, so a QR held in view cannot stack a second result.
    setState(() {
      _processing = false;
      _lastHandledAt = DateTime.now();
      _lastCode = code.trim().toUpperCase();
    });
  }

  Future<void> _manualEntry() async {
    final code = await showManualCodeDialog(context);
    if (code == null || !mounted) return;
    await _submit(code);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Quét QR điểm danh'),
        actions: [
          if (_controller != null)
            ValueListenableBuilder<MobileScannerState>(
              valueListenable: _controller!,
              builder: (context, state, child) {
                final torchOn = state.torchState == TorchState.on;
                final canSwitch = state.isInitialized &&
                    (state.availableCameras == null || state.availableCameras! >= 2);
                return Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: torchOn ? 'Tắt đèn flash' : 'Bật đèn flash',
                      onPressed: state.torchState == TorchState.unavailable
                          ? null
                          : () => _controller?.toggleTorch(),
                      icon: Icon(torchOn ? Icons.flash_on : Icons.flash_off),
                    ),
                    IconButton(
                      tooltip: 'Đổi camera',
                      onPressed: canSwitch ? () => _controller?.switchCamera() : null,
                      icon: const Icon(Icons.cameraswitch),
                    ),
                  ],
                );
              },
            ),
        ],
      ),
      body: _controller == null ? _unsupportedBody() : _scannerBody(),
    );
  }

  Widget _scannerBody() {
    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onDetect,
          errorBuilder: (context, error) => _CameraError(message: _cameraErrorMessage(error)),
        ),
        IgnorePointer(child: Container(color: Colors.black26)),
        Center(
          child: Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white, width: 3),
              borderRadius: BorderRadius.circular(20),
            ),
          ),
        ),
        Positioned(left: 0, right: 0, bottom: 0, child: _bottomPanel()),
        if (_processing)
          const Positioned.fill(
            child: ColoredBox(
              color: Colors.black54,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 12),
                    Text('Đang kiểm tra vé...', style: TextStyle(color: Colors.white)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _bottomPanel() {
    return BlocBuilder<GuideCheckInCubit, GuideCheckInState>(
      builder: (context, state) {
        final roster = state.roster;
        return Container(
          color: Colors.black54,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Đưa mã QR trên vé vào khung',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  'Đã điểm danh ${roster?.checkedIn ?? 0}/${roster?.total ?? 0} vé',
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _processing || state.submitting ? null : _manualEntry,
                  icon: const Icon(Icons.keyboard_outlined),
                  label: const Text('Điểm danh thủ công'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white70),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _unsupportedBody() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.no_photography_outlined, size: 56, color: AppColors.textMuted),
            const SizedBox(height: 16),
            const Text(
              'Thiết bị này không hỗ trợ quét camera',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Hãy dùng điểm danh thủ công bằng mã vé.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _manualEntry,
              icon: const Icon(Icons.keyboard_outlined),
              label: const Text('Điểm danh thủ công'),
            ),
          ],
        ),
      ),
    );
  }

  String _cameraErrorMessage(MobileScannerException error) {
    switch (error.errorCode) {
      case MobileScannerErrorCode.permissionDenied:
        return 'Ứng dụng chưa được cấp quyền camera. Hãy bật quyền camera trong Cài đặt, hoặc dùng điểm danh thủ công.';
      case MobileScannerErrorCode.unsupported:
        return 'Thiết bị này không hỗ trợ quét camera. Hãy dùng điểm danh thủ công.';
      default:
        return 'Không mở được camera. Hãy thử lại hoặc dùng điểm danh thủ công.';
    }
  }
}

class _CameraError extends StatelessWidget {
  const _CameraError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.videocam_off_outlined, size: 56, color: Colors.white70),
              const SizedBox(height: 16),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
