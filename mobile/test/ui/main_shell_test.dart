import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shell/main_shell.dart';
import '../helpers/fakes.dart';

Widget _app(FakeChatSocket socket, {int unread = 0}) => MaterialApp(
      home: MainShell(
        home: const Center(child: Text('Nội dung trang chủ')),
        notificationsRepository: FakeNotificationsRepository(unread: unread),
        socket: socket,
      ),
    );

void main() {
  testWidgets('the navigation bar has the Đơn đặt, Tin nhắn, Trợ lý AI and Thông báo tabs', (tester) async {
    await tester.pumpWidget(_app(FakeChatSocket()));
    await tester.pump();

    for (final label in ['Trang chủ', 'Đơn đặt', 'Tin nhắn', 'Trợ lý AI', 'Thông báo']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('Nội dung trang chủ'), findsOneWidget);
  });

  testWidgets('the notifications tab shows the unread count and raises it live (AC5)', (tester) async {
    final socket = FakeChatSocket();
    await tester.pumpWidget(_app(socket, unread: 3));
    await tester.pump();
    expect(find.text('3'), findsOneWidget);

    socket.notifs.add({'id': 'n1', 'type': 'CHAT_MESSAGE', 'title': 't', 'body': 'b', 'isRead': false, 'createdAt': '2026-10-29T10:00:00.000Z'});
    await tester.pumpAndSettle();
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('no badge when everything is read', (tester) async {
    await tester.pumpWidget(_app(FakeChatSocket()));
    await tester.pump();
    expect(find.byType(Badge), findsOneWidget);
    expect(tester.widget<Badge>(find.byType(Badge)).isLabelVisible, isFalse);
  });
}
