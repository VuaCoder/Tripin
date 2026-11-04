import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/chat/bloc/chat_cubit.dart';
import 'package:mobile/features/chat/bloc/chat_repository.dart';
import 'package:mobile/features/chat/bloc/chat_socket.dart';
import 'package:mobile/features/chat/models/chat_models.dart';

ChatMessage msg(String id, String text, {bool mine = false, String conv = 'c1'}) => ChatMessage(
      id: id,
      conversationId: conv,
      senderId: mine ? 'me' : 'peer',
      text: text,
      isMine: mine,
      createdAt: DateTime(2026, 10, 29, 10),
      status: MessageStatus.sent,
    );

class FakeSocket implements ChatSocket {
  final _conn = StreamController<bool>.broadcast();
  final _msgs = StreamController<ChatMessage>.broadcast();
  final _typing = StreamController<String>.broadcast();
  final _delivered = StreamController<({String conversationId, String messageId})>.broadcast();
  final _notifs = StreamController<Map<String, dynamic>>.broadcast();

  bool online = true;
  int sent = 0;
  int reads = 0;

  @override
  Stream<bool> get connection => _conn.stream;
  @override
  bool get isConnected => online;
  @override
  Stream<ChatMessage> get messages => _msgs.stream;
  @override
  Stream<String> get typing => _typing.stream;
  @override
  Stream<({String conversationId, String messageId})> get delivered => _delivered.stream;
  @override
  Stream<Map<String, dynamic>> get notifications => _notifs.stream;

  @override
  Future<void> connect() async {}

  @override
  Future<ChatMessage> send(String conversationId, String text) async {
    if (!online) throw StateError('offline');
    sent++;
    return msg('srv-$sent', text, mine: true, conv: conversationId);
  }

  @override
  void sendTyping(String conversationId) {}
  @override
  void sendRead(String conversationId) => reads++;
  @override
  void dispose() {}

  void pushMessage(ChatMessage m) => _msgs.add(m);
  void pushTyping(String id) => _typing.add(id);
  void pushDelivered(String id) => _delivered.add((conversationId: 'c1', messageId: id));
  void setConnected(bool v) {
    online = v;
    _conn.add(v);
  }
}

class FakeRepo extends ChatRepository {
  List<ChatMessage> history;
  bool failSend = false;
  int restSends = 0;

  FakeRepo(this.history);

  @override
  Future<MessagesPage> listMessages(String conversationId, {String? before, int limit = 30}) async =>
      MessagesPage(history, false);

  @override
  Future<ChatMessage> sendMessage(String conversationId, String text) async {
    if (failSend) throw const ChatException('Không kết nối được máy chủ', offline: true);
    restSends++;
    return msg('rest-$restSends', text, mine: true, conv: conversationId);
  }

  @override
  Future<void> markRead(String conversationId) async {}
}

Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

void main() {
  late FakeSocket socket;
  late FakeRepo repo;
  late ChatCubit cubit;

  setUp(() async {
    socket = FakeSocket();
    repo = FakeRepo([msg('m2', 'Chào bạn'), msg('m1', 'Xin chào', mine: true)]);
    cubit = ChatCubit(
      conversationId: 'c1',
      repository: repo,
      socket: socket,
      typingTimeout: const Duration(milliseconds: 80),
    );
    await cubit.start();
  });

  tearDown(() => cubit.close());

  test('loads history newest first and marks the conversation read', () {
    expect(cubit.state.loading, isFalse);
    expect(cubit.state.messages.map((m) => m.id), ['m2', 'm1']);
    expect(socket.reads, greaterThan(0));
  });

  test('a message pushed over the socket appears immediately without reloading (AC2)', () async {
    socket.pushMessage(msg('m3', 'Mình đang ở bến xe'));
    await settle();
    expect(cubit.state.messages.first.text, 'Mình đang ở bến xe');
    expect(cubit.state.messages.length, 3);
  });

  test('the same message delivered twice is shown once', () async {
    socket.pushMessage(msg('m3', 'A'));
    socket.pushMessage(msg('m3', 'A'));
    await settle();
    expect(cubit.state.messages.where((m) => m.id == 'm3').length, 1);
  });

  test('a sent message is saved through the socket and not duplicated by its echo', () async {
    final sending = cubit.send('  Em đã tới  ');
    socket.pushMessage(msg('srv-1', 'Em đã tới', mine: true)); // echo to the sender's own sockets
    await sending;
    await settle();
    final mine = cubit.state.messages.where((m) => m.text == 'Em đã tới').toList();
    expect(mine.length, 1);
    expect(mine.single.id, 'srv-1');
    expect(mine.single.status, MessageStatus.sent);
  });

  test('falls back to REST when the socket is down so the message is not lost (AC1)', () async {
    socket.setConnected(false);
    await cubit.send('Mất mạng nhưng vẫn gửi');
    expect(repo.restSends, 1);
    expect(cubit.state.messages.first.id, 'rest-1');
    expect(cubit.state.connected, isFalse);
  });

  test('a failed send can be retried', () async {
    socket.setConnected(false);
    repo.failSend = true;
    await cubit.send('Thử lại sau');
    final failed = cubit.state.messages.first;
    expect(failed.status, MessageStatus.failed);

    repo.failSend = false;
    await cubit.retry(failed.id);
    expect(cubit.state.messages.first.status, MessageStatus.sent);
    expect(cubit.state.messages.where((m) => m.text == 'Thử lại sau').length, 1);
  });

  test('messages missed while offline are recovered on reconnect (AC1)', () async {
    socket.setConnected(false);
    await settle();
    repo.history = [msg('m4', 'Tin lỡ 2'), msg('m3', 'Tin lỡ 1'), ...repo.history];
    socket.setConnected(true);
    await settle();
    expect(cubit.state.connected, isTrue);
    expect(cubit.state.messages.map((m) => m.id), ['m4', 'm3', 'm2', 'm1']);
  });

  test('typing indicator shows then clears itself', () async {
    socket.pushTyping('c1');
    await settle();
    expect(cubit.state.peerTyping, isTrue);
    await Future<void>.delayed(const Duration(milliseconds: 120));
    expect(cubit.state.peerTyping, isFalse);
  });

  test('typing in another conversation is ignored', () async {
    socket.pushTyping('other');
    await settle();
    expect(cubit.state.peerTyping, isFalse);
  });

  test('delivery receipt upgrades "sent" to "delivered"', () async {
    await cubit.send('Có nhận được không');
    final id = cubit.state.messages.first.id;
    socket.pushDelivered(id);
    await settle();
    expect(cubit.state.messages.first.status, MessageStatus.delivered);
  });

  test('messages that failed while offline are re-sent automatically after reconnecting (AC1)', () async {
    socket.setConnected(false);
    repo.failSend = true;
    await cubit.send('Gửi khi mất mạng');
    expect(cubit.state.messages.first.status, MessageStatus.failed);

    repo.failSend = false;
    socket.setConnected(true);
    await Future<void>.delayed(const Duration(milliseconds: 80));
    final sent = cubit.state.messages.where((m) => m.text == 'Gửi khi mất mạng').toList();
    expect(sent.length, 1);
    expect(sent.single.status, MessageStatus.sent);
  });
}
