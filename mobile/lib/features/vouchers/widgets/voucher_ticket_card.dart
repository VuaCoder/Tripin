import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../models/voucher_model.dart';

/// Thẻ Voucher phong cách Ticket / Vé giảm giá Shopee & Airbnb
class VoucherTicketCard extends StatelessWidget {
  final VoucherModel voucher;
  final bool isSelected;
  final bool isSelectable;
  final int? currentOrderTotal;
  final VoidCallback? onApply;
  final VoidCallback? onUseNow;

  const VoucherTicketCard({
    super.key,
    required this.voucher,
    this.isSelected = false,
    this.isSelectable = false,
    this.currentOrderTotal,
    this.onApply,
    this.onUseNow,
  });

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat('#,###', 'vi_VN');
    final isAvailable = voucher.isAvailable;
    final isEligible = currentOrderTotal == null || voucher.isEligibleForOrder(currentOrderTotal!);
    final isEnabled = isAvailable && isEligible;

    final daysLeft = voucher.endsAt.difference(DateTime.now()).inDays;
    final String expiryText = daysLeft <= 0
        ? 'Hết hạn hôm nay'
        : daysLeft <= 3
            ? 'Còn $daysLeft ngày'
            : 'HSD: ${DateFormat('dd/MM/yyyy').format(voucher.endsAt)}';

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected
              ? AppColors.primary
              : isEnabled
                  ? const Color(0xFFE5E7EB)
                  : const Color(0xFFF3F4F6),
          width: isSelected ? 1.8 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isSelected ? 0.08 : 0.03),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. CỘT TRÁI: KHỐI GIẢM GIÁ (TICKET STUB)
              Container(
                width: 104,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: isEnabled
                        ? [const Color(0xFFFF7A00), const Color(0xFFFF5400)]
                        : [const Color(0xFF9CA3AF), const Color(0xFF6B7280)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.confirmation_num_rounded, color: Colors.white, size: 24),
                    const SizedBox(height: 4),
                    Text(
                      voucher.discountType == VoucherDiscountType.percentage
                          ? '${voucher.discountValue}%'
                          : '${(voucher.discountValue / 1000).round()}K',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const Text(
                      'GIẢM GIÁ',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Colors.white70,
                        letterSpacing: 0.5,
                      ),
                    ),
                    if (voucher.badgeText != null) ...[
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          voucher.badgeText!,
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              // 2. ĐƯỜNG CẮT RĂNG CƯA BÁN NGUYỆT
              CustomPaint(
                size: const Size(12, double.infinity),
                painter: _TicketDividerPainter(
                  bgColor: Colors.white,
                  borderColor: isSelected ? AppColors.primary : const Color(0xFFE5E7EB),
                ),
              ),

              // 3. CỘT PHẢI: CHI TIẾT VOUCHER & NÚT CHỌN
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 12, 14, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  voucher.code,
                                  style: const TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFFB45309),
                                  ),
                                ),
                              ),
                              const Spacer(),
                              // Con dấu ĐÃ DÙNG hoặc HẾT HẠN
                              if (voucher.isUsed)
                                _buildStamp('ĐÃ DÙNG', Colors.red.shade700)
                              else if (!isAvailable)
                                _buildStamp('HẾT HẠN', Colors.grey.shade600),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            voucher.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: isEnabled ? const Color(0xFF1E293B) : const Color(0xFF94A3B8),
                              height: 1.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Đơn tối thiểu ${formatter.format(voucher.minOrderAmount)}đ',
                            style: TextStyle(
                              fontSize: 11.5,
                              color: isEligible ? const Color(0xFF64748B) : Colors.red.shade600,
                              fontWeight: isEligible ? FontWeight.normal : FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Hàng dưới: Hạn dùng + Nút hành động
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            expiryText,
                            style: TextStyle(
                              fontSize: 11,
                              color: daysLeft <= 3 && isAvailable ? Colors.deepOrange : const Color(0xFF94A3B8),
                              fontWeight: daysLeft <= 3 && isAvailable ? FontWeight.w700 : FontWeight.w500,
                            ),
                          ),
                          if (isSelectable)
                            GestureDetector(
                              onTap: isEnabled ? onApply : null,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? AppColors.primary
                                      : isEnabled
                                          ? const Color(0xFFFEF3C7)
                                          : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isSelected
                                        ? AppColors.primary
                                        : isEnabled
                                            ? const Color(0xFFF59E0B)
                                            : Colors.transparent,
                                    width: 1,
                                  ),
                                ),
                                child: Text(
                                  isSelected ? 'Đang chọn' : 'Áp dụng',
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: isSelected
                                        ? Colors.white
                                        : isEnabled
                                            ? const Color(0xFFB45309)
                                            : const Color(0xFF94A3B8),
                                  ),
                                ),
                              ),
                            )
                          else if (onUseNow != null && isAvailable)
                            GestureDetector(
                              onTap: onUseNow,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: const Text(
                                  'Dùng ngay',
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStamp(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: color, width: 1.2),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w900,
          color: color,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

/// Custom painter vẽ đường cắt răng cưa vé ở 2 đầu
class _TicketDividerPainter extends CustomPainter {
  final Color bgColor;
  final Color borderColor;

  _TicketDividerPainter({required this.bgColor, required this.borderColor});

  @override
  void paint(Canvas canvas, Size size) {
    final paintDashed = Paint()
      ..color = const Color(0xFFCBD5E1)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    // Vẽ nét đứt ở giữa
    const dashHeight = 4.0;
    const dashSpace = 4.0;
    double startY = 12.0;
    while (startY < size.height - 12.0) {
      canvas.drawLine(
        Offset(size.width / 2, startY),
        Offset(size.width / 2, startY + dashHeight),
        paintDashed,
      );
      startY += dashHeight + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
