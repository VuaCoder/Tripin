import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/bookings_repository.dart';
import '../models/booking_models.dart';
import '../widgets/booking_card.dart';

/// Yêu cầu hủy: xem trước hoàn tiền theo chính sách, nhập lý do, xác nhận `POST /bookings/:id/cancel`.
/// Pop `true` khi hủy thành công.
class CancelBookingScreen extends StatefulWidget {
  final BookingItem booking;
  final BookingsRepository? repository;
  final DateTime Function()? now;

  const CancelBookingScreen({super.key, required this.booking, this.repository, this.now});

  @override
  State<CancelBookingScreen> createState() => _CancelBookingScreenState();
}

class _CancelBookingScreenState extends State<CancelBookingScreen> {
  late final BookingsRepository _repo = widget.repository ?? BookingsRepository();
  final TextEditingController _reason = TextEditingController();
  CancellationPreview? _preview;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPolicy();
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _loadPolicy() async {
    final hours = await _repo.getCancellationWindowHours();
    if (!mounted) return;
    setState(() {
      _preview = CancellationPreview.forBooking(
        widget.booking,
        windowHours: hours,
        now: (widget.now ?? DateTime.now)(),
      );
    });
  }

  Future<void> _confirm() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await _repo.cancelBooking(widget.booking.id, reason: _reason.text);
      if (mounted) Navigator.of(context).pop(true);
    } on BookingException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    final b = widget.booking;
    return Scaffold(
      appBar: AppBar(title: const Text('Hủy đơn đặt chỗ', style: TextStyle(fontWeight: FontWeight.bold))),
      body: preview == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(b.tourTitle, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text('${b.bookingCode} · Khởi hành ${dateFmt.format(b.departureDate.toLocal())}',
                            style: const TextStyle(color: AppColors.textSecondary)),
                        const Divider(height: 24),
                        _MoneyRow(label: 'Tổng tiền đã đặt', value: vnd.format(b.totalAmount)),
                        if (b.status == BookingStatus.confirmed) ...[
                          _MoneyRow(label: 'Phí hủy', value: vnd.format(0)),
                          _MoneyRow(
                            label: 'Số tiền được hoàn',
                            value: vnd.format(preview.refundAmount),
                            emphasize: true,
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: preview.canCancel ? AppColors.successLight : AppColors.errorLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(preview.message, key: const Key('refund-message')),
                ),
                if (preview.canCancel) ...[
                  const SizedBox(height: 16),
                  TextField(
                    controller: _reason,
                    maxLines: 3,
                    maxLength: 500,
                    decoration: const InputDecoration(
                      labelText: 'Lý do hủy',
                      hintText: 'Thay đổi kế hoạch, việc bận…',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_error != null) ...[
                    Text(_error!, style: const TextStyle(color: AppColors.error)),
                    const SizedBox(height: 8),
                  ],
                  FilledButton(
                    onPressed: _submitting ? null : _confirm,
                    style: FilledButton.styleFrom(backgroundColor: AppColors.error),
                    child: _submitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Xác nhận hủy'),
                  ),
                ],
                const SizedBox(height: 8),
                TextButton(onPressed: _submitting ? null : () => Navigator.of(context).pop(false), child: const Text('Giữ lại đơn')),
              ],
            ),
    );
  }
}

class _MoneyRow extends StatelessWidget {
  final String label;
  final String value;
  final bool emphasize;
  const _MoneyRow({required this.label, required this.value, this.emphasize = false});

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontWeight: emphasize ? FontWeight.bold : FontWeight.normal, fontSize: emphasize ? 16 : 14);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style.copyWith(color: emphasize ? AppColors.primary : null))],
      ),
    );
  }
}
