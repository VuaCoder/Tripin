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

  Future<({List<AiConversationSummary> items, int totalPages})>
  listConversations({int page = 1}) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/ai/conversations',
      queryParameters: {'page': page, 'limit': 20},
    );
    return (
      items: (response.data!['data'] as List)
          .map(
            (item) =>
                AiConversationSummary.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      totalPages: (response.data!['meta']['totalPages'] as num).toInt(),
    );
  }

  Future<List<AiMessage>> getConversation(String id) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/ai/conversations/$id',
    );
    return (response.data!['data']['messages'] as List)
        .map((item) => AiMessage.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> markRead(String id, String throughMessageId) async {
    await _api.post(
      '/ai/conversations/$id/read',
      data: {'throughMessageId': throughMessageId},
    );
  }

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
