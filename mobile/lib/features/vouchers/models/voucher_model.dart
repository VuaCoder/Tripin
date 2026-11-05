import 'dart:math';

/// Phân loại loại giảm giá của Voucher
enum VoucherDiscountType {
  percentage, // Giảm theo phần trăm (%)
  fixedAmount, // Giảm theo số tiền cố định (VND)
}

/// Trạng thái của Voucher (chuẩn Shopee)
enum VoucherStatus {
  available, // Khả dụng (chưa dùng, còn hạn)
  used, // Đã sử dụng (Shopee rule: không thể tái sử dụng)
  expired, // Đã hết hạn
}

/// Model quản lý thông tin Voucher / Mã giảm giá đặt tour
class VoucherModel {
  final String id;
  final String code;
  final String title;
  final String description;
  final VoucherDiscountType discountType;
  final int discountValue; // Giá trị % hoặc số tiền VND
  final int? maxDiscountAmount; // Số tiền giảm tối đa nếu là %
  final int minOrderAmount; // Giá trị đơn hàng tối thiểu để áp dụng
  final DateTime startsAt;
  final DateTime endsAt;
  final bool isUsed;
  final DateTime? usedAt;
  final String? usedBookingId;
  final String? badgeText; // Tag nhãn: "Độc quyền", "Sắp hết hạn", "Khách mới"

  const VoucherModel({
    required this.id,
    required this.code,
    required this.title,
    required this.description,
    required this.discountType,
    required this.discountValue,
    this.maxDiscountAmount,
    this.minOrderAmount = 0,
    required this.startsAt,
    required this.endsAt,
    this.isUsed = false,
    this.usedAt,
    this.usedBookingId,
    this.badgeText,
  });

  /// Kiểm tra trạng thái hiện tại của voucher
  VoucherStatus get status {
    if (isUsed) return VoucherStatus.used;
    if (DateTime.now().isAfter(endsAt)) return VoucherStatus.expired;
    return VoucherStatus.available;
  }

  /// Voucher có đang khả dụng không?
  bool get isAvailable => status == VoucherStatus.available;

  /// Đơn hàng có đạt giá trị tối thiểu để áp dụng voucher không?
  bool isEligibleForOrder(int orderTotal) {
    if (!isAvailable) return false;
    return orderTotal >= minOrderAmount;
  }

  /// Tính toán số tiền được giảm cho một giá trị đơn hàng
  int calculateDiscount(int orderTotal) {
    if (!isAvailable) return 0;
    if (orderTotal < minOrderAmount) return 0;

    int discount = 0;
    if (discountType == VoucherDiscountType.percentage) {
      discount = (orderTotal * discountValue / 100).round();
      if (maxDiscountAmount != null && maxDiscountAmount! > 0) {
        discount = min(discount, maxDiscountAmount!);
      }
    } else {
      discount = discountValue;
    }

    // Số tiền giảm không vượt quá tổng đơn hàng
    return min(discount, orderTotal);
  }

  /// Bản sao với trạng thái đã sử dụng
  VoucherModel markAsUsed({required String bookingId}) {
    return VoucherModel(
      id: id,
      code: code,
      title: title,
      description: description,
      discountType: discountType,
      discountValue: discountValue,
      maxDiscountAmount: maxDiscountAmount,
      minOrderAmount: minOrderAmount,
      startsAt: startsAt,
      endsAt: endsAt,
      isUsed: true,
      usedAt: DateTime.now(),
      usedBookingId: bookingId,
      badgeText: badgeText,
    );
  }

  factory VoucherModel.fromJson(Map<String, dynamic> json) {
    final discountTypeStr = json['discountType']?.toString().toUpperCase() ?? 'FIXED_AMOUNT';
    final isPercent = discountTypeStr == 'PERCENTAGE' || discountTypeStr == 'PERCENT';

    return VoucherModel(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString().toUpperCase() ?? '',
      title: json['title']?.toString() ?? 'Mã ưu đãi Tripri',
      description: json['description']?.toString() ?? '',
      discountType: isPercent ? VoucherDiscountType.percentage : VoucherDiscountType.fixedAmount,
      discountValue: (json['discountValue'] as num?)?.toInt() ?? 0,
      maxDiscountAmount: (json['maxDiscountAmount'] as num?)?.toInt(),
      minOrderAmount: (json['minOrderAmount'] as num?)?.toInt() ?? 0,
      startsAt: json['startsAt'] != null
          ? DateTime.tryParse(json['startsAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      endsAt: json['endsAt'] != null
          ? DateTime.tryParse(json['endsAt'].toString()) ?? DateTime.now().add(const Duration(days: 30))
          : DateTime.now().add(const Duration(days: 30)),
      isUsed: json['isUsed'] == true,
      usedAt: json['usedAt'] != null ? DateTime.tryParse(json['usedAt'].toString()) : null,
      usedBookingId: json['usedBookingId']?.toString(),
      badgeText: json['badgeText']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'code': code,
      'title': title,
      'description': description,
      'discountType': discountType == VoucherDiscountType.percentage ? 'PERCENTAGE' : 'FIXED_AMOUNT',
      'discountValue': discountValue,
      'maxDiscountAmount': maxDiscountAmount,
      'minOrderAmount': minOrderAmount,
      'startsAt': startsAt.toIso8601String(),
      'endsAt': endsAt.toIso8601String(),
      'isUsed': isUsed,
      'usedAt': usedAt?.toIso8601String(),
      'usedBookingId': usedBookingId,
      'badgeText': badgeText,
    };
  }
}
