import 'package:equatable/equatable.dart';
import 'package:intl/intl.dart';

/// Đại diện cho một Voucher / Chương trình khuyến mãi (từ ví voucher hoặc danh sách khuyến mãi của tour).
class VoucherItemModel extends Equatable {
  final String id;
  final String code;
  final String title;
  final String? description;
  final String discountType; // 'PERCENT' | 'FIXED'
  final int discountValue;
  final int? maxDiscountAmount;
  final int minOrderAmount;
  final String scope; // 'AGENCY' | 'PLATFORM'
  final DateTime? startsAt;
  final DateTime? endsAt;
  final bool isUsed;
  final bool isActive;

  const VoucherItemModel({
    required this.id,
    required this.code,
    required this.title,
    this.description,
    required this.discountType,
    required this.discountValue,
    this.maxDiscountAmount,
    this.minOrderAmount = 0,
    required this.scope,
    this.startsAt,
    this.endsAt,
    this.isUsed = false,
    this.isActive = true,
  });

  /// Parse từ UserVoucherDto (GET /promotions/my-vouchers) hoặc PromotionDto (GET /promotions/available)
  factory VoucherItemModel.fromJson(Map<String, dynamic> json) {
    // Nếu là UserVoucherDto, thông tin khuyến mãi nằm trong trường `promotion`
    final promoMap = json['promotion'] is Map<String, dynamic>
        ? json['promotion'] as Map<String, dynamic>
        : json;

    return VoucherItemModel(
      id: (json['id'] ?? promoMap['id'] ?? '').toString(),
      code: (promoMap['code'] ?? json['code'] ?? '').toString().toUpperCase(),
      title: (promoMap['title'] ?? 'Ưu đãi chuyến đi').toString(),
      description: promoMap['description']?.toString(),
      discountType: (promoMap['discountType'] ?? 'PERCENT').toString().toUpperCase(),
      discountValue: (promoMap['discountValue'] as num?)?.toInt() ?? 0,
      maxDiscountAmount: (promoMap['maxDiscountAmount'] as num?)?.toInt(),
      minOrderAmount: (promoMap['minOrderAmount'] as num?)?.toInt() ?? 0,
      scope: (promoMap['scope'] ?? 'PLATFORM').toString().toUpperCase(),
      startsAt: promoMap['startsAt'] != null ? DateTime.tryParse(promoMap['startsAt'].toString()) : null,
      endsAt: promoMap['endsAt'] != null ? DateTime.tryParse(promoMap['endsAt'].toString()) : null,
      isUsed: json['isUsed'] == true,
      isActive: promoMap['isActive'] != false,
    );
  }

  /// Format chuỗi hiển thị giảm giá tiếng Việt (VD: "Giảm 10% (tối đa 100.000 ₫)" hoặc "Giảm 50.000 ₫")
  String get formattedDiscountText {
    final currencyFormat = NumberFormat('#,###', 'vi_VN');
    if (discountType == 'PERCENT') {
      if (maxDiscountAmount != null && maxDiscountAmount! > 0) {
        return 'Giảm $discountValue% (tối đa ${currencyFormat.format(maxDiscountAmount)} ₫)';
      }
      return 'Giảm $discountValue%';
    } else {
      return 'Giảm ${currencyFormat.format(discountValue)} ₫';
    }
  }

  /// Format điều kiện đơn hàng tối thiểu tiếng Việt
  String get formattedMinOrderText {
    if (minOrderAmount <= 0) return 'Không giới hạn đơn tối thiểu';
    final currencyFormat = NumberFormat('#,###', 'vi_VN');
    return 'Đơn tối thiểu ${currencyFormat.format(minOrderAmount)} ₫';
  }

  /// Format hạn sử dụng tiếng Việt
  String get formattedExpiryText {
    if (endsAt == null) return 'Không có hạn sử dụng';
    final df = DateFormat('dd/MM/yyyy');
    return 'Hạn dùng: ${df.format(endsAt!.toLocal())}';
  }

  /// Kiểm tra voucher còn hạn hay không
  bool get isExpired {
    if (endsAt == null) return false;
    return endsAt!.isBefore(DateTime.now());
  }

  /// Kiểm tra có thể áp dụng cho subtotal hiện tại hay không
  bool isApplicable(int subtotal) {
    if (isUsed || !isActive || isExpired) return false;
    return subtotal >= minOrderAmount;
  }

  @override
  List<Object?> get props => [
        id,
        code,
        title,
        description,
        discountType,
        discountValue,
        maxDiscountAmount,
        minOrderAmount,
        scope,
        startsAt,
        endsAt,
        isUsed,
        isActive,
      ];
}

/// Kết quả xem trước tính giảm giá từ backend (`GET /promotions/preview`).
class PromotionPreviewResult extends Equatable {
  final String promotionId;
  final String code;
  final String scope; // 'AGENCY' | 'PLATFORM'
  final int discountAmount; // Số nguyên VND
  final int finalAmount; // Số nguyên VND

  const PromotionPreviewResult({
    required this.promotionId,
    required this.code,
    required this.scope,
    required this.discountAmount,
    required this.finalAmount,
  });

  factory PromotionPreviewResult.fromJson(Map<String, dynamic> json) {
    return PromotionPreviewResult(
      promotionId: (json['promotionId'] ?? '').toString(),
      code: (json['code'] ?? '').toString().toUpperCase(),
      scope: (json['scope'] ?? 'PLATFORM').toString().toUpperCase(),
      discountAmount: (json['discountAmount'] as num?)?.toInt() ?? 0,
      finalAmount: (json['finalAmount'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [
        promotionId,
        code,
        scope,
        discountAmount,
        finalAmount,
      ];
}

