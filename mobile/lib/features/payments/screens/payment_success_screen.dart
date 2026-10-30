import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/payments_repository.dart';
import '../models/payment_models.dart';

/// "Đặt tour thành công": xác nhận lại trạng thái đơn từ `GET /bookings/:id`.
class PaymentSuccessScreen extends StatefulWidget {
  final String bookingId;
  final PaymentsRepository? repository;

  const PaymentSuccessScreen({super.key, required this.bookingId, this.repository});

  @override
  State<PaymentSuccessScreen> createState() => _PaymentSuccessScreenState();
}

class _PaymentSuccessScreenState extends State<PaymentSuccessScreen> {
  late final PaymentsRepository _repo = widget.repository ?? PaymentsRepository();
  BookingSummary? _booking;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Webhook có thể đến chậm hơn polling vài giây nên thử lại vài lần cho tới khi đơn CONFIRMED.
  Future<void> _load() async {
    for (var attempt = 0; attempt < 5; attempt++) {
      try {
        final booking = await _repo.getBooking(widget.bookingId);
        if (!mounted) return;
        setState(() => _booking = booking);
        if (booking.isConfirmed) break;
      } on PaymentException {
        // Giữ màn hình thành công; thông tin đơn sẽ hiện ở lần thử sau.
      }
      await Future<void>.delayed(const Duration(seconds: 2));
      if (!mounted) return;
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final booking = _booking;
    final money = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle_rounded, size: 88, color: AppColors.success),
                const SizedBox(height: 16),
                const Text('Đặt tour thành công', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Text(
                  'Thanh toán đã được ghi nhận. Vé điện tử sẽ có trong mục vé của bạn.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondary, height: 1.5),
                ),
                const SizedBox(height: 24),
                if (booking != null)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Mã đơn: ${booking.bookingCode}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          if (booking.tourTitle.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(booking.tourTitle),
                          ],
                          const SizedBox(height: 6),
                          Text('Tổng tiền: ${money.format(booking.totalAmount)}'),
                          const SizedBox(height: 6),
                          Text(
                            booking.isConfirmed ? 'Trạng thái: Đã xác nhận' : 'Trạng thái: Đang xác nhận...',
                            style: TextStyle(color: booking.isConfirmed ? AppColors.success : AppColors.warning),
                          ),
                        ],
                      ),
                    ),
                  )
                else if (_loading)
                  const CircularProgressIndicator(),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                  child: const Text('Về trang chủ'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
