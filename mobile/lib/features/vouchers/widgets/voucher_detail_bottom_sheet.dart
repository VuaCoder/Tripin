import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../models/voucher_model.dart';

/// Modal bảng chi tiết & điều kiện sử dụng Voucher (Chuẩn Shopee & Grab Voucher)
class VoucherDetailBottomSheet extends StatelessWidget {
  final VoucherModel voucher;
  final VoidCallback? onUseNow;
  final VoidCallback? onApply;
  final bool isSelectable;
  final bool isSelected;

  const VoucherDetailBottomSheet({
    super.key,
    required this.voucher,
    this.onUseNow,
    this.onApply,
    this.isSelectable = false,
    this.isSelected = false,
  });

  /// Hàm tiện ích mở Modal chi tiết Voucher
  static Future<void> show(
    BuildContext context, {
    required VoucherModel voucher,
    VoidCallback? onUseNow,
    VoidCallback? onApply,
    bool isSelectable = false,
    bool isSelected = false,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => VoucherDetailBottomSheet(
        voucher: voucher,
        onUseNow: onUseNow,
        onApply: onApply,
        isSelectable: isSelectable,
        isSelected: isSelected,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat('#,###', 'vi_VN');
    final isAvailable = voucher.isAvailable;
    final daysLeft = voucher.endsAt.difference(DateTime.now()).inDays;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            // Thanh kéo đỉnh
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 44,
                height: 4.5,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),

            // Header tiêu đề
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
              child: Row(
                children: [
                  const Text(
                    'Điều kiện sử dụng Voucher',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // Nội dung cuộn chi tiết
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 20),
                children: [
                  // 1. BANNER THẺ VOUCHER TỔNG QUAN
                  _buildVoucherBanner(context, formatter),

                  const SizedBox(height: 20),

                  // 2. KHUNG SAO CHÉP MÃ CODE
                  _buildCodeCopyBar(context),

                  const SizedBox(height: 20),

                  // 3. DANH SÁCH ĐIỀU KIỆN SỬ DỤNG (BẢNG CHI TIẾT CHUẨN SHOPEE / GRAB)
                  const Text(
                    'CHI TIẾT ĐIỀU KIỆN ÁP DỤNG',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),

                  _buildDetailRow(
                    icon: Icons.discount_rounded,
                    iconColor: const Color(0xFFFF5400),
                    title: 'Mức giảm giá',
                    content: voucher.discountType == VoucherDiscountType.percentage
                        ? 'Giảm ${voucher.discountValue}%'
                            '${voucher.maxDiscountAmount != null ? ' - Tối đa ${formatter.format(voucher.maxDiscountAmount)}đ' : ''}'
                        : 'Giảm trực tiếp ${formatter.format(voucher.discountValue)}đ',
                  ),

                  _buildDetailRow(
                    icon: Icons.shopping_bag_outlined,
                    iconColor: AppColors.primary,
                    title: 'Đơn hàng tối thiểu',
                    content: voucher.minOrderAmount > 0
                        ? 'Áp dụng cho đơn đặt tour từ ${formatter.format(voucher.minOrderAmount)}đ trở lên'
                        : 'Áp dụng cho mọi giá trị đơn hàng (không giới hạn)',
                  ),

                  _buildDetailRow(
                    icon: Icons.calendar_today_rounded,
                    iconColor: const Color(0xFF2563EB),
                    title: 'Thời gian hiệu lực',
                    content:
                        'Từ ${DateFormat('dd/MM/yyyy').format(voucher.startsAt)} đến 23:59 ngày ${DateFormat('dd/MM/yyyy').format(voucher.endsAt)}\n'
                        '(${daysLeft <= 0 ? 'Hết hạn hôm nay' : 'Còn $daysLeft ngày'})',
                  ),

                  _buildDetailRow(
                    icon: Icons.map_rounded,
                    iconColor: const Color(0xFF10B981),
                    title: 'Phạm vi áp dụng',
                    content: 'Tất cả các tour du lịch, gói trải nghiệm và đặt hướng dẫn viên bản địa trên Tripri Travel',
                  ),

                  _buildDetailRow(
                    icon: Icons.payment_rounded,
                    iconColor: const Color(0xFF8B5CF6),
                    title: 'Phương thức thanh toán',
                    content: 'Áp dụng cho tất cả các hình thức thanh toán (VNPay, VietQR, Thẻ ATM/Visa/Mastercard)',
                  ),

                  _buildDetailRow(
                    icon: Icons.person_rounded,
                    iconColor: const Color(0xFFEC4899),
                    title: 'Đối tượng áp dụng',
                    content: voucher.badgeText == 'Khách mới'
                        ? 'Dành riêng cho khách hàng mới đặt tour lần đầu tiên trên Tripri'
                        : 'Tất cả thành viên có tài khoản Tripri hợp lệ',
                  ),

                  const SizedBox(height: 12),

                  // 4. CÁC QUY ĐỊNH CHUNG (SHOPEE / GRAB RULES)
                  const Text(
                    'QUY ĐỊNH VÀ ĐIỀU KHOẢN KHÁC',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),

                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        _RuleBullet(
                          text: 'Mỗi tài khoản / khách hàng chỉ được sử dụng mã giảm giá 01 lần duy nhất trong suốt thời gian diễn ra chương trình.',
                        ),
                        SizedBox(height: 6),
                        _RuleBullet(
                          text: 'Mã voucher không có giá trị quy đổi thành tiền mặt, không được tặng hoặc chuyển nhượng cho tài khoản khác.',
                        ),
                        SizedBox(height: 6),
                        _RuleBullet(
                          text: 'Trường hợp tour bị hủy do lỗi của hướng dẫn viên hoặc nhà tổ chức, mã voucher sẽ được tự động hoàn lại vào ví voucher của bạn. Nếu khách hàng tự ý hủy tour, voucher sẽ không được hoàn lại.',
                        ),
                        SizedBox(height: 6),
                        _RuleBullet(
                          text: 'Không áp dụng đồng thời với một số chương trình khuyến mãi độc quyền hoặc giảm giá đặc biệt khác.',
                        ),
                        SizedBox(height: 6),
                        _RuleBullet(
                          text: 'Tripri có quyền từ chối áp dụng mã voucher hoặc khóa tài khoản vĩnh viễn nếu phát hiện hành vi gian lận hoặc trục lợi chính sách khuyến mãi.',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // 5. THANH HÀNH ĐỘNG DƯỚI ĐÁY
            Container(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    offset: const Offset(0, -3),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.pop(context);
                          if (isSelectable) {
                            onApply?.call();
                          } else if (onUseNow != null) {
                            onUseNow?.call();
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isAvailable ? AppColors.primary : const Color(0xFF94A3B8),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          isSelectable
                              ? (isSelected ? 'Bỏ chọn' : 'Áp dụng mã này')
                              : (isAvailable ? 'Dùng ngay' : 'Đóng'),
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Banner vé mô phỏng thẻ voucher
  Widget _buildVoucherBanner(BuildContext context, NumberFormat formatter) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFF7A00), Color(0xFFFF5400)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.confirmation_num_rounded, color: Colors.white, size: 20),
                const SizedBox(height: 2),
                Text(
                  voucher.discountType == VoucherDiscountType.percentage
                      ? '${voucher.discountValue}%'
                      : '${(voucher.discountValue / 1000).round()}K',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (voucher.badgeText != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF5400),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      voucher.badgeText!,
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white),
                    ),
                  ),
                Text(
                  voucher.title,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Đơn tối thiểu ${formatter.format(voucher.minOrderAmount)}đ',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Thanh mã code và nút sao chép
  Widget _buildCodeCopyBar(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          const Icon(Icons.qr_code_rounded, size: 20, color: Color(0xFF475569)),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'MÃ VOUCHER',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
              ),
              Text(
                voucher.code,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F172A),
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const Spacer(),
          TextButton.icon(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: voucher.code));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Đã sao chép mã "${voucher.code}" vào bộ nhớ tạm!'),
                  backgroundColor: AppColors.primary,
                  behavior: SnackBarBehavior.floating,
                  duration: const Duration(seconds: 2),
                ),
              );
            },
            icon: const Icon(Icons.copy_rounded, size: 16, color: AppColors.primary),
            label: const Text(
              'Sao chép',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Hàng thông tin chi tiết điều kiện
  Widget _buildDetailRow({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String content,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 17, color: iconColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF334155),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  content,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF64748B),
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Dòng gạch đầu dòng quy định
class _RuleBullet extends StatelessWidget {
  final String text;

  const _RuleBullet({required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '• ',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
        ),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF64748B),
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
