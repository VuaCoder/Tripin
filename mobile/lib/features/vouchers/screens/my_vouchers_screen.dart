import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../models/voucher_model.dart';
import '../services/voucher_storage_service.dart';
import '../widgets/voucher_ticket_card.dart';

/// Màn hình "Ưu đãi & Voucher của tôi" trong trang Profile
class MyVouchersScreen extends StatefulWidget {
  const MyVouchersScreen({super.key});

  @override
  State<MyVouchersScreen> createState() => _MyVouchersScreenState();
}

class _MyVouchersScreenState extends State<MyVouchersScreen> with SingleTickerProviderStateMixin {
  final VoucherStorageService _storageService = VoucherStorageService();
  final TextEditingController _codeController = TextEditingController();

  late TabController _tabController;
  List<VoucherModel> _allVouchers = [];
  bool _isLoading = true;
  bool _isSavingCode = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadVouchers();
  }

  @override
  void dispose() {
    _tabController.dispose();
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

  Future<void> _handleSaveCode() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;

    setState(() => _isSavingCode = true);
    try {
      final voucher = await _storageService.collectVoucher(code);
      _codeController.clear();
      await _loadVouchers();
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đã lưu thành công mã "${voucher.code}" vào ví voucher!'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSavingCode = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final available = _allVouchers.where((v) => v.isAvailable).toList();
    final used = _allVouchers.where((v) => v.status == VoucherStatus.used).toList();
    final expired = _allVouchers.where((v) => v.status == VoucherStatus.expired).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Ưu đãi & Voucher của tôi',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: Color(0xFF1E293B),
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: const Color(0xFF64748B),
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
          tabs: [
            Tab(text: 'Khả dụng (${available.length})'),
            Tab(text: 'Đã dùng (${used.length})'),
            Tab(text: 'Hết hạn (${expired.length})'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Khung nhập mã lưu vào ví
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: TextField(
                      controller: _codeController,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        hintText: 'Nhập mã voucher lưu vào ví...',
                        hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                        prefixIcon: Icon(Icons.card_giftcard_rounded, size: 19, color: Color(0xFF64748B)),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(vertical: 11),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 44,
                  child: ElevatedButton(
                    onPressed: _isSavingCode ? null : _handleSaveCode,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    child: _isSavingCode
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Lưu mã', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Nội dung các tab
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildVoucherList(
                        vouchers: available,
                        emptyMessage: 'Bạn chưa có mã giảm giá nào khả dụng',
                        showUseNow: true,
                      ),
                      _buildVoucherList(
                        vouchers: used,
                        emptyMessage: 'Chưa có voucher nào đã sử dụng',
                      ),
                      _buildVoucherList(
                        vouchers: expired,
                        emptyMessage: 'Không có voucher nào hết hạn',
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildVoucherList({
    required List<VoucherModel> vouchers,
    required String emptyMessage,
    bool showUseNow = false,
  }) {
    if (vouchers.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.confirmation_num_outlined, size: 40, color: Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 14),
              Text(
                emptyMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: vouchers.length,
      itemBuilder: (context, index) {
        final voucher = vouchers[index];
        return VoucherTicketCard(
          voucher: voucher,
          onUseNow: showUseNow
              ? () {
                  // Đóng trang voucher để người dùng chọn tour
                  Navigator.pop(context);
                }
              : null,
        );
      },
    );
  }
}
