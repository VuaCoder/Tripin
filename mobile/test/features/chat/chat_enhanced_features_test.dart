import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/ai/screens/ai_chat_screen.dart';
import 'package:mobile/features/chat/bloc/chat_repository.dart';
import 'package:mobile/features/chat/bloc/chat_socket.dart';
import 'package:mobile/features/chat/models/chat_models.dart';
import 'package:mobile/features/chat/screens/chat_screen.dart';
import 'package:mobile/features/chat/screens/conversations_screen.dart';

class _FakeSocket implements ChatSocket {
  final _conn = StreamController<bool>.broadcast();
  final _msgs = StreamController<ChatMessage>.broadcast();
  final _typing = StreamController<String>.broadcast();
  final _delivered = StreamController<({String conversationId, String messageId})>.broadcast();
  final _notifs = StreamController<Map<String, dynamic>>.broadcast();

  @override
  Stream<bool> get connection => _conn.stream;
  @override
  bool get isConnected => true;
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
    return ChatMessage(
      id: 'sent-1',
      conversationId: conversationId,
      senderId: 'me',
      text: text,
      isMine: true,
      createdAt: DateTime.now(),
      status: MessageStatus.sent,
    );
  }

  @override
  void sendTyping(String conversationId) {}
  @override
  void sendRead(String conversationId) {}
  @override
  void dispose() {}
}

class _MockRepo extends ChatRepository {
  final List<Conversation> list;
  final List<ChatMessage> messages;

  _MockRepo({this.list = const [], this.messages = const []});

  @override
  Future<List<Conversation>> listConversations({int page = 1, int limit = 30}) async => list;

  @override
  Future<MessagesPage> listMessages(String conversationId, {String? before, int limit = 30}) async =>
      MessagesPage(messages, false);
}

