import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../bookings/bloc/booked_trips_repository.dart';
import '../../bookings/models/booking_models.dart';
import '../../bookings/storage/pending_booking_storage.dart';
import '../../navigation/traveler_main_navigation_screen.dart';
import '../bloc/payments_repository.dart';
import '../models/payment_models.dart';

/// Màn hình "Đặt tour thành công" được thiết kế chuẩn theo bản vẽ phác thảo (Ảnh 2)
class PaymentSuccessScreen extends StatefulWidget {
  final String bookingId;
  final PaymentsRepository? repository;
  final String? tourTitle;
  final String? thumbnailUrl;
  final DateTime? departureDate;
  final int? guestsCount;
  final int? totalAmount;
  final String? contactName;
  final String? customerAvatarUrl;

  const PaymentSuccessScreen({
    super.key,
    required this.bookingId,
    this.repository,
    this.tourTitle,
    this.thumbnailUrl,
    this.departureDate,
    this.guestsCount,
    this.totalAmount,
    this.contactName,
    this.customerAvatarUrl,
  });

  @override
  State<PaymentSuccessScreen> createState() => _PaymentSuccessScreenState();
}

class _PaymentSuccessScreenState extends State<PaymentSuccessScreen> {
  late final PaymentsRepository _repo = widget.repository ?? PaymentsRepository();
  BookingSummary? _booking;

  @override
  void initState() {
    super.initState();
    _initializeBooking();
    _load();
  }

  void _initializeBooking() {
    final code = 'TRP-${widget.bookingId.replaceAll('-', '').substring(0, 8).toUpperCase()}';
    _booking = BookingSummary(
      id: widget.bookingId,
      bookingCode: code,
      status: 'CONFIRMED',
      tourTitle: widget.tourTitle ?? 'Vịnh Hạ Long – Du thuyền giữa kỳ quan',
      totalAmount: widget.totalAmount ?? 2000,
      departureDate: widget.departureDate,
      participants: widget.guestsCount ?? 1,
      thumbnailUrl: widget.thumbnailUrl,
    );

    // Tự động lưu ngay chuyến đi vào cơ sở dữ liệu/cache của mục "Chuyến đi"
    final tripItem = BookingItem(
      id: widget.bookingId,
      bookingCode: code,
      status: BookingStatus.confirmed,
      tourId: widget.bookingId,
      tourTitle: widget.tourTitle ?? 'Vịnh Hạ Long – Du thuyền giữa kỳ quan',
      departureDate: widget.departureDate ?? DateTime.now().add(const Duration(days: 7)),
      endDate: (widget.departureDate ?? DateTime.now().add(const Duration(days: 7))).add(const Duration(days: 2)),
      participants: widget.guestsCount ?? 1,
      totalAmount: widget.totalAmount ?? 2000,
      isPaid: true,
      refundRequired: false,
      thumbnailUrl: widget.thumbnailUrl,
      destination: widget.tourTitle?.split('–').first.trim() ?? 'Vịnh Hạ Long',
      contactName: widget.contactName ?? 'Khách hàng Tripri',
      customerAvatarUrl: widget.customerAvatarUrl,
    );
    BookedTripsRepository().saveTrip(tripItem);
    PendingBookingStorage().clearDraft();
  }

  /// Tải thông tin đơn hàng bảo đảm an toàn tuyệt đối, không gây văng app (crash-proof)
  Future<void> _load() async {
    try {
      final booking = await _repo.getBooking(widget.bookingId);
      if (!mounted) return;
      if (booking.tourTitle.isNotEmpty) {
        setState(() => _booking = booking);
      }
    } catch (err) {
      debugPrint('[PaymentSuccessScreen] _load safe catch: $err');
    }
  }

  void _goToHome() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const TravelerMainNavigationScreen(initialIndex: 0)),
      (route) => false,
    );
  }

  void _goToTrips() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const TravelerMainNavigationScreen(initialIndex: 2)),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final booking = _booking;
    final money = NumberFormat.currency(locale: 'vi_VN', symbol: 'VND', decimalDigits: 0);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Khung Component chứa thông tin chính xác theo Ảnh 2
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.all(22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Hàng đầu: "Thành công" bên trái, icon tròn tích xanh (✓) bên phải
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Thành công',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          Container(
                            width: 36,
                            height: 36,
                            decoration: const BoxDecoration(
                              color: Color(0xFF10B981),
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: const Icon(
                              Icons.check_rounded,
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Dòng cảm ơn
                      const Text(
                        'Cảm ơn bạn đã lựa chọn Tripri. Chuyến đi của bạn đã được xác nhận thành công.',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF64748B),
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      const SizedBox(height: 16),

                      // Tên tour nổi bật
                      Text(
                        booking?.tourTitle.isNotEmpty == true
                            ? booking!.tourTitle
                            : 'Vịnh Hạ Long – Du thuyền giữa kỳ quan',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Thông tin chi tiết đơn hàng
                      _buildInfoRow('Mã đơn:', booking?.bookingCode ?? 'TRP-DEMO'),
                      if (booking?.departureDate != null) ...[
                        const SizedBox(height: 8),
                        _buildInfoRow(
                          'Ngày khởi hành:',
                          DateFormat('dd/MM/yyyy').format(booking!.departureDate!),
                        ),
                      ],
                      if (booking != null && booking.participants > 0) ...[
                        const SizedBox(height: 8),
                        _buildInfoRow(
                          'Số khách:',
                          '${booking.participants} khách',
                        ),
                      ],
                      const SizedBox(height: 8),
                      _buildInfoRow(
                        'Tổng tiền:',
                        money.format(booking?.totalAmount ?? 2000),
                        valueColor: const Color(0xFF0F766E),
                        valueBold: true,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Trạng thái:',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD1FAE5),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text(
                              'Đã xác nhận',
                              style: TextStyle(
                                color: Color(0xFF065F46),
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 28),

                // 2 nút CTA ở dưới theo Ảnh 2: "Về trang chủ" và "Xem vé"
                Row(
                  children: [
                    // Nút "Về trang chủ"
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _goToHome,
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
                          foregroundColor: const Color(0xFF334155),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: const Text(
                          'Về trang chủ',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),

                    // Nút "Xem vé" / "Xem vé ticket"
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _goToTrips,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: const Text(
                          'Xem vé ticket',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {Color? valueColor, bool valueBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            color: valueColor ?? const Color(0xFF1E293B),
            fontWeight: valueBold ? FontWeight.bold : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
