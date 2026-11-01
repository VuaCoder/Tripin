import 'package:dio/dio.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/notification_models.dart';
import '../services/notifications_storage.dart';

class NotificationException implements Exception {
  final String message;
  const NotificationException(this.message);

  @override
  String toString() => message;
}

class NotificationsRepository {
  final ApiClient _api;
  final NotificationsStorage _storage;

  NotificationsRepository({ApiClient? api, NotificationsStorage? storage})
      : _api = api ?? ApiClient(),
        _storage = storage ?? NotificationsStorage();

  Future<List<AppNotification>> list({int page = 1, int limit = 30}) async {
    final localItems = await _storage.getNotifications();
    try {
      final res = await _api.get<Map<String, dynamic>>(
        ApiEndpoints.notifications,
        queryParameters: {'page': page, 'limit': limit},
      );
      final rawData = res.data?['data'];
      if (rawData is List) {
        final remoteItems = [for (final j in rawData) AppNotification.fromJson(j as Map<String, dynamic>)];
        final combined = [...localItems];
        for (final r in remoteItems) {
          if (!combined.any((item) => item.id == r.id)) {
            combined.add(r);
          }
        }
        combined.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        return combined;
      }
      return localItems;
    } catch (_) {
      return localItems;
    }
  }

  Future<int> unreadCount() async {
    final localUnread = await _storage.getUnreadCount();
    try {
      final res = await _api.get<Map<String, dynamic>>(ApiEndpoints.unreadNotificationsCount);
      final remote = ((res.data?['data'] as Map<String, dynamic>?)?['unread'] as num?)?.toInt() ?? 0;
      return localUnread + remote;
    } catch (_) {
      return localUnread;
    }
  }

  Future<void> markRead(String id) async {
    await _storage.markRead(id);
    try {
      await _api.patch<Map<String, dynamic>>(ApiEndpoints.readNotification(id));
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    await _storage.markAllRead();
    try {
      await _api.post<Map<String, dynamic>>(ApiEndpoints.readAllNotifications);
    } catch (_) {}
  }
}
