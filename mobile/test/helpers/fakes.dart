import 'dart:async';
import 'package:mobile/features/chat/bloc/chat_repository.dart';
import 'package:mobile/features/chat/bloc/chat_socket.dart';
import 'package:mobile/features/chat/models/chat_models.dart';
import 'package:mobile/features/notifications/bloc/notifications_repository.dart';
import 'package:mobile/features/notifications/models/notification_models.dart';

/// Kênh realtime giả: không mở kết nối, cho phép test đẩy sự kiện vào.
class FakeChatSocket implements ChatSocket {
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
  void dispose() {}
}

class FakeNotificationsRepository extends NotificationsRepository {
  int unread;
  FakeNotificationsRepository({this.unread = 0});

  @override
  Future<List<AppNotification>> list({int page = 1, int limit = 30}) async => const [];
  @override
  Future<int> unreadCount() async => unread;
}

class FakeChatRepository extends ChatRepository {
  @override
  Future<List<Conversation>> listConversations({int page = 1, int limit = 30}) async => const [];
}
