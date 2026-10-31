import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../models/booking_voucher_model.dart';

class BookingVoucherPickerModal extends StatefulWidget {
  final List<VoucherItemModel> vouchers;
  final VoucherItemModel? selectedVoucher;
  final int currentSubtotal;
  final bool isLoading;
  final ValueChanged<String> onApplyCode;
  final ValueChanged<VoucherItemModel> onSelectVoucher;
  final VoidCallback onRemoveVoucher;

  const BookingVoucherPickerModal({
    super.key,
    required this.vouchers,
    this.selectedVoucher,
    required this.currentSubtotal,
    this.isLoading = false,
    required this.onApplyCode,
    required this.onSelectVoucher,
    required this.onRemoveVoucher,
  });

  static Future<void> show({
    required BuildContext context,
    required List<VoucherItemModel> vouchers,
    VoucherItemModel? selectedVoucher,
    required int currentSubtotal,
    bool isLoading = false,
    required ValueChanged<String> onApplyCode,
    required ValueChanged<VoucherItemModel> onSelectVoucher,
    required VoidCallback onRemoveVoucher,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BookingVoucherPickerModal(
        vouchers: vouchers,
        selectedVoucher: selectedVoucher,
        currentSubtotal: currentSubtotal,
        isLoading: isLoading,
        onApplyCode: onApplyCode,
        onSelectVoucher: onSelectVoucher,
        onRemoveVoucher: onRemoveVoucher,
      ),
    );
  }

  @override
  State<BookingVoucherPickerModal> createState() => _BookingVoucherPickerModalState();
}

class _BookingVoucherPickerModalState extends State<BookingVoucherPickerModal> {
  final TextEditingController _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  void _handleManualApply() {
    final code = _codeController.text.trim();
    if (code.isNotEmpty) {
      widget.onApplyCode(code);
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.8,
      ),
      margin: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.confirmation_num_outlined, color: AppColors.secondary, size: 22),
                    SizedBox(width: 8),
                    Text(
                      'Ưu đãi & Voucher',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textSecondary),
                  onPressed: () => Navigator.of(context).pop(),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),

          // Nhập mã thủ công
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _codeController,
                    textCapitalization: TextCapitalization.characters,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Nhập mã khuyến mãi',
                      hintStyle: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.normal,
                      ),
                      prefixIcon: const Icon(Icons.sell_outlined, size: 18, color: AppColors.textSecondary),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      filled: true,
                      fillColor: AppColors.surface,
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.secondary, width: 1.5),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                ElevatedButton(
                  onPressed: _handleManualApply,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.secondary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Áp dụng',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),

          // Danh sách voucher
          Expanded(
            child: widget.isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.secondary),
                  )
                : widget.vouchers.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.discount_outlined, size: 48, color: AppColors.textMuted),
                            SizedBox(height: 12),
                            Text(
                              'Không có voucher nào trong ví',
                              style: TextStyle(
                                fontSize: 14,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: widget.vouchers.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final voucher = widget.vouchers[index];
                          final isSelected = widget.selectedVoucher?.code == voucher.code;
                          final isEligible = voucher.isApplicable(widget.currentSubtotal);

                          return _buildVoucherCard(voucher, isSelected, isEligible);
                        },
                      ),
          ),

          // Nút gỡ bỏ nếu đang chọn
          if (widget.selectedVoucher != null)
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () {
                      widget.onRemoveVoucher();
                      Navigator.of(context).pop();
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Bỏ chọn voucher', style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildVoucherCard(VoucherItemModel voucher, bool isSelected, bool isEligible) {
    return Opacity(
      opacity: isEligible ? 1.0 : 0.6,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.secondarySurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppColors.secondary : AppColors.border,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Icon(
                Icons.confirmation_num,
                color: isEligible ? AppColors.secondary : AppColors.textMuted,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),

            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.secondary,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          voucher.code,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          voucher.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    voucher.formattedDiscountText,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.secondary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${voucher.formattedMinOrderText} • ${voucher.formattedExpiryText}',
                    style: TextStyle(
                      fontSize: 11,
                      color: isEligible ? AppColors.textSecondary : AppColors.error,
                    ),
                  ),
                  if (!isEligible)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        voucher.isExpired
                            ? 'Voucher đã hết hạn sử dụng'
                            : 'Đơn hàng chưa đạt giá trị tối thiểu',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.error,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            const SizedBox(width: 8),
            TextButton(
              onPressed: isEligible
                  ? () {
                      widget.onSelectVoucher(voucher);
                      Navigator.of(context).pop();
                    }
                  : null,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.secondary,
                disabledForegroundColor: AppColors.textMuted,
                visualDensity: VisualDensity.compact,
              ),
              child: Text(
                isSelected ? 'Đã chọn' : 'Áp dụng',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: isSelected
                      ? AppColors.primary
                      : (isEligible ? AppColors.secondary : AppColors.textMuted),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
