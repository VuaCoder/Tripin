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
}

/// Kết quả `POST /reports`: mã tra cứu để người dùng đọc cho bộ phận hỗ trợ.
class SubmittedReport extends Equatable {
  final String id;
  final String code;
  final String status;

  const SubmittedReport({required this.id, required this.code, required this.status});

  factory SubmittedReport.fromJson(Map<String, dynamic> json) => SubmittedReport(
        id: json['id'] as String,
        code: json['code'] as String? ?? '',
        status: json['status'] as String? ?? '',
      );

  @override
  List<Object?> get props => [id, code, status];
}
