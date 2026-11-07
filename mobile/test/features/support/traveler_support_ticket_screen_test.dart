import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/support/screens/traveler_support_ticket_screen.dart';

void main() {
  testWidgets(
    'submits a service support request and shows the server reference',
    (tester) async {
      String? category;
      await tester.pumpWidget(
        MaterialApp(
          home: TravelerSupportTicketScreen(
            submit: (kind, subject, message) async {
              category = kind;
              return 'SUP-SERVER-123';
            },
          ),
        ),
      );
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'Question about my booking',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'Please help me update the pickup location.',
      );
      await tester.ensureVisible(find.text('Gửi yêu cầu hỗ trợ'));
      await tester.tap(find.text('Gửi yêu cầu hỗ trợ'));
      await tester.pumpAndSettle();
      expect(category, 'BOOKING');
      expect(find.text('Mã yêu cầu: SUP-SERVER-123'), findsOneWidget);
    },
  );
  testWidgets('keeps the text after a submission failure', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: TravelerSupportTicketScreen(
          submit: (_, _, _) async => throw Exception('offline'),
        ),
      ),
    );
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'Question about booking',
    );
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'Please help with the reservation.',
    );
    await tester.ensureVisible(find.text('Gửi yêu cầu hỗ trợ'));
    await tester.tap(find.text('Gửi yêu cầu hỗ trợ'));
    await tester.pumpAndSettle();
    expect(find.text('Please help with the reservation.'), findsOneWidget);
    expect(find.textContaining('Không thể gửi yêu cầu.'), findsOneWidget);
  });
}
