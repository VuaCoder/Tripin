import 'package:dio/dio.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/ai_models.dart';

/// Lỗi gọi trợ lý AI, đã rút gọn thành thông báo hiển thị cho người dùng.
class AiException implements Exception {
  final String message;
  const AiException(this.message);

  @override
  String toString() => message;
}

class AiRepository {
  final ApiClient _api;

  AiRepository({ApiClient? api}) : _api = api ?? ApiClient();

  /// `POST /ai/chat`; bỏ `conversationId` để bắt đầu cuộc trò chuyện mới.
  Future<AiReply> chat(String message, {String? conversationId}) async {
    try {
      final res = await _api.post<Map<String, dynamic>>(
        ApiEndpoints.aiChat,
        data: {'message': message, 'conversationId': ?conversationId},
        // Trợ lý có thể trả lời chậm hơn các API khác.
        options: Options(receiveTimeout: const Duration(seconds: 45)),
      );
      return AiReply.fromJson(res.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw AiException(switch (e.response?.statusCode) {
        null => 'Mất kết nối. Kiểm tra mạng rồi thử lại.',
        401 => 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
        403 => 'Tài khoản của bạn chưa được dùng trợ lý AI.',
        429 => 'Bạn hỏi hơi nhanh, hãy đợi một chút rồi thử lại.',
        503 => 'Trợ lý AI đang tạm thời không khả dụng. Vui lòng thử lại sau.',
        _ => 'Trợ lý chưa trả lời được. Vui lòng thử lại.',
      });
    }
  }
}
