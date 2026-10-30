import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../models/booking_models.dart';

final NumberFormat vnd = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
final DateFormat dateFmt = DateFormat('dd/MM/yyyy');
final DateFormat dateTimeFmt = DateFormat('HH:mm dd/MM/yyyy');

Color statusColor(BookingStatus s) => switch (s) {
      BookingStatus.pending => AppColors.warning,
      BookingStatus.confirmed => AppColors.primary,
      BookingStatus.completed => AppColors.success,
      BookingStatus.cancelled => AppColors.error,
    };

class BookingCard extends StatelessWidget {
  final BookingItem booking;
  final VoidCallback onTap;
  final VoidCallback? onPay;
  final VoidCallback? onCancel;

  const BookingCard({super.key, required this.booking, required this.onTap, this.onPay, this.onCancel});

  @override
  Widget build(BuildContext context) {
    final color = statusColor(booking.status);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      booking.bookingCode,
                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                    child: Text(booking.status.label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(booking.tourTitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.event, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 6),
                  Text('Khởi hành ${dateFmt.format(booking.departureDate.toLocal())}', style: const TextStyle(color: AppColors.textSecondary)),
                  const SizedBox(width: 12),
                  const Icon(Icons.people_alt_outlined, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 6),
                  Text('${booking.participants} khách', style: const TextStyle(color: AppColors.textSecondary)),
                ],
              ),
              const SizedBox(height: 8),
              Text(vnd.format(booking.totalAmount), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary)),
              if (onPay != null || onCancel != null) ...[
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (onCancel != null)
                      TextButton(
                        onPressed: onCancel,
                        style: TextButton.styleFrom(foregroundColor: AppColors.error),
                        child: const Text('Hủy đơn đặt chỗ'),
                      ),
                    if (onPay != null) FilledButton(onPressed: onPay, child: const Text('Thanh toán')),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
