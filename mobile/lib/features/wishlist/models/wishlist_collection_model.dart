import '../../tours/models/tour_model.dart';

/// Model đại diện cho một danh sách/bộ sưu tập yêu thích tùy chỉnh (ví dụ: "ngu", "Hè 2026")
class WishlistCollectionModel {
  final String id;
  final String name;
  final List<TourModel> tours;
  final DateTime createdAt;
  final DateTime updatedAt;

  const WishlistCollectionModel({
    required this.id,
    required this.name,
    this.tours = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  /// Ảnh bìa lấy từ tour mới nhất trong wishlist
  String? get coverImageUrl {
    for (final tour in tours) {
      if (tour.coverImage != null && tour.coverImage!.isNotEmpty) {
        return tour.coverImage;
      }
    }
    return null;
  }

  /// Số lượng tour đã lưu
  int get count => tours.length;

  /// Chuỗi hiển thị số lượng theo Tiếng Việt (ví dụ: "3 đã lưu")
  String get savedSubtitle => '$count đã lưu';

  /// Kiểm tra xem tour đã có trong wishlist này chưa
  bool containsTour(String tourId) => tours.any((t) => t.id == tourId);

  WishlistCollectionModel copyWith({
    String? id,
    String? name,
    List<TourModel>? tours,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return WishlistCollectionModel(
      id: id ?? this.id,
      name: name ?? this.name,
      tours: tours ?? this.tours,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'tours': tours.map((t) => t.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  factory WishlistCollectionModel.fromJson(Map<String, dynamic> json) {
    final toursList = (json['tours'] as List<dynamic>?)
            ?.map((e) => TourModel.fromJson(e as Map<String, dynamic>))
            .toList() ??
        const [];

    return WishlistCollectionModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      tours: toursList,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
