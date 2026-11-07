import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/chat/widgets/typing_bubble.dart';

void main() {
  testWidgets('shows three animated dots and disposes its ticker', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: TypingBubble())),
    );
    expect(find.text('Đang soạn tin '), findsOneWidget);
    final before = tester
        .widgetList<Opacity>(find.byType(Opacity))
        .map((widget) => widget.opacity)
        .toList();
    expect(before, hasLength(3));
    await tester.pump(const Duration(milliseconds: 200));
    final after = tester
        .widgetList<Opacity>(find.byType(Opacity))
        .map((widget) => widget.opacity)
        .toList();
    expect(after, isNot(before));
    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.takeException(), isNull);
  });
}
