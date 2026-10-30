import 'package:dio/dio.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/chat_models.dart';

/// Lỗi nghiệp vụ đã rút gọn thành thông báo hiển thị cho người dùng.
class ChatException implements Exception {
  final String message;

  /// true khi không tới được máy chủ (để chuyển sang chế độ chờ kết nối lại).
  final bool offline;
  const ChatException(this.message, {this.offline = false});

  @override
  String toString() => message;
}

/// Gọi REST của `/chat`. Socket.IO chỉ lo phần giao tiếp tức thời.
class ChatRepository {
  final ApiClient _api;

  ChatRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<List<Conversation>> listConversations({int page = 1, int limit = 30}) => _guard(() async {
        final res = await _api.get<Map<String, dynamic>>(
          ApiEndpoints.conversations,
          queryParameters: {'page': page, 'limit': limit},
        );
        return [for (final j in res.data!['data'] as List) Conversation.fromJson(j as Map<String, dynamic>)];
      });

  /// `before` là id của tin cũ nhất đang có để lấy trang trước nữa.
  Future<MessagesPage> listMessages(String conversationId, {String? before, int limit = 30}) => _guard(() async {
        final res = await _api.get<Map<String, dynamic>>(
          ApiEndpoints.conversationMessages(conversationId),
          queryParameters: {'limit': limit, 'before': ?before},
        );
        final data = res.data!['data'] as Map<String, dynamic>;
        return MessagesPage(
          [for (final j in data['items'] as List) ChatMessage.fromJson(j as Map<String, dynamic>)],
          data['hasMore'] as bool? ?? false,
        );
      });

  /// Mở (hoặc lấy lại) cuộc trò chuyện với HDV phụ trách tour mà khách đã đặt.
  Future<Conversation> startWithGuideOfTour(String tourId) => _guard(() async {
        final tour = await _api.get<Map<String, dynamic>>(ApiEndpoints.tourDetail(tourId));
        final guide = (tour.data!['data'] as Map<String, dynamic>)['guide'] as Map<String, dynamic>?;
        final guideId = guide?['id'] as String?;
        if (guideId == null) {
          throw const ChatException('Tour này chưa có hướng dẫn viên phụ trách để nhắn tin.');
        }
        final res = await _api.post<Map<String, dynamic>>(
          ApiEndpoints.conversations,
          data: {'participantId': guideId, 'tourId': tourId},
        );
        return Conversation.fromJson(res.data!['data'] as Map<String, dynamic>);
      });

  Future<ChatMessage> sendMessage(String conversationId, String text) => _guard(() async {
        final res = await _api.post<Map<String, dynamic>>(
          ApiEndpoints.conversationMessages(conversationId),
          data: {'text': text},
        );
        return ChatMessage.fromJson(res.data!['data'] as Map<String, dynamic>);
      });

  Future<void> markRead(String conversationId) => _guard(() async {
        await _api.post<Map<String, dynamic>>(ApiEndpoints.conversationRead(conversationId));
      });

  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on ChatException {
      rethrow;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == null) {
        throw const ChatException('Không kết nối được máy chủ, kiểm tra mạng và thử lại.', offline: true);
      }
      final body = e.response?.data;
      String? serverMessage;
      if (body is Map && body['error'] is Map) {
        final message = (body['error'] as Map)['message'];
        if (message is String) serverMessage = message;
      }
      throw ChatException(switch (status) {
        401 => 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
        403 => 'Bạn không có quyền dùng tính năng trò chuyện này.',
        404 => 'Không tìm thấy cuộc trò chuyện.',
        429 => 'Bạn gửi quá nhanh, vui lòng thử lại sau giây lát.',
        _ => serverMessage ?? 'Đã có lỗi xảy ra, vui lòng thử lại.',
      });
    }
  }
}
