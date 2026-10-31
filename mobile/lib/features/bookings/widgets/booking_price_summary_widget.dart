import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../models/booking_voucher_model.dart';

class BookingPriceSummaryWidget extends StatelessWidget {
  final int unitPrice;
  final int participants;
  final int subtotal;
  final int discountAmount;
  final int totalAmount;
  final PromotionPreviewResult? previewResult;
  final VoidCallback onOpenVoucherPicker;
  final VoidCallback onRemoveVoucher;
  final String? voucherError;

  const BookingPriceSummaryWidget({
    super.key,
    required this.unitPrice,
    required this.participants,
    required this.subtotal,
    required this.discountAmount,
    required this.totalAmount,
    this.previewResult,
    required this.onOpenVoucherPicker,
    required this.onRemoveVoucher,
    this.voucherError,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat('#,###', 'vi_VN');

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.receipt_long_outlined, color: AppColors.primary, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Chi tiết thanh toán',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'Tạm tính',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Giá vé × số khách
          _buildRow(
            label: 'Đơn giá vé (${currencyFormat.format(unitPrice)} ₫ × $participants khách)',
            value: '${currencyFormat.format(subtotal)} ₫',
          ),
          const SizedBox(height: 10),

          // Voucher selector button / applied badge
          InkWell(
            onTap: onOpenVoucherPicker,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: previewResult != null
                    ? AppColors.secondarySurface
                    : AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: previewResult != null
                      ? AppColors.secondary
                      : AppColors.border,
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.confirmation_num_outlined, size: 18, color: AppColors.secondary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: previewResult != null
                        ? Text(
                            'Mã ${previewResult!.code}: -${currencyFormat.format(discountAmount)} ₫',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: AppColors.secondary,
                            ),
                          )
                        : const Text(
                            'Chọn hoặc nhập mã ưu đãi',
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                  ),
                  if (previewResult != null)
                    GestureDetector(
                      onTap: onRemoveVoucher,
                      child: const Padding(
                        padding: EdgeInsets.all(2.0),
                        child: Icon(Icons.close, size: 16, color: AppColors.error),
                      ),
                    )
                  else
                    const Icon(Icons.chevron_right, size: 18, color: AppColors.textSecondary),
                ],
              ),
            ),
          ),

          if (voucherError != null) ...[
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.only(left: 4),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 14, color: AppColors.error),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      voucherError!,
                      style: const TextStyle(fontSize: 12, color: AppColors.error),
                    ),
                  ),
                ],
              ),
            ),
          ],

          if (discountAmount > 0) ...[
            const SizedBox(height: 10),
            _buildRow(
              label: 'Khuyến mãi giảm giá',
              value: '-${currencyFormat.format(discountAmount)} ₫',
              valueColor: AppColors.secondary,
              isBold: true,
            ),
          ],

          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: AppColors.border),
          ),

          // Tổng cộng
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Tổng tiền tạm tính',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Đã bao gồm thuế & phí',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
              Text(
                '${currencyFormat.format(totalAmount)} ₫',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 14, color: AppColors.primary),
                SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Giá tạm tính. Hệ thống máy chủ sẽ xác thực tính khả dụng và áp dụng ưu đãi chính thức khi tạo đơn.',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.primary,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow({
    required String label,
    required String value,
    Color valueColor = AppColors.textPrimary,
    bool isBold = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}
