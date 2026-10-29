import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:gal/gal.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/bookings_repository.dart';
import '../bloc/e_ticket_cubit.dart';
import '../models/booking_models.dart';
import '../widgets/booking_card.dart';
import 'cancel_booking_screen.dart';

/// Vé điện tử: mã vé, thông tin chuyến đi và QR cho HDV quét điểm danh.
/// Pop `true` khi đơn vừa được hủy từ màn này.
class ETicketScreen extends StatelessWidget {
  final BookingItem booking;
  final BookingsRepository? repository;

  const ETicketScreen({super.key, required this.booking, this.repository});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => ETicketCubit(bookingId: booking.id, repository: repository)..load(),
      child: _ETicketView(booking: booking, repository: repository),
    );
  }
}

class _ETicketView extends StatefulWidget {
  final BookingItem booking;
  final BookingsRepository? repository;
  const _ETicketView({required this.booking, this.repository});

  @override
  State<_ETicketView> createState() => _ETicketViewState();
}

class _ETicketViewState extends State<_ETicketView> {
  final GlobalKey _ticketKey = GlobalKey();
  bool _saving = false;

  /// Chụp toàn bộ thẻ vé (QR + thông tin) thành ảnh lưu vào thư viện để xem khi mất mạng.
  Future<void> _saveToDevice(ETicket ticket) async {
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final boundary = _ticketKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 3);
      final bytes = (await image.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();
      await Gal.putImageBytes(bytes, name: 've_${ticket.code}');
      messenger.showSnackBar(const SnackBar(content: Text('Đã lưu vé vào thư viện ảnh')));
    } on GalException catch (e) {
      final denied = e.type == GalExceptionType.accessDenied;
      messenger.showSnackBar(SnackBar(
        content: Text(denied ? 'Cần cấp quyền truy cập thư viện ảnh để lưu vé' : 'Không lưu được vé'),
        backgroundColor: AppColors.error,
      ));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(
        content: Text('Thiết bị này không hỗ trợ lưu ảnh vé'),
        backgroundColor: AppColors.error,
      ));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _cancel() async {
    final cancelled = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => CancelBookingScreen(booking: widget.booking, repository: widget.repository)),
    );
    if (!mounted) return;
    if (cancelled == true) {
      // Tải lại để vé hiện trạng thái vô hiệu hóa ngay, rồi báo màn danh sách chuyển sang tab "Đã hủy".
      await context.read<ETicketCubit>().load();
      if (mounted) Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Vé điện tử', style: TextStyle(fontWeight: FontWeight.bold))),
      body: BlocBuilder<ETicketCubit, ETicketState>(
        builder: (context, state) => switch (state) {
          ETicketLoading() => const Center(child: CircularProgressIndicator()),
          ETicketFailure(:final message) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                    const SizedBox(height: 12),
                    Text(message, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    OutlinedButton(onPressed: context.read<ETicketCubit>().load, child: const Text('Thử lại')),
                  ],
                ),
              ),
            ),
          ETicketLoaded(:final ticket, :final fromCache) => _body(ticket, fromCache),
        },
      ),
    );
  }

  Widget _body(ETicket ticket, bool fromCache) {
    final active = ticket.status == ETicketStatus.valid;
    final canCancel = active &&
        (widget.booking.status == BookingStatus.confirmed) &&
        widget.booking.departureDate.isAfter(DateTime.now());
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (fromCache)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.secondaryLight, borderRadius: BorderRadius.circular(12)),
            child: const Row(
              children: [
                Icon(Icons.cloud_off, size: 18, color: AppColors.warning),
                SizedBox(width: 8),
                Expanded(child: Text('Đang xem bản đã lưu (không có mạng). Trạng thái vé có thể chưa được cập nhật.')),
              ],
            ),
          ),
        RepaintBoundary(key: _ticketKey, child: _TicketCard(ticket: ticket)),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _saving ? null : () => _saveToDevice(ticket),
          icon: _saving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.download_rounded),
          label: const Text('Lưu vé vào máy'),
        ),
        if (canCancel) ...[
          const SizedBox(height: 8),
          TextButton(
            onPressed: _cancel,
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Hủy đơn đặt chỗ'),
          ),
        ],
      ],
    );
  }
}

class _TicketCard extends StatelessWidget {
  final ETicket ticket;
  const _TicketCard({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final active = ticket.status == ETicketStatus.valid;
    final color = switch (ticket.status) {
      ETicketStatus.valid => AppColors.primary,
      ETicketStatus.used => AppColors.success,
      ETicketStatus.cancelled => AppColors.error,
    };
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(ticket.code,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 17, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                child: Text(ticket.status.label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(ticket.tourTitle, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _InfoRow(icon: Icons.schedule, label: 'Ngày đón', value: dateTimeFmt.format(ticket.departureDate.toLocal())),
          if (ticket.destination != null && ticket.destination!.isNotEmpty)
            _InfoRow(icon: Icons.place_outlined, label: 'Điểm đến', value: ticket.destination!),
          _InfoRow(icon: Icons.confirmation_number_outlined, label: 'Mã đặt chỗ', value: ticket.bookingCode),
          _InfoRow(
            icon: Icons.people_alt_outlined,
            label: 'Hành khách',
            value: '${ticket.holderName} · ${ticket.participants} khách',
          ),
          const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider()),
          Center(
            child: Stack(
              alignment: Alignment.center,
              children: [
                Opacity(
                  opacity: active ? 1 : 0.15,
                  child: QrImageView(
                    data: ticket.code,
                    size: 240,
                    backgroundColor: Colors.white,
                    errorCorrectionLevel: QrErrorCorrectLevel.H,
                  ),
                ),
                if (!active)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
                    child: Text(ticket.status.label.toUpperCase(),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              active ? 'Đưa mã này cho hướng dẫn viên quét để điểm danh' : 'Vé không còn giá trị sử dụng',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          SizedBox(width: 84, child: Text(label, style: const TextStyle(color: AppColors.textSecondary))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
