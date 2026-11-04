import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/voucher_model.dart';

/// Dịch vụ quản lý kho voucher của người dùng (lưu trữ cục bộ & tuân thủ quy tắc 1 lần dùng Shopee)
class VoucherStorageService {
  static const String _storageKey = 'tripri_user_vouchers_v1';
  final SharedPreferences? _prefs;

  VoucherStorageService({SharedPreferences? prefs}) : _prefs = prefs;

  Future<SharedPreferences> get _instance async => _prefs ?? await SharedPreferences.getInstance();

  /// Danh sách voucher mặc định ban đầu phong phú chuẩn thực tế
  List<VoucherModel> get _defaultVouchers {
    final now = DateTime.now();
    return [
      VoucherModel(
        id: 'vouch_welcome_50k',
        code: 'TRIPRI50K',
        title: 'Giảm 50.000đ cho chuyến đi đầu tiên',
        description: 'Áp dụng cho mọi tour trải nghiệm bản địa từ 200.000đ',
        discountType: VoucherDiscountType.fixedAmount,
        discountValue: 50000,
        minOrderAmount: 200000,
        startsAt: now.subtract(const Duration(days: 2)),
        endsAt: now.add(const Duration(days: 30)),
        badgeText: 'Khách mới',
      ),
      VoucherModel(
        id: 'vouch_disc_10pct',
        code: 'DISCOUNT10',
        title: 'Giảm 10% - Tối đa 200.000đ',
        description: 'Áp dụng cho các tour khám phá thiên nhiên và văn hóa',
        discountType: VoucherDiscountType.percentage,
        discountValue: 10,
        maxDiscountAmount: 200000,
        minOrderAmount: 500000,
        startsAt: now.subtract(const Duration(days: 5)),
        endsAt: now.add(const Duration(days: 14)),
        badgeText: 'Thịnh hành',
      ),
      VoucherModel(
        id: 'vouch_summer_15pct',
        code: 'HELLOSUMMER',
        title: 'Giảm 15% - Mùa du lịch sôi động',
        description: 'Tối đa 300.000đ cho đơn đặt tour từ 800.000đ',
        discountType: VoucherDiscountType.percentage,
        discountValue: 15,
        maxDiscountAmount: 300000,
        minOrderAmount: 800000,
        startsAt: now.subtract(const Duration(days: 1)),
        endsAt: now.add(const Duration(days: 3)),
        badgeText: 'Sắp hết hạn',
      ),
      VoucherModel(
        id: 'vouch_vip_250k',
        code: 'VIPTRIPRI',
        title: 'Giảm 250.000đ Độc quyền Thành viên',
        description: 'Áp dụng cho đơn từ 1.500.000đ trên toàn quốc',
        discountType: VoucherDiscountType.fixedAmount,
        discountValue: 250000,
        minOrderAmount: 1500000,
        startsAt: now.subtract(const Duration(days: 10)),
        endsAt: now.add(const Duration(days: 60)),
        badgeText: 'Độc quyền',
      ),
      // Voucher đã sử dụng (để chứng minh tab Đã dùng)
      VoucherModel(
        id: 'vouch_used_sample',
        code: 'WELCOME2026',
        title: 'Ưu đãi kích hoạt tài khoản 100.000đ',
        description: 'Đã sử dụng thành công cho đơn tour Hạ Long',
        discountType: VoucherDiscountType.fixedAmount,
        discountValue: 100000,
        minOrderAmount: 300000,
        startsAt: now.subtract(const Duration(days: 20)),
        endsAt: now.add(const Duration(days: 10)),
        isUsed: true,
        usedAt: now.subtract(const Duration(days: 3)),
        usedBookingId: 'BK-SAMPLE-01',
      ),
      // Voucher hết hạn (để chứng minh tab Hết hạn)
      VoucherModel(
        id: 'vouch_expired_sample',
        code: 'EARLYBIRD',
        title: 'Giảm 80.000đ Đặt sớm mùa xuân',
        description: 'Voucher ưu đãi đặt tour trước mùa cao điểm',
        discountType: VoucherDiscountType.fixedAmount,
        discountValue: 80000,
        minOrderAmount: 400000,
        startsAt: now.subtract(const Duration(days: 45)),
        endsAt: now.subtract(const Duration(days: 2)),
      ),
    ];
  }

