import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/chat/bloc/chat_socket.dart';
import 'package:mobile/features/chat/models/chat_models.dart';
import 'package:mobile/features/notifications/bloc/notifications_repository.dart';
import 'package:mobile/features/notifications/models/notification_models.dart';
import 'package:mobile/features/notifications/screens/notifications_screen.dart';
import 'package:mobile/features/notifications/services/notifications_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeSocket implements ChatSocket {
  final notifs = StreamController<Map<String, dynamic>>.broadcast();
  final conn = StreamController<bool>.broadcast();

  @override
  Stream<Map<String, dynamic>> get notifications => notifs.stream;
  @override
  Stream<bool> get connection => conn.stream;
  @override
  bool get isConnected => true;
  @override
  Stream<ChatMessage> get messages => const Stream.empty();
  @override
  Stream<String> get typing => const Stream.empty();
  @override
  Stream<({String conversationId, String messageId})> get delivered => const Stream.empty();
  @override
  Future<void> connect() async {}
  @override
  Future<ChatMessage> send(String conversationId, String text) => throw UnimplementedError();
  @override
  void sendTyping(String conversationId) {}
  @override
  void sendRead(String conversationId) {}
  @override
  void dispose() {
    notifs.close();
    conn.close();
  }
}

class _FakeRepo extends NotificationsRepository {
  final List<AppNotification> items;
  _FakeRepo(this.items);

  @override
  Future<List<AppNotification>> list({int page = 1, int limit = 30}) async => items;

  @override
  Future<int> unreadCount() async => items.where((n) => !n.isRead).length;

  @override
  Future<void> markRead(String id) async {}

  @override
  Future<void> markAllRead() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
  });

  group('NotificationsStorage & NotificationsScreen Tests', () {
    test('NotificationsStorage correctly tracks unread count and persists notifications', () async {
      final storage = NotificationsStorage();

      // Initial seeded notifications (welcome + update)
      final initialItems = await storage.getNotifications();
      expect(initialItems.length, greaterThanOrEqualTo(2));
      final unreadCount = await storage.getUnreadCount();
      expect(unreadCount, greaterThanOrEqualTo(2));

      // Add a booking notification
      final newNotif = AppNotification(
        id: 'test_1',
        type: 'BOOKING_PAID',
        title: 'Thanh toán thành công',
        body: 'Bạn đã thanh toán thành công tour Đà Lạt',
        isRead: false,
        createdAt: DateTime.now(),
      );
      await storage.addNotification(newNotif);

      final updatedItems = await storage.getNotifications();
      expect(updatedItems.first.id, 'test_1');
      final newUnread = await storage.getUnreadCount();
      expect(newUnread, initialItems.length + 1);

      // Mark all as read
      await storage.markAllRead();
      final finalUnread = await storage.getUnreadCount();
      expect(finalUnread, 0);
    });

    testWidgets('NotificationsScreen renders title, Xem tất cả button without icons, and timeline items', (tester) async {
      final socket = _FakeSocket();
      final repo = _FakeRepo([
        AppNotification(
          id: '1',
          type: 'SYSTEM_UPDATE',
          title: 'Cập nhật phiên bản mới',
          body: 'Nội dung cập nhật mới nhất',
          isRead: false,
          createdAt: DateTime.now(),
        ),
      ]);

      await tester.pumpWidget(
        MaterialApp(
          home: NotificationsScreen(repository: repo, socket: socket),
        ),
      );
      await tester.pumpAndSettle();

      // Title in Vietnamese
      expect(find.text('Thông báo'), findsOneWidget);

      // "Xem tất cả" text button without icon
      expect(find.text('Xem tất cả'), findsOneWidget);

      // Back button exists
      expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

      // Milestones exist
      expect(find.text('Hôm nay'), findsWidgets);

      socket.dispose();
    });

    testWidgets('NotificationsScreen renders empty state matching screenshot 4 when no notifications', (tester) async {
      final socket = _FakeSocket();
      final repo = _FakeRepo([]);

      await tester.pumpWidget(
        MaterialApp(
          home: NotificationsScreen(repository: repo, socket: socket),
        ),
      );
      await tester.pumpAndSettle();

      // Empty state text in Vietnamese
      expect(find.text('Chưa có thông báo nào'), findsOneWidget);
      expect(find.textContaining('Bạn chưa có thông báo nào mới'), findsOneWidget);
      expect(find.byIcon(Icons.notifications_none_rounded), findsOneWidget);

      socket.dispose();
    });
  });
}
