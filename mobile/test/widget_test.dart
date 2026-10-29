import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/splash/widgets/boat_preloader_widget.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('App smoke test renders Tripri SplashScreen with BoatPreloaderWidget', (WidgetTester tester) async {
    await tester.pumpWidget(const TripriApp());
    await tester.pump();

    // Verify Splash branding and BoatPreloader loading state
    expect(find.text('Tripri Travel'), findsOneWidget);
    expect(find.text('Khám phá thế giới • Kết nối đồng hành'), findsOneWidget);
    expect(find.byType(BoatPreloaderWidget), findsOneWidget);
    expect(find.text('LOADING'), findsOneWidget);
    expect(find.text('Khám phá hành trình cùng Tripri'), findsOneWidget);

    // Fast-forward through splash delay
    await tester.pump(const Duration(milliseconds: 2500));
    await tester.pump(const Duration(milliseconds: 500));
  });
}