import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/notification_models.dart';

/// Dịch vụ lưu trữ và đồng bộ thông báo cục bộ persistent
class NotificationsStorage {
  static const _key = 'tripri_persistent_notifications_v1';
  static final NotificationsStorage _instance = NotificationsStorage._internal();
  factory NotificationsStorage() => _instance;
  NotificationsStorage._internal();

  /// ValueNotifier thông báo số lượng chưa đọc tĩnh (bền vững qua các chu kỳ hot-reload)
  static final ValueNotifier<int> unreadCountNotifier = ValueNotifier<int>(0);
  ValueNotifier<int> get unreadNotifier => unreadCountNotifier;

  Future<List<AppNotification>> getNotifications() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_key);

    if (jsonList == null) {
      // Dữ liệu ban đầu: Thông báo phiên bản mới và thông báo hệ thống
      final initialItems = [
        AppNotification(
          id: 'notif-system-welcome',
          type: 'SYSTEM_UPDATE',
          title: 'Chào mừng bạn đến với Tripri Travel! 🎉',
          body: 'Khám phá hàng trăm tour du lịch trọn gói độc quyền, thanh toán PayOS VietQR siêu tốc và nhận nhiều ưu đãi.',
          isRead: false,
          createdAt: DateTime.now().subtract(const Duration(hours: 1)),
        ),
        AppNotification(
          id: 'notif-version-100',
          type: 'SYSTEM_UPDATE',
          title: 'Cập nhật phiên bản mới 1.0.0',
          body: 'Giao diện mới được nâng cấp toàn diện, trải nghiệm đặt tour phong cách Airbnb cao cấp và theo dõi trạng thái đơn hàng thời gian thực.',
          isRead: false,
          createdAt: DateTime.now().subtract(const Duration(hours: 5)),
        ),
      ];
      await saveNotifications(initialItems);
      unreadNotifier.value = initialItems.where((n) => !n.isRead).length;
      return initialItems;
    }

    final items = jsonList
        .map((str) => AppNotification.fromJson(jsonDecode(str) as Map<String, dynamic>))
        .toList();
    unreadNotifier.value = items.where((n) => !n.isRead).length;
    return items;
  }

  Future<void> saveNotifications(List<AppNotification> items) async {
    final prefs = await SharedPreferences.getInstance();
    final list = items.map((item) => jsonEncode(item.toJson())).toList();
    await prefs.setStringList(_key, list);
    unreadNotifier.value = items.where((n) => !n.isRead).length;
  }

  Future<void> addNotification(AppNotification notification) async {
    final items = await getNotifications();
    // Tránh trùng lặp id
    items.removeWhere((item) => item.id == notification.id);
    items.insert(0, notification);
    await saveNotifications(items);
  }

  Future<int> getUnreadCount() async {
    final items = await getNotifications();
    final count = items.where((n) => !n.isRead).length;
    unreadNotifier.value = count;
    return count;
  }

  Future<void> markRead(String id) async {
    final items = await getNotifications();
    final updated = items.map((n) => n.id == id ? n.asRead() : n).toList();
    await saveNotifications(updated);
  }

  Future<void> markAllRead() async {
    final items = await getNotifications();
    final updated = items.map((n) => n.asRead()).toList();
    await saveNotifications(updated);
  }
}
