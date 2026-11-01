import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../models/voucher_model.dart';
import '../services/voucher_storage_service.dart';
import 'voucher_ticket_card.dart';

/// BottomSheet chọn và áp dụng Voucher trong luồng thanh toán (chuẩn Shopee)
class VoucherBottomSheet extends StatefulWidget {
  final int orderTotal;
  final VoucherModel? initiallySelectedVoucher;
  final ValueChanged<VoucherModel?> onVoucherApplied;

  const VoucherBottomSheet({
    super.key,
    required this.orderTotal,
    this.initiallySelectedVoucher,
    required this.onVoucherApplied,
  });

  static Future<VoucherModel?> show(
    BuildContext context, {
    required int orderTotal,
    VoucherModel? currentVoucher,
  }) {
    return showModalBottomSheet<VoucherModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => VoucherBottomSheet(
        orderTotal: orderTotal,
        initiallySelectedVoucher: currentVoucher,
        onVoucherApplied: (v) => Navigator.pop(ctx, v),
      ),
    );
  }

  @override
  State<VoucherBottomSheet> createState() => _VoucherBottomSheetState();
}

class _VoucherBottomSheetState extends State<VoucherBottomSheet> {
  final VoucherStorageService _storageService = VoucherStorageService();
  final TextEditingController _codeController = TextEditingController();
  final NumberFormat _formatter = NumberFormat('#,###', 'vi_VN');

  List<VoucherModel> _allVouchers = [];
  VoucherModel? _selectedVoucher;
  bool _isLoading = true;
  String? _applyError;
  bool _isCheckingCode = false;

  @override
  void initState() {
    super.initState();
    _selectedVoucher = widget.initiallySelectedVoucher;
    _loadVouchers();
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _loadVouchers() async {
    setState(() => _isLoading = true);
    final list = await _storageService.getAllVouchers();
    if (mounted) {
      setState(() {
        _allVouchers = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleManualCode() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;

    setState(() {
      _applyError = null;
      _isCheckingCode = true;
    });

    try {
      final voucher = await _storageService.collectVoucher(code);
      if (!voucher.isAvailable) {
        throw Exception('Mã voucher này đã được sử dụng hoặc hết hạn.');
      }
      if (!voucher.isEligibleForOrder(widget.orderTotal)) {
        throw Exception('Đơn hàng chưa đạt mức tối thiểu ${_formatter.format(voucher.minOrderAmount)}đ');
      }

      setState(() {
        _selectedVoucher = voucher;
        _codeController.clear();
      });
      await _loadVouchers();
    } catch (e) {
      setState(() {
        _applyError = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _isCheckingCode = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final eligibleVouchers = _allVouchers.where((v) => v.isAvailable && v.isEligibleForOrder(widget.orderTotal)).toList();
    final ineligibleVouchers = _allVouchers.where((v) => v.isAvailable && !v.isEligibleForOrder(widget.orderTotal)).toList();

    final int calculatedDiscount = _selectedVoucher?.calculateDiscount(widget.orderTotal) ?? 0;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
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

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
              child: Row(
                children: [
                  const Text(
                    'Tripri Voucher',
                    style: TextStyle(
                      fontSize: 19,
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

            // Ô nhập mã thủ công
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 46,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _applyError != null ? Colors.red.shade400 : const Color(0xFFE2E8F0),
                            ),
                          ),
                          child: TextField(
                            controller: _codeController,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(
                              hintText: 'Nhập mã ưu đãi Tripri...',
                              hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                              prefixIcon: Icon(Icons.confirmation_number_outlined, size: 20, color: Color(0xFF64748B)),
                              border: InputBorder.none,
                              contentPadding: EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      SizedBox(
                        height: 46,
                        child: ElevatedButton(
                          onPressed: _isCheckingCode ? null : _handleManualCode,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 18),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: _isCheckingCode
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Áp dụng', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                        ),
                      ),
                    ],
                  ),
                  if (_applyError != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      _applyError!,
                      style: TextStyle(fontSize: 12, color: Colors.red.shade600, fontWeight: FontWeight.w500),
                    ),
                  ],
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // Danh sách Voucher
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
                      children: [
                        if (eligibleVouchers.isEmpty && ineligibleVouchers.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 40),
                            child: Center(
                              child: Text(
                                'Chưa có voucher nào trong ví',
                                style: TextStyle(color: Color(0xFF94A3B8)),
                              ),
                            ),
                          ),

                        // Nhóm voucher KHẢ DỤNG
                        if (eligibleVouchers.isNotEmpty) ...[
                          const Padding(
                            padding: EdgeInsets.only(bottom: 8, top: 4),
                            child: Text(
                              'VOUCHER KHẢ DỤNG',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF64748B),
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          ...eligibleVouchers.map((v) {
                            final isSel = _selectedVoucher?.id == v.id;
                            return VoucherTicketCard(
                              voucher: v,
                              isSelected: isSel,
                              isSelectable: true,
                              currentOrderTotal: widget.orderTotal,
                              onApply: () {
                                setState(() {
                                  _selectedVoucher = isSel ? null : v;
                                });
                              },
                            );
                          }),
                          const SizedBox(height: 14),
                        ],

                        // Nhóm voucher CHƯA ĐỦ ĐIỀU KIỆN
                        if (ineligibleVouchers.isNotEmpty) ...[
                          const Padding(
                            padding: EdgeInsets.only(bottom: 8, top: 6),
                            child: Text(
                              'CHƯA ĐỦ ĐIỀU KIỆN ÁP DỤNG',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF94A3B8),
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          ...ineligibleVouchers.map((v) {
                            return VoucherTicketCard(
                              voucher: v,
                              isSelected: false,
                              isSelectable: false,
                              currentOrderTotal: widget.orderTotal,
                            );
                          }),
                        ],
                      ],
                    ),
            ),

            // Bottom bar: Tóm tắt giảm & Nút xác nhận
            Container(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _selectedVoucher != null ? 'Đã giảm:' : 'Chưa áp dụng voucher',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                        ),
                        if (_selectedVoucher != null)
                          Text(
                            '-${_formatter.format(calculatedDiscount)} VND',
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: AppColors.primary,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (_selectedVoucher != null) ...[
                    TextButton(
                      onPressed: () => setState(() => _selectedVoucher = null),
                      child: const Text('Bỏ chọn', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 8),
                  ],
                  ElevatedButton(
                    onPressed: () {
                      widget.onVoucherApplied(_selectedVoucher);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Đồng ý', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
