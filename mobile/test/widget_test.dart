import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('Starter smoke test renders Tripri Starter home page', (WidgetTester tester) async {
    await tester.pumpWidget(const TripriApp());
    await tester.pump();

    // Verify header title and action buttons
    expect(find.text('Tripri Flutter Starter'), findsOneWidget);
    expect(find.text('Dự án Flutter Sẵn Sàng'), findsOneWidget);
    expect(find.text('Test API Backend'), findsOneWidget);
    expect(find.text('Test Notification'), findsOneWidget);
  });
}
