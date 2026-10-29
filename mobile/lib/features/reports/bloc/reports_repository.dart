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
  final Dio _uploader;

  ReportsRepository({ApiClient? api, Dio? uploader})
      : _api = api ?? ApiClient(),
        _uploader = uploader ?? Dio();

  /// Tải ảnh lên Cloudinary bằng chữ ký do backend cấp, trả về `public_id` để đính vào phiếu.
  Future<String> _uploadPhoto(ReportPhoto photo) async {
    final sig = await _api.post<Map<String, dynamic>>('/complaints/images/upload-signature');
    final data = sig.data!['data'] as Map<String, dynamic>;
    final params = Map<String, dynamic>.from(data['params'] as Map);
    final form = FormData.fromMap({
      ...params,
      'api_key': data['apiKey'],
      'timestamp': data['timestamp'],
      'signature': data['signature'],
      'file': MultipartFile.fromBytes(photo.bytes, filename: photo.name),
    });
    await _uploader.post<dynamic>(data['uploadUrl'] as String, data: form);
    return data['publicId'] as String;
  }

  /// Báo cáo kèm ảnh: gửi thành phiếu khiếu nại (`POST /complaints`), mã tra cứu là `ticketCode`.
  Future<SubmittedReport> reportTourWithPhotos({
    required String tourId,
    String? bookingId,
    required ReportCategory category,
    required String description,
    required List<ReportPhoto> photos,
  }) async {
    try {
      final ids = <String>[];
      for (final p in photos) {
        ids.add(await _uploadPhoto(p));
      }
      final text = description.trim();
      final res = await _api.post<Map<String, dynamic>>(
        '/complaints',
        data: {
          'tourId': tourId,
          'bookingId': ?bookingId,
          'category': category.complaintCategory,
          'subCategory': category.complaintSubCategory,
          'subject': text.length > 80 ? text.substring(0, 80) : (text.length < 5 ? '$text...' : text),
          'description': text,
          'imagePublicIds': ids,
        },
      );
      return SubmittedReport.fromComplaintJson(res.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ReportException(_messageFor(e, uploading: true));
    }
  }

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
      throw ReportException(_messageFor(e));
    }
  }

  String _messageFor(DioException e, {bool uploading = false}) {
    String? serverMessage;
    final body = e.response?.data;
    if (body is Map && body['error'] is Map) {
      final message = (body['error'] as Map)['message'];
      if (message is String) serverMessage = message;
    }
    final host = e.requestOptions.uri.host;
    if (uploading && host.contains('cloudinary')) {
      return 'Không tải được ảnh lên. Hãy kiểm tra mạng hoặc bỏ bớt ảnh rồi thử lại.';
    }
    return switch (e.response?.statusCode) {
      null => 'Không kết nối được máy chủ. Nội dung của bạn vẫn được giữ, hãy thử gửi lại khi có mạng.',
      401 => 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
      403 => 'Tài khoản của bạn không có quyền gửi báo cáo.',
      409 => 'Bạn đã có một phiếu đang xử lý cho tour này. Hãy chờ phản hồi từ bộ phận hỗ trợ.',
      422 || 400 => 'Thông tin chưa hợp lệ. Hãy mô tả rõ hơn sự cố (ít nhất 10 ký tự).',
      429 => 'Bạn đã gửi quá nhiều báo cáo, vui lòng thử lại sau.',
      503 => 'Chưa tải được ảnh lúc này (dịch vụ lưu ảnh chưa sẵn sàng). Bạn có thể gửi không kèm ảnh.',
      _ => serverMessage ?? 'Chưa gửi được báo cáo. Vui lòng thử lại.',
    };
  }
}
