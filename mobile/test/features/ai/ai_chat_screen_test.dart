import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/ai/bloc/ai_repository.dart';
import 'package:mobile/features/ai/models/ai_models.dart';
import 'package:mobile/features/ai/screens/ai_chat_screen.dart';
import 'package:mobile/features/ai/storage/ai_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeAiRepo extends AiRepository {
  @override
  Future<AiReply> chat(String message, {String? conversationId}) async {
    return AiReply(
      conversationId: 'ai-test-conv-1',
      reply: AiMessage(
        role: AiRole.assistant,
        content: '**Gợi ý Lịch Trình Hạ Long 2 Ngày 1 Đêm**\n\n* **Buổi sáng:** Đi tàu\n* **Buổi trưa:** Dùng bữa',
        createdAt: DateTime.now(),
        status: AiMessageStatus.read,
      ),
    );
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('AiChatScreen UI & Storage tests', () {
    testWidgets('Renders MarkdownBody for AI responses with formatted bold text, timestamp and AI indicator', (tester) async {
      final repo = _FakeAiRepo();
      await tester.pumpWidget(
        MaterialApp(
          home: AiChatScreen(repository: repo),
        ),
      );
      await tester.pumpAndSettle();

      // Starts with welcome suggestions
      expect(find.text('Trợ lý AI'), findsOneWidget);
      expect(find.text('Xin chào! Mình là trợ lý du lịch Tripri.'), findsOneWidget);

      // Tap suggestion to ask
      await tester.tap(find.text('Gợi ý lịch trình Hạ Long 2 ngày 1 đêm'));
      await tester.pump();
      await tester.pumpAndSettle();

      // Check MarkdownBody exists
      expect(find.byType(MarkdownBody), findsOneWidget);

      // Verify timestamp & AI indicator
      expect(find.textContaining('Trợ lý AI ·'), findsOneWidget);
      expect(find.textContaining('Đã xem'), findsOneWidget);

      // Verify date chip 'Hôm nay'
      expect(find.text('Hôm nay'), findsOneWidget);
    });

    testWidgets('Restores chat history from AiStorage when opened again', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final storage = AiStorage();
      await storage.saveMessages(
        messages: [
          AiMessage(
            role: AiRole.user,
            content: 'Chào AI',
            createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
            status: AiMessageStatus.read,
          ),
          AiMessage(
            role: AiRole.assistant,
            content: 'Chào bạn, tôi có thể giúp gì cho chuyến du lịch của bạn?',
            createdAt: DateTime.now().subtract(const Duration(minutes: 4)),
            status: AiMessageStatus.read,
          ),
        ],
        conversationId: 'saved-conv-123',
      );

      final repo = _FakeAiRepo();
      await tester.pumpWidget(
        MaterialApp(
          home: AiChatScreen(repository: repo),
        ),
      );
      await tester.pumpAndSettle();

      // Restored messages are displayed directly!
      expect(find.text('Chào AI'), findsOneWidget);
      expect(find.textContaining('Trợ lý AI ·'), findsOneWidget);

      // Clear history action is available
      expect(find.byTooltip('Xóa lịch sử'), findsOneWidget);
    });

    testWidgets('Clear history removes messages after confirmation', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final storage = AiStorage();
      await storage.saveMessages(
        messages: [
          AiMessage(
            role: AiRole.user,
            content: 'Tin nhắn cũ',
            createdAt: DateTime.now(),
            status: AiMessageStatus.read,
          ),
        ],
      );

      final repo = _FakeAiRepo();
      await tester.pumpWidget(
        MaterialApp(
          home: AiChatScreen(repository: repo),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Tin nhắn cũ'), findsOneWidget);

      // Tap delete button
      await tester.tap(find.byTooltip('Xóa lịch sử'));
      await tester.pumpAndSettle();

      // Confirmation dialog pops up
      expect(find.text('Xóa lịch sử trò chuyện?'), findsOneWidget);
      await tester.tap(find.text('Xóa'));
      await tester.pumpAndSettle();

      // Returns to welcome screen
      expect(find.text('Xin chào! Mình là trợ lý du lịch Tripri.'), findsOneWidget);
    });
  });
}
