import 'package:dio/dio.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/notification_models.dart';

class NotificationException implements Exception {
  final String message;
  const NotificationException(this.message);

  @override
  String toString() => message;
}

class NotificationsRepository {
  final ApiClient _api;

  NotificationsRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<List<AppNotification>> list({int page = 1, int limit = 30}) => _guard(() async {
        final res = await _api.get<Map<String, dynamic>>(
          ApiEndpoints.notifications,
          queryParameters: {'page': page, 'limit': limit},
        );
        return [for (final j in res.data!['data'] as List) AppNotification.fromJson(j as Map<String, dynamic>)];
      });

  Future<int> unreadCount() => _guard(() async {
        final res = await _api.get<Map<String, dynamic>>(ApiEndpoints.unreadNotificationsCount);
        return ((res.data!['data'] as Map<String, dynamic>)['unread'] as num?)?.toInt() ?? 0;
      });

  Future<void> markRead(String id) => _guard(() async {
        await _api.patch<Map<String, dynamic>>(ApiEndpoints.readNotification(id));
      });

  Future<void> markAllRead() => _guard(() async {
        await _api.post<Map<String, dynamic>>(ApiEndpoints.readAllNotifications);
      });

  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on DioException catch (e) {
      throw NotificationException(switch (e.response?.statusCode) {
        null => 'Không kết nối được máy chủ, kiểm tra mạng và thử lại.',
        401 => 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
        _ => 'Không tải được thông báo. Vui lòng thử lại.',
      });
    }
  }
}
