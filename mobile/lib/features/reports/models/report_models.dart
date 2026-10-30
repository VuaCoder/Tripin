import 'package:equatable/equatable.dart';

/// Nhóm sự cố, khớp `REPORT_CATEGORY` của backend.
enum ReportCategory {
  safety('SAFETY', 'An toàn / sự cố khẩn cấp'),
  serviceQuality('SERVICE_QUALITY', 'Chất lượng dịch vụ'),
  misleadingInfo('MISLEADING_INFO', 'Thông tin sai lệch'),
  paymentOrRefund('PAYMENT_OR_REFUND', 'Thanh toán / hoàn tiền'),
  inappropriateContent('INAPPROPRIATE_CONTENT', 'Nội dung không phù hợp'),
  other('OTHER', 'Khác');

  final String apiValue;
  final String label;
  const ReportCategory(this.apiValue, this.label);

  /// Nhóm tương ứng của phiếu khiếu nại (`POST /complaints`, dùng khi có ảnh đính kèm).
  String get complaintCategory => switch (this) {
        safety => 'SAFETY_URGENT',
        serviceQuality => 'GUIDE_SERVICE',
        misleadingInfo => 'ITINERARY',
        paymentOrRefund => 'BILLING_REFUND',
        inappropriateContent => 'OTHER',
        other => 'OTHER',
      };

  String get complaintSubCategory => switch (this) {
        safety => 'SAFETY_INJURY_NO_SUPPORT',
        serviceQuality => 'GUIDE_ABSENT_OR_INCOMPETENT',
        misleadingInfo => 'ITINERARY_UNANNOUNCED_CHANGE',
        paymentOrRefund => 'BILLING_UNAUTHORIZED_SURCHARGE',
        inappropriateContent => 'OTHER_SERVICE_ISSUE',
        other => 'OTHER_SERVICE_ISSUE',
      };
}

/// Một ảnh bằng chứng đã chọn từ thư viện / máy ảnh.
class ReportPhoto extends Equatable {
  final String name;
  final List<int> bytes;

  const ReportPhoto({required this.name, required this.bytes});

  @override
  List<Object?> get props => [name, bytes.length];
}

/// Kết quả `POST /reports`: mã tra cứu để người dùng đọc cho bộ phận hỗ trợ.
class SubmittedReport extends Equatable {
  final String id;
  final String code;
  final String status;

  const SubmittedReport({required this.id, required this.code, required this.status});

  /// Phiếu khiếu nại (có ảnh): mã tra cứu là `ticketCode`.
  factory SubmittedReport.fromComplaintJson(Map<String, dynamic> json) => SubmittedReport(
        id: json['id'] as String,
        code: json['ticketCode'] as String? ?? '',
        status: json['status'] as String? ?? '',
      );

  factory SubmittedReport.fromJson(Map<String, dynamic> json) => SubmittedReport(
        id: json['id'] as String,
        code: json['code'] as String? ?? '',
        status: json['status'] as String? ?? '',
      );

  @override
  List<Object?> get props => [id, code, status];
}
