import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/constants/app_colors.dart';
import 'package:mobile/features/chat/bloc/chat_repository.dart';
import 'package:mobile/features/chat/models/chat_models.dart';
import 'package:mobile/features/chat/screens/conversations_screen.dart';
import 'package:mobile/features/chat/widgets/conversations_shimmer_loading.dart';

class _FakeChatRepo extends ChatRepository {
  final List<Conversation> stub;
  _FakeChatRepo(this.stub);

  @override
  Future<List<Conversation>> listConversations({int page = 1, int limit = 30}) async => stub;
}

class _DelayedChatRepo extends ChatRepository {
  final Future<List<Conversation>> future;
  _DelayedChatRepo(this.future);

  @override
  Future<List<Conversation>> listConversations({int page = 1, int limit = 30}) async => future;
}

void main() {
  group('ConversationsScreen Tests (Image 3 Design & Messenger Style)', () {
    setUp(() {
      ConversationsScreen.resetCache();
    });

    testWidgets('Renders Empty State matching Screenshot 3 with 3D bubbles and green button', (tester) async {
      bool exploreTapped = false;
      final repo = _FakeChatRepo([]);

      await tester.pumpWidget(
        MaterialApp(
          home: ConversationsScreen(
            repository: repo,
            onExploreTap: () => exploreTapped = true,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tiêu đề "Tin nhắn" & Nút search tròn
      expect(find.text('Tin nhắn'), findsOneWidget);
      expect(find.byKey(const Key('search-button')), findsOneWidget);

      // Nút settings không xuất hiện (đã bỏ theo yêu cầu)
      expect(find.byIcon(Icons.settings), findsNothing);

      // Màn hình trống đã được bỏ theo yêu cầu, Trợ lý AI luôn hiện ngay đầu danh sách
      expect(find.text('Chưa có cuộc trò chuyện nào'), findsNothing);
      expect(find.byKey(const Key('ai-assistant-conversation-item')), findsOneWidget);
      expect(find.text('Trợ lý AI Tripri'), findsOneWidget);

      // Không có phần Past conversations theo yêu cầu
      expect(find.text('Past conversations'), findsNothing);
      expect(find.text('Cuộc trò chuyện trước đây'), findsNothing);
    });

    testWidgets('Expanding Search bar opens on tap and closes on close button', (tester) async {
      final repo = _FakeChatRepo([]);

      await tester.pumpWidget(
        MaterialApp(
          home: ConversationsScreen(repository: repo),
        ),
      );
      await tester.pumpAndSettle();

      // Bấm nút tìm kiếm tròn
      await tester.tap(find.byKey(const Key('search-button')));
      await tester.pumpAndSettle();

      // Thanh tìm kiếm mở rộng với ô TextField gợi ý
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('Tìm kiếm tin nhắn, hướng dẫn viên...'), findsOneWidget);
      expect(find.byKey(const Key('close-search-button')), findsOneWidget);

      // Bấm nút đóng tìm kiếm
      await tester.tap(find.byKey(const Key('close-search-button')));
      await tester.pumpAndSettle();

      // Quay lại tiêu đề bình thường
      expect(find.text('Tin nhắn'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });

    testWidgets('Renders Messenger-style conversations with avatar, online dot and unread badge', (tester) async {
      final conversations = [
        Conversation(
          id: 'c1',
          counterpart: const Counterpart(
            id: 'g1',
            fullName: 'Nguyễn Văn Hướng Dẫn',
            role: 'TOUR_GUIDE',
          ),
          lastText: 'Chào bạn, mai hẹn 7h sáng tại bến xe nhé!',
          lastSentAt: DateTime.now(),
          unreadCount: 2,
          updatedAt: DateTime.now(),
        ),
        Conversation(
          id: 'c2',
          counterpart: const Counterpart(
            id: 'g2',
            fullName: 'Trần Thị Hướng Dẫn',
            role: 'TOUR_GUIDE',
          ),
          lastText: 'Cảm ơn bạn đã tham gia tour.',
          lastSentAt: DateTime.now().subtract(const Duration(days: 1)),
          unreadCount: 0,
          updatedAt: DateTime.now().subtract(const Duration(days: 1)),
        ),
      ];

      final repo = _FakeChatRepo(conversations);

      await tester.pumpWidget(
        MaterialApp(
          home: ConversationsScreen(repository: repo),
        ),
      );
      await tester.pumpAndSettle();

      // Hiển thị tên người gửi và tin nhắn gần nhất
      expect(find.text('Nguyễn Văn Hướng Dẫn'), findsOneWidget);
      expect(find.text('Chào bạn, mai hẹn 7h sáng tại bến xe nhé!'), findsOneWidget);
      expect(find.text('Trần Thị Hướng Dẫn'), findsOneWidget);

      // Huy hiệu chưa đọc
      expect(find.byKey(const Key('unread-c1')), findsOneWidget);
      expect(find.text('2'), findsOneWidget);

      // Tìm kiếm lọc hội thoại thời gian thực
      await tester.tap(find.byKey(const Key('search-button')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'Nguyễn');
      await tester.pumpAndSettle();

      expect(find.text('Nguyễn Văn Hướng Dẫn'), findsOneWidget);
      expect(find.text('Trần Thị Hướng Dẫn'), findsNothing);
    });

    testWidgets('Renders ConversationsShimmerLoading instead of CircularProgressIndicator while fetching', (tester) async {
      final completer = Completer<List<Conversation>>();
      final delayedRepo = _DelayedChatRepo(completer.future);

      await tester.pumpWidget(
        MaterialApp(
          home: ConversationsScreen(repository: delayedRepo),
        ),
      );
      await tester.pump();

      // Kiểm tra có ConversationsShimmerLoading và không dùng CircularProgressIndicator
      expect(find.byType(ConversationsShimmerLoading), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);

      completer.complete([]);
      await tester.pumpAndSettle();

      // Sau khi tải xong mà rỗng: lập tức hiện danh sách với Trợ lý AI
      expect(find.byType(ConversationsShimmerLoading), findsNothing);
      expect(find.byKey(const Key('ai-assistant-conversation-item')), findsOneWidget);
    });
  });
}