  /// Lấy toàn bộ danh sách voucher của người dùng
  Future<List<VoucherModel>> getAllVouchers() async {
    try {
      final prefs = await _instance;
      final rawJson = prefs.getString(_storageKey);
      if (rawJson == null || rawJson.isEmpty) {
        // Khởi tạo danh sách mặc định lần đầu
        final defaults = _defaultVouchers;
        await _saveVouchersList(defaults);
        return defaults;
      }

      final List decoded = jsonDecode(rawJson) as List;
      return decoded.map((e) => VoucherModel.fromJson(e as Map<String, dynamic>)).toList();
    } catch (e) {
      debugPrint('[VoucherStorageService] getAllVouchers error: $e');
      return _defaultVouchers;
    }
  }

  /// Lấy danh sách voucher khả dụng (chưa dùng và còn hạn)
  Future<List<VoucherModel>> getAvailableVouchers() async {
    final list = await getAllVouchers();
    return list.where((v) => v.isAvailable).toList();
  }

  /// Lấy danh sách voucher đã sử dụng (Shopee single-use rule)
  Future<List<VoucherModel>> getUsedVouchers() async {
    final list = await getAllVouchers();
    return list.where((v) => v.status == VoucherStatus.used).toList();
  }

  /// Lấy danh sách voucher đã hết hạn
  Future<List<VoucherModel>> getExpiredVouchers() async {
    final list = await getAllVouchers();
    return list.where((v) => v.status == VoucherStatus.expired).toList();
  }

  /// Đánh dấu voucher đã sử dụng khi thanh toán xong
  /// Đảm bảo voucher này KHÔNG BAO GIỜ dùng lại được nữa!
  Future<void> markVoucherAsUsed(String voucherId, {required String bookingId}) async {
    final list = await getAllVouchers();
    final updatedList = list.map((v) {
      if (v.id == voucherId || v.code.toUpperCase() == voucherId.toUpperCase()) {
        return v.markAsUsed(bookingId: bookingId);
      }
      return v;
    }).toList();

    await _saveVouchersList(updatedList);
  }

  /// Thu thập/Nhập mã voucher thủ công vào ví
  Future<VoucherModel> collectVoucher(String code) async {
    final cleanCode = code.trim().toUpperCase();
    final list = await getAllVouchers();

    // Kiểm tra xem đã có mã này chưa
    final existingIndex = list.indexWhere((v) => v.code == cleanCode);
    if (existingIndex >= 0) {
      final existing = list[existingIndex];
      if (existing.isUsed) {
        throw Exception('Mã ưu đãi này đã được sử dụng trước đó.');
      }
      return existing;
    }

    // Nếu là mã mới hợp lệ (tự động tạo voucher tương ứng)
    final newVoucher = VoucherModel(
      id: 'vouch_collected_${DateTime.now().millisecondsSinceEpoch}',
      code: cleanCode,
      title: 'Mã ưu đãi đặc biệt: $cleanCode',
      description: 'Giảm ngay 10% giá trị đơn đặt tour',
      discountType: VoucherDiscountType.percentage,
      discountValue: 10,
      maxDiscountAmount: 200000,
      minOrderAmount: 300000,
      startsAt: DateTime.now(),
      endsAt: DateTime.now().add(const Duration(days: 30)),
      badgeText: 'Mới lưu',
    );

    list.insert(0, newVoucher);
    await _saveVouchersList(list);
    return newVoucher;
  }

  Future<void> _saveVouchersList(List<VoucherModel> list) async {
    final prefs = await _instance;
    final jsonList = list.map((v) => v.toJson()).toList();
    await prefs.setString(_storageKey, jsonEncode(jsonList));
  }

  /// Reset dữ liệu ví voucher về mặc định (dùng khi test)
  Future<void> resetToDefaults() async {
    final prefs = await _instance;
    await prefs.remove(_storageKey);
  }
}
