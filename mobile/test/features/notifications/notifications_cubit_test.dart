import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/chat/bloc/chat_socket.dart';
import 'package:mobile/features/chat/models/chat_models.dart';
import 'package:mobile/features/notifications/bloc/notifications_cubit.dart';
import 'package:mobile/features/notifications/bloc/notifications_repository.dart';
import 'package:mobile/features/notifications/models/notification_models.dart';

class _Socket implements ChatSocket {
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

AppNotification _n(String id, String type, {bool read = false}) => AppNotification(
      id: id,
      type: type,
      title: 'Tiêu đề $id',
      body: 'Nội dung $id',
      isRead: read,
      createdAt: DateTime(2026, 10, 29),
    );

class _Repo extends NotificationsRepository {
  List<AppNotification> items = [_n('n1', 'BOOKING_CONFIRMED')];
  int unread = 1;
  final List<String> markedRead = [];

  @override
  Future<List<AppNotification>> list({int page = 1, int limit = 30}) async => items;
  @override
  Future<int> unreadCount() async => unread;
  @override
  Future<void> markRead(String id) async => markedRead.add(id);
  @override
  Future<void> markAllRead() async => unread = 0;
}

Map<String, dynamic> _payload(String id, String type) => {
      'id': id,
      'type': type,
      'title': 'Tin nhắn mới',
      'body': 'HDV vừa nhắn cho bạn',
      'isRead': false,
      'createdAt': '2026-10-29T10:00:00.000Z',
    };

Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

void main() {
  test('a live notification shows up at the top and raises the unread count (AC5)', () async {
    final socket = _Socket();
    final cubit = NotificationsCubit(repository: _Repo(), socket: socket);
    await cubit.start();
    expect(cubit.state.unread, 1);

    socket.notifs.add(_payload('n2', 'CHAT_MESSAGE'));
    await settle();
    expect(cubit.state.items.first.id, 'n2');
    expect(cubit.state.items.first.isChat, isTrue);
    expect(cubit.state.unread, 2);
    expect(cubit.state.latest?.id, 'n2');
    await cubit.close();
  });

  test('the same notification pushed twice is counted once', () async {
    final socket = _Socket();
    final cubit = NotificationsCubit(repository: _Repo(), socket: socket);
    await cubit.start();
    socket.notifs.add(_payload('n9', 'BOOKING_CANCELLED'));
    socket.notifs.add(_payload('n9', 'BOOKING_CANCELLED'));
    await settle();
    expect(cubit.state.unread, 2);
    expect(cubit.state.items.where((n) => n.id == 'n9').length, 1);
    await cubit.close();
  });

  test('marking one read lowers the badge and tells the server; read-all clears it', () async {
    final repo = _Repo();
    final cubit = NotificationsCubit(repository: repo, socket: _Socket());
    await cubit.start();
    await cubit.markRead(cubit.state.items.single);
    expect(cubit.state.unread, 0);
    expect(cubit.state.items.single.isRead, isTrue);
    expect(repo.markedRead, ['n1']);

    await cubit.markAllRead();
    expect(cubit.state.unread, 0);
    await cubit.close();
  });

  test('catches up after the socket reconnects', () async {
    final socket = _Socket();
    final repo = _Repo();
    final cubit = NotificationsCubit(repository: repo, socket: socket);
    await cubit.start();
    repo.items = [_n('n3', 'BOOKING_CONFIRMED'), ...repo.items];
    repo.unread = 2;
    socket.conn.add(true);
    await settle();
    expect(cubit.state.items.first.id, 'n3');
    expect(cubit.state.unread, 2);
    await cubit.close();
  });
}
