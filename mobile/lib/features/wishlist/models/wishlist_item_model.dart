import '../../tours/models/tour_model.dart';

/// Model biểu diễn một mục trong danh sách yêu thích (Wishlist) của khách du lịch
class WishlistItemModel {
  final String tourId;
  final DateTime? addedAt;
  final bool available;
  final TourModel? tour;

  const WishlistItemModel({
    required this.tourId,
    this.addedAt,
    this.available = true,
    this.tour,
  });

  factory WishlistItemModel.fromJson(Map<String, dynamic> json) {
    TourModel? tourModel;
    if (json['tour'] is Map<String, dynamic>) {
      tourModel = TourModel.fromJson(json['tour'] as Map<String, dynamic>);
    }

    DateTime? addedDate;
    if (json['addedAt'] != null) {
      addedDate = DateTime.tryParse(json['addedAt'].toString());
    }

    return WishlistItemModel(
      tourId: json['tourId'] as String? ?? (tourModel?.id ?? ''),
      addedAt: addedDate,
      available: json['available'] as bool? ?? true,
      tour: tourModel,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'tourId': tourId,
      'addedAt': addedAt?.toIso8601String(),
      'available': available,
      if (tour != null) 'tour': tour!.toJson(),
    };
  }

  WishlistItemModel copyWith({
    String? tourId,
    DateTime? addedAt,
    bool? available,
    TourModel? tour,
  }) {
    return WishlistItemModel(
      tourId: tourId ?? this.tourId,
      addedAt: addedAt ?? this.addedAt,
      available: available ?? this.available,
      tour: tour ?? this.tour,
    );
  }
}
