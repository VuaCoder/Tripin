import 'package:dio/dio.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/report_models.dart';

class ReportException implements Exception {
  final String message;
  const ReportException(this.message);

  @override
  String toString() => message;
}

class ReportsRepository {
  final ApiClient _api;

  ReportsRepository({ApiClient? api}) : _api = api ?? ApiClient();

  /// Báo cáo sự cố về một tour; `bookingId` là đơn đặt chỗ làm bằng chứng.
  Future<SubmittedReport> reportTour({
    required String tourId,
    String? bookingId,
    required ReportCategory category,
    required String description,
  }) async {
    try {
      final res = await _api.post<Map<String, dynamic>>(
        ApiEndpoints.reports,
        data: {
          'targetType': 'TOUR',
          'targetId': tourId,
          'category': category.apiValue,
          'description': description.trim(),
          'bookingId': ?bookingId,
        },
      );
      return SubmittedReport.fromJson(res.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      String? serverMessage;
      final body = e.response?.data;
      if (body is Map && body['error'] is Map) {
        final message = (body['error'] as Map)['message'];
        if (message is String) serverMessage = message;
      }
      throw ReportException(switch (e.response?.statusCode) {
        null => 'Không kết nối được máy chủ. Nội dung của bạn vẫn được giữ, hãy thử gửi lại khi có mạng.',
        401 => 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
        403 => 'Tài khoản của bạn không có quyền gửi báo cáo.',
        422 || 400 => 'Thông tin chưa hợp lệ. Hãy mô tả rõ hơn sự cố (ít nhất 10 ký tự).',
        429 => 'Bạn đã gửi quá nhiều báo cáo, vui lòng thử lại sau.',
        _ => serverMessage ?? 'Chưa gửi được báo cáo. Vui lòng thử lại.',
      });
    }
  }
}
