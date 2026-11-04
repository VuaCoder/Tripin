import '../../tours/models/tour_model.dart';

/// Model lưu thông tin tour vừa xem gần đây kèm thời gian xem
class RecentlyViewedTourModel {
  final TourModel tour;
  final DateTime viewedAt;

  const RecentlyViewedTourModel({
    required this.tour,
    required this.viewedAt,
  });

  /// Tính chuỗi ngày/nhóm ngày bằng Tiếng Việt ("Hôm nay", "Hôm qua", "Thứ Hai, 19 tháng 10"...)
  String get relativeTime {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final viewDate = DateTime(viewedAt.year, viewedAt.month, viewedAt.day);
    final diffDays = today.difference(viewDate).inDays;

    if (diffDays <= 0) {
      return 'Hôm nay';
    } else if (diffDays == 1) {
      return 'Hôm qua';
    } else {
      return _formatVietnameseDate(viewedAt);
    }
  }

  static String _formatVietnameseDate(DateTime date) {
    const weekdays = [
      '',
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
      'Chủ Nhật',
    ];
    final weekdayName = (date.weekday >= 1 && date.weekday <= 7) ? weekdays[date.weekday] : '';
    return '$weekdayName, ${date.day} tháng ${date.month}';
  }

  Map<String, dynamic> toJson() {
    return {
      'tour': tour.toJson(),
      'viewedAt': viewedAt.toIso8601String(),
    };
  }

  factory RecentlyViewedTourModel.fromJson(Map<String, dynamic> json) {
    return RecentlyViewedTourModel(
      tour: TourModel.fromJson(json['tour'] as Map<String, dynamic>),
      viewedAt: json['viewedAt'] != null
          ? DateTime.tryParse(json['viewedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