void main() {
  setUp(() {
    ConversationsScreen.resetCache();
  });

  group('Enhanced Chat Features & AI Integration Tests', () {
    testWidgets('ConversationsScreen renders AI Assistant item at top and navigates to AiChatScreen', (tester) async {
      final repo = _MockRepo(list: [
        Conversation(
          id: 'c1',
          counterpart: const Counterpart(id: 'g1', fullName: 'Lê Hướng Dẫn', role: 'TOUR_GUIDE'),
          lastText: 'Hẹn gặp bạn sáng mai.',
          lastSenderId: 'g1',
          lastSentAt: DateTime.now(),
          unreadCount: 0,
          updatedAt: DateTime.now(),
        ),
      ]);

      await tester.pumpWidget(
        MaterialApp(
          home: ConversationsScreen(repository: repo),
        ),
      );
      await tester.pumpAndSettle();

      // 1. Trợ lý AI Tripri xuất hiện ở ngay trên cùng danh sách tin nhắn
      expect(find.byKey(const Key('ai-assistant-conversation-item')), findsOneWidget);
      expect(find.text('Trợ lý AI Tripri'), findsOneWidget);
      expect(find.textContaining('Trợ lý AI:'), findsOneWidget);

      // 2. Bấm vào mở AiChatScreen
      await tester.tap(find.byKey(const Key('ai-assistant-conversation-item')));
      await tester.pumpAndSettle();

      expect(find.byType(AiChatScreen), findsOneWidget);
    });

    testWidgets('ConversationsScreen displays "Bạn:" vs "Tên họ:", unread dot, and "5+ tin nhắn mới"', (tester) async {
      final repo = _MockRepo(list: [
        // Tin nhắn đối phương gửi và có trên 5 tin chưa đọc
        Conversation(
          id: 'c1',
          counterpart: const Counterpart(id: 'g1', fullName: 'Trần Văn Guide', role: 'TOUR_GUIDE'),
          lastText: 'Xe đã tới điểm đón rồi nhé!',
          lastSenderId: 'g1',
          lastSentAt: DateTime.now(),
          unreadCount: 8, // > 5 tin nhắn
          updatedAt: DateTime.now(),
        ),
        // Tin nhắn do chính người dùng gửi (lastSenderId != counterpartId)
        Conversation(
          id: 'c2',
          counterpart: const Counterpart(id: 'g2', fullName: 'Phạm Thị Hướng Dẫn', role: 'TOUR_GUIDE'),
          lastText: 'Em đã chuẩn bị xong rồi ạ.',
          lastSenderId: 'my-user-id',
          lastSentAt: DateTime.now().subtract(const Duration(minutes: 15)),
          unreadCount: 0,
          updatedAt: DateTime.now().subtract(const Duration(minutes: 15)),
        ),
      ]);

      await tester.pumpWidget(
        MaterialApp(
          home: ConversationsScreen(repository: repo),
        ),
      );
      await tester.pumpAndSettle();

      // Hiển thị tên người gửi trong nội dung preview
      expect(find.text('Trần Văn Guide: Xe đã tới điểm đón rồi nhé!'), findsOneWidget);
      expect(find.text('Bạn: Em đã chuẩn bị xong rồi ạ.'), findsOneWidget);

      // Dấu chấm xanh thông báo tin chưa đọc
      expect(find.byKey(const Key('unread-dot-c1')), findsOneWidget);

      // Khi trên 5 tin chưa đọc, hiển thị nội dung "5+ tin nhắn mới"
      expect(find.text('5+ tin nhắn mới'), findsOneWidget);
    });

    testWidgets('ChatScreen displays timeline date chip (Hôm nay), bubble messages and status (Đã xem, Đã nhận, Đã gửi)', (tester) async {
      final now = DateTime.now();
      final messages = [
        // Tin của mình đã được xem
        ChatMessage(
          id: 'm1',
          conversationId: 'c1',
          senderId: 'my-user-id',
          text: 'Dạ vâng, em cảm ơn anh.',
          isMine: true,
          createdAt: now,
          status: MessageStatus.read,
        ),
        // Tin của đối phương
        ChatMessage(
          id: 'm2',
          conversationId: 'c1',
          senderId: 'g1',
          text: 'Mai đoàn mình tập trung 6h30 nhé.',
          isMine: false,
          createdAt: now.subtract(const Duration(minutes: 5)),
          status: MessageStatus.read,
        ),
        // Tin của mình đã nhận
        ChatMessage(
          id: 'm3',
          conversationId: 'c1',
          senderId: 'my-user-id',
          text: 'Anh ơi cho em hỏi địa điểm tập trung ở đâu?',
          isMine: true,
          createdAt: now.subtract(const Duration(minutes: 10)),
          status: MessageStatus.delivered,
        ),
        // Tin của mình đã gửi
        ChatMessage(
          id: 'm4',
          conversationId: 'c1',
          senderId: 'my-user-id',
          text: 'Chào anh hướng dẫn viên!',
          isMine: true,
          createdAt: now.subtract(const Duration(minutes: 20)),
          status: MessageStatus.sent,
        ),
      ];

      final repo = _MockRepo(messages: messages);
      final socket = _FakeSocket();

      await tester.pumpWidget(
        MaterialApp(
          home: ChatScreen(
            conversationId: 'c1',
            title: 'Trần Văn Guide',
            repository: repo,
            socket: socket,
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // 1. Mốc thời gian ngày "Hôm nay"
      expect(find.text('Hôm nay'), findsOneWidget);

      // 2. Nội dung các bubble messages
      expect(find.text('Dạ vâng, em cảm ơn anh.'), findsOneWidget);
      expect(find.text('Mai đoàn mình tập trung 6h30 nhé.'), findsOneWidget);
      expect(find.text('Anh ơi cho em hỏi địa điểm tập trung ở đâu?'), findsOneWidget);
      expect(find.text('Chào anh hướng dẫn viên!'), findsOneWidget);

      // 3. Tình trạng tin nhắn (Đã xem, Đã nhận, Đã gửi)
      expect(find.textContaining('Đã xem'), findsOneWidget);
      expect(find.textContaining('Đã nhận'), findsOneWidget);
      expect(find.textContaining('Đã gửi'), findsOneWidget);
    });
  });
}
