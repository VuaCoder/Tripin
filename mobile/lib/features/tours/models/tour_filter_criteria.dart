import 'package:equatable/equatable.dart';

/// Các khoảng thời lượng định sẵn
enum TourDurationOption {
  all,
  oneDay, // 1 ngày
  twoToThreeDays, // 2 - 3 ngày
  moreThanThreeDays, // Trên 3 ngày
}

/// Tiêu chí lọc nâng cao cho Tour du lịch
class TourFilterCriteria extends Equatable {
  final double? minPrice;
  final double? maxPrice;
  final int? minDays;
  final int? maxDays;
  final Set<String> categoryIds;
  final double? minRating;
  final String sort;

  const TourFilterCriteria({
    this.minPrice,
    this.maxPrice,
    this.minDays,
    this.maxDays,
    this.categoryIds = const {},
    this.minRating,
    this.sort = 'newest',
  });

  /// Đếm số lượng tiêu chí lọc đang được kích hoạt (để hiển thị badge trên nút icon lọc)
  int get activeFilterCount {
    int count = 0;
    if (minPrice != null || maxPrice != null) count++;
    if (minDays != null || maxDays != null) count++;
    if (categoryIds.isNotEmpty) count += categoryIds.length;
    if (minRating != null && minRating! > 0) count++;
    if (sort != 'newest') count++;
    return count;
  }

  bool get isEmpty => activeFilterCount == 0;

  bool get isNotEmpty => !isEmpty;

  TourDurationOption get durationOption {
    if (minDays == 1 && maxDays == 1) return TourDurationOption.oneDay;
    if (minDays == 2 && maxDays == 3) return TourDurationOption.twoToThreeDays;
    if (minDays == 4 && maxDays == null) return TourDurationOption.moreThanThreeDays;
    return TourDurationOption.all;
  }

  TourFilterCriteria copyWith({
    double? minPrice,
    double? maxPrice,
    bool clearPrice = false,
    int? minDays,
    int? maxDays,
    bool clearDuration = false,
    Set<String>? categoryIds,
    double? minRating,
    bool clearRating = false,
    String? sort,
  }) {
    return TourFilterCriteria(
      minPrice: clearPrice ? null : (minPrice ?? this.minPrice),
      maxPrice: clearPrice ? null : (maxPrice ?? this.maxPrice),
      minDays: clearDuration ? null : (minDays ?? this.minDays),
      maxDays: clearDuration ? null : (maxDays ?? this.maxDays),
      categoryIds: categoryIds ?? this.categoryIds,
      minRating: clearRating ? null : (minRating ?? this.minRating),
      sort: sort ?? this.sort,
    );
  }

  /// Trả về bộ lọc rỗng mặc định
  static const TourFilterCriteria empty = TourFilterCriteria();

  @override
  List<Object?> get props => [
        minPrice,
        maxPrice,
        minDays,
        maxDays,
        categoryIds,
        minRating,
        sort,
      ];
}
