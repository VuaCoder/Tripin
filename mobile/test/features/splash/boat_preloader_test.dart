import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/splash/widgets/boat_preloader_widget.dart';

void main() {
  group('[Splash & Preloader] BoatPreloaderWidget Tests', () {
    testWidgets('renders BoatPreloaderWidget with default texts and animations', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: BoatPreloaderWidget(),
            ),
          ),
        ),
      );

      // Verify presence of Loading text and default subtitle
      expect(find.text('LOADING'), findsOneWidget);
      expect(find.text('Khám phá hành trình cùng Tripri'), findsOneWidget);
      expect(find.text('.'), findsNWidgets(3));

      // Advance animation frames
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 500));
    });

    testWidgets('renders BoatPreloaderWidget with custom subtitle', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: BoatPreloaderWidget(
                subtitle: 'Đang tải dữ liệu chuyến đi...',
              ),
            ),
          ),
        ),
      );

      expect(find.text('LOADING'), findsOneWidget);
      expect(find.text('Đang tải dữ liệu chuyến đi...'), findsOneWidget);
    });
  });
}
