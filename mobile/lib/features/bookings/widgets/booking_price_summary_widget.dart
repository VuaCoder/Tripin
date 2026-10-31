import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../models/booking_voucher_model.dart';

class BookingPriceSummaryWidget extends StatelessWidget {
  final int unitPrice;
  final int adults;
  final int children;
  final int infants;
  final int adultPrice;
  final int childPrice;
  final int infantPrice;
  final int subtotal;
  final int discountAmount;
  final int totalAmount;
  final PromotionPreviewResult? previewResult;
  final VoidCallback onOpenVoucherPicker;
  final VoidCallback onRemoveVoucher;
  final String? voucherError;

  BookingPriceSummaryWidget({
    super.key,
    required this.unitPrice,
    this.adults = 1,
    this.children = 0,
    this.infants = 0,
    int? adultPrice,
    int? childPrice,
    int? infantPrice,
    required this.subtotal,
    required this.discountAmount,
    required this.totalAmount,
    this.previewResult,
    required this.onOpenVoucherPicker,
    required this.onRemoveVoucher,
    this.voucherError,
  })  : adultPrice = adultPrice ?? unitPrice,
        childPrice = childPrice ?? ((unitPrice * 0.7).round()),
        infantPrice = infantPrice ?? 0;

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

          // [FLOW-09 AC2] Chi tiết theo từng đối tượng: Người lớn, Trẻ em, Em bé
          _buildRow(
            label: 'Người lớn (${currencyFormat.format(adultPrice)} ₫ × $adults)',
            value: '${currencyFormat.format(adults * adultPrice)} ₫',
          ),
          if (children > 0) ...[
            const SizedBox(height: 8),
            _buildRow(
              label: 'Trẻ em (${currencyFormat.format(childPrice)} ₫ × $children)',
              value: '${currencyFormat.format(children * childPrice)} ₫',
            ),
          ],
          if (infants > 0) ...[
            const SizedBox(height: 8),
            _buildRow(
              label: 'Em bé (Miễn phí × $infants)',
              value: '0 ₫',
              valueColor: AppColors.success,
            ),
          ],
          const SizedBox(height: 10),

          // Nút hoặc thẻ Voucher đã áp dụng
          InkWell(
            onTap: onOpenVoucherPicker,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: previewResult != null ? AppColors.secondarySurface : AppColors.background,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: previewResult != null ? AppColors.secondary : AppColors.border,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.confirmation_number_outlined,
                    size: 18,
                    color: previewResult != null ? AppColors.secondary : AppColors.textSecondary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: previewResult != null
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    previewResult!.code,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                      color: AppColors.secondary,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    '(-${currencyFormat.format(discountAmount)} ₫)',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.secondary,
                                    ),
                                  ),
                                ],
                              ),
                              const Text(
                                'Đã áp dụng mã ưu đãi thành công',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          )
                        : const Text(
                            'Chọn hoặc nhập mã khuyến mãi',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textPrimary,
                            ),
                          ),
                  ),
                  if (previewResult != null)
                    IconButton(
                      icon: const Icon(Icons.close, size: 16, color: AppColors.textSecondary),
                      onPressed: onRemoveVoucher,
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    )
                  else
                    const Icon(
                      Icons.chevron_right,
                      size: 18,
                      color: AppColors.textSecondary,
                    ),
                ],
              ),
            ),
          ),

          // Lỗi áp dụng voucher
          if (voucherError != null && voucherError!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 14, color: AppColors.error),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      voucherError!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.error,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          if (discountAmount > 0) ...[
            const SizedBox(height: 10),
            _buildRow(
              label: 'Giảm giá khuyến mãi',
              value: '-${currencyFormat.format(discountAmount)} ₫',
              valueColor: AppColors.secondary,
            ),
          ],

          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: AppColors.border),
          ),

          // Tổng thanh toán
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Tổng cộng tạm tính',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
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
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRow({
    required String label,
    required String value,
    Color? valueColor,
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
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: valueColor ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
