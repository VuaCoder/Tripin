import 'package:intl/intl.dart';

/// Model đại diện cho một Tour du lịch trong danh sách khám phá / tìm kiếm
class TourModel {
  final String id;
  final String title;
  final String? summary;
  final String destination;
  final int durationDays;
  final double basePrice;
  final String? coverImage;
  final List<String> categoryIds;
  final double ratingAvg;
  final int ratingCount;
  final String? nextDepartureDate;
  final String? agencyName;

  const TourModel({
    required this.id,
    required this.title,
    this.summary,
    required this.destination,
    required this.durationDays,
    required this.basePrice,
    this.coverImage,
    this.categoryIds = const [],
    this.ratingAvg = 0.0,
    this.ratingCount = 0,
    this.nextDepartureDate,
    this.agencyName,
  });

  factory TourModel.fromJson(Map<String, dynamic> json) {
    // Parse agency name if present
    String? agency;
    if (json['agency'] is Map<String, dynamic>) {
      agency = json['agency']['name'] as String?;
    } else if (json['agencyName'] is String) {
      agency = json['agencyName'] as String?;
    }

    return TourModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Tour du lịch',
      summary: json['summary'] as String?,
      destination: json['destination'] as String? ?? 'Việt Nam',
      durationDays: (json['durationDays'] as num?)?.toInt() ?? 1,
      basePrice: (json['basePrice'] as num?)?.toDouble() ?? 0.0,
      coverImage: json['coverImage'] as String?,
      categoryIds: (json['categoryIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      ratingAvg: (json['ratingAvg'] as num?)?.toDouble() ?? 0.0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      nextDepartureDate: json['nextDepartureDate'] as String?,
      agencyName: agency,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'summary': summary,
      'destination': destination,
      'durationDays': durationDays,
      'basePrice': basePrice,
      'coverImage': coverImage,
      'categoryIds': categoryIds,
      'ratingAvg': ratingAvg,
      'ratingCount': ratingCount,
      'nextDepartureDate': nextDepartureDate,
      'agencyName': agencyName,
    };
  }

  /// Format giá tiền chuẩn VNĐ: ví dụ 2.500.000 ₫
  String get formattedPrice {
    if (basePrice <= 0) return 'Liên hệ';
    try {
      final formatter = NumberFormat('#,###', 'vi_VN');
      return '${formatter.format(basePrice)} ₫';
    } catch (_) {
      // Fallback nếu locale chưa init
      final priceInt = basePrice.toInt();
      final regex = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
      final formatted = priceInt.toString().replaceAllMapped(
            regex,
            (match) => '${match[1]}.',
          );
      return '$formatted ₫';
    }
  }

  /// Chuỗi thời lượng tour: ví dụ "3 ngày 2 đêm" hoặc "1 ngày"
  String get durationText {
    if (durationDays <= 1) {
      return '1 ngày';
    }
    return '$durationDays ngày ${durationDays - 1} đêm';
  }

  /// Chuỗi đánh giá làm tròn 1 chữ số thập phân
  String get formattedRating {
    if (ratingAvg <= 0) return 'Mới';
    return ratingAvg.toStringAsFixed(1);
  }

  /// Chuỗi giá theo phong cách Airbnb: "₫[amount] cho [duration]" (ví dụ "₫3.250.000 cho 2 đêm")
  String get airbnbPriceDuration {
    final amount = formattedPrice.replaceAll(' ₫', '');
    final nights = durationDays > 1 ? durationDays - 1 : 1;
    final dur = durationDays > 1 ? '$nights đêm' : '1 ngày';
    return '₫$amount cho $dur';
  }
}
